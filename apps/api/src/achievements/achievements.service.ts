import { Injectable } from '@nestjs/common';
import {
  ACHIEVEMENTS,
  computeWeeklyStreak,
  evaluateAchievements,
  localDateKey,
  type AchievementView,
  type FinishSummary,
} from '@satzio/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AchievementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Volumen je abgeschlossener Einheit (ohne Aufwärmsätze). */
  async sessionVolumes(userId: string): Promise<{ id: string; startedAt: Date; volume: number }[]> {
    const rows = await this.prisma.$queryRaw<{ id: string; startedAt: Date; volume: number | null }[]>`
      SELECT ws.id, ws."startedAt",
             COALESCE(SUM(CASE WHEN s.completed AND s.type <> 'warmup' AND s.reps IS NOT NULL
                          THEN COALESCE(s."weightKg", 0) * s.reps ELSE 0 END), 0)::float8 AS volume
      FROM "WorkoutSession" ws
      LEFT JOIN "WorkoutSessionExercise" e ON e."sessionId" = ws.id
      LEFT JOIN "WorkoutSet" s ON s."sessionExerciseId" = e.id
      WHERE ws."userId" = ${userId}::uuid AND ws.status = 'completed'
      GROUP BY ws.id, ws."startedAt"
      ORDER BY ws."startedAt" ASC`;
    return rows.map((r) => ({ id: r.id, startedAt: r.startedAt, volume: Number(r.volume ?? 0) }));
  }

  async evaluate(userId: string, sessionId: string): Promise<FinishSummary['unlockedAchievements']> {
    const [settings, profile] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    const volumes = await this.sessionVolumes(userId);
    const tz = settings?.timeZone ?? 'Europe/Berlin';
    const streak = computeWeeklyStreak(
      volumes.map((v) => localDateKey(v.startedAt, tz)),
      profile?.trainingDaysPerWeek ?? 0,
      localDateKey(new Date(), tz),
    );
    const current = volumes.find((v) => v.id === sessionId);
    const previousMax = volumes.filter((v) => v.id !== sessionId).reduce((m, v) => Math.max(m, v.volume), 0);
    const stats = {
      workoutCount: volumes.length,
      prCount: profile?.recordCount ?? 0,
      weeksGoalReached: streak.weeksGoalReached,
      longestWeeklyStreak: streak.longest,
      newMaxSessionVolume: !!current && volumes.length >= 2 && current.volume > previousMax && current.volume > 0,
      totalVolumeKg: volumes.reduce((s, v) => s + v.volume, 0),
    };
    const unlocked = await this.prisma.userAchievement.findMany({ where: { userId }, include: { achievement: true } });
    const codes = evaluateAchievements(stats, new Set(unlocked.map((u) => u.achievement.code)));
    if (!codes.length) return [];
    const defs = await this.prisma.achievement.findMany({ where: { code: { in: codes } } });
    for (const d of defs) {
      await this.prisma.userAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: d.id } },
        create: { userId, achievementId: d.id, sessionId },
        update: {},
      });
    }
    return defs.map((d) => ({ code: d.code, title: d.title, description: d.description, icon: d.icon }));
  }

  async list(userId: string): Promise<AchievementView[]> {
    const [defs, unlocked] = await Promise.all([
      this.prisma.achievement.findMany({ orderBy: { sortOrder: 'asc' } }),
      this.prisma.userAchievement.findMany({ where: { userId } }),
    ]);
    const map = new Map(unlocked.map((u) => [u.achievementId, u.unlockedAt]));
    const order = new Map(ACHIEVEMENTS.map((a, i) => [a.code, i]));
    return defs
      .sort((a, b) => (order.get(a.code) ?? 99) - (order.get(b.code) ?? 99))
      .map((d) => ({
        code: d.code,
        title: d.title,
        description: d.description,
        icon: d.icon,
        unlockedAt: map.get(d.id)?.toISOString() ?? null,
      }));
  }
}
