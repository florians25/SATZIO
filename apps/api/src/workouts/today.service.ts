import { Injectable } from '@nestjs/common';
import {
  computeWeeklyStreak,
  findMissedWorkouts,
  getNextWorkout,
  getTodayAssignment,
  getWeekPlan,
  localDateKey,
  type ScheduleDay,
  type ScheduleState,
  type TodayView,
  type Weekday,
} from '@satzio/shared';
import { PlansService } from '../plans/plans.service';
import { PrismaService } from '../prisma/prisma.service';
import { sessionInclude, sessionView, summaryView } from './views';

@Injectable()
export class TodayService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plans: PlansService,
  ) {}

  async today(userId: string, dateParam?: string): Promise<TodayView> {
    const [settings, profile] = await Promise.all([
      this.prisma.userSettings.findUnique({ where: { userId } }),
      this.prisma.userProfile.findUnique({ where: { userId } }),
    ]);
    const tz = settings?.timeZone ?? 'Europe/Berlin';
    const today = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : localDateKey(new Date(), tz);

    const plan = profile?.activePlanId ? await this.plans.get(userId, profile.activePlanId).catch(() => null) : null;
    const days: ScheduleDay[] = (plan?.days ?? []).map((d) => ({ id: d.id, name: d.name, order: d.order, weekday: d.weekday as Weekday | null }));
    const state: ScheduleState = plan
      ? { mode: plan.schedule.mode, nextDayIndex: plan.schedule.nextDayIndex, paused: plan.schedule.paused, overrides: plan.schedule.overrides }
      : { mode: 'flexible', nextDayIndex: 0, paused: false, overrides: {} };

    const since = new Date(Date.now() - 400 * 86400_000);
    const [activeRows, completed] = await Promise.all([
      this.prisma.workoutSession.findMany({
        where: { userId, status: { in: ['active', 'paused'] } },
        include: sessionInclude,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.workoutSession.findMany({
        where: { userId, status: 'completed', startedAt: { gte: since } },
        select: { id: true, startedAt: true, planDayId: true },
        orderBy: { startedAt: 'desc' },
      }),
    ]);

    const completedByDate: Record<string, string[]> = {};
    const doneDates = new Set<string>();
    for (const c of completed) {
      const k = localDateKey(c.startedAt, tz);
      doneDates.add(k);
      if (c.planDayId) (completedByDate[k] ??= []).push(c.planDayId);
    }

    const todayIds = completed.filter((c) => localDateKey(c.startedAt, tz) === today).map((c) => c.id);
    const completedTodayRows = todayIds.length
      ? await this.prisma.workoutSession.findMany({ where: { id: { in: todayIds } }, include: sessionInclude, orderBy: { startedAt: 'asc' } })
      : [];

    const next = plan ? getNextWorkout(days, state, today) : null;
    const missed = plan ? findMissedWorkouts(days, state, completedByDate, today) : [];
    const week = getWeekPlan(days, state, today).map((w) => ({
      date: w.date,
      weekday: w.weekday,
      type: w.assignment.type,
      dayId: w.assignment.type === 'workout' ? w.assignment.day.id : null,
      dayName: w.assignment.type === 'workout' ? w.assignment.day.name : null,
      done: doneDates.has(w.date),
    }));
    const streak = computeWeeklyStreak(
      completed.map((c) => localDateKey(c.startedAt, tz)),
      profile?.trainingDaysPerWeek ?? 0,
      today,
    );
    return {
      date: today,
      plan,
      assignment: plan ? getTodayAssignment(days, state, today) : { type: 'none' },
      nextWorkout: next ? { date: next.date, dayId: next.day.id, dayName: next.day.name } : null,
      missed: missed.map((m) => ({ date: m.date, dayId: m.day.id, dayName: m.day.name })),
      activeSessions: activeRows.map(sessionView),
      completedToday: completedTodayRows.map((r) => summaryView(r)),
      week,
      streak: { current: streak.current, longest: streak.longest, thisWeekCount: streak.thisWeekCount, weeklyGoal: streak.weeklyGoal },
    };
  }
}
