import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, makeApp, registerUser, uuid, type TestUser } from './helpers';

/**
 * Sicherheitstest: Nutzer A darf niemals Daten von Nutzer B lesen oder ändern.
 */
let app: INestApplication;
let a: TestUser;
let b: TestUser;
let bPlanId: string;
let bWorkoutId: string;
let bSetId: string;
let bExerciseEntryId: string;
let bCustomExerciseId: string;
let bBodyId: string;

beforeAll(async () => {
  app = await makeApp();
  a = await registerUser(app, 'alice');
  b = await registerUser(app, 'bob');
  const plan = await api(app, b).post('/plans/from-template', { templateId: 'full-body-2' }).expect(201);
  bPlanId = plan.body.id;
  const w = await api(app, b).post('/workouts', { planDayId: plan.body.days[0].id }).expect(201);
  bWorkoutId = w.body.id;
  bExerciseEntryId = w.body.exercises[0].id;
  bSetId = w.body.exercises[0].sets[0].id;
  const c = await api(app, b).post('/exercises', { nameDe: 'Bobs Geheimübung', primaryMuscle: 'chest', equipment: 'other' }).expect(201);
  bCustomExerciseId = c.body.id;
  const body = await api(app, b).post('/body-weight', { measuredAt: new Date().toISOString(), weightKg: 90 }).expect(201);
  bBodyId = body.body.id;
});
afterAll(async () => {
  await app.close();
});

describe('Account-Isolation', () => {
  it('Pläne von B sind für A unsichtbar und unveränderbar', async () => {
    await api(app, a).get(`/plans/${bPlanId}`).expect(404);
    await api(app, a).put(`/plans/${bPlanId}`, { name: 'x', description: null, scheduleMode: 'flexible', days: [] }).expect(404);
    await api(app, a).delete(`/plans/${bPlanId}`).expect(404);
    await api(app, a).post(`/plans/${bPlanId}/duplicate`).expect(404);
    await api(app, a).post(`/plans/${bPlanId}/activate`).expect(404);
    await api(app, a).get(`/plans/${bPlanId}/export`).expect(404);
    const list = await api(app, a).get('/plans').expect(200);
    expect(list.body.find((p: { id: string }) => p.id === bPlanId)).toBeUndefined();
    await api(app, a).patch('/users/me/profile', { activePlanId: bPlanId }).expect(404);
  });

  it('Workouts von B sind für A unsichtbar und unveränderbar', async () => {
    await api(app, a).get(`/workouts/${bWorkoutId}`).expect(404);
    await api(app, a).post(`/workouts/${bWorkoutId}/finish`).expect(404);
    await api(app, a).patch(`/workouts/${bWorkoutId}`, { name: 'gehackt' }).expect(404);
    await api(app, a).patch(`/workout-sets/${bSetId}`, { weightKg: 999 }).expect(404);
    await api(app, a).delete(`/workout-exercises/${bExerciseEntryId}`).expect(200).then((r) => expect(r.body.status).toBe('not_found'));
    await api(app, a).delete(`/workout-sets/${bSetId}`).expect(200).then((r) => expect(r.body.status).toBe('not_found'));
    const del = await api(app, a).delete(`/workouts/${bWorkoutId}`).expect(200);
    expect(del.body.deleted).toBe(false);
    expect((await api(app, a).get('/workouts/active').expect(200)).body).toHaveLength(0);
    expect((await api(app, a).get('/workouts').expect(200)).body).toHaveLength(0);
    // B sieht unveränderte Daten
    const w = await api(app, b).get(`/workouts/${bWorkoutId}`).expect(200);
    expect(w.body.exercises[0].sets[0].weightKg).toBeNull();
    expect(w.body.name).not.toBe('gehackt');
  });

  it('Sync-Operationen auf fremde Entitäten werden abgewiesen', async () => {
    const res = await api(app, a)
      .post('/sync', {
        deviceId: 'device-alice',
        operations: [
          { opId: uuid(), type: 'set.update', clientTs: new Date().toISOString(), baseVersion: null, payload: { id: bSetId, patch: { weightKg: 1 } } },
          { opId: uuid(), type: 'session.delete', clientTs: new Date().toISOString(), baseVersion: null, payload: { id: bWorkoutId } },
          {
            opId: uuid(),
            type: 'set.add',
            clientTs: new Date().toISOString(),
            baseVersion: null,
            payload: {
              exerciseId: bExerciseEntryId,
              set: { id: uuid(), order: 9, type: 'working', weightKg: 1, reps: 1, completed: true, completedAt: null, targetRepsMin: null, targetRepsMax: null, targetWeightKg: null, weightSource: 'manual', repsSource: 'manual', rpe: null },
            },
          },
          {
            opId: uuid(),
            type: 'session.create',
            clientTs: new Date().toISOString(),
            baseVersion: null,
            payload: { session: { id: bWorkoutId, name: 'Übernahme', planId: null, planDayId: null, startedAt: new Date().toISOString(), notes: null, exercises: [] } },
          },
        ],
      })
      .expect(200);
    expect(res.body.results.map((r: { status: string }) => r.status)).toEqual(['not_found', 'not_found', 'not_found', 'rejected']);
    const w = await api(app, b).get(`/workouts/${bWorkoutId}`).expect(200);
    expect(w.body.name).not.toBe('Übernahme');
  });

  it('eigene Übungen, Körperdaten und Statistiken von B sind privat', async () => {
    await api(app, a).get(`/exercises/${bCustomExerciseId}`).expect(404);
    const list = await api(app, a).get('/exercises').expect(200);
    expect(list.body.find((e: { id: string }) => e.id === bCustomExerciseId)).toBeUndefined();
    await api(app, a).put(`/exercises/${bCustomExerciseId}`, { nameDe: 'Gekapert', primaryMuscle: 'chest', equipment: 'other' }).expect(404);
    await api(app, a).delete(`/exercises/${bCustomExerciseId}`).expect(404);
    await api(app, a).put(`/body-weight/${bBodyId}`, { measuredAt: new Date().toISOString(), weightKg: 50 }).expect(404);
    await api(app, a).delete(`/body-weight/${bBodyId}`).expect(404);
    expect((await api(app, a).get('/body-weight').expect(200)).body).toHaveLength(0);
    expect((await api(app, a).get('/records').expect(200)).body).toHaveLength(0);
    const ov = await api(app, a).get('/analytics/overview?range=all').expect(200);
    expect(ov.body.allTimeWorkouts).toBe(0);
    // Plan von A darf keine fremde eigene Übung referenzieren
    await api(app, a)
      .post('/plans', {
        name: 'x',
        description: null,
        scheduleMode: 'flexible',
        days: [{ id: uuid(), name: 'T', weekday: null, notes: null, exercises: [{ id: uuid(), exerciseId: bCustomExerciseId, restSeconds: null, notes: null, supersetGroup: null, weightStepKg: null, sets: [] }] }],
      })
      .expect(400);
  });

  it('Export enthält nur eigene Daten', async () => {
    const exp = await api(app, a).get('/users/me/export.json').expect(200);
    expect(exp.body.account.username).toBe(a.username);
    expect(exp.body.workouts).toHaveLength(0);
    expect(exp.body.bodyWeight).toHaveLength(0);
  });
});
