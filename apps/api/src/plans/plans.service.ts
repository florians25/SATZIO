import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  WORKOUT_TEMPLATES,
  normalizeIndex,
  type PlanSaveInput,
  type PlanSummaryView,
  type PlanView,
  type ScheduleUpdateInput,
  type SharedPlan,
} from '@satzio/shared';
import { randomUUID } from 'node:crypto';
import { dec, num } from '../common/util';
import { ExercisesService } from '../exercises/exercises.service';
import { PrismaService } from '../prisma/prisma.service';

const planInclude = {
  days: {
    orderBy: { order: 'asc' },
    include: {
      exercises: {
        orderBy: { order: 'asc' },
        include: { exercise: true, sets: { orderBy: { order: 'asc' } } },
      },
    },
  },
  schedule: true,
} satisfies Prisma.WorkoutPlanInclude;

type FullPlan = Prisma.WorkoutPlanGetPayload<{ include: typeof planInclude }>;
type Tx = Prisma.TransactionClient;

/** Versionen innerhalb dieses Zeitfensters werden zusammengefasst (Auto-Save). */
const VERSION_COALESCE_MS = 10 * 60_000;

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly exercises: ExercisesService,
  ) {}

  async activePlanId(userId: string): Promise<string | null> {
    const p = await this.prisma.userProfile.findUnique({ where: { userId }, select: { activePlanId: true } });
    return p?.activePlanId ?? null;
  }

  toView(p: FullPlan, activePlanId: string | null): PlanView {
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      scheduleMode: p.scheduleMode,
      isFavorite: p.isFavorite,
      isActive: p.id === activePlanId,
      archived: p.archivedAt !== null,
      version: p.version,
      sourceTemplate: p.sourceTemplate,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      days: p.days.map((d) => ({
        id: d.id,
        name: d.name,
        order: d.order,
        weekday: d.weekday,
        notes: d.notes,
        exercises: d.exercises.map((e) => ({
          id: e.id,
          exerciseId: e.exerciseId,
          exerciseName: e.exercise.nameDe,
          exerciseSlug: e.exercise.slug,
          primaryMuscle: e.exercise.primaryMuscle,
          equipment: e.exercise.equipment,
          restSeconds: e.restSeconds,
          notes: e.notes,
          supersetGroup: e.supersetGroup,
          weightStepKg: num(e.weightStepKg),
          sets: e.sets.map((s) => ({
            id: s.id,
            type: s.type,
            repsMin: s.repsMin,
            repsMax: s.repsMax,
            targetWeightKg: num(s.targetWeightKg),
          })),
        })),
      })),
      schedule: {
        mode: p.schedule?.mode ?? p.scheduleMode,
        nextDayIndex: p.schedule?.nextDayIndex ?? 0,
        paused: p.schedule?.paused ?? false,
        overrides: (p.schedule?.overrides as Record<string, string | null>) ?? {},
      },
    };
  }

  private async load(userId: string, id: string): Promise<FullPlan> {
    const p = await this.prisma.workoutPlan.findFirst({ where: { id, userId }, include: planInclude });
    if (!p) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Trainingsplan nicht gefunden.' });
    return p;
  }

  async get(userId: string, id: string): Promise<PlanView> {
    const [p, active] = await Promise.all([this.load(userId, id), this.activePlanId(userId)]);
    return this.toView(p, active);
  }

  async list(userId: string, includeArchived: boolean): Promise<PlanSummaryView[]> {
    const [plans, active] = await Promise.all([
      this.prisma.workoutPlan.findMany({
        where: { userId, ...(includeArchived ? {} : { archivedAt: null }) },
        include: { days: { include: { _count: { select: { exercises: true } } } } },
        orderBy: [{ isFavorite: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.activePlanId(userId),
    ]);
    const lastUsed = await this.prisma.workoutSession.groupBy({
      by: ['planId'],
      where: { userId, planId: { in: plans.map((p) => p.id) } },
      _max: { startedAt: true },
    });
    const lastMap = new Map(lastUsed.map((l) => [l.planId, l._max.startedAt]));
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      isFavorite: p.isFavorite,
      isActive: p.id === active,
      archived: p.archivedAt !== null,
      dayCount: p.days.length,
      exerciseCount: p.days.reduce((s, d) => s + d._count.exercises, 0),
      updatedAt: p.updatedAt.toISOString(),
      lastUsedAt: lastMap.get(p.id)?.toISOString() ?? null,
    }));
  }

  /** Stellt sicher, dass alle referenzierten Übungen für den Nutzer sichtbar sind. */
  private async assertExercises(userId: string, input: PlanSaveInput) {
    const ids = [...new Set(input.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)))];
    if (!ids.length) return;
    const found = await this.prisma.exercise.count({ where: { id: { in: ids }, OR: [{ ownerId: null }, { ownerId: userId }] } });
    if (found !== ids.length) {
      throw new BadRequestException({ code: 'UNKNOWN_EXERCISE', message: 'Mindestens eine Übung ist unbekannt.' });
    }
  }

  /** Verhindert, dass Client-IDs fremde Datensätze überschreiben. */
  private async assertIdsFree(tx: Tx, planId: string, input: PlanSaveInput) {
    const dayIds = input.days.map((d) => d.id);
    const exIds = input.days.flatMap((d) => d.exercises.map((e) => e.id));
    const setIds = input.days.flatMap((d) => d.exercises.flatMap((e) => e.sets.map((s) => s.id)));
    const all = [...dayIds, ...exIds, ...setIds];
    if (new Set(all).size !== all.length) {
      throw new BadRequestException({ code: 'DUPLICATE_IDS', message: 'Doppelte IDs im Plan.' });
    }
    const [foreignDays, foreignEx, foreignSets] = await Promise.all([
      tx.workoutPlanDay.count({ where: { id: { in: dayIds }, planId: { not: planId } } }),
      tx.workoutPlanExercise.count({ where: { id: { in: exIds }, day: { planId: { not: planId } } } }),
      tx.plannedSet.count({ where: { id: { in: setIds }, planExercise: { day: { planId: { not: planId } } } } }),
    ]);
    if (foreignDays + foreignEx + foreignSets > 0) {
      throw new ConflictException({ code: 'ID_CONFLICT', message: 'Ungültige IDs im Plan.' });
    }
  }

  private async writeTree(tx: Tx, planId: string, input: PlanSaveInput) {
    await this.assertIdsFree(tx, planId, input);
    const dayIds = input.days.map((d) => d.id);
    await tx.workoutPlanDay.deleteMany({ where: { planId, id: { notIn: dayIds } } });
    for (const [di, d] of input.days.entries()) {
      await tx.workoutPlanDay.upsert({
        where: { id: d.id },
        create: { id: d.id, planId, name: d.name, order: di, weekday: d.weekday, notes: d.notes },
        update: { name: d.name, order: di, weekday: d.weekday, notes: d.notes },
      });
      const exIds = d.exercises.map((e) => e.id);
      await tx.workoutPlanExercise.deleteMany({ where: { dayId: d.id, id: { notIn: exIds } } });
      for (const [ei, e] of d.exercises.entries()) {
        const data = {
          dayId: d.id,
          exerciseId: e.exerciseId,
          order: ei,
          restSeconds: e.restSeconds,
          notes: e.notes,
          supersetGroup: e.supersetGroup,
          weightStepKg: dec(e.weightStepKg),
        };
        await tx.workoutPlanExercise.upsert({ where: { id: e.id }, create: { id: e.id, ...data }, update: data });
        const setIds = e.sets.map((s) => s.id);
        await tx.plannedSet.deleteMany({ where: { planExerciseId: e.id, id: { notIn: setIds } } });
        for (const [si, s] of e.sets.entries()) {
          const lo = s.repsMin !== null && s.repsMax !== null ? Math.min(s.repsMin, s.repsMax) : s.repsMin;
          const hi = s.repsMin !== null && s.repsMax !== null ? Math.max(s.repsMin, s.repsMax) : s.repsMax;
          const sd = { planExerciseId: e.id, order: si, type: s.type, repsMin: lo, repsMax: hi, targetWeightKg: dec(s.targetWeightKg) };
          await tx.plannedSet.upsert({ where: { id: s.id }, create: { id: s.id, ...sd }, update: sd });
        }
      }
    }
  }

  private async snapshot(tx: Tx, planId: string, input: PlanSaveInput, changeNote?: string) {
    const plan = await tx.workoutPlan.findUniqueOrThrow({ where: { id: planId } });
    const latest = await tx.workoutPlanVersion.findFirst({ where: { planId }, orderBy: { version: 'desc' } });
    const snap = { ...input, changeNote: undefined } as unknown as Prisma.InputJsonValue;
    if (latest && !changeNote && Date.now() - latest.createdAt.getTime() < VERSION_COALESCE_MS) {
      await tx.workoutPlanVersion.update({ where: { id: latest.id }, data: { snapshot: snap } });
      return;
    }
    const version = (latest?.version ?? 0) + 1;
    await tx.workoutPlanVersion.create({ data: { planId, version, snapshot: snap, changeNote: changeNote ?? null } });
    await tx.workoutPlan.update({ where: { id: plan.id }, data: { version } });
  }

  async create(
    userId: string,
    input: PlanSaveInput,
    opts: { activate?: boolean; sourceTemplate?: string | null; id?: string } = {},
  ): Promise<PlanView> {
    await this.assertExercises(userId, input);
    const id = opts.id ?? randomUUID();
    await this.prisma.$transaction(
      async (tx) => {
        await tx.workoutPlan.create({
          data: {
            id,
            userId,
            name: input.name,
            description: input.description,
            scheduleMode: input.scheduleMode,
            sourceTemplate: opts.sourceTemplate ?? null,
            version: 0,
          },
        });
        await this.writeTree(tx, id, input);
        await tx.trainingSchedule.create({ data: { userId, planId: id, mode: input.scheduleMode } });
        await this.snapshot(tx, id, input, input.changeNote ?? 'Erstellt');
        if (opts.activate) {
          await tx.userProfile.upsert({ where: { userId }, create: { userId, activePlanId: id }, update: { activePlanId: id } });
        }
      },
      { timeout: 20_000 },
    );
    return this.get(userId, id);
  }

  async save(userId: string, id: string, input: PlanSaveInput): Promise<PlanView> {
    await this.load(userId, id);
    await this.assertExercises(userId, input);
    await this.prisma.$transaction(
      async (tx) => {
        await tx.workoutPlan.update({
          where: { id },
          data: { name: input.name, description: input.description, scheduleMode: input.scheduleMode },
        });
        await this.writeTree(tx, id, input);
        const schedule = await tx.trainingSchedule.findUnique({ where: { planId: id } });
        if (schedule) {
          await tx.trainingSchedule.update({
            where: { planId: id },
            data: { mode: input.scheduleMode, nextDayIndex: normalizeIndex(schedule.nextDayIndex, Math.max(1, input.days.length)) },
          });
        } else {
          await tx.trainingSchedule.create({ data: { userId, planId: id, mode: input.scheduleMode } });
        }
        await this.snapshot(tx, id, input, input.changeNote);
      },
      { timeout: 20_000 },
    );
    return this.get(userId, id);
  }

  /** Aktuellen Plan in das Speicherformat überführen (mit neuen IDs bei Bedarf). */
  toSaveInput(view: PlanView, freshIds = false): PlanSaveInput {
    const nid = (id: string) => (freshIds ? randomUUID() : id);
    return {
      name: view.name,
      description: view.description,
      scheduleMode: view.scheduleMode,
      days: view.days.map((d) => ({
        id: nid(d.id),
        name: d.name,
        weekday: d.weekday,
        notes: d.notes,
        exercises: d.exercises.map((e) => ({
          id: nid(e.id),
          exerciseId: e.exerciseId,
          restSeconds: e.restSeconds,
          notes: e.notes,
          supersetGroup: e.supersetGroup,
          weightStepKg: e.weightStepKg,
          sets: e.sets.map((s) => ({ ...s, id: nid(s.id) })),
        })),
      })),
    };
  }

  async duplicate(userId: string, id: string): Promise<PlanView> {
    const view = await this.get(userId, id);
    const input = this.toSaveInput(view, true);
    input.name = `${view.name} (Kopie)`.slice(0, 100);
    input.changeNote = 'Dupliziert';
    return this.create(userId, input);
  }

  async setArchived(userId: string, id: string, archived: boolean) {
    await this.load(userId, id);
    await this.prisma.workoutPlan.update({ where: { id }, data: { archivedAt: archived ? new Date() : null } });
    if (archived) {
      await this.prisma.userProfile.updateMany({ where: { userId, activePlanId: id }, data: { activePlanId: null } });
    }
    return this.get(userId, id);
  }

  async setFavorite(userId: string, id: string, favorite: boolean) {
    await this.load(userId, id);
    await this.prisma.workoutPlan.update({ where: { id }, data: { isFavorite: favorite } });
    return this.get(userId, id);
  }

  async activate(userId: string, id: string | null) {
    if (id) {
      const p = await this.load(userId, id);
      if (p.archivedAt) await this.prisma.workoutPlan.update({ where: { id }, data: { archivedAt: null } });
    }
    await this.prisma.userProfile.upsert({ where: { userId }, create: { userId, activePlanId: id }, update: { activePlanId: id } });
    return id ? this.get(userId, id) : null;
  }

  /** Löscht den Plan. Abgeschlossene Workouts bleiben dank Schnappschüssen erhalten. */
  async remove(userId: string, id: string) {
    await this.load(userId, id);
    await this.prisma.workoutPlan.delete({ where: { id } });
    return { deleted: true };
  }

  async versions(userId: string, id: string) {
    await this.load(userId, id);
    const rows = await this.prisma.workoutPlanVersion.findMany({ where: { planId: id }, orderBy: { version: 'desc' }, take: 50 });
    return rows.map((v) => ({
      version: v.version,
      createdAt: v.createdAt.toISOString(),
      changeNote: v.changeNote,
      snapshot: v.snapshot as unknown as PlanSaveInput,
    }));
  }

  async restoreVersion(userId: string, id: string, version: number) {
    await this.load(userId, id);
    const v = await this.prisma.workoutPlanVersion.findUnique({ where: { planId_version: { planId: id, version } } });
    if (!v) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Version nicht gefunden.' });
    const snap = v.snapshot as unknown as PlanSaveInput;
    // Übungen, die inzwischen nicht mehr existieren, werden ausgelassen
    const exIds = new Set(
      (
        await this.prisma.exercise.findMany({
          where: { id: { in: snap.days.flatMap((d) => d.exercises.map((e) => e.exerciseId)) }, OR: [{ ownerId: null }, { ownerId: userId }] },
          select: { id: true },
        })
      ).map((e) => e.id),
    );
    const input: PlanSaveInput = {
      ...snap,
      days: snap.days.map((d) => ({ ...d, exercises: d.exercises.filter((e) => exIds.has(e.exerciseId)) })),
      changeNote: `Version ${version} wiederhergestellt`,
    };
    return this.save(userId, id, input);
  }

  /* -------------------------------- Vorlagen -------------------------------- */

  templates() {
    return WORKOUT_TEMPLATES;
  }

  async fromTemplate(userId: string, templateId: string, activate = true): Promise<PlanView> {
    const t = WORKOUT_TEMPLATES.find((x) => x.id === templateId);
    if (!t) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Vorlage nicht gefunden.' });
    const slugs = [...new Set(t.days.flatMap((d) => d.exercises.map((e) => e.exercise)))];
    const rows = await this.prisma.exercise.findMany({ where: { slug: { in: slugs }, ownerId: null }, select: { id: true, slug: true } });
    const bySlug = new Map(rows.map((r) => [r.slug, r.id]));
    const input: PlanSaveInput = {
      name: t.name,
      description: t.description,
      scheduleMode: 'flexible',
      changeNote: `Aus Vorlage „${t.name}“`,
      days: t.days.map((d) => ({
        id: randomUUID(),
        name: d.name,
        weekday: null,
        notes: null,
        exercises: d.exercises
          .filter((e) => bySlug.has(e.exercise))
          .map((e) => ({
            id: randomUUID(),
            exerciseId: bySlug.get(e.exercise)!,
            restSeconds: e.restSeconds,
            notes: e.notes ?? null,
            supersetGroup: e.supersetGroup ?? null,
            weightStepKg: null,
            // Gewichte bleiben bewusst leer – SATZIO erfindet keine Trainingsgewichte
            sets: e.sets.map((s) => ({ id: randomUUID(), type: s.type, repsMin: s.repsMin, repsMax: s.repsMax, targetWeightKg: null })),
          })),
      })),
    };
    return this.create(userId, input, { activate, sourceTemplate: t.id });
  }

  /* ------------------------------ Teilen (JSON) ------------------------------ */

  async exportShared(userId: string, id: string): Promise<SharedPlan> {
    const p = await this.load(userId, id);
    return {
      format: 'satzio-plan',
      version: 1,
      plan: {
        name: p.name,
        description: p.description,
        scheduleMode: p.scheduleMode,
        days: p.days.map((d) => ({
          name: d.name,
          weekday: d.weekday,
          notes: d.notes,
          exercises: d.exercises.map((e) => ({
            slug: e.exercise.ownerId ? null : e.exercise.slug,
            name: e.exercise.nameDe,
            primaryMuscle: e.exercise.primaryMuscle,
            restSeconds: e.restSeconds,
            notes: e.notes,
            supersetGroup: e.supersetGroup,
            sets: e.sets.map((s) => ({ type: s.type, repsMin: s.repsMin, repsMax: s.repsMax, targetWeightKg: num(s.targetWeightKg) })),
          })),
        })),
      },
    };
  }

  async importShared(userId: string, shared: SharedPlan): Promise<PlanView> {
    const slugs = shared.plan.days.flatMap((d) => d.exercises.map((e) => e.slug).filter((s): s is string => !!s));
    const lib = await this.prisma.exercise.findMany({ where: { slug: { in: slugs }, ownerId: null }, select: { id: true, slug: true } });
    const bySlug = new Map(lib.map((r) => [r.slug, r.id]));
    const days: PlanSaveInput['days'] = [];
    for (const d of shared.plan.days) {
      const exercises: PlanSaveInput['days'][number]['exercises'] = [];
      for (const e of d.exercises) {
        let exerciseId = e.slug ? bySlug.get(e.slug) : undefined;
        if (!exerciseId) exerciseId = (await this.exercises.findOrCreateCustom(userId, e.name, e.primaryMuscle ?? 'full_body')).id;
        exercises.push({
          id: randomUUID(),
          exerciseId,
          restSeconds: e.restSeconds,
          notes: e.notes,
          supersetGroup: e.supersetGroup,
          weightStepKg: null,
          sets: e.sets.map((s) => ({ id: randomUUID(), ...s })),
        });
      }
      days.push({ id: randomUUID(), name: d.name, weekday: d.weekday, notes: d.notes, exercises });
    }
    return this.create(userId, {
      name: shared.plan.name,
      description: shared.plan.description,
      scheduleMode: shared.plan.scheduleMode,
      days,
      changeNote: 'Importiert',
    });
  }

  /* ------------------------------- Planung ------------------------------- */

  async updateSchedule(userId: string, planId: string, input: ScheduleUpdateInput): Promise<PlanView> {
    const p = await this.load(userId, planId);
    await this.prisma.$transaction(async (tx) => {
      if (input.weekdays) {
        for (const [dayId, weekday] of Object.entries(input.weekdays)) {
          if (!p.days.some((d) => d.id === dayId)) continue;
          await tx.workoutPlanDay.update({ where: { id: dayId }, data: { weekday } });
        }
      }
      const data: Prisma.TrainingScheduleUncheckedUpdateInput = {};
      if (input.mode) data.mode = input.mode;
      if (input.paused !== undefined) data.paused = input.paused;
      if (input.nextDayIndex !== undefined) data.nextDayIndex = normalizeIndex(input.nextDayIndex, Math.max(1, p.days.length));
      if (input.overrides) {
        const valid: Record<string, string | null> = {};
        for (const [date, dayId] of Object.entries(input.overrides)) {
          if (dayId === null || p.days.some((d) => d.id === dayId)) valid[date] = dayId;
        }
        data.overrides = valid;
      }
      await tx.trainingSchedule.upsert({
        where: { planId },
        create: { userId, planId, mode: input.mode ?? p.scheduleMode, ...(data as object) },
        update: data,
      });
      if (input.mode) await tx.workoutPlan.update({ where: { id: planId }, data: { scheduleMode: input.mode } });
    });
    return this.get(userId, planId);
  }
}
