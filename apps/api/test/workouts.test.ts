import type { INestApplication } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, makeApp, registerUser, uuid, type TestUser } from './helpers';

let app: INestApplication;
let u: TestUser;
let benchId: string;

beforeAll(async () => {
  app = await makeApp();
  u = await registerUser(app, 'wk');
  const list = await api(app, u).get('/exercises').expect(200);
  benchId = list.body.find((e: { slug: string }) => e.slug === 'barbell-bench-press').id;
});
afterAll(async () => {
  await app.close();
});

const set = (order: number, weightKg: number | null, reps: number | null, completed = false) => ({
  id: uuid(),
  order,
  type: 'working' as const,
  weightKg,
  reps,
  completed,
  completedAt: completed ? new Date().toISOString() : null,
  targetRepsMin: 8,
  targetRepsMax: 12,
  targetWeightKg: null,
  weightSource: 'none' as const,
  repsSource: 'plan' as const,
  rpe: null,
});

describe('Übungsbibliothek', () => {
  it('liefert mindestens 150 Übungen mit Details', async () => {
    const list = await api(app, u).get('/exercises').expect(200);
    expect(list.body.length).toBeGreaterThanOrEqual(150);
    const detail = await api(app, u).get(`/exercises/${benchId}`).expect(200);
    expect(detail.body.nameDe).toBe('Bankdrücken');
    expect(detail.body.stepsDe.length).toBeGreaterThan(0);
    expect(detail.body.media[0].isPlaceholder).toBe(true);
  });
  it('filtert nach Muskelgruppe und Equipment, sucht nach Aliasen', async () => {
    const chest = await api(app, u).get('/exercises?muscle=chest&equipment=barbell').expect(200);
    expect(chest.body.every((e: { equipment: string }) => e.equipment === 'barbell')).toBe(true);
    const search = await api(app, u).get('/exercises?q=bench').expect(200);
    expect(search.body.some((e: { slug: string }) => e.slug === 'barbell-bench-press')).toBe(true);
  });
  it('eigene Übungen, Favoriten, individuelle Einstellungen', async () => {
    const c = await api(app, u)
      .post('/exercises', { nameDe: 'Zottman Curls', primaryMuscle: 'biceps', secondaryMuscles: ['forearms'], equipment: 'dumbbell' })
      .expect(201);
    expect(c.body.isCustom).toBe(true);
    await api(app, u).put(`/exercises/${benchId}/favorite`).expect(200);
    const fav = await api(app, u).get('/exercises?favorites=true').expect(200);
    expect(fav.body.map((e: { id: string }) => e.id)).toContain(benchId);
    const s = await api(app, u).patch(`/exercises/${benchId}/settings`, { weightStepKg: 1.25, equipmentSettings: 'Bank Stufe 3' }).expect(200);
    expect(s.body.userSettings.weightStepKg).toBe(1.25);
  });
});

describe('Trainingsplan', () => {
  it('erstellt, bearbeitet (versioniert), dupliziert, archiviert', async () => {
    const dayId = uuid();
    const exId = uuid();
    const created = await api(app, u)
      .post('/plans', {
        name: 'Mein Plan',
        description: null,
        scheduleMode: 'flexible',
        activate: true,
        days: [
          {
            id: dayId,
            name: 'Push',
            weekday: null,
            notes: null,
            exercises: [
              {
                id: exId,
                exerciseId: benchId,
                restSeconds: 120,
                notes: null,
                supersetGroup: null,
                weightStepKg: null,
                sets: [
                  { id: uuid(), type: 'warmup', repsMin: 10, repsMax: 10, targetWeightKg: null },
                  { id: uuid(), type: 'working', repsMin: 8, repsMax: 12, targetWeightKg: 60 },
                ],
              },
            ],
          },
        ],
      })
      .expect(201);
    expect(created.body.isActive).toBe(true);
    expect(created.body.days[0].exercises[0].sets).toHaveLength(2);
    const input = {
      name: 'Mein Plan v2',
      description: 'Neu',
      scheduleMode: 'fixed',
      changeNote: 'Umbenannt',
      days: [
        { ...created.body.days[0], id: dayId, weekday: 1, exercises: [{ ...created.body.days[0].exercises[0], exerciseId: benchId, weightStepKg: null }] },
        { id: uuid(), name: 'Pull', weekday: 3, notes: null, exercises: [] },
      ].map((d) => ({
        id: d.id,
        name: d.name,
        weekday: d.weekday,
        notes: d.notes,
        exercises: d.exercises.map((e: Record<string, unknown>) => ({
          id: e.id,
          exerciseId: e.exerciseId,
          restSeconds: e.restSeconds,
          notes: e.notes,
          supersetGroup: e.supersetGroup,
          weightStepKg: null,
          sets: e.sets,
        })),
      })),
    };
    const saved = await api(app, u).put(`/plans/${created.body.id}`, input).expect(200);
    expect(saved.body.name).toBe('Mein Plan v2');
    expect(saved.body.days).toHaveLength(2);
    expect(saved.body.days[0].exercises[0].id).toBe(exId); // stabile IDs
    const versions = await api(app, u).get(`/plans/${created.body.id}/versions`).expect(200);
    expect(versions.body.length).toBe(2);
    const dup = await api(app, u).post(`/plans/${created.body.id}/duplicate`).expect(201);
    expect(dup.body.id).not.toBe(created.body.id);
    expect(dup.body.days[0].exercises[0].id).not.toBe(exId);
    const arch = await api(app, u).patch(`/plans/${dup.body.id}/archive`, { archived: true }).expect(200);
    expect(arch.body.archived).toBe(true);
    const list = await api(app, u).get('/plans').expect(200);
    expect(list.body.find((p: { id: string }) => p.id === dup.body.id)).toBeUndefined();
    // Export / Import zum Teilen
    const exp = await api(app, u).get(`/plans/${created.body.id}/export`).expect(200);
    expect(exp.body.format).toBe('satzio-plan');
    const other = await registerUser(app, 'share');
    const imp = await api(app, other).post('/plans/import', exp.body).expect(201);
    expect(imp.body.days[0].exercises[0].exerciseId).toBe(benchId);
  });

  it('Vorlagen enthalten keine erfundenen Gewichte', async () => {
    const t = await api(app, u).get('/plans/templates').expect(200);
    expect(t.body.length).toBe(11);
    const plan = await api(app, u).post('/plans/from-template', { templateId: 'upper-lower', activate: false }).expect(201);
    const weights = plan.body.days.flatMap((d: { exercises: { sets: { targetWeightKg: number | null }[] }[] }) =>
      d.exercises.flatMap((e) => e.sets.map((s) => s.targetWeightKg)),
    );
    expect(weights.every((w: number | null) => w === null)).toBe(true);
  });
});

describe('Workout-Ablauf mit Smart Defaults', () => {
  it('Training starten, Gewicht ändern, Satz abhaken, Satz hinzufügen, abschließen, Historie', async () => {
    const user = await registerUser(app, 'flow');
    const plan = await api(app, user).post('/plans/from-template', { templateId: 'push-pull-legs' }).expect(201);
    const pushDay = plan.body.days[0];

    // 1. Training
    const w1 = await api(app, user).post('/workouts', { planDayId: pushDay.id }).expect(201);
    expect(w1.body.exercises.length).toBe(pushDay.exercises.length);
    const firstEx = w1.body.exercises[0];
    // Ohne Historie keine erfundenen Gewichte
    expect(firstEx.sets.every((s: { weightKg: number | null }) => s.weightKg === null)).toBe(true);
    const work = firstEx.sets.filter((s: { type: string }) => s.type === 'working');
    for (const [i, s] of work.entries()) {
      await api(app, user).patch(`/workout-sets/${s.id}`, { weightKg: 80 + i * 2.5, reps: 8, completed: true }).expect(200);
    }
    // Satz hinzufügen
    await api(app, user).post(`/workout-exercises/${firstEx.id}/sets`, set(10, 85, 6, true)).expect(201);
    // Abhaken rückgängig
    await api(app, user).patch(`/workout-sets/${work[0].id}`, { completed: false }).expect(200);
    await api(app, user).patch(`/workout-sets/${work[0].id}`, { completed: true }).expect(200);

    const active = await api(app, user).get('/workouts/active').expect(200);
    expect(active.body).toHaveLength(1);
    await api(app, user).post(`/workouts/${w1.body.id}/pause`).expect(200);
    await api(app, user).post(`/workouts/${w1.body.id}/resume`).expect(200);

    const sum = await api(app, user).post(`/workouts/${w1.body.id}/finish`, { perceivedExertion: 7 }).expect(200);
    expect(sum.body.setCount).toBe(work.length + 1);
    expect(sum.body.volumeKg).toBeGreaterThan(0);
    expect(sum.body.unlockedAchievements.map((a: { code: string }) => a.code)).toContain('first_workout');

    // Rotation: nächstes Training ist Pull
    const today = await api(app, user).get('/today').expect(200);
    expect(today.body.assignment.day.name).toBe('Pull');
    expect(today.body.activeSessions).toHaveLength(0);

    // Historie
    const hist = await api(app, user).get('/workouts').expect(200);
    expect(hist.body).toHaveLength(1);
    expect(hist.body[0].name).toBe('Push');
    const search = await api(app, user).get('/workouts?search=Bankdr').expect(200);
    expect(search.body).toHaveLength(1);

    // 2. Training desselben Tages übernimmt letzte Werte
    const w2 = await api(app, user).post('/workouts', { planDayId: pushDay.id }).expect(201);
    const w2work = w2.body.exercises[0].sets.filter((s: { type: string }) => s.type === 'working');
    expect(w2work[0]).toMatchObject({ weightKg: 80, reps: 8, weightSource: 'history' });
    expect(w2work[1]).toMatchObject({ weightKg: 82.5, weightSource: 'history' });
    for (const s of w2work) await api(app, user).patch(`/workout-sets/${s.id}`, { weightKg: 90, reps: 8, completed: true }).expect(200);
    const sum2 = await api(app, user).post(`/workouts/${w2.body.id}/finish`).expect(200);
    expect(sum2.body.newRecords.some((r: { type: string }) => r.type === 'max_weight')).toBe(true);
    expect(sum2.body.comparison.previousSessionId).toBe(w1.body.id);

    // Rekorde werden nach Korrektur neu berechnet (keine Duplikate)
    const recs = await api(app, user).get('/records').expect(200);
    const maxW = recs.body.filter((r: { type: string; exerciseName: string }) => r.type === 'max_weight' && r.exerciseName === firstEx.name);
    expect(maxW).toHaveLength(1);
    expect(maxW[0].value).toBe(90);
    for (const s of w2work) await api(app, user).patch(`/workout-sets/${s.id}`, { weightKg: 70 }).expect(200);
    const recs2 = await api(app, user).get('/records').expect(200);
    expect(recs2.body.find((r: { type: string; exerciseName: string }) => r.type === 'max_weight' && r.exerciseName === firstEx.name).value).toBe(Math.max(85, 80 + (work.length - 1) * 2.5));

    // Statistik nutzt echte Daten
    const ov = await api(app, user).get('/analytics/overview?range=30d').expect(200);
    expect(ov.body.workouts).toBe(2);
    const prog = await api(app, user).get(`/analytics/exercises/${firstEx.exerciseId}?range=all`).expect(200);
    expect(prog.body).toHaveLength(2);
    const weekly = await api(app, user).get('/analytics/weekly?range=30d').expect(200);
    expect(weekly.body.reduce((s: number, w: { workouts: number }) => s + w.workouts, 0)).toBe(2);
    const muscles = await api(app, user).get('/analytics/muscles?range=30d').expect(200);
    expect(muscles.body[0].muscle).toBeTruthy();

    // Workout löschen
    await api(app, user).delete(`/workouts/${w2.body.id}`).expect(200);
    expect((await api(app, user).get('/workouts').expect(200)).body).toHaveLength(1);
  });

  it('freies Training ohne Plan', async () => {
    const w = await api(app, u).post('/workouts', { name: 'Spontan' }).expect(201);
    expect(w.body.exercises).toHaveLength(0);
    const ex = { id: uuid(), exerciseId: benchId, name: 'Bankdrücken', primaryMuscle: 'chest', order: 0, notes: null, restSeconds: 90, supersetGroup: null, planExerciseId: null, weightStepKg: null, sets: [set(0, 60, 10, true)] };
    const r = await api(app, u).post(`/workouts/${w.body.id}/exercises`, ex).expect(201);
    expect(r.body.exercises).toHaveLength(1);
    await api(app, u).post(`/workouts/${w.body.id}/finish`).expect(200);
  });

  it('lehnt ungültige Eingaben ab', async () => {
    const w = await api(app, u).post('/workouts', { name: 'Test' }).expect(201);
    await api(app, u).post(`/workouts/${w.body.id}/exercises`, { name: '' }).expect(400);
    await api(app, u).patch(`/workout-sets/${uuid()}`, { weightKg: -5 }).expect(400);
    await api(app, u).patch(`/workout-sets/${uuid()}`, { weightKg: 5 }).expect(404);
    await api(app, u).get('/workouts/kein-uuid').expect(400);
  });
});

describe('Körpergewicht, Achievements, Export', () => {
  it('Körpergewicht erfassen aktualisiert Profil', async () => {
    const e = await api(app, u).post('/body-weight', { measuredAt: new Date().toISOString(), weightKg: 82.4, notes: 'morgens' }).expect(201);
    const me = await api(app, u).get('/users/me').expect(200);
    expect(me.body.profile.bodyWeightKg).toBe(82.4);
    await api(app, u).delete(`/body-weight/${e.body.id}`).expect(200);
  });

  it('Export (JSON/CSV) und Re-Import ohne Duplikate', async () => {
    const json = await api(app, u).get('/users/me/export.json').expect(200);
    expect(json.body.format).toBe('satzio-export');
    expect(json.body.workouts.length).toBeGreaterThan(0);
    const csv = await api(app, u).get('/users/me/export.csv').expect(200);
    expect(csv.text).toContain('date;workout;exercise');
    const other = await registerUser(app, 'import');
    const imp = await api(app, other).post('/users/me/import', json.body).expect(200);
    expect(imp.body.imported).toBe(json.body.workouts.length);
    const again = await api(app, other).post('/users/me/import', json.body).expect(200);
    expect(again.body.imported).toBe(0);
    expect(again.body.skipped).toBe(json.body.workouts.length);
  });

  it('Achievements werden angezeigt', async () => {
    const a = await api(app, u).get('/achievements').expect(200);
    expect(a.body.length).toBeGreaterThanOrEqual(8);
    expect(a.body.find((x: { code: string }) => x.code === 'first_workout').unlockedAt).toBeTruthy();
  });
});
