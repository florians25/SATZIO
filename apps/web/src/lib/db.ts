import Dexie, { type Table } from 'dexie';
import type { SyncOperation, WorkoutSessionView } from '@satzio/shared';

/**
 * Lokale Datenbank (IndexedDB via Dexie).
 * - workouts: Arbeitskopie aktiver und bearbeiteter Trainings (offline-fähig)
 * - outbox:   persistente Mutationswarteschlange für den Server-Sync
 * - conflicts: Konflikte, die der Nutzer entscheiden muss
 * - kv:       Query-Cache, Nutzerdaten, Geräte-ID, Timer usw.
 * Versionierung: Bei Schemaänderungen neue Dexie-Version mit Upgrade-Funktion
 * anlegen – lokale Daten bleiben bei App-Updates erhalten.
 */
export type LocalWorkout = WorkoutSessionView & {
  /** Lokaler Änderungszeitpunkt (ms). */
  localUpdatedAt: number;
};

export type OutboxStatus = 'pending' | 'conflict' | 'failed';

export interface OutboxOp {
  seq?: number;
  opId: string;
  type: SyncOperation['type'];
  payload: SyncOperation['payload'];
  baseVersion: number | null;
  clientTs: string;
  entityType: 'session' | 'exercise' | 'set';
  entityId: string;
  sessionId: string;
  status: OutboxStatus;
  attempts: number;
  lastError?: string;
  createdAt: number;
}

export interface ConflictEntry {
  opId: string;
  sessionId: string;
  entityType: 'session' | 'exercise' | 'set';
  entityId: string;
  serverEntity: unknown;
  createdAt: number;
}

export interface KvEntry {
  key: string;
  value: unknown;
}

class SatzioDB extends Dexie {
  workouts!: Table<LocalWorkout, string>;
  outbox!: Table<OutboxOp, number>;
  conflicts!: Table<ConflictEntry, string>;
  kv!: Table<KvEntry, string>;

  constructor() {
    super('satzio');
    this.version(1).stores({
      workouts: 'id, status, startedAt',
      outbox: '++seq, &opId, status, sessionId, entityId',
      conflicts: 'opId, sessionId, entityId',
      kv: 'key',
    });
  }
}

export const db = new SatzioDB();

export async function kvGet<T>(key: string): Promise<T | undefined> {
  try {
    return (await db.kv.get(key))?.value as T | undefined;
  } catch {
    return undefined;
  }
}

export async function kvSet(key: string, value: unknown) {
  try {
    await db.kv.put({ key, value });
  } catch {
    /* Speicher nicht verfügbar (z. B. privater Modus) */
  }
}

export async function kvDel(key: string) {
  try {
    await db.kv.delete(key);
  } catch {
    /* ignore */
  }
}

/** Alle lokalen Daten des Nutzers löschen (Logout/Kontowechsel). */
export async function clearLocalData() {
  await db.transaction('rw', [db.workouts, db.outbox, db.conflicts, db.kv], async () => {
    await db.workouts.clear();
    await db.outbox.clear();
    await db.conflicts.clear();
    const keep = new Set(['deviceId']);
    const keys = (await db.kv.toCollection().primaryKeys()) as string[];
    await db.kv.bulkDelete(keys.filter((k) => !keep.has(k)));
  });
}

export async function getDeviceId(): Promise<string> {
  let id = await kvGet<string>('deviceId');
  if (!id) {
    id = `web-${crypto.getRandomValues(new Uint32Array(4)).join('').slice(0, 24)}`;
    await kvSet('deviceId', id);
  }
  return id;
}

/** Bittet den Browser, den Speicher nicht automatisch zu leeren. */
export async function requestPersistentStorage() {
  try {
    if (navigator.storage?.persist && !(await navigator.storage.persisted())) await navigator.storage.persist();
  } catch {
    /* nicht unterstützt */
  }
}
