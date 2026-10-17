import { Injectable } from '@nestjs/common';
import {
  addDays,
  computeWeeklyStreak,
  estimateOneRepMax,
  localDateKey,
  startOfIsoWeek,
  type AnalyticsOverview,
  type ExerciseProgressPoint,
  type MuscleGroup,
  type MuscleGroupStat,
  type WeeklyPoint,
} from '@satzio/shared';
import { num } from '../common/util';
import { PrismaService } from '../prisma/prisma.service';

export const RANGES = ['7d', '30d', '90d', '6m', '1y', 'all'] as const;
export type Range = (typeof RANGES)[number];

function rangeStart(range: Range): Date | null {
  const day = 86400_000;
  const map: Record<Range, number | null> = { '7d': 7, '30d': 30, '90d': 90, '6m': 182, '1y': 365, all: null };
  const d = map[range];
  return d === null ? null : new Date(Date.now() - d * day);
}

export function parseRange(r?: string): Range {
  return (RANGES as readonly string[]).includes(r ?? '') ? (r as Range) : '90d';
}

interface SessionRow {
  id: string;
  startedAt: Date;
  endedAt: Date | null;
  pausedSeconds: number;
  volume: number;
  sets: number;
  reps: number;
}

/** Alle Kennzahlen stammen ausschließlich aus gespeicherten Trainingsdaten. */
@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async tz(userId: string) {
    const s = await this.prisma.userSettings.findUnique({ where: { userId }, select: { timeZone: true } });
    return s?.timeZone ?? 'Europe/Berlin';
  }

  private async sessions(userId: string, from: Date | null): Promise<SessionRow[]> {
    const rows = await this.prisma.$queryRaw<
      { id: string; startedAt: Date; endedAt: Date | null; pausedSeconds: number; volume: number; sets: bigint; reps: bigint }[]
    >`
      SELECT ws.id, ws."startedAt", ws."endedAt", ws."pausedSeconds",
        COALESCE(SUM(CASE WHEN s.completed AND s.type <> 'warmup' AND s.reps IS NOT NULL THEN COALESCE(s."weightKg",0) * s.reps ELSE 0 END),0)::float8 AS volume,
        COUNT(s.id) FILTER (WHERE s.completed) AS sets,
        COALESCE(SUM(s.reps) FILTER (WHERE s.completed), 0) AS reps
      FROM "WorkoutSession" ws
      LEFT JOIN "WorkoutSessionExercise" e ON e."sessionId" = ws.id
      LEFT JOIN "WorkoutSet" s ON s."sessionExerciseId" = e.id
      WHERE ws."userId" = ${userId}::uuid AND ws.status = 'completed'
        AND (${from}::timestamptz IS NULL OR ws."startedAt" >= ${from}::timestamptz)
      GROUP BY ws.id
      ORDER BY ws."startedAt" ASC`;
    return rows.map((r) => ({ ...r, volume: Number(r.volume), sets: Number(r.sets), reps: Number(r.reps) }));
  }

  async overview(userId: string, range: Range): Promise<AnalyticsOverview> {
    const from = rangeStart(range);
    const [tz, profile, inRange, all, prCount] = await Promise.all([
      this.tz(userId),
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.sessions(userId, from),
      this.prisma.workoutSession.findMany({ where: { userId, status: 'completed' }, select: { startedAt: true } }),
      this.prisma.personalRecord.count({
        where: { userId, ...(from ? { achievedAt: { gte: from } } : {}) },
      }),
    ]);
    const durations = inRange
      .filter((s) => s.endedAt)
      .map((s) => Math.max(0, (s.endedAt!.getTime() - s.startedAt.getTime()) / 60000 - s.pausedSeconds / 60));
    const firstDate = from ?? inRange[0]?.startedAt ?? new Date();
    const weeks = Math.max(1, (Date.now() - firstDate.getTime()) / (7 * 86400_000));
    const streak = computeWeeklyStreak(
      all.map((s) => localDateKey(s.startedAt, tz)),
      profile?.trainingDaysPerWeek ?? 0,
      localDateKey(new Date(), tz),
    );
    return {
      range,
      workouts: inRange.length,
      totalVolumeKg: Math.round(inRange.reduce((s, x) => s + x.volume, 0)),
      totalSets: inRange.reduce((s, x) => s + x.sets, 0),
      totalReps: inRange.reduce((s, x) => s + x.reps, 0),
      avgDurationMinutes: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      workoutsPerWeek: Math.round((inRange.length / weeks) * 10) / 10,
      prCount,
      streak: { current: streak.current, longest: streak.longest, thisWeekCount: streak.thisWeekCount, weeklyGoal: streak.weeklyGoal },
      allTimeWorkouts: all.length,
    };
  }

  /** Volumen, Sätze und Einheiten pro Kalenderwoche (lückenlos, auch Wochen ohne Training). */
  async weekly(userId: string, range: Range): Promise<WeeklyPoint[]> {
    const [tz, rows] = await Promise.all([this.tz(userId), this.sessions(userId, rangeStart(range))]);
    if (!rows.length) return [];
    const map = new Map<string, WeeklyPoint>();
    for (const r of rows) {
      const wk = startOfIsoWeek(localDateKey(r.startedAt, tz));
      const p = map.get(wk) ?? { week: wk, workouts: 0, volumeKg: 0, sets: 0 };
      p.workouts++;
      p.volumeKg += r.volume;
      p.sets += r.sets;
      map.set(wk, p);
    }
    const start = rangeStart(range);
    let cursor = startOfIsoWeek(localDateKey(start ?? rows[0].startedAt, tz));
    const end = startOfIsoWeek(localDateKey(new Date(), tz));
    const out: WeeklyPoint[] = [];
    while (cursor <= end) {
      const p = map.get(cursor) ?? { week: cursor, workouts: 0, volumeKg: 0, sets: 0 };
      out.push({ ...p, volumeKg: Math.round(p.volumeKg) });
      cursor = addDays(cursor, 7);
    }
    return out;
  }

  async exerciseProgress(userId: string, exerciseId: string, range: Range): Promise<ExerciseProgressPoint[]> {
    const from = rangeStart(range);
    const [tz, entries] = await Promise.all([
      this.tz(userId),
      this.prisma.workoutSessionExercise.findMany({
        where: { exerciseId, session: { userId, status: 'completed', ...(from ? { startedAt: { gte: from } } : {}) } },
        include: { sets: true, session: { select: { id: true, startedAt: true } } },
        orderBy: { session: { startedAt: 'asc' } },
      }),
    ]);
    const bySession = new Map<string, ExerciseProgressPoint>();
    for (const e of entries) {
      const p =
        bySession.get(e.session.id) ??
        ({ date: localDateKey(e.session.startedAt, tz), sessionId: e.session.id, maxWeightKg: null, est1rmKg: null, volumeKg: 0, bestSet: null } as ExerciseProgressPoint);
      for (const s of e.sets) {
        if (!s.completed || s.type === 'warmup' || s.reps === null) continue;
        const w = num(s.weightKg) ?? 0;
        p.volumeKg += w * s.reps;
        if (w > 0 && (p.maxWeightKg === null || w > p.maxWeightKg)) {
          p.maxWeightKg = w;
          p.bestSet = { weightKg: w, reps: s.reps };
        }
        const e1 = estimateOneRepMax(w, s.reps);
        if (e1 !== null && (p.est1rmKg === null || e1 > p.est1rmKg)) p.est1rmKg = e1;
      }
      bySession.set(e.session.id, p);
    }
    return [...bySession.values()].map((p) => ({ ...p, volumeKg: Math.round(p.volumeKg) })).filter((p) => p.volumeKg > 0 || p.maxWeightKg !== null);
  }

  /** Übungen, zu denen Verlaufsdaten existieren (für die Auswahl im Diagramm). */
  async trainedExercises(userId: string) {
    const rows = await this.prisma.$queryRaw<{ exerciseId: string; name: string; sessions: bigint; last: Date }[]>`
      SELECT e."exerciseId", MAX(e."exerciseName") AS name, COUNT(DISTINCT ws.id) AS sessions, MAX(ws."startedAt") AS last
      FROM "WorkoutSessionExercise" e JOIN "WorkoutSession" ws ON ws.id = e."sessionId"
      WHERE ws."userId" = ${userId}::uuid AND ws.status = 'completed' AND e."exerciseId" IS NOT NULL
      GROUP BY e."exerciseId" ORDER BY COUNT(DISTINCT ws.id) DESC, MAX(ws."startedAt") DESC`;
    return rows.map((r) => ({ exerciseId: r.exerciseId, name: r.name, sessions: Number(r.sessions), lastTrained: r.last.toISOString() }));
  }

  /** Sätze je Muskelgruppe (primär voll, sekundär halb gewichtet). */
  async muscles(userId: string, range: Range): Promise<MuscleGroupStat[]> {
    const from = rangeStart(range);
    const rows = await this.prisma.$queryRaw<{ muscle: MuscleGroup; role: string; sets: bigint; volume: number; last: Date }[]>`
      SELECT m.muscle, m.role::text AS role,
        COUNT(s.id) AS sets,
        COALESCE(SUM(COALESCE(s."weightKg",0) * COALESCE(s.reps,0)),0)::float8 AS volume,
        MAX(ws."startedAt") AS last
      FROM "WorkoutSet" s
      JOIN "WorkoutSessionExercise" e ON e.id = s."sessionExerciseId"
      JOIN "WorkoutSession" ws ON ws.id = e."sessionId"
      JOIN "ExerciseMuscle" m ON m."exerciseId" = e."exerciseId"
      WHERE ws."userId" = ${userId}::uuid AND ws.status = 'completed' AND s.completed AND s.type <> 'warmup'
        AND (${from}::timestamptz IS NULL OR ws."startedAt" >= ${from}::timestamptz)
      GROUP BY m.muscle, m.role`;
    const map = new Map<MuscleGroup, MuscleGroupStat>();
    for (const r of rows) {
      const f = r.role === 'primary' ? 1 : 0.5;
      const cur = map.get(r.muscle) ?? { muscle: r.muscle, sets: 0, volumeKg: 0, lastTrained: null };
      cur.sets += Number(r.sets) * f;
      cur.volumeKg += Number(r.volume) * f;
      const last = r.last.toISOString();
      if (!cur.lastTrained || last > cur.lastTrained) cur.lastTrained = last;
      map.set(r.muscle, cur);
    }
    return [...map.values()]
      .map((m) => ({ ...m, sets: Math.round(m.sets * 10) / 10, volumeKg: Math.round(m.volumeKg) }))
      .sort((a, b) => b.sets - a.sets);
  }

  /** Trainingstage für die Kalenderansicht. */
  async calendar(userId: string, month: string) {
    const m = /^(\d{4})-(\d{2})$/.exec(month);
    const now = new Date();
    const y = m ? Number(m[1]) : now.getUTCFullYear();
    const mo = m ? Number(m[2]) : now.getUTCMonth() + 1;
    const from = new Date(Date.UTC(y, mo - 1, 1) - 2 * 86400_000);
    const to = new Date(Date.UTC(y, mo, 1) + 2 * 86400_000);
    const [tz, rows] = await Promise.all([
      this.tz(userId),
      this.prisma.workoutSession.findMany({
        where: { userId, status: 'completed', startedAt: { gte: from, lt: to } },
        select: { id: true, name: true, startedAt: true },
        orderBy: { startedAt: 'asc' },
      }),
    ]);
    const prefix = `${y}-${String(mo).padStart(2, '0')}`;
    return rows
      .map((r) => ({ id: r.id, name: r.name, date: localDateKey(r.startedAt, tz) }))
      .filter((r) => r.date.startsWith(prefix));
  }
}
