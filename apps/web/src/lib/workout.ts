import {
  buildPrefilledSets,
  nextSetDefaults,
  type ExerciseListItem,
  type ExercisePerformance,
  type MuscleGroup,
  type PlanDayView,
  type PrefillSource,
  type SetType,
  type SyncExercise,
  type SyncSet,
  type WorkoutExerciseView,
  type WorkoutSessionView,
  type WorkoutSetView,
} from '@satzio/shared';
import { liveQuery } from 'dexie';
import { useSyncExternalStore } from 'react';
import { create } from 'zustand';
import { api } from './api';
import { db, type LocalWorkout, type OutboxOp } from './db';
import { uuid } from './ids';
import { applyServerEntity, enqueueInTx, patchVersion, registerSyncHandlers, scheduleFlush } from './sync';

/**
 * WORKOUT-STORE
 * Hält das gerade geöffnete Training normalisiert im Speicher. Jede Änderung:
 *   1. sofort im Zustand (optimistisch, ohne Wartezeit)
 *   2. atomar in IndexedDB: Arbeitskopie + Outbox-Operation
 *   3. Sync-Engine überträgt im Hintergrund
 * Schreibvorgänge werden in einer Warteschlange serialisiert → schnelles
 * Tippen und Navigieren verliert keine Änderungen.
 */

type OpInput = Omit<OutboxOp, 'seq' | 'status' | 'attempts' | 'createdAt' | 'opId' | 'clientTs' | 'sessionId'>;

interface WorkoutState {
  session: LocalWorkout | null;
  loading: boolean;
  open: (id: string) => Promise<LocalWorkout | null>;
  close: () => void;
  setSession: (s: LocalWorkout) => void;
  updateSet: (exId: string, setId: string, patch: Partial<WorkoutSetView>) => void;
  toggleSet: (exId: string, setId: string) => WorkoutSetView | null;
  addSet: (exId: string, init?: Partial<WorkoutSetView>) => string | null;
  duplicateSet: (exId: string, setId: string) => void;
  deleteSet: (exId: string, setId: string) => void;
  addExercise: (ex: ExerciseListItem | { id: string | null; nameDe: string; primaryMuscle: MuscleGroup | null }, opts?: { performance?: ExercisePerformance; restSeconds?: number | null; sets?: Partial<SyncSet>[] }) => string;
  updateExercise: (exId: string, patch: Partial<Pick<WorkoutExerciseView, 'notes' | 'restSeconds' | 'supersetGroup' | 'weightStepKg'>>) => void;
  replaceExercise: (exId: string, ex: { id: string | null; nameDe: string; primaryMuscle: MuscleGroup | null }) => void;
  removeExercise: (exId: string) => void;
  moveExercise: (exId: string, dir: -1 | 1) => void;
  updateSession: (patch: Partial<Pick<WorkoutSessionView, 'name' | 'notes' | 'perceivedExertion' | 'status' | 'pausedAt' | 'pausedSeconds' | 'startedAt'>>) => void;
  finish: (p?: { notes?: string | null; perceivedExertion?: number | null }) => Promise<void>;
  discard: () => Promise<void>;
}

let writeQueue: Promise<unknown> = Promise.resolve();
function queueWrite(fn: () => Promise<unknown>) {
  writeQueue = writeQueue.then(fn).catch((e) => console.error('Lokales Speichern fehlgeschlagen', e));
  return writeQueue;
}

export function flushWrites() {
  return writeQueue;
}

function persist(session: LocalWorkout, ops: OpInput[]) {
  const snapshot = structuredClone(session);
  return queueWrite(async () => {
    await db.transaction('rw', db.workouts, db.outbox, async () => {
      await db.workouts.put(snapshot);
      for (const op of ops) await enqueueInTx({ ...op, sessionId: snapshot.id });
    });
    scheduleFlush(300);
  });
}

const now = () => new Date().toISOString();

function mapSet(session: LocalWorkout, exId: string, setId: string, fn: (s: WorkoutSetView) => WorkoutSetView): LocalWorkout {
  return {
    ...session,
    localUpdatedAt: Date.now(),
    exercises: session.exercises.map((e) => (e.id !== exId ? e : { ...e, sets: e.sets.map((s) => (s.id === setId ? fn(s) : s)) })),
  };
}

function mapExercise(session: LocalWorkout, exId: string, fn: (e: WorkoutExerciseView) => WorkoutExerciseView): LocalWorkout {
  return { ...session, localUpdatedAt: Date.now(), exercises: session.exercises.map((e) => (e.id === exId ? fn(e) : e)) };
}

function toSyncSet(s: WorkoutSetView): SyncSet {
  return {
    id: s.id,
    order: s.order,
    type: s.type,
    weightKg: s.weightKg,
    reps: s.reps,
    completed: s.completed,
    completedAt: s.completedAt,
    targetRepsMin: s.targetRepsMin,
    targetRepsMax: s.targetRepsMax,
    targetWeightKg: s.targetWeightKg,
    weightSource: s.weightSource,
    repsSource: s.repsSource,
    rpe: s.rpe,
  };
}

export function toSyncExercise(e: WorkoutExerciseView): SyncExercise {
  return {
    id: e.id,
    exerciseId: e.exerciseId,
    name: e.name,
    primaryMuscle: e.primaryMuscle,
    order: e.order,
    notes: e.notes,
    restSeconds: e.restSeconds,
    supersetGroup: e.supersetGroup,
    planExerciseId: e.planExerciseId,
    weightStepKg: e.weightStepKg,
    sets: e.sets.map(toSyncSet),
  };
}

function newSet(order: number, init: Partial<WorkoutSetView> = {}): WorkoutSetView {
  return {
    id: uuid(),
    order,
    type: 'working',
    weightKg: null,
    reps: null,
    completed: false,
    completedAt: null,
    targetRepsMin: null,
    targetRepsMax: null,
    targetWeightKg: null,
    weightSource: 'none',
    repsSource: 'none',
    rpe: null,
    version: 0,
    ...init,
  };
}

const setPatchKeys = ['weightKg', 'reps', 'completed', 'completedAt', 'type', 'order', 'rpe', 'weightSource', 'repsSource'] as const;

export const useWorkout = create<WorkoutState>((set, get) => ({
  session: null,
  loading: false,

  async open(id) {
    const cur = get().session;
    if (cur?.id === id) return cur;
    set({ loading: true });
    try {
      let local = await db.workouts.get(id);
      const pending = await db.outbox.where('sessionId').equals(id).count();
      if (!local || pending === 0) {
        try {
          const server = await api<WorkoutSessionView>(`/workouts/${id}`);
          if (!local || pending === 0) {
            local = { ...server, localUpdatedAt: Date.now() };
            await db.workouts.put(local);
          }
        } catch {
          /* offline: lokale Kopie verwenden */
        }
      }
      set({ session: local ?? null, loading: false });
      return local ?? null;
    } catch {
      set({ loading: false });
      return null;
    }
  },

  close() {
    set({ session: null });
  },

  setSession(s) {
    set({ session: s });
  },

  updateSet(exId, setId, patch) {
    const s = get().session;
    if (!s) return;
    const cur = s.exercises.find((e) => e.id === exId)?.sets.find((x) => x.id === setId);
    if (!cur) return;
    const p: Partial<WorkoutSetView> = { ...patch };
    if ('weightKg' in patch && patch.weightKg !== cur.weightKg) p.weightSource = 'manual';
    if ('reps' in patch && patch.reps !== cur.reps) p.repsSource = 'manual';
    const next = mapSet(s, exId, setId, (x) => ({ ...x, ...p }));
    set({ session: next });
    const syncPatch: Record<string, unknown> = {};
    for (const k of setPatchKeys) if (k in p) syncPatch[k] = p[k as keyof typeof p];
    void persist(next, [{ type: 'set.update', entityType: 'set', entityId: setId, baseVersion: cur.version, payload: { id: setId, patch: syncPatch } as never }]);
  },

  toggleSet(exId, setId) {
    const s = get().session;
    const cur = s?.exercises.find((e) => e.id === exId)?.sets.find((x) => x.id === setId);
    if (!s || !cur) return null;
    const completed = !cur.completed;
    const patch: Partial<WorkoutSetView> = { completed, completedAt: completed ? now() : null };
    get().updateSet(exId, setId, patch);
    return { ...cur, ...patch };
  },

  addSet(exId, init) {
    const s = get().session;
    const ex = s?.exercises.find((e) => e.id === exId);
    if (!s || !ex) return null;
    const base = nextSetDefaults(ex.sets);
    const order = ex.sets.reduce((m, x) => Math.max(m, x.order), -1) + 1;
    const created = newSet(order, {
      type: base.type,
      weightKg: base.weightKg,
      reps: base.reps,
      targetRepsMin: base.targetRepsMin,
      targetRepsMax: base.targetRepsMax,
      weightSource: base.weightKg !== null ? 'manual' : 'none',
      repsSource: base.reps !== null ? 'manual' : 'none',
      ...init,
    });
    const next = mapExercise(s, exId, (e) => ({ ...e, sets: [...e.sets, created] }));
    set({ session: next });
    void persist(next, [{ type: 'set.add', entityType: 'set', entityId: created.id, baseVersion: null, payload: { exerciseId: exId, set: toSyncSet(created) } as never }]);
    return created.id;
  },

  duplicateSet(exId, setId) {
    const s = get().session;
    const ex = s?.exercises.find((e) => e.id === exId);
    const src = ex?.sets.find((x) => x.id === setId);
    if (!s || !ex || !src) return;
    // Kopie direkt hinter dem Original einfügen
    const idx = ex.sets.findIndex((x) => x.id === setId);
    const copy = newSet(0, { ...src, id: uuid(), completed: false, completedAt: null, version: 0, weightSource: 'manual', repsSource: 'manual' });
    const sets = [...ex.sets.slice(0, idx + 1), copy, ...ex.sets.slice(idx + 1)].map((x, i) => ({ ...x, order: i }));
    const next = mapExercise(s, exId, (e) => ({ ...e, sets }));
    set({ session: next });
    const ops: OpInput[] = [{ type: 'set.add', entityType: 'set', entityId: copy.id, baseVersion: null, payload: { exerciseId: exId, set: toSyncSet(sets[idx + 1]) } as never }];
    for (const x of sets.slice(idx + 2)) {
      ops.push({ type: 'set.update', entityType: 'set', entityId: x.id, baseVersion: ex.sets.find((o) => o.id === x.id)?.version ?? 0, payload: { id: x.id, patch: { order: x.order } } as never });
    }
    void persist(next, ops);
  },

  deleteSet(exId, setId) {
    const s = get().session;
    const cur = s?.exercises.find((e) => e.id === exId)?.sets.find((x) => x.id === setId);
    if (!s || !cur) return;
    const next = mapExercise(s, exId, (e) => ({ ...e, sets: e.sets.filter((x) => x.id !== setId) }));
    set({ session: next });
    void persist(next, [{ type: 'set.delete', entityType: 'set', entityId: setId, baseVersion: cur.version, payload: { id: setId } as never }]);
  },

  addExercise(ex, opts) {
    const s = get().session;
    if (!s) return '';
    const perf = opts?.performance;
    const userDefaults = 'userDefaults' in ex ? ex.userDefaults : null;
    const prefilled = opts?.sets
      ? null
      : buildPrefilledSets({
          last: perf?.recent[0] ?? null,
          userDefaults: userDefaults ? { defaultWeightKg: userDefaults.defaultWeightKg, defaultReps: userDefaults.defaultReps } : null,
        });
    const sets: WorkoutSetView[] = opts?.sets
      ? opts.sets.map((p, i) => newSet(i, { ...p, id: uuid(), version: 0 } as Partial<WorkoutSetView>))
      : prefilled!.map((p, i) =>
          newSet(i, {
            type: p.type,
            weightKg: p.weightKg,
            reps: p.reps,
            targetRepsMin: p.targetRepsMin,
            targetRepsMax: p.targetRepsMax,
            targetWeightKg: p.targetWeightKg,
            weightSource: p.weightSource,
            repsSource: p.repsSource,
          }),
        );
    const order = s.exercises.reduce((m, e) => Math.max(m, e.order), -1) + 1;
    const entry: WorkoutExerciseView = {
      id: uuid(),
      exerciseId: ex.id,
      name: ex.nameDe,
      primaryMuscle: ex.primaryMuscle,
      order,
      notes: null,
      restSeconds: opts?.restSeconds ?? userDefaults?.defaultRestSeconds ?? null,
      supersetGroup: null,
      planExerciseId: null,
      weightStepKg: userDefaults?.weightStepKg ?? ('weightStepKg' in ex ? ex.weightStepKg : null),
      version: 0,
      sets,
    };
    const next = { ...s, localUpdatedAt: Date.now(), exercises: [...s.exercises, entry] };
    set({ session: next });
    void persist(next, [{ type: 'exercise.add', entityType: 'exercise', entityId: entry.id, baseVersion: null, payload: { sessionId: s.id, exercise: toSyncExercise(entry) } as never }]);
    return entry.id;
  },

  updateExercise(exId, patch) {
    const s = get().session;
    const cur = s?.exercises.find((e) => e.id === exId);
    if (!s || !cur) return;
    const next = mapExercise(s, exId, (e) => ({ ...e, ...patch }));
    set({ session: next });
    void persist(next, [{ type: 'exercise.update', entityType: 'exercise', entityId: exId, baseVersion: cur.version, payload: { id: exId, patch } as never }]);
  },

  replaceExercise(exId, ex) {
    const s = get().session;
    const cur = s?.exercises.find((e) => e.id === exId);
    if (!s || !cur) return;
    const next = mapExercise(s, exId, (e) => ({ ...e, exerciseId: ex.id, name: ex.nameDe, primaryMuscle: ex.primaryMuscle, planExerciseId: null }));
    set({ session: next });
    void persist(next, [
      {
        type: 'exercise.replace',
        entityType: 'exercise',
        entityId: exId,
        baseVersion: cur.version,
        payload: { id: exId, exerciseId: ex.id, name: ex.nameDe, primaryMuscle: ex.primaryMuscle } as never,
      },
    ]);
  },

  removeExercise(exId) {
    const s = get().session;
    const cur = s?.exercises.find((e) => e.id === exId);
    if (!s || !cur) return;
    const next = { ...s, localUpdatedAt: Date.now(), exercises: s.exercises.filter((e) => e.id !== exId) };
    set({ session: next });
    void persist(next, [{ type: 'exercise.delete', entityType: 'exercise', entityId: exId, baseVersion: cur.version, payload: { id: exId } as never }]);
  },

  moveExercise(exId, dir) {
    const s = get().session;
    if (!s) return;
    const list = [...s.exercises].sort((a, b) => a.order - b.order);
    const i = list.findIndex((e) => e.id === exId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const exercises = list.map((e, idx) => ({ ...e, order: idx }));
    const next = { ...s, localUpdatedAt: Date.now(), exercises };
    set({ session: next });
    void persist(next, [{ type: 'exercise.reorder', entityType: 'session', entityId: s.id, baseVersion: null, payload: { sessionId: s.id, order: exercises.map((e) => e.id) } as never }]);
  },

  updateSession(patch) {
    const s = get().session;
    if (!s) return;
    const next = { ...s, ...patch, localUpdatedAt: Date.now() };
    set({ session: next });
    void persist(next, [{ type: 'session.update', entityType: 'session', entityId: s.id, baseVersion: s.version, payload: { id: s.id, patch } as never }]);
  },

  async finish(p) {
    const s = get().session;
    if (!s) return;
    const endedAt = now();
    let pausedSeconds = s.pausedSeconds;
    if (s.status === 'paused' && s.pausedAt) pausedSeconds += Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 1000);
    const wasCompleted = s.status === 'completed';
    const next: LocalWorkout = {
      ...s,
      status: 'completed',
      endedAt: wasCompleted ? s.endedAt : endedAt,
      pausedAt: null,
      pausedSeconds,
      notes: p?.notes !== undefined ? p.notes : s.notes,
      perceivedExertion: p?.perceivedExertion !== undefined ? p.perceivedExertion : s.perceivedExertion,
      localUpdatedAt: Date.now(),
    };
    set({ session: next });
    await persist(next, [
      {
        type: 'session.finish',
        entityType: 'session',
        entityId: s.id,
        baseVersion: s.version,
        payload: { id: s.id, endedAt: next.endedAt ?? endedAt, pausedSeconds, notes: next.notes, perceivedExertion: next.perceivedExertion } as never,
      },
    ]);
  },

  async discard() {
    const s = get().session;
    if (!s) return;
    set({ session: null });
    await queueWrite(async () => {
      await db.transaction('rw', db.workouts, db.outbox, async () => {
        const ops = await db.outbox.where('sessionId').equals(s.id).toArray();
        const neverSent = s.version === 0 && ops.every((o) => o.attempts === 0 && o.status === 'pending');
        await db.workouts.delete(s.id);
        if (neverSent) {
          // Training existiert nur lokal → einfach verwerfen
          await db.outbox.bulkDelete(ops.map((o) => o.seq!));
        } else {
          await enqueueInTx({ type: 'session.delete', entityType: 'session', entityId: s.id, sessionId: s.id, baseVersion: null, payload: { id: s.id } as never });
        }
      });
      scheduleFlush(100);
    });
  },
}));

/* ---------------------- Sync-Rückmeldungen in den Zustand ---------------------- */

registerSyncHandlers({
  ack(sessionId, entityType, entityId, version) {
    const s = useWorkout.getState().session;
    if (!s || s.id !== sessionId) return false;
    const next = structuredClone(s);
    patchVersion(next, entityType, entityId, version);
    useWorkout.setState({ session: next });
    void queueWrite(() => db.workouts.put(structuredClone(next)));
    return true;
  },
  serverEntity(sessionId, entityType, entity) {
    const s = useWorkout.getState().session;
    if (!s || s.id !== sessionId) return false;
    const next = structuredClone(s);
    applyServerEntity(next, entityType, entity);
    useWorkout.setState({ session: next });
    void queueWrite(() => db.workouts.put(structuredClone(next)));
    return true;
  },
  sessionGone(sessionId) {
    void queueWrite(async () => {
      const pending = await db.outbox.where('sessionId').equals(sessionId).count();
      if (pending === 0) await db.workouts.delete(sessionId);
    });
  },
});

/* --------------------------- Training erstellen --------------------------- */

export interface StartOptions {
  name: string;
  planId?: string | null;
  day?: PlanDayView | null;
  performance?: Map<string, ExercisePerformance>;
  exercises?: Map<string, ExerciseListItem>;
  /** Vorhandenes Training als Vorlage ("erneut starten"). */
  copyFrom?: WorkoutSessionView;
}

/** Erstellt ein Training lokal (offline-fähig) inklusive Smart Defaults. */
export async function createWorkout(o: StartOptions): Promise<LocalWorkout> {
  const id = uuid();
  const exercises: WorkoutExerciseView[] = [];
  if (o.day) {
    o.day.exercises.forEach((pe, i) => {
      const perf = o.performance?.get(pe.exerciseId);
      const ud = o.exercises?.get(pe.exerciseId)?.userDefaults ?? null;
      const prefilled = buildPrefilledSets({
        planned: pe.sets.map((s) => ({ type: s.type, repsMin: s.repsMin, repsMax: s.repsMax, targetWeightKg: s.targetWeightKg })),
        last: perf?.recent[0] ?? null,
        userDefaults: ud ? { defaultWeightKg: ud.defaultWeightKg, defaultReps: ud.defaultReps } : null,
      });
      exercises.push({
        id: uuid(),
        exerciseId: pe.exerciseId,
        name: pe.exerciseName,
        primaryMuscle: pe.primaryMuscle,
        order: i,
        notes: pe.notes,
        restSeconds: pe.restSeconds ?? ud?.defaultRestSeconds ?? null,
        supersetGroup: pe.supersetGroup,
        planExerciseId: pe.id,
        weightStepKg: pe.weightStepKg ?? ud?.weightStepKg ?? o.exercises?.get(pe.exerciseId)?.weightStepKg ?? null,
        version: 0,
        sets: prefilled.map((p, si) =>
          newSet(si, {
            type: p.type,
            weightKg: p.weightKg,
            reps: p.reps,
            targetRepsMin: p.targetRepsMin,
            targetRepsMax: p.targetRepsMax,
            targetWeightKg: p.targetWeightKg,
            weightSource: p.weightSource,
            repsSource: p.repsSource,
          }),
        ),
      });
    });
  } else if (o.copyFrom) {
    o.copyFrom.exercises.forEach((e, i) => {
      exercises.push({
        ...e,
        id: uuid(),
        order: i,
        version: 0,
        sets: e.sets.map((x, si) =>
          newSet(si, {
            type: x.type,
            weightKg: x.weightKg,
            reps: x.reps,
            targetRepsMin: x.targetRepsMin,
            targetRepsMax: x.targetRepsMax,
            targetWeightKg: x.targetWeightKg,
            weightSource: (x.weightKg !== null ? 'history' : 'none') as PrefillSource,
            repsSource: (x.reps !== null ? 'history' : 'none') as PrefillSource,
          }),
        ),
      });
    });
  }
  const session: LocalWorkout = {
    id,
    name: o.name,
    status: 'active',
    planId: o.planId ?? null,
    planDayId: o.day?.id ?? null,
    startedAt: now(),
    endedAt: null,
    pausedAt: null,
    pausedSeconds: 0,
    notes: null,
    perceivedExertion: null,
    version: 0,
    updatedAt: now(),
    exercises,
    localUpdatedAt: Date.now(),
  };
  await persist(session, [
    {
      type: 'session.create',
      entityType: 'session',
      entityId: id,
      baseVersion: null,
      payload: {
        session: {
          id,
          name: session.name,
          planId: session.planId,
          planDayId: session.planDayId,
          startedAt: session.startedAt,
          notes: null,
          exercises: exercises.map(toSyncExercise),
        },
      } as never,
    },
  ]);
  useWorkout.setState({ session });
  return session;
}

/** Übernimmt Server-Stände aktiver Trainings, ohne lokale, unsynchronisierte Änderungen zu überschreiben. */
/**
 * Gleicht lokal aktive Trainings mit der Serverliste ab. `fetchedAt` ist der Zeitpunkt der
 * Serverantwort: Lokale Änderungen danach (z. B. gerade gestartetes Training bei noch
 * gecachter /today-Antwort) dürfen von veralteten Daten nicht überschrieben/gelöscht werden.
 */
export async function reconcileActiveSessions(server: WorkoutSessionView[], fetchedAt = Date.now()) {
  await queueWrite(async () => {
    const ids = new Set(server.map((s) => s.id));
    for (const s of server) {
      const local = await db.workouts.get(s.id);
      const pending = await db.outbox.where('sessionId').equals(s.id).count();
      if (!local || (pending === 0 && s.version >= local.version && local.localUpdatedAt <= fetchedAt)) {
        await db.workouts.put({ ...s, localUpdatedAt: Date.now() });
        const cur = useWorkout.getState().session;
        if (cur?.id === s.id && pending === 0) useWorkout.setState({ session: { ...s, localUpdatedAt: Date.now() } });
      }
    }
    // Lokal aktive, bereits synchronisierte Trainings, die der Server nicht mehr als aktiv kennt
    const localActive = await db.workouts.where('status').anyOf('active', 'paused').toArray();
    for (const l of localActive) {
      if (ids.has(l.id) || l.version === 0 || l.localUpdatedAt > fetchedAt) continue;
      const pending = await db.outbox.where('sessionId').equals(l.id).count();
      if (pending === 0) await db.workouts.delete(l.id);
    }
  });
}

/* --------------------------------- Hooks ---------------------------------- */

function useLive<T>(query: () => Promise<T>, deps: string, initial: T): T {
  const store = useLiveStore(query, deps, initial);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

const liveStores = new Map<string, { subscribe: (cb: () => void) => () => void; get: () => unknown }>();
function useLiveStore<T>(query: () => Promise<T>, key: string, initial: T) {
  let s = liveStores.get(key);
  if (!s) {
    let value: unknown = initial;
    const listeners = new Set<() => void>();
    let sub: { unsubscribe: () => void } | null = null;
    s = {
      subscribe(cb) {
        listeners.add(cb);
        if (!sub) {
          sub = liveQuery(query).subscribe({
            next: (v) => {
              value = v;
              listeners.forEach((l) => l());
            },
            error: () => undefined,
          });
        }
        return () => {
          listeners.delete(cb);
          if (!listeners.size && sub) {
            sub.unsubscribe();
            sub = null;
          }
        };
      },
      get: () => value,
    };
    liveStores.set(key, s);
  }
  return s as { subscribe: (cb: () => void) => () => void; get: () => T };
}

const EMPTY: LocalWorkout[] = [];
/** Aktive/pausierte Trainings aus der lokalen DB (reaktiv). */
export function useActiveWorkouts(): LocalWorkout[] {
  return useLive(
    () => db.workouts.where('status').anyOf('active', 'paused').reverse().sortBy('startedAt'),
    'active-workouts',
    EMPTY,
  );
}

export function useOutboxForSession(sessionId: string | undefined): OutboxOp[] {
  return useLive(
    () => (sessionId ? db.outbox.where('sessionId').equals(sessionId).toArray() : Promise.resolve([] as OutboxOp[])),
    `outbox:${sessionId ?? '-'}`,
    [] as OutboxOp[],
  );
}

export type { SetType };
