import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, makeApp, registerUser, uuid, type TestUser } from './helpers';

let app: INestApplication;
let u: TestUser;
let benchId: string;

beforeAll(async () => {
  app = await makeApp();
  u = await registerUser(app, 'sync');
  const list = await api(app, u).get('/exercises').expect(200);
  benchId = list.body.find((e: { slug: string }) => e.slug === 'barbell-bench-press').id;
});
afterAll(async () => {
  await app.close();
});

const now = () => new Date().toISOString();
const mkSet = (order: number, weightKg: number | null, reps: number | null) => ({
  id: uuid(),
  order,
  type: 'working',
  weightKg,
  reps,
  completed: false,
  completedAt: null,
  targetRepsMin: null,
  targetRepsMax: null,
  targetWeightKg: null,
  weightSource: 'none',
  repsSource: 'none',
  rpe: null,
});

function offlineSession() {
  const sessionId = uuid();
  const exId = uuid();
  const sets = [mkSet(0, 60, 10), mkSet(1, 60, 10)];
  return {
    sessionId,
    exId,
    sets,
    create: {
      opId: uuid(),
      type: 'session.create',
      clientTs: now(),
      baseVersion: null,
      payload: {
        session: {
          id: sessionId,
          name: 'Offline Push',
          planId: null,
          planDayId: null,
          startedAt: now(),
          notes: null,
          exercises: [
            { id: exId, exerciseId: benchId, name: 'Bankdrücken', primaryMuscle: 'chest', order: 0, notes: null, restSeconds: 90, supersetGroup: null, planExerciseId: null, weightStepKg: null, sets },
          ],
        },
      },
    },
  };
}

describe('Offline-Synchronisation', () => {
  it('verarbeitet eine offline erfasste Warteschlange in Reihenfolge', async () => {
    const s = offlineSession();
    const extra = mkSet(2, 65, 8);
    const ops = [
      s.create,
      { opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: s.sets[0].id, patch: { weightKg: 62.5, completed: true } } },
      { opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: s.sets[0].id, patch: { reps: 12 } } },
      { opId: uuid(), type: 'set.add', clientTs: now(), baseVersion: null, payload: { exerciseId: s.exId, set: extra } },
      { opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: extra.id, patch: { completed: true } } },
      { opId: uuid(), type: 'set.delete', clientTs: now(), baseVersion: 1, payload: { id: s.sets[1].id } },
      { opId: uuid(), type: 'session.finish', clientTs: now(), baseVersion: 1, payload: { id: s.sessionId, endedAt: now() } },
    ];
    const res = await api(app, u).post('/sync', { deviceId: 'device-A-123', operations: ops }).expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(Array(7).fill('applied'));
    const finish = res.body.results[6];
    expect(finish.summary.setCount).toBe(2);
    const w = await api(app, u).get(`/workouts/${s.sessionId}`).expect(200);
    expect(w.body.status).toBe('completed');
    expect(w.body.exercises[0].sets.map((x: { weightKg: number; reps: number }) => [x.weightKg, x.reps])).toEqual([
      [62.5, 12],
      [65, 8],
    ]);
  });

  it('doppelte Sync-Requests erzeugen keine doppelten Sätze (Idempotenz)', async () => {
    const s = offlineSession();
    const add = { opId: uuid(), type: 'set.add', clientTs: now(), baseVersion: null, payload: { exerciseId: s.exId, set: mkSet(5, 70, 5) } };
    const body = { deviceId: 'device-A-123', operations: [s.create, add] };
    const r1 = await api(app, u).post('/sync', body).expect(200);
    expect(r1.body.results.map((r: { status: string }) => r.status)).toEqual(['applied', 'applied']);
    // Retry nach Verbindungsabbruch: identische Operationen
    const r2 = await api(app, u).post('/sync', body).expect(200);
    expect(r2.body.results.map((r: { status: string }) => r.status)).toEqual(['duplicate', 'duplicate']);
    // Paralleler Doppel-Request
    const add2 = { opId: uuid(), type: 'set.add', clientTs: now(), baseVersion: null, payload: { exerciseId: s.exId, set: mkSet(6, 72.5, 5) } };
    await Promise.all([
      api(app, u).post('/sync', { deviceId: 'device-A-123', operations: [add2] }),
      api(app, u).post('/sync', { deviceId: 'device-A-123', operations: [add2] }),
    ]);
    const w = await api(app, u).get(`/workouts/${s.sessionId}`).expect(200);
    expect(w.body.exercises[0].sets).toHaveLength(4);
  });

  it('erkennt Konflikte zwischen Geräten und überschreibt nicht stillschweigend', async () => {
    const s = offlineSession();
    await api(app, u).post('/sync', { deviceId: 'device-A-123', operations: [s.create] }).expect(200);
    const setId = s.sets[0].id;
    // Gerät B ändert den Satz (kennt Version 1)
    const b = await api(app, u)
      .post('/sync', { deviceId: 'device-B-456', operations: [{ opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: setId, patch: { weightKg: 100 } } }] })
      .expect(200);
    expect(b.body.results[0]).toMatchObject({ status: 'applied', version: 2 });
    // Gerät A war offline und ändert denselben Satz auf Basis von Version 1 → Konflikt
    const conflictOp = { opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: setId, patch: { weightKg: 70 } } };
    const a = await api(app, u).post('/sync', { deviceId: 'device-A-123', operations: [conflictOp] }).expect(200);
    expect(a.body.results[0].status).toBe('conflict');
    expect(a.body.results[0].serverEntity.weightKg).toBe(100);
    let w = await api(app, u).get(`/workouts/${s.sessionId}`).expect(200);
    expect(w.body.exercises[0].sets[0].weightKg).toBe(100);
    // Nutzer entscheidet "lokal behalten": erneut mit aktueller Basisversion senden
    const resolved = await api(app, u)
      .post('/sync', { deviceId: 'device-A-123', operations: [{ ...conflictOp, opId: uuid(), baseVersion: 2 }] })
      .expect(200);
    expect(resolved.body.results[0].status).toBe('applied');
    w = await api(app, u).get(`/workouts/${s.sessionId}`).expect(200);
    expect(w.body.exercises[0].sets[0].weightKg).toBe(70);
  });

  it('eigene aufeinanderfolgende Änderungen desselben Geräts sind kein Konflikt', async () => {
    const s = offlineSession();
    const setId = s.sets[0].id;
    const ops = [1, 2, 3].map((i) => ({ opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: setId, patch: { reps: i } } }));
    const r = await api(app, u).post('/sync', { deviceId: 'device-A-123', operations: [s.create, ...ops] }).expect(200);
    expect(r.body.results.every((x: { status: string }) => x.status === 'applied')).toBe(true);
  });

  it('validiert Sync-Payloads', async () => {
    await api(app, u).post('/sync', { deviceId: 'x', operations: [] }).expect(400);
    await api(app, u)
      .post('/sync', { deviceId: 'device-A-123', operations: [{ opId: 'kaputt', type: 'set.update', clientTs: now(), baseVersion: null, payload: {} }] })
      .expect(400);
  });
});
