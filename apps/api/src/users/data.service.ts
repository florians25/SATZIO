import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ExerciseMatcher, MUSCLE_GROUPS, SET_TYPES, parseDecimal, sharedPlanSchema, type MuscleGroup, type SetType } from '@satzio/shared';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { dec, num } from '../common/util';
import { ExercisesService } from '../exercises/exercises.service';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from '../workouts/records.service';
import { parseCsv, toCsv } from './csv';
import { loadUserView } from './user-view';

const CSV_HEADER = ['date', 'workout', 'exercise', 'set', 'type', 'weight_kg', 'reps', 'completed', 'rpe', 'notes'];

const importSetSchema = z.object({
  type: z.enum(SET_TYPES).default('working'),
  weightKg: z.number().min(0).max(2000).nullable(),
  reps: z.number().int().min(0).max(1000).nullable(),
  completed: z.boolean().default(true),
  rpe: z.number().min(1).max(10).nullable().optional(),
});
const importWorkoutSchema = z.object({
  name: z.string().trim().min(1).max(120),
  startedAt: z.string().datetime({ offset: true }),
  endedAt: z.string().datetime({ offset: true }).nullable().optional(),
  pausedSeconds: z.number().int().min(0).optional(),
  notes: z.string().max(4000).nullable().optional(),
  perceivedExertion: z.number().int().min(1).max(10).nullable().optional(),
  exercises: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(120),
        slug: z.string().max(120).nullable().optional(),
        primaryMuscle: z.enum(MUSCLE_GROUPS).nullable().optional(),
        notes: z.string().max(2000).nullable().optional(),
        sets: z.array(importSetSchema).max(50),
      }),
    )
    .max(60),
});
export const importJsonSchema = z.object({
  format: z.literal('satzio-export'),
  version: z.literal(1),
  workouts: z.array(importWorkoutSchema).max(20000).default([]),
  bodyWeight: z
    .array(z.object({ measuredAt: z.string().datetime({ offset: true }), weightKg: z.number().min(20).max(400).nullable(), notes: z.string().max(1000).nullable().optional() }))
    .max(20000)
    .default([]),
  plans: z.array(z.unknown()).max(200).default([]),
});
type ImportWorkout = z.infer<typeof importWorkoutSchema>;

@Injectable()
export class DataService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exercises: ExercisesService,
    private readonly plans: PlansService,
    private readonly records: RecordsService,
  ) {}

  /* --------------------------------- Export --------------------------------- */

  async exportJson(userId: string) {
    const user = await loadUserView(this.prisma, userId);
    const [workouts, custom, userEx, favorites, prs, body, achievements, planList] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where: { userId },
        include: { exercises: { orderBy: { order: 'asc' }, include: { sets: { orderBy: { order: 'asc' } }, exercise: { select: { slug: true, ownerId: true } } } } },
        orderBy: { startedAt: 'asc' },
      }),
      this.prisma.exercise.findMany({ where: { ownerId: userId }, include: { muscles: true } }),
      this.prisma.userExercise.findMany({ where: { userId }, include: { exercise: { select: { slug: true, nameDe: true } } } }),
      this.prisma.exerciseFavorite.findMany({ where: { userId }, include: { exercise: { select: { slug: true, nameDe: true } } } }),
      this.records.list(userId),
      this.prisma.bodyWeightEntry.findMany({ where: { userId }, orderBy: { measuredAt: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
      this.prisma.workoutPlan.findMany({ where: { userId }, select: { id: true } }),
    ]);
    const plans = [];
    for (const p of planList) plans.push(await this.plans.exportShared(userId, p.id));
    const social = await this.exportSocial(userId);
    return {
      format: 'satzio-export' as const,
      version: 1 as const,
      exportedAt: new Date().toISOString(),
      account: { username: user.username, email: user.email, createdAt: user.createdAt, emailVerified: user.emailVerified },
      profile: user.profile,
      settings: user.settings,
      customExercises: custom.map((e) => ({
        name: e.nameDe,
        primaryMuscle: e.primaryMuscle,
        secondaryMuscles: e.muscles.filter((m) => m.role === 'secondary').map((m) => m.muscle),
        equipment: e.equipment,
        description: e.descriptionDe,
        steps: e.stepsDe,
      })),
      exerciseSettings: userEx.map((u) => ({
        exercise: u.exercise.nameDe,
        slug: u.exercise.slug,
        weightStepKg: num(u.weightStepKg),
        defaultWeightKg: num(u.defaultWeightKg),
        defaultReps: u.defaultReps,
        defaultRestSeconds: u.defaultRestSeconds,
        equipmentSettings: u.equipmentSettings,
        notes: u.notes,
      })),
      favorites: favorites.map((f) => f.exercise.nameDe),
      plans,
      workouts: workouts.map((w) => ({
        name: w.name,
        status: w.status,
        startedAt: w.startedAt.toISOString(),
        endedAt: w.endedAt?.toISOString() ?? null,
        pausedSeconds: w.pausedSeconds,
        notes: w.notes,
        perceivedExertion: w.perceivedExertion,
        exercises: w.exercises.map((e) => ({
          name: e.exerciseName,
          slug: e.exercise && !e.exercise.ownerId ? e.exercise.slug : null,
          primaryMuscle: e.primaryMuscle,
          notes: e.notes,
          sets: e.sets.map((s) => ({ type: s.type, weightKg: num(s.weightKg), reps: s.reps, completed: s.completed, rpe: num(s.rpe) })),
        })),
      })),
      personalRecords: prs.map((r) => ({ ...r, note: r.type === 'est_1rm' ? 'Schätzung (Epley)' : undefined })),
      bodyWeight: body.map((b) => ({
        measuredAt: b.measuredAt.toISOString(),
        weightKg: num(b.weightKg),
        bodyFatPct: num(b.bodyFatPct),
        measurements: b.measurements,
        notes: b.notes,
      })),
      achievements: achievements.map((a) => ({ code: a.achievement.code, title: a.achievement.title, unlockedAt: a.unlockedAt.toISOString() })),
      ...social,
    };
  }

  /** Soziale Daten: Freunde (nur Benutzernamen) und eigene bzw. erhaltene Trainingseinladungen. */
  private async exportSocial(userId: string) {
    const [friendships, participations] = await Promise.all([
      this.prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        include: { requester: { select: { username: true } }, addressee: { select: { username: true } } },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.trainingInviteParticipant.findMany({
        where: { userId },
        include: { invite: { include: { host: { select: { username: true } } } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      friends: friendships.map((f) => {
        const outgoing = f.requesterId === userId;
        return {
          username: outgoing ? f.addressee.username : f.requester.username,
          status: f.status,
          direction: outgoing ? 'sent' : 'received',
          createdAt: f.createdAt.toISOString(),
          respondedAt: f.respondedAt?.toISOString() ?? null,
        };
      }),
      trainingInvites: participations.map((p) => ({
        title: p.invite.title,
        startsAt: p.invite.startsAt.toISOString(),
        location: p.invite.location,
        note: p.invite.note,
        host: p.invite.host.username,
        isHost: p.invite.hostId === userId,
        inviteStatus: p.invite.status,
        myStatus: p.status,
        linkedWorkout: !!p.sessionId,
      })),
    };
  }

  async exportCsv(userId: string): Promise<string> {
    const workouts = await this.prisma.workoutSession.findMany({
      where: { userId, status: 'completed' },
      include: { exercises: { orderBy: { order: 'asc' }, include: { sets: { orderBy: { order: 'asc' } } } } },
      orderBy: { startedAt: 'asc' },
    });
    const rows: (string | number | boolean | null)[][] = [CSV_HEADER];
    for (const w of workouts) {
      for (const e of w.exercises) {
        e.sets.forEach((s, i) => {
          rows.push([
            w.startedAt.toISOString(),
            w.name,
            e.exerciseName,
            i + 1,
            s.type,
            num(s.weightKg),
            s.reps,
            s.completed,
            num(s.rpe),
            i === 0 ? e.notes : null,
          ]);
        });
      }
    }
    return toCsv(rows);
  }

  /* --------------------------------- Import --------------------------------- */

  private async resolveExercise(
    userId: string,
    matcher: ExerciseMatcher<{ id: string; nameDe: string; nameEn: string | null; aliases: string[] }>,
    bySlug: Map<string, string>,
    name: string,
    slug: string | null | undefined,
    muscle: MuscleGroup | null | undefined,
  ): Promise<{ id: string; name: string; muscle: MuscleGroup | null }> {
    if (slug && bySlug.has(slug)) return { id: bySlug.get(slug)!, name, muscle: muscle ?? null };
    const best = matcher.best(name, 0.9);
    if (best) return { id: best.exercise.id, name, muscle: muscle ?? null };
    const custom = await this.exercises.findOrCreateCustom(userId, name, muscle ?? 'full_body');
    return { id: custom.id, name, muscle: custom.primaryMuscle };
  }

  /**
   * Importiert historische Workouts als abgeschlossene Einheiten.
   * Bereits vorhandene Einheiten (gleicher Name + Startzeit) werden übersprungen.
   */
  async importWorkouts(userId: string, workouts: ImportWorkout[]) {
    const lib = await this.prisma.exercise.findMany({
      where: { archivedAt: null, OR: [{ ownerId: null }, { ownerId: userId }] },
      select: { id: true, slug: true, nameDe: true, nameEn: true, aliases: true },
    });
    const matcher = new ExerciseMatcher(lib);
    const bySlug = new Map(lib.map((l) => [l.slug, l.id]));
    let imported = 0;
    let skipped = 0;
    const touched = new Set<string>();
    for (const w of workouts) {
      const startedAt = new Date(w.startedAt);
      const exists = await this.prisma.workoutSession.findFirst({ where: { userId, name: w.name, startedAt } });
      if (exists) {
        skipped++;
        continue;
      }
      const exercises: Prisma.WorkoutSessionExerciseCreateWithoutSessionInput[] = [];
      for (const [i, e] of w.exercises.entries()) {
        const r = await this.resolveExercise(userId, matcher, bySlug, e.name, e.slug, e.primaryMuscle);
        touched.add(r.id);
        exercises.push({
          id: randomUUID(),
          exercise: { connect: { id: r.id } },
          exerciseName: e.name,
          primaryMuscle: r.muscle,
          order: i,
          notes: e.notes ?? null,
          sets: {
            create: e.sets.map((s, si) => ({
              id: randomUUID(),
              order: si,
              type: s.type,
              weightKg: dec(s.weightKg),
              reps: s.reps,
              completed: s.completed,
              completedAt: s.completed ? startedAt : null,
              rpe: dec(s.rpe ?? null),
              weightSource: 'manual',
              repsSource: 'manual',
            })),
          },
        });
      }
      await this.prisma.workoutSession.create({
        data: {
          id: randomUUID(),
          userId,
          name: w.name,
          status: 'completed',
          startedAt,
          endedAt: w.endedAt ? new Date(w.endedAt) : startedAt,
          pausedSeconds: w.pausedSeconds ?? 0,
          notes: w.notes ?? null,
          perceivedExertion: w.perceivedExertion ?? null,
          lastDeviceId: 'import',
          exercises: { create: exercises },
        },
      });
      imported++;
    }
    await this.records.recompute(userId, [...touched]);
    return { imported, skipped };
  }

  async importJson(userId: string, raw: unknown) {
    const parsed = importJsonSchema.safeParse(raw);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_IMPORT',
        message: 'Die Datei hat kein gültiges SATZIO-Exportformat.',
        details: parsed.error.issues.slice(0, 10).map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
    }
    const data = parsed.data;
    const workouts = await this.importWorkouts(userId, data.workouts);
    let bodyImported = 0;
    for (const b of data.bodyWeight) {
      const measuredAt = new Date(b.measuredAt);
      const exists = await this.prisma.bodyWeightEntry.findFirst({ where: { userId, measuredAt } });
      if (exists) continue;
      await this.prisma.bodyWeightEntry.create({ data: { userId, measuredAt, weightKg: dec(b.weightKg), notes: b.notes ?? null } });
      bodyImported++;
    }
    let plansImported = 0;
    for (const p of data.plans) {
      const sp = sharedPlanSchema.safeParse(p);
      if (sp.success) {
        await this.plans.importShared(userId, sp.data);
        plansImported++;
      }
    }
    return { ...workouts, bodyWeight: bodyImported, plans: plansImported };
  }

  /**
   * CSV-Import (Format wie CSV-Export):
   * date;workout;exercise;set;type;weight_kg;reps;completed;rpe;notes
   */
  async importCsv(userId: string, text: string) {
    const rows = parseCsv(text);
    if (rows.length < 2) throw new BadRequestException({ code: 'INVALID_IMPORT', message: 'Die CSV-Datei enthält keine Daten.' });
    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (name: string) => header.indexOf(name);
    for (const required of ['date', 'workout', 'exercise']) {
      if (idx(required) === -1) {
        throw new BadRequestException({
          code: 'INVALID_IMPORT',
          message: `Spalte „${required}“ fehlt. Erwartet: ${CSV_HEADER.join(';')}`,
        });
      }
    }
    const groups = new Map<string, ImportWorkout>();
    const errors: string[] = [];
    rows.slice(1).forEach((r, i) => {
      const get = (n: string) => (idx(n) >= 0 ? (r[idx(n)] ?? '').trim() : '');
      const dateRaw = get('date');
      const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? `${dateRaw}T12:00:00.000Z` : dateRaw;
      if (Number.isNaN(Date.parse(date))) {
        errors.push(`Zeile ${i + 2}: ungültiges Datum`);
        return;
      }
      const workout = get('workout') || 'Training';
      const key = `${new Date(date).toISOString()}|${workout}`;
      const g = groups.get(key) ?? { name: workout.slice(0, 120), startedAt: new Date(date).toISOString(), exercises: [] };
      const exName = get('exercise').slice(0, 120);
      if (!exName) {
        errors.push(`Zeile ${i + 2}: Übung fehlt`);
        return;
      }
      let ex = g.exercises[g.exercises.length - 1];
      if (!ex || ex.name !== exName) {
        ex = { name: exName, sets: [], notes: get('notes') || null };
        g.exercises.push(ex);
      }
      const type = (SET_TYPES as readonly string[]).includes(get('type')) ? (get('type') as SetType) : 'working';
      const completedRaw = get('completed').toLowerCase();
      ex.sets.push({
        type,
        weightKg: parseDecimal(get('weight_kg')),
        reps: parseDecimal(get('reps')) !== null ? Math.round(parseDecimal(get('reps'))!) : null,
        completed: completedRaw === '' ? true : ['true', '1', 'ja', 'yes', 'x', '✓'].includes(completedRaw),
        rpe: parseDecimal(get('rpe')),
      });
      groups.set(key, g);
    });
    const valid = [...groups.values()].filter((g) => importWorkoutSchema.safeParse(g).success);
    const result = await this.importWorkouts(userId, valid);
    return { ...result, errors: errors.slice(0, 50) };
  }
}
