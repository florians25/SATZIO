import type { SyncOperation, SyncOperationResult, SyncResponse, WorkoutSessionView } from '@satzio/shared';
import { liveQuery } from 'dexie';
import { create } from 'zustand';
import { api, ApiError } from './api';
import { db, getDeviceId, kvSet, type ConflictEntry, type OutboxOp } from './db';
import { uuid } from './ids';
import { queryClient } from './query';

/**
 * SYNC-ENGINE
 * Jede Änderung wird zuerst lokal (IndexedDB) gespeichert und in die
 * persistente Outbox geschrieben. Die Engine überträgt die Outbox geordnet an
 * POST /api/v1/sync. Jede Operation hat eine eindeutige opId → der Server
 * verarbeitet Wiederholungen idempotent (keine doppelten Sätze).
 *
 * Konfliktstrategie: Hat ein anderes Gerät eine Entität seit der dem Client
 * bekannten Version geändert, wendet der Server nichts an und liefert seinen
 * Stand. Die lokale Änderung bleibt erhalten (Status "conflict"), bis der
 * Nutzer entscheidet: "Meine Änderung behalten" oder "Serverstand übernehmen".
 */

export interface SyncState {
  online: boolean;
  syncing: boolean;
  pending: number;
  conflicts: number;
  failed: number;
  lastSyncedAt: number | null;
  lastError: string | null;
}

export const useSyncState = create<SyncState>(() => ({
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  syncing: false,
  pending: 0,
  conflicts: 0,
  failed: 0,
  lastSyncedAt: null,
  lastError: null,
}));

type AckHandler = (sessionId: string, entityType: 'session' | 'exercise' | 'set', entityId: string, version: number) => boolean;
type ServerEntityHandler = (sessionId: string, entityType: 'session' | 'exercise' | 'set', entity: unknown) => boolean;
let ackHandler: AckHandler | null = null;
let serverEntityHandler: ServerEntityHandler | null = null;
let sessionGoneHandler: ((sessionId: string) => void) | null = null;

/** Der Workout-Store registriert sich, damit Versionsupdates in den Speicherzustand fließen. */
export function registerSyncHandlers(h: { ack: AckHandler; serverEntity: ServerEntityHandler; sessionGone: (id: string) => void }) {
  ackHandler = h.ack;
  serverEntityHandler = h.serverEntity;
  sessionGoneHandler = h.sessionGone;
}

const MERGEABLE = new Set(['set.update', 'exercise.update', 'session.update']);

/**
 * Fügt eine Operation hinzu – MUSS innerhalb einer Dexie-Transaktion über
 * db.outbox aufgerufen werden (atomar mit der lokalen Änderung).
 * Aufeinanderfolgende Patches derselben Entität werden zusammengeführt,
 * solange die Operation noch nie gesendet wurde.
 */
export async function enqueueInTx(op: Omit<OutboxOp, 'seq' | 'status' | 'attempts' | 'createdAt' | 'opId' | 'clientTs'>) {
  const clientTs = new Date().toISOString();
  if (MERGEABLE.has(op.type)) {
    const last = await db.outbox.orderBy('seq').last();
    if (last && last.type === op.type && last.entityId === op.entityId && last.status === 'pending' && last.attempts === 0) {
      const lp = last.payload as { patch: Record<string, unknown> };
      const np = op.payload as { patch: Record<string, unknown> };
      await db.outbox.update(last.seq!, { payload: { ...lp, patch: { ...lp.patch, ...np.patch } } as never, clientTs });
      return;
    }
  }
  await db.outbox.add({ ...op, opId: uuid(), clientTs, status: 'pending', attempts: 0, createdAt: Date.now() });
}

async function refreshCounts() {
  try {
    const [pending, conflicts, failed] = await Promise.all([
      db.outbox.where('status').equals('pending').count(),
      db.outbox.where('status').equals('conflict').count(),
      db.outbox.where('status').equals('failed').count(),
    ]);
    useSyncState.setState({ pending, conflicts, failed });
  } catch {
    /* DB nicht verfügbar */
  }
}

let running = false;
let again = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let backoff = 2000;
let canSync: () => boolean = () => true;

export function setSyncGate(fn: () => boolean) {
  canSync = fn;
}

export function scheduleFlush(delay = 0) {
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void flush();
  }, delay);
}

export async function flush(): Promise<void> {
  if (running) {
    again = true;
    return;
  }
  if (!canSync()) return;
  running = true;
  useSyncState.setState({ syncing: true });
  try {
    const deviceId = await getDeviceId();
    for (;;) {
      const batch = (await db.outbox.where('status').equals('pending').sortBy('seq')).slice(0, 50);
      if (!batch.length) break;
      await db.outbox.bulkUpdate(batch.map((o) => ({ key: o.seq!, changes: { attempts: o.attempts + 1 } })));
      const operations = batch.map((o) => ({
        opId: o.opId,
        type: o.type,
        clientTs: o.clientTs,
        baseVersion: o.baseVersion,
        payload: o.payload,
      })) as SyncOperation[];
      const res = await api<SyncResponse>('/sync', { method: 'POST', body: { deviceId, operations } });
      let finished = false;
      for (const r of res.results) {
        const op = batch.find((b) => b.opId === r.opId);
        if (!op) continue;
        if (await handleResult(op, r)) finished = true;
      }
      if (finished) {
        void queryClient.invalidateQueries({ queryKey: ['today'] });
        void queryClient.invalidateQueries({ queryKey: ['history'] });
        void queryClient.invalidateQueries({ queryKey: ['analytics'] });
        void queryClient.invalidateQueries({ queryKey: ['performance'] });
        void queryClient.invalidateQueries({ queryKey: ['records'] });
        void queryClient.invalidateQueries({ queryKey: ['achievements'] });
      }
    }
    backoff = 2000;
    useSyncState.setState({ lastSyncedAt: Date.now(), lastError: null, online: true });
  } catch (e) {
    const network = e instanceof ApiError && (e.isNetwork || e.status >= 500);
    useSyncState.setState({ lastError: e instanceof Error ? e.message : 'Sync fehlgeschlagen' });
    if (network) {
      if (e instanceof ApiError && e.isNetwork) useSyncState.setState({ online: false });
      scheduleFlush(backoff);
      backoff = Math.min(backoff * 2, 60_000);
    } else if (e instanceof ApiError && e.status === 400) {
      // Ungültiger Batch: Operationen einzeln als fehlgeschlagen markieren, damit der Rest weiterläuft
      const batch = (await db.outbox.where('status').equals('pending').sortBy('seq')).slice(0, 50);
      await db.outbox.bulkUpdate(batch.map((o) => ({ key: o.seq!, changes: { status: 'failed' as const, lastError: e.message } })));
    }
  } finally {
    running = false;
    useSyncState.setState({ syncing: false });
    await refreshCounts();
    if (again) {
      again = false;
      void flush();
    }
  }
}

async function handleResult(op: OutboxOp, r: SyncOperationResult): Promise<boolean> {
  switch (r.status) {
    case 'applied':
    case 'duplicate': {
      await db.outbox.delete(op.seq!);
      if (r.version !== undefined) await applyVersion(op.sessionId, r.entityType, r.entityId, r.version);
      if (op.type === 'session.finish') {
        if (r.summary) await kvSet(`summary:${op.sessionId}`, r.summary);
        return true;
      }
      return op.type === 'session.delete';
    }
    case 'not_found': {
      await db.outbox.delete(op.seq!);
      if (r.entityType === 'session' && op.type !== 'session.delete') {
        // Training existiert auf dem Server nicht mehr (z. B. auf anderem Gerät gelöscht)
        sessionGoneHandler?.(op.sessionId);
      }
      return false;
    }
    case 'conflict': {
      await db.outbox.update(op.seq!, { status: 'conflict' });
      const entry: ConflictEntry = {
        opId: op.opId,
        sessionId: op.sessionId,
        entityType: r.entityType,
        entityId: r.entityId,
        serverEntity: r.serverEntity,
        createdAt: Date.now(),
      };
      await db.conflicts.put(entry);
      return false;
    }
    case 'rejected':
    default:
      await db.outbox.update(op.seq!, { status: 'failed', lastError: r.error ?? 'Vom Server abgelehnt' });
      return false;
  }
}

async function applyVersion(sessionId: string, entityType: 'session' | 'exercise' | 'set', entityId: string, version: number) {
  if (ackHandler?.(sessionId, entityType, entityId, version)) return;
  await db.transaction('rw', db.workouts, async () => {
    const w = await db.workouts.get(sessionId);
    if (!w) return;
    patchVersion(w, entityType, entityId, version);
    await db.workouts.put(w);
  });
}

export function patchVersion(w: WorkoutSessionView, entityType: string, entityId: string, version: number) {
  if (entityType === 'session' && w.id === entityId) w.version = Math.max(w.version, version);
  for (const e of w.exercises) {
    if (entityType === 'exercise' && e.id === entityId) e.version = Math.max(e.version, version);
    if (entityType === 'set') for (const s of e.sets) if (s.id === entityId) s.version = Math.max(s.version, version);
  }
}

/* ------------------------------ Konfliktlösung ----------------------------- */

/** Lokale Änderung behalten: erneut senden mit aktueller Serverversion als Basis. */
export async function resolveKeepLocal(opId: string) {
  const c = await db.conflicts.get(opId);
  const op = await db.outbox.where('opId').equals(opId).first();
  if (!c || !op) return;
  const serverVersion = (c.serverEntity as { version?: number } | null)?.version ?? null;
  await db.transaction('rw', db.outbox, db.conflicts, async () => {
    await db.outbox.update(op.seq!, { status: 'pending', baseVersion: serverVersion });
    await db.conflicts.delete(opId);
  });
  await refreshCounts();
  void flush();
}

/** Serverstand übernehmen: lokale Änderung verwerfen und Serverdaten anwenden. */
export async function resolveTakeServer(opId: string) {
  const c = await db.conflicts.get(opId);
  const op = await db.outbox.where('opId').equals(opId).first();
  if (!c) return;
  const handled = serverEntityHandler?.(c.sessionId, c.entityType, c.serverEntity) ?? false;
  await db.transaction('rw', db.outbox, db.conflicts, db.workouts, async () => {
    if (op) await db.outbox.delete(op.seq!);
    await db.conflicts.delete(opId);
    if (!handled) {
      const w = await db.workouts.get(c.sessionId);
      if (w) {
        applyServerEntity(w, c.entityType, c.serverEntity);
        await db.workouts.put(w);
      }
    }
  });
  await refreshCounts();
}

export function applyServerEntity(w: WorkoutSessionView, entityType: string, entity: unknown) {
  const ent = entity as Record<string, unknown> & { id: string };
  if (!ent) return;
  if (entityType === 'session') {
    Object.assign(w, ent);
  } else if (entityType === 'exercise') {
    const i = w.exercises.findIndex((e) => e.id === ent.id);
    if (i >= 0) w.exercises[i] = { ...w.exercises[i], ...(ent as object) } as never;
  } else if (entityType === 'set') {
    for (const e of w.exercises) {
      const i = e.sets.findIndex((s) => s.id === ent.id);
      if (i >= 0) e.sets[i] = { ...e.sets[i], ...(ent as object) } as never;
    }
  }
}

/** Fehlgeschlagene Operation verwerfen. */
export async function discardFailed(seq: number) {
  await db.outbox.delete(seq);
  await refreshCounts();
}

export async function retryFailed() {
  await db.outbox.where('status').equals('failed').modify({ status: 'pending', lastError: undefined });
  await refreshCounts();
  void flush();
}

/* --------------------------------- Start ---------------------------------- */

let started = false;
export function startSyncEngine() {
  if (started) return;
  started = true;
  void refreshCounts();
  window.addEventListener('online', () => {
    useSyncState.setState({ online: true });
    backoff = 2000;
    void flush();
  });
  window.addEventListener('offline', () => useSyncState.setState({ online: false }));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void flush();
  });
  // Zähler aktuell halten, wenn sich die Outbox ändert
  liveQuery(() => db.outbox.count()).subscribe({ next: () => void refreshCounts(), error: () => undefined });
  setInterval(() => {
    if (useSyncState.getState().pending > 0) void flush();
  }, 30_000);
  void flush();
}
