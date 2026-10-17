import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiMock = vi.fn();
vi.mock('./api', () => ({
  api: (...args: unknown[]) => apiMock(...args),
  ApiError: class ApiError extends Error {
    constructor(public status: number, public code: string, message: string) {
      super(message);
    }
    get isNetwork() {
      return this.status === 0;
    }
  },
}));

import { ApiError } from './api';
import { db } from './db';
import { enqueueInTx, flush, resolveKeepLocal, useSyncState } from './sync';

async function add(op: Parameters<typeof enqueueInTx>[0]) {
  await db.transaction('rw', db.outbox, () => enqueueInTx(op));
}

const setUpdate = (id: string, patch: Record<string, unknown>, baseVersion = 1) =>
  ({ type: 'set.update', entityType: 'set', entityId: id, sessionId: 's1', baseVersion, payload: { id, patch } }) as const;

beforeEach(async () => {
  apiMock.mockReset();
  await db.outbox.clear();
  await db.conflicts.clear();
  await db.workouts.clear();
  useSyncState.setState({ pending: 0, conflicts: 0, failed: 0 });
});

describe('Outbox', () => {
  it('führt aufeinanderfolgende Änderungen am selben Satz zusammen', async () => {
    await add(setUpdate('a', { weightKg: 80 }) as never);
    await add(setUpdate('a', { reps: 8 }) as never);
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect((ops[0].payload as { patch: object }).patch).toEqual({ weightKg: 80, reps: 8 });
  });

  it('verändert bereits gesendete Operationen nie (Idempotenz bei Retry)', async () => {
    await add(setUpdate('a', { weightKg: 80 }) as never);
    const first = (await db.outbox.toArray())[0];
    await db.outbox.update(first.seq!, { attempts: 1 });
    await add(setUpdate('a', { reps: 8 }) as never);
    expect(await db.outbox.count()).toBe(2);
  });

  it('führt nicht über andere Entitäten hinweg zusammen (Reihenfolge bleibt erhalten)', async () => {
    await add(setUpdate('a', { weightKg: 80 }) as never);
    await add(setUpdate('b', { weightKg: 60 }) as never);
    await add(setUpdate('a', { reps: 8 }) as never);
    expect(await db.outbox.count()).toBe(3);
  });
});

describe('Sync-Engine', () => {
  it('entfernt bestätigte Operationen und übernimmt Serverversionen', async () => {
    await db.workouts.put({
      id: 's1', name: 'T', status: 'active', planId: null, planDayId: null, startedAt: new Date().toISOString(), endedAt: null, pausedAt: null,
      pausedSeconds: 0, notes: null, perceivedExertion: null, version: 1, updatedAt: '', localUpdatedAt: 0,
      exercises: [{ id: 'e1', exerciseId: null, name: 'X', primaryMuscle: null, order: 0, notes: null, restSeconds: null, supersetGroup: null, planExerciseId: null, weightStepKg: null, version: 1,
        sets: [{ id: 'a', order: 0, type: 'working', weightKg: 80, reps: 8, completed: false, completedAt: null, targetRepsMin: null, targetRepsMax: null, targetWeightKg: null, weightSource: 'manual', repsSource: 'manual', rpe: null, version: 1 }] }],
    });
    await add(setUpdate('a', { weightKg: 82.5 }) as never);
    const op = (await db.outbox.toArray())[0];
    apiMock.mockResolvedValueOnce({ results: [{ opId: op.opId, status: 'applied', entityType: 'set', entityId: 'a', version: 2 }], serverTime: '' });
    await flush();
    expect(await db.outbox.count()).toBe(0);
    const w = await db.workouts.get('s1');
    expect(w!.exercises[0].sets[0].version).toBe(2);
    const body = apiMock.mock.calls[0][1].body;
    expect(body.operations[0]).toMatchObject({ opId: op.opId, type: 'set.update', baseVersion: 1 });
  });

  it('behält Änderungen bei Netzwerkfehlern und sendet dieselbe opId erneut', async () => {
    await add(setUpdate('a', { weightKg: 90 }) as never);
    apiMock.mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline'));
    await flush();
    const ops = await db.outbox.toArray();
    expect(ops).toHaveLength(1);
    expect(ops[0].attempts).toBe(1);
    apiMock.mockResolvedValueOnce({ results: [{ opId: ops[0].opId, status: 'duplicate', entityType: 'set', entityId: 'a', version: 2 }], serverTime: '' });
    await flush();
    expect(apiMock.mock.calls[1][1].body.operations[0].opId).toBe(ops[0].opId);
    expect(await db.outbox.count()).toBe(0);
  });

  it('Konflikte werden nicht überschrieben, sondern zur Entscheidung vorgelegt', async () => {
    await add(setUpdate('a', { weightKg: 70 }) as never);
    const op = (await db.outbox.toArray())[0];
    apiMock.mockResolvedValueOnce({
      results: [{ opId: op.opId, status: 'conflict', entityType: 'set', entityId: 'a', serverEntity: { id: 'a', weightKg: 100, version: 3 } }],
      serverTime: '',
    });
    await flush();
    expect((await db.outbox.toArray())[0].status).toBe('conflict');
    expect(await db.conflicts.count()).toBe(1);
    // "Meine Änderung behalten" → erneut senden mit Serverversion als Basis
    apiMock.mockResolvedValueOnce({ results: [{ opId: op.opId, status: 'applied', entityType: 'set', entityId: 'a', version: 4 }], serverTime: '' });
    await resolveKeepLocal(op.opId);
    await new Promise((r) => setTimeout(r, 50));
    expect(apiMock.mock.calls[1][1].body.operations[0].baseVersion).toBe(3);
    expect(await db.conflicts.count()).toBe(0);
  });
});
