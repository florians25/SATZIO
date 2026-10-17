import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  advanceRotation,
  buildPrefilledSets,
  totalReps,
  totalVolume,
  workoutDurationMinutes,
  type FinishSummary,
  type SyncExercise,
  type SyncOperationResult,
  type SyncSession,
  type SyncSet,
  type WorkoutSessionView,
} from '@satzio/shared';
import { randomUUID } from 'node:crypto';
import { AchievementsService } from '../achievements/achievements.service';
import { dec, num } from '../common/util';
import { ExercisesService } from '../exercises/exercises.service';
import { PrismaService } from '../prisma/prisma.service';
import { RecordsService } from './records.service';
import { exerciseView, flatSets, sessionInclude, sessionView, setView, summaryView, type FullSession } from './views';

export interface MutationContext {
  userId: string;
  /** Gerät, von dem die Änderung stammt (für Konflikterkennung). */
  deviceId: string | null;
  /** Dem Client zuletzt bekannte Serverversion der Entität (null = keine Prüfung). */
  baseVersion: number | null;
}

export type MutationResult = Omit<SyncOperationResult, 'opId'>;

/**
 * Konflikt: Die Entität wurde seit dem Stand des Clients von einem ANDEREN
 * Gerät geändert. Die Änderung wird nicht angewendet; der Client erhält den
 * Serverstand und entscheidet (lokal behalten / Server übernehmen).
 */
export class SyncConflictException extends ConflictException {
  constructor(
    public readonly entityType: 'session' | 'exercise' | 'set',
    public readonly entityId: string,
    public readonly serverEntity: unknown,
  ) {
    super({
      code: 'SYNC_CONFLICT',
      message: 'Dieser Eintrag wurde zwischenzeitlich auf einem anderen Gerät geändert.',
      details: { entityType, entityId, serverEntity },
    });
  }
}

function hasConflict(entity: { version: number; lastDeviceId: string | null }, ctx: MutationContext): boolean {
  if (ctx.baseVersion === null) return false;
  return entity.version > ctx.baseVersion && entity.lastDeviceId !== ctx.deviceId;
}

const notFound = (what = 'Training') => new NotFoundException({ code: 'NOT_FOUND', message: `${what} nicht gefunden.` });

function setData(s: SyncSet) {
  return {
    order: s.order,
    type: s.type,
    weightKg: dec(s.weightKg),
    reps: s.reps,
    completed: s.completed,
    completedAt: s.completedAt ? new Date(s.completedAt) : s.completed ? new Date() : null,
    targetRepsMin: s.targetRepsMin,
    targetRepsMax: s.targetRepsMax,
    targetWeightKg: dec(s.targetWeightKg),
    weightSource: s.weightSource,
    repsSource: s.repsSource,
    rpe: dec(s.rpe),
  };
}

@Injectable()
export class WorkoutsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly records: RecordsService,
    private readonly achievements: AchievementsService,
    private readonly exercises: ExercisesService,
  ) {}

  /* --------------------------------- Lesen --------------------------------- */

  private async loadSession(userId: string, id: string): Promise<FullSession> {
    const s = await this.prisma.workoutSession.findFirst({ where: { id, userId }, include: sessionInclude });
    if (!s) throw notFound();
    return s;
  }

  async get(userId: string, id: string): Promise<WorkoutSessionView> {
    return sessionView(await this.loadSession(userId, id));
  }

  async active(userId: string): Promise<WorkoutSessionView[]> {
    const rows = await this.prisma.workoutSession.findMany({
      where: { userId, status: { in: ['active', 'paused'] } },
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
    });
    return rows.map(sessionView);
  }

  async list(
    userId: string,
    q: { search?: string; from?: string; to?: string; limit?: number; before?: string; exerciseId?: string; planDayId?: string },
  ) {
    const where: Prisma.WorkoutSessionWhereInput = { userId, status: 'completed' };
    const and: Prisma.WorkoutSessionWhereInput[] = [];
    if (q.from) and.push({ startedAt: { gte: new Date(q.from) } });
    if (q.to) and.push({ startedAt: { lte: new Date(q.to) } });
    if (q.before) and.push({ startedAt: { lt: new Date(q.before) } });
    if (q.exerciseId) and.push({ exercises: { some: { exerciseId: q.exerciseId } } });
    if (q.planDayId) and.push({ planDayId: q.planDayId });
    if (q.search) {
      const s = q.search.trim().slice(0, 100);
      and.push({
        OR: [
          { name: { contains: s, mode: 'insensitive' } },
          { notes: { contains: s, mode: 'insensitive' } },
          { exercises: { some: { exerciseName: { contains: s, mode: 'insensitive' } } } },
        ],
      });
    }
    if (and.length) where.AND = and;
    const limit = Math.min(Math.max(q.limit ?? 30, 1), 200);
    const rows = await this.prisma.workoutSession.findMany({
      where,
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
      take: limit,
    });
    const recordCounts = await this.prisma.personalRecord.groupBy({
      by: ['sessionId'],
      where: { userId, sessionId: { in: rows.map((r) => r.id) } },
      _count: true,
    });
    const rc = new Map(recordCounts.map((r) => [r.sessionId, r._count]));
    return rows.map((r) => summaryView(r, rc.get(r.id) ?? 0));
  }

  /* -------------------------------- Sitzungen ------------------------------- */

  /** Prüft Übungs-IDs und Plan-Bezüge; unbekannte Übungen bleiben als Schnappschuss ohne Verknüpfung. */
  private async sanitizeSession(userId: string, s: SyncSession) {
    const exIds = [...new Set(s.exercises.map((e) => e.exerciseId).filter((x): x is string => !!x))];
    const visible = new Set(
      (
        await this.prisma.exercise.findMany({
          where: { id: { in: exIds }, OR: [{ ownerId: null }, { ownerId: userId }] },
          select: { id: true },
        })
      ).map((e) => e.id),
    );
    let planId = s.planId;
    let planDayId = s.planDayId;
    if (planId) {
      const plan = await this.prisma.workoutPlan.findFirst({ where: { id: planId, userId }, select: { id: true } });
      if (!plan) planId = null;
    }
    if (planDayId) {
      const day = await this.prisma.workoutPlanDay.findFirst({ where: { id: planDayId, plan: { userId } }, select: { id: true, planId: true } });
      if (!day) planDayId = null;
      else if (!planId) planId = day.planId;
    }
    return { visible, planId, planDayId };
  }

  private exerciseCreate(e: SyncExercise, visible: Set<string>, deviceId: string | null) {
    return {
      id: e.id,
      exerciseId: e.exerciseId && visible.has(e.exerciseId) ? e.exerciseId : null,
      exerciseName: e.name,
      primaryMuscle: e.primaryMuscle,
      planExerciseId: e.planExerciseId,
      order: e.order,
      notes: e.notes,
      restSeconds: e.restSeconds,
      supersetGroup: e.supersetGroup,
      weightStepKg: dec(e.weightStepKg),
      lastDeviceId: deviceId,
      sets: { create: e.sets.map((s) => ({ id: s.id, ...setData(s), lastDeviceId: deviceId })) },
    };
  }

  private async assertNewIds(ids: { sessions?: string[]; exercises?: string[]; sets?: string[] }) {
    const [a, b, c] = await Promise.all([
      ids.sessions?.length ? this.prisma.workoutSession.count({ where: { id: { in: ids.sessions } } }) : 0,
      ids.exercises?.length ? this.prisma.workoutSessionExercise.count({ where: { id: { in: ids.exercises } } }) : 0,
      ids.sets?.length ? this.prisma.workoutSet.count({ where: { id: { in: ids.sets } } }) : 0,
    ]);
    if (a + b + c > 0) throw new BadRequestException({ code: 'ID_CONFLICT', message: 'Die ID wird bereits verwendet.' });
  }

  async createSession(ctx: MutationContext, s: SyncSession): Promise<MutationResult> {
    const existing = await this.prisma.workoutSession.findUnique({ where: { id: s.id } });
    if (existing) {
      if (existing.userId !== ctx.userId) throw new BadRequestException({ code: 'ID_CONFLICT', message: 'Die ID wird bereits verwendet.' });
      return { status: 'duplicate', entityType: 'session', entityId: s.id, version: existing.version };
    }
    await this.assertNewIds({
      exercises: s.exercises.map((e) => e.id),
      sets: s.exercises.flatMap((e) => e.sets.map((x) => x.id)),
    });
    const { visible, planId, planDayId } = await this.sanitizeSession(ctx.userId, s);
    const created = await this.prisma.workoutSession.create({
      data: {
        id: s.id,
        userId: ctx.userId,
        planId,
        planDayId,
        name: s.name,
        status: 'active',
        startedAt: new Date(s.startedAt),
        notes: s.notes,
        lastDeviceId: ctx.deviceId,
        exercises: { create: s.exercises.map((e) => this.exerciseCreate(e, visible, ctx.deviceId)) },
      },
    });
    return { status: 'applied', entityType: 'session', entityId: s.id, version: created.version };
  }

  async updateSession(
    ctx: MutationContext,
    id: string,
    patch: Partial<{
      name: string;
      notes: string | null;
      status: 'active' | 'paused';
      pausedAt: string | null;
      pausedSeconds: number;
      perceivedExertion: number | null;
      startedAt: string;
      endedAt: string | null;
    }>,
  ): Promise<MutationResult> {
    const s = await this.loadSession(ctx.userId, id);
    if (hasConflict(s, ctx)) throw new SyncConflictException('session', id, sessionView(s));
    const data: Prisma.WorkoutSessionUpdateInput = { version: { increment: 1 }, lastDeviceId: ctx.deviceId };
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.notes !== undefined) data.notes = patch.notes;
    if (patch.perceivedExertion !== undefined) data.perceivedExertion = patch.perceivedExertion;
    if (patch.pausedSeconds !== undefined) data.pausedSeconds = patch.pausedSeconds;
    if (patch.pausedAt !== undefined) data.pausedAt = patch.pausedAt ? new Date(patch.pausedAt) : null;
    if (patch.startedAt !== undefined) data.startedAt = new Date(patch.startedAt);
    if (patch.endedAt !== undefined && s.status === 'completed' && patch.endedAt) data.endedAt = new Date(patch.endedAt);
    if (patch.status !== undefined && s.status !== 'completed') {
      data.status = patch.status;
      if (patch.status === 'paused' && patch.pausedAt === undefined) data.pausedAt = new Date();
      if (patch.status === 'active' && s.pausedAt && patch.pausedSeconds === undefined) {
        data.pausedSeconds = s.pausedSeconds + Math.round((Date.now() - s.pausedAt.getTime()) / 1000);
        data.pausedAt = null;
      }
    }
    const updated = await this.prisma.workoutSession.update({ where: { id }, data });
    return { status: 'applied', entityType: 'session', entityId: id, version: updated.version };
  }

  async finishSession(
    ctx: MutationContext,
    p: { id: string; endedAt: string; pausedSeconds?: number; notes?: string | null; perceivedExertion?: number | null },
  ): Promise<MutationResult & { summary: FinishSummary }> {
    const s = await this.loadSession(ctx.userId, p.id);
    if (hasConflict(s, ctx)) throw new SyncConflictException('session', p.id, sessionView(s));
    const firstCompletion = s.status !== 'completed';
    let pausedSeconds = p.pausedSeconds ?? s.pausedSeconds;
    if (p.pausedSeconds === undefined && s.status === 'paused' && s.pausedAt) {
      pausedSeconds += Math.max(0, Math.round((new Date(p.endedAt).getTime() - s.pausedAt.getTime()) / 1000));
    }
    const endedAt = new Date(p.endedAt) < s.startedAt ? s.startedAt : new Date(p.endedAt);
    const updated = await this.prisma.workoutSession.update({
      where: { id: p.id },
      data: {
        status: 'completed',
        endedAt: firstCompletion ? endedAt : s.endedAt ?? endedAt,
        pausedAt: null,
        pausedSeconds,
        ...(p.notes !== undefined ? { notes: p.notes } : {}),
        ...(p.perceivedExertion !== undefined ? { perceivedExertion: p.perceivedExertion } : {}),
        version: { increment: 1 },
        lastDeviceId: ctx.deviceId,
      },
      include: sessionInclude,
    });
    const newRecords = await this.records.recompute(
      ctx.userId,
      updated.exercises.map((e) => e.exerciseId),
      p.id,
    );
    let unlocked: FinishSummary['unlockedAchievements'] = [];
    if (firstCompletion) {
      if (newRecords.length) {
        await this.prisma.userProfile.updateMany({ where: { userId: ctx.userId }, data: { recordCount: { increment: newRecords.length } } });
      }
      unlocked = await this.achievements.evaluate(ctx.userId, p.id);
      await this.advanceSchedule(ctx.userId, updated.planId, updated.planDayId);
    }
    const summary = await this.buildSummary(ctx.userId, updated, newRecords, unlocked);
    return { status: 'applied', entityType: 'session', entityId: p.id, version: updated.version, summary };
  }

  private async advanceSchedule(userId: string, planId: string | null, planDayId: string | null) {
    if (!planId || !planDayId) return;
    const schedule = await this.prisma.trainingSchedule.findFirst({
      where: { planId, userId },
      include: { plan: { include: { days: { select: { id: true, name: true, order: true, weekday: true } } } } },
    });
    if (!schedule) return;
    const next = advanceRotation(
      schedule.plan.days.map((d) => ({ ...d, weekday: d.weekday as never })),
      { mode: schedule.mode, nextDayIndex: schedule.nextDayIndex, paused: schedule.paused, overrides: {} },
      planDayId,
    );
    await this.prisma.trainingSchedule.update({ where: { id: schedule.id }, data: { nextDayIndex: next.nextDayIndex } });
  }

  async buildSummary(
    userId: string,
    s: FullSession,
    newRecords: FinishSummary['newRecords'] = [],
    unlocked: FinishSummary['unlockedAchievements'] = [],
  ): Promise<FinishSummary> {
    const sets = flatSets(s);
    const previous = await this.prisma.workoutSession.findFirst({
      where: {
        userId,
        status: 'completed',
        id: { not: s.id },
        startedAt: { lt: s.startedAt },
        ...(s.planDayId ? { planDayId: s.planDayId } : { name: s.name }),
      },
      include: sessionInclude,
      orderBy: { startedAt: 'desc' },
    });
    const prevSets = previous ? flatSets(previous) : [];
    return {
      sessionId: s.id,
      name: s.name,
      durationMinutes: workoutDurationMinutes(s.startedAt, s.endedAt, s.pausedSeconds),
      exerciseCount: s.exercises.filter((e) => e.sets.some((x) => x.completed)).length,
      setCount: sets.filter((x) => x.completed).length,
      totalReps: totalReps(sets, { includeWarmup: true }),
      volumeKg: totalVolume(sets),
      newRecords,
      unlockedAchievements: unlocked,
      comparison: previous
        ? {
            previousSessionId: previous.id,
            previousVolumeKg: totalVolume(prevSets),
            previousDurationMinutes: workoutDurationMinutes(previous.startedAt, previous.endedAt, previous.pausedSeconds),
            previousCompletedSets: prevSets.filter((x) => x.completed).length,
          }
        : null,
    };
  }

  async summary(userId: string, id: string): Promise<FinishSummary> {
    const s = await this.loadSession(userId, id);
    const records = await this.prisma.personalRecord.findMany({
      where: { userId, sessionId: id },
      include: { exercise: { select: { nameDe: true } } },
    });
    return this.buildSummary(
      userId,
      s,
      records.map((r) => ({
        exerciseId: r.exerciseId,
        exerciseName: r.exercise.nameDe,
        type: r.type,
        value: Number(r.value),
        weightKg: num(r.weightKg),
        reps: r.reps,
      })),
    );
  }

  async deleteSession(ctx: MutationContext, id: string): Promise<MutationResult> {
    const s = await this.prisma.workoutSession.findFirst({ where: { id, userId: ctx.userId }, include: sessionInclude });
    if (!s) return { status: 'not_found', entityType: 'session', entityId: id };
    await this.prisma.workoutSession.delete({ where: { id } });
    if (s.status === 'completed') await this.records.recompute(ctx.userId, s.exercises.map((e) => e.exerciseId));
    return { status: 'applied', entityType: 'session', entityId: id };
  }

  /* --------------------------------- Übungen -------------------------------- */

  private async loadExercise(userId: string, id: string) {
    const e = await this.prisma.workoutSessionExercise.findFirst({
      where: { id, session: { userId } },
      include: { sets: true, session: { select: { id: true, status: true } } },
    });
    if (!e) throw notFound('Übung');
    return e;
  }

  private async afterChange(userId: string, sessionStatus: string, exerciseIds: (string | null)[]) {
    if (sessionStatus === 'completed') await this.records.recompute(userId, exerciseIds);
  }

  async addExercise(ctx: MutationContext, sessionId: string, e: SyncExercise): Promise<MutationResult> {
    const s = await this.prisma.workoutSession.findFirst({ where: { id: sessionId, userId: ctx.userId } });
    if (!s) throw notFound();
    const existing = await this.prisma.workoutSessionExercise.findUnique({ where: { id: e.id }, include: { session: true } });
    if (existing) {
      if (existing.session.userId !== ctx.userId) throw new BadRequestException({ code: 'ID_CONFLICT', message: 'Die ID wird bereits verwendet.' });
      return { status: 'duplicate', entityType: 'exercise', entityId: e.id, version: existing.version };
    }
    await this.assertNewIds({ sets: e.sets.map((x) => x.id) });
    const visible = new Set(
      e.exerciseId
        ? (await this.prisma.exercise.findMany({ where: { id: e.exerciseId, OR: [{ ownerId: null }, { ownerId: ctx.userId }] }, select: { id: true } })).map((x) => x.id)
        : [],
    );
    const created = await this.prisma.workoutSessionExercise.create({
      data: { ...this.exerciseCreate(e, visible, ctx.deviceId), sessionId },
    });
    await this.afterChange(ctx.userId, s.status, [created.exerciseId]);
    return { status: 'applied', entityType: 'exercise', entityId: e.id, version: created.version };
  }

  async updateExercise(
    ctx: MutationContext,
    id: string,
    patch: Partial<{ notes: string | null; restSeconds: number | null; supersetGroup: string | null; weightStepKg: number | null }>,
  ): Promise<MutationResult> {
    const e = await this.loadExercise(ctx.userId, id);
    if (hasConflict(e, ctx)) throw new SyncConflictException('exercise', id, exerciseView(e));
    const updated = await this.prisma.workoutSessionExercise.update({
      where: { id },
      data: {
        ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
        ...(patch.restSeconds !== undefined ? { restSeconds: patch.restSeconds } : {}),
        ...(patch.supersetGroup !== undefined ? { supersetGroup: patch.supersetGroup } : {}),
        ...(patch.weightStepKg !== undefined ? { weightStepKg: dec(patch.weightStepKg) } : {}),
        version: { increment: 1 },
        lastDeviceId: ctx.deviceId,
      },
    });
    return { status: 'applied', entityType: 'exercise', entityId: id, version: updated.version };
  }

  async replaceExercise(
    ctx: MutationContext,
    p: { id: string; exerciseId: string | null; name: string; primaryMuscle: SyncExercise['primaryMuscle'] },
  ): Promise<MutationResult> {
    const e = await this.loadExercise(ctx.userId, p.id);
    if (hasConflict(e, ctx)) throw new SyncConflictException('exercise', p.id, exerciseView(e));
    let exerciseId = p.exerciseId;
    if (exerciseId) {
      const ok = await this.prisma.exercise.findFirst({ where: { id: exerciseId, OR: [{ ownerId: null }, { ownerId: ctx.userId }] } });
      if (!ok) exerciseId = null;
    }
    const updated = await this.prisma.workoutSessionExercise.update({
      where: { id: p.id },
      data: {
        exerciseId,
        exerciseName: p.name,
        primaryMuscle: p.primaryMuscle,
        planExerciseId: null,
        version: { increment: 1 },
        lastDeviceId: ctx.deviceId,
      },
    });
    await this.afterChange(ctx.userId, e.session.status, [e.exerciseId, exerciseId]);
    return { status: 'applied', entityType: 'exercise', entityId: p.id, version: updated.version };
  }

  async deleteExercise(ctx: MutationContext, id: string): Promise<MutationResult> {
    const e = await this.prisma.workoutSessionExercise.findFirst({
      where: { id, session: { userId: ctx.userId } },
      include: { sets: true, session: { select: { status: true } } },
    });
    if (!e) return { status: 'not_found', entityType: 'exercise', entityId: id };
    if (hasConflict(e, ctx)) throw new SyncConflictException('exercise', id, exerciseView(e));
    await this.prisma.workoutSessionExercise.delete({ where: { id } });
    await this.afterChange(ctx.userId, e.session.status, [e.exerciseId]);
    return { status: 'applied', entityType: 'exercise', entityId: id };
  }

  /** Reihenfolge: zuletzt geschriebene Reihenfolge gewinnt (bewusst ohne Konfliktprüfung). */
  async reorderExercises(ctx: MutationContext, sessionId: string, order: string[]): Promise<MutationResult> {
    const s = await this.prisma.workoutSession.findFirst({
      where: { id: sessionId, userId: ctx.userId },
      include: { exercises: { select: { id: true, order: true } } },
    });
    if (!s) throw notFound();
    const known = new Set(s.exercises.map((e) => e.id));
    const ordered = order.filter((id) => known.has(id));
    const rest = s.exercises.filter((e) => !ordered.includes(e.id)).sort((a, b) => a.order - b.order).map((e) => e.id);
    await this.prisma.$transaction(
      [...ordered, ...rest].map((id, i) => this.prisma.workoutSessionExercise.update({ where: { id }, data: { order: i } })),
    );
    return { status: 'applied', entityType: 'session', entityId: sessionId, version: s.version };
  }

  /* ---------------------------------- Sätze --------------------------------- */

  async addSet(ctx: MutationContext, exerciseId: string, set: SyncSet): Promise<MutationResult> {
    const e = await this.loadExercise(ctx.userId, exerciseId);
    const existing = await this.prisma.workoutSet.findUnique({
      where: { id: set.id },
      include: { sessionExercise: { include: { session: { select: { userId: true } } } } },
    });
    if (existing) {
      if (existing.sessionExercise.session.userId !== ctx.userId) {
        throw new BadRequestException({ code: 'ID_CONFLICT', message: 'Die ID wird bereits verwendet.' });
      }
      return { status: 'duplicate', entityType: 'set', entityId: set.id, version: existing.version };
    }
    const created = await this.prisma.workoutSet.create({
      data: { id: set.id, sessionExerciseId: exerciseId, ...setData(set), lastDeviceId: ctx.deviceId },
    });
    await this.afterChange(ctx.userId, e.session.status, [e.exerciseId]);
    return { status: 'applied', entityType: 'set', entityId: set.id, version: created.version };
  }

  async updateSet(
    ctx: MutationContext,
    id: string,
    patch: Partial<Pick<SyncSet, 'weightKg' | 'reps' | 'completed' | 'completedAt' | 'type' | 'order' | 'rpe' | 'weightSource' | 'repsSource'>>,
  ): Promise<MutationResult> {
    const s = await this.prisma.workoutSet.findFirst({
      where: { id, sessionExercise: { session: { userId: ctx.userId } } },
      include: { sessionExercise: { include: { session: { select: { status: true } } } } },
    });
    if (!s) throw notFound('Satz');
    if (hasConflict(s, ctx)) throw new SyncConflictException('set', id, setView(s));
    const data: Prisma.WorkoutSetUpdateInput = { version: { increment: 1 }, lastDeviceId: ctx.deviceId };
    if (patch.weightKg !== undefined) data.weightKg = dec(patch.weightKg);
    if (patch.reps !== undefined) data.reps = patch.reps;
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.order !== undefined) data.order = patch.order;
    if (patch.rpe !== undefined) data.rpe = dec(patch.rpe);
    if (patch.weightSource !== undefined) data.weightSource = patch.weightSource;
    if (patch.repsSource !== undefined) data.repsSource = patch.repsSource;
    if (patch.completed !== undefined) {
      data.completed = patch.completed;
      data.completedAt = patch.completed ? (patch.completedAt ? new Date(patch.completedAt) : new Date()) : null;
    }
    const updated = await this.prisma.workoutSet.update({ where: { id }, data });
    await this.afterChange(ctx.userId, s.sessionExercise.session.status, [s.sessionExercise.exerciseId]);
    return { status: 'applied', entityType: 'set', entityId: id, version: updated.version };
  }

  async deleteSet(ctx: MutationContext, id: string): Promise<MutationResult> {
    const s = await this.prisma.workoutSet.findFirst({
      where: { id, sessionExercise: { session: { userId: ctx.userId } } },
      include: { sessionExercise: { include: { session: { select: { status: true } } } } },
    });
    if (!s) return { status: 'not_found', entityType: 'set', entityId: id };
    if (hasConflict(s, ctx)) throw new SyncConflictException('set', id, setView(s));
    await this.prisma.workoutSet.delete({ where: { id } });
    await this.afterChange(ctx.userId, s.sessionExercise.session.status, [s.sessionExercise.exerciseId]);
    return { status: 'applied', entityType: 'set', entityId: id };
  }

  /* ------------------------- Start mit Smart Defaults ------------------------ */

  /** Baut ein Training serverseitig auf (REST). Die App macht dasselbe lokal/offline. */
  async buildFromPlanDay(userId: string, planDayId: string | null, name?: string): Promise<SyncSession> {
    const sessionId = randomUUID();
    if (!planDayId) {
      return { id: sessionId, name: name || 'Freies Training', planId: null, planDayId: null, startedAt: new Date().toISOString(), notes: null, exercises: [] };
    }
    const day = await this.prisma.workoutPlanDay.findFirst({
      where: { id: planDayId, plan: { userId } },
      include: {
        exercises: { orderBy: { order: 'asc' }, include: { exercise: true, sets: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!day) throw notFound('Trainingstag');
    const performance = new Map((await this.exercises.performance(userId)).map((p) => [p.exerciseId, p]));
    const userEx = new Map(
      (await this.prisma.userExercise.findMany({ where: { userId, exerciseId: { in: day.exercises.map((e) => e.exerciseId) } } })).map((u) => [
        u.exerciseId,
        u,
      ]),
    );
    return {
      id: sessionId,
      name: name || day.name,
      planId: day.planId,
      planDayId: day.id,
      startedAt: new Date().toISOString(),
      notes: null,
      exercises: day.exercises.map((pe, i) => {
        const perf = performance.get(pe.exerciseId);
        const ue = userEx.get(pe.exerciseId);
        const prefilled = buildPrefilledSets({
          planned: pe.sets.map((s) => ({ type: s.type, repsMin: s.repsMin, repsMax: s.repsMax, targetWeightKg: num(s.targetWeightKg) })),
          last: perf?.recent[0] ?? null,
          userDefaults: ue ? { defaultWeightKg: num(ue.defaultWeightKg), defaultReps: ue.defaultReps } : null,
        });
        return {
          id: randomUUID(),
          exerciseId: pe.exerciseId,
          name: pe.exercise.nameDe,
          primaryMuscle: pe.exercise.primaryMuscle,
          order: i,
          notes: pe.notes,
          restSeconds: pe.restSeconds ?? ue?.defaultRestSeconds ?? null,
          supersetGroup: pe.supersetGroup,
          planExerciseId: pe.id,
          weightStepKg: num(pe.weightStepKg) ?? num(ue?.weightStepKg) ?? num(pe.exercise.weightStepKg),
          sets: prefilled.map((p, si) => ({
            id: randomUUID(),
            order: si,
            type: p.type,
            weightKg: p.weightKg,
            reps: p.reps,
            completed: false,
            completedAt: null,
            targetRepsMin: p.targetRepsMin,
            targetRepsMax: p.targetRepsMax,
            targetWeightKg: p.targetWeightKg,
            weightSource: p.weightSource,
            repsSource: p.repsSource,
            rpe: null,
          })),
        };
      }),
    };
  }
}
