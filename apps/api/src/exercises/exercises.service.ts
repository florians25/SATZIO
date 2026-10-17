import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  bestsFromRecords,
  type CustomExerciseInput,
  type ExercisePerformance,
  type ExerciseView,
  type UserExerciseSettingsInput,
} from '@satzio/shared';
import { dec, num, randomToken } from '../common/util';
import { PrismaService } from '../prisma/prisma.service';
import { removeUpload, storeImage } from '../users/uploads';

const fullInclude = (userId: string) =>
  ({
    muscles: true,
    media: { where: { OR: [{ uploadedById: null }, { uploadedById: userId }] }, orderBy: { createdAt: 'desc' } },
    favorites: { where: { userId }, select: { id: true } },
    userExercises: { where: { userId } },
  }) satisfies Prisma.ExerciseInclude;

type FullExercise = Prisma.ExerciseGetPayload<{ include: ReturnType<typeof fullInclude> }>;

export interface ExerciseListItem {
  id: string;
  slug: string;
  nameDe: string;
  nameEn: string | null;
  aliases: string[];
  primaryMuscle: ExerciseView['primaryMuscle'];
  secondaryMuscles: ExerciseView['secondaryMuscles'];
  equipment: ExerciseView['equipment'];
  category: ExerciseView['category'];
  difficulty: ExerciseView['difficulty'];
  weightStepKg: number | null;
  isCustom: boolean;
  isFavorite: boolean;
  imageUrl: string | null;
}

@Injectable()
export class ExercisesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Kompakte Liste (Bibliothek + eigene Übungen) – Filterung erfolgt clientseitig (offline-fähig). */
  async list(userId: string): Promise<ExerciseListItem[]> {
    const rows = await this.prisma.exercise.findMany({
      where: { archivedAt: null, OR: [{ ownerId: null }, { ownerId: userId }] },
      include: {
        muscles: { where: { role: 'secondary' } },
        favorites: { where: { userId }, select: { id: true } },
        media: {
          where: { isPlaceholder: false, OR: [{ uploadedById: null }, { uploadedById: userId }] },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { nameDe: 'asc' },
    });
    return rows.map((e) => ({
      id: e.id,
      slug: e.slug,
      nameDe: e.nameDe,
      nameEn: e.nameEn,
      aliases: e.aliases,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: e.muscles.map((m) => m.muscle),
      equipment: e.equipment,
      category: e.category,
      difficulty: e.difficulty,
      weightStepKg: num(e.weightStepKg),
      isCustom: e.ownerId !== null,
      isFavorite: e.favorites.length > 0,
      imageUrl: e.media[0]?.url ?? null,
    }));
  }

  private toView(e: FullExercise): ExerciseView {
    const ue = e.userExercises[0];
    return {
      id: e.id,
      slug: e.slug,
      nameDe: e.nameDe,
      nameEn: e.nameEn,
      aliases: e.aliases,
      descriptionDe: e.descriptionDe,
      primaryMuscle: e.primaryMuscle,
      secondaryMuscles: e.muscles.filter((m) => m.role === 'secondary').map((m) => m.muscle),
      equipment: e.equipment,
      category: e.category,
      difficulty: e.difficulty,
      stepsDe: e.stepsDe,
      mistakesDe: e.mistakesDe,
      safetyDe: e.safetyDe,
      alternatives: e.alternatives,
      weightStepKg: num(e.weightStepKg),
      isCustom: e.ownerId !== null,
      isFavorite: e.favorites.length > 0,
      media: e.media.map((m) => ({ url: m.url, kind: m.kind, isPlaceholder: m.isPlaceholder, source: m.source, license: m.license })),
      userSettings: ue
        ? {
            weightStepKg: num(ue.weightStepKg),
            defaultWeightKg: num(ue.defaultWeightKg),
            defaultReps: ue.defaultReps,
            defaultRestSeconds: ue.defaultRestSeconds,
            equipmentSettings: ue.equipmentSettings,
            notes: ue.notes,
          }
        : null,
    };
  }

  /** Lädt eine Übung, die der Nutzer sehen darf (Bibliothek oder eigene). */
  async assertVisible(userId: string, id: string) {
    const e = await this.prisma.exercise.findFirst({ where: { id, OR: [{ ownerId: null }, { ownerId: userId }] } });
    if (!e) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Übung nicht gefunden.' });
    return e;
  }

  async get(userId: string, id: string): Promise<ExerciseView> {
    await this.assertVisible(userId, id);
    const e = await this.prisma.exercise.findUniqueOrThrow({ where: { id }, include: fullInclude(userId) });
    return this.toView(e);
  }

  async create(userId: string, input: CustomExerciseInput): Promise<ExerciseView> {
    const e = await this.prisma.exercise.create({
      data: {
        slug: `custom-${randomToken(9).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`,
        nameDe: input.nameDe,
        nameEn: input.nameEn ?? null,
        aliases: input.aliases ?? [],
        descriptionDe: input.descriptionDe ?? null,
        primaryMuscle: input.primaryMuscle,
        equipment: input.equipment,
        category: input.category,
        difficulty: input.difficulty,
        stepsDe: input.stepsDe ?? [],
        mistakesDe: [],
        alternatives: [],
        ownerId: userId,
        muscles: {
          create: [
            { muscle: input.primaryMuscle, role: 'primary' as const },
            ...[...new Set(input.secondaryMuscles ?? [])]
              .filter((m) => m !== input.primaryMuscle)
              .map((m) => ({ muscle: m, role: 'secondary' as const })),
          ],
        },
      },
    });
    return this.get(userId, e.id);
  }

  /** Mehrere eigene Übungen auf einmal (Notizen-Import). Gleichnamige werden wiederverwendet. */
  async findOrCreateCustom(userId: string, name: string, primaryMuscle: CustomExerciseInput['primaryMuscle'] = 'full_body') {
    const existing = await this.prisma.exercise.findFirst({
      where: { ownerId: userId, archivedAt: null, nameDe: { equals: name, mode: 'insensitive' } },
    });
    if (existing) return existing;
    const view = await this.create(userId, {
      nameDe: name,
      primaryMuscle,
      secondaryMuscles: [],
      equipment: 'other',
      category: 'compound',
      difficulty: 'beginner',
      stepsDe: [],
      aliases: [],
    });
    return this.prisma.exercise.findUniqueOrThrow({ where: { id: view.id } });
  }

  async update(userId: string, id: string, input: CustomExerciseInput): Promise<ExerciseView> {
    const e = await this.prisma.exercise.findFirst({ where: { id, ownerId: userId } });
    if (!e) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Eigene Übung nicht gefunden.' });
    await this.prisma.$transaction([
      this.prisma.exercise.update({
        where: { id },
        data: {
          nameDe: input.nameDe,
          nameEn: input.nameEn ?? null,
          aliases: input.aliases ?? [],
          descriptionDe: input.descriptionDe ?? null,
          primaryMuscle: input.primaryMuscle,
          equipment: input.equipment,
          category: input.category,
          difficulty: input.difficulty,
          stepsDe: input.stepsDe ?? [],
        },
      }),
      this.prisma.exerciseMuscle.deleteMany({ where: { exerciseId: id } }),
      this.prisma.exerciseMuscle.createMany({
        data: [
          { exerciseId: id, muscle: input.primaryMuscle, role: 'primary' },
          ...[...new Set(input.secondaryMuscles ?? [])]
            .filter((m) => m !== input.primaryMuscle)
            .map((m) => ({ exerciseId: id, muscle: m, role: 'secondary' as const })),
        ],
      }),
    ]);
    return this.get(userId, id);
  }

  /** Eigene Übung entfernen. Wird sie in Plänen verwendet, wird sie nur archiviert. */
  async remove(userId: string, id: string) {
    const e = await this.prisma.exercise.findFirst({ where: { id, ownerId: userId } });
    if (!e) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Eigene Übung nicht gefunden.' });
    const used = await this.prisma.workoutPlanExercise.count({ where: { exerciseId: id } });
    if (used > 0) {
      await this.prisma.exercise.update({ where: { id }, data: { archivedAt: new Date() } });
      return { archived: true };
    }
    const media = await this.prisma.exerciseMedia.findMany({ where: { exerciseId: id } });
    await this.prisma.exercise.delete({ where: { id } });
    for (const m of media) await removeUpload(m.url.replace('/api/v1/uploads/', ''));
    return { deleted: true };
  }

  async setFavorite(userId: string, id: string, favorite: boolean) {
    await this.assertVisible(userId, id);
    if (favorite) {
      await this.prisma.exerciseFavorite.upsert({
        where: { userId_exerciseId: { userId, exerciseId: id } },
        create: { userId, exerciseId: id },
        update: {},
      });
    } else {
      await this.prisma.exerciseFavorite.deleteMany({ where: { userId, exerciseId: id } });
    }
    return { favorite };
  }

  async updateUserSettings(userId: string, id: string, input: UserExerciseSettingsInput) {
    await this.assertVisible(userId, id);
    const data = {
      ...(input.weightStepKg !== undefined ? { weightStepKg: dec(input.weightStepKg) } : {}),
      ...(input.defaultWeightKg !== undefined ? { defaultWeightKg: dec(input.defaultWeightKg) } : {}),
      ...(input.defaultReps !== undefined ? { defaultReps: input.defaultReps } : {}),
      ...(input.defaultRestSeconds !== undefined ? { defaultRestSeconds: input.defaultRestSeconds } : {}),
      ...(input.equipmentSettings !== undefined ? { equipmentSettings: input.equipmentSettings } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    };
    await this.prisma.userExercise.upsert({
      where: { userId_exerciseId: { userId, exerciseId: id } },
      create: { userId, exerciseId: id, ...data },
      update: data,
    });
    return this.get(userId, id);
  }

  async addImage(userId: string, id: string, buffer: Buffer) {
    await this.assertVisible(userId, id);
    const count = await this.prisma.exerciseMedia.count({ where: { exerciseId: id, uploadedById: userId } });
    if (count >= 5) throw new BadRequestException({ code: 'LIMIT', message: 'Maximal 5 eigene Bilder pro Übung.' });
    const path = await storeImage(buffer, 'exercises', 1200);
    await this.prisma.exerciseMedia.create({
      data: { exerciseId: id, kind: 'image', url: `/api/v1/uploads/${path}`, source: 'Eigener Upload', uploadedById: userId },
    });
    return this.get(userId, id);
  }

  async removeImages(userId: string, id: string) {
    const media = await this.prisma.exerciseMedia.findMany({ where: { exerciseId: id, uploadedById: userId } });
    await this.prisma.exerciseMedia.deleteMany({ where: { exerciseId: id, uploadedById: userId } });
    for (const m of media) await removeUpload(m.url.replace('/api/v1/uploads/', ''));
    return this.get(userId, id);
  }

  /** Verlauf einer Übung: abgeschlossene Trainings mit Sätzen (neueste zuerst). */
  async history(userId: string, exerciseId: string, limit = 50) {
    await this.assertVisible(userId, exerciseId);
    const entries = await this.prisma.workoutSessionExercise.findMany({
      where: { exerciseId, session: { userId, status: 'completed' } },
      include: { sets: { orderBy: { order: 'asc' } }, session: { select: { id: true, name: true, startedAt: true } } },
      orderBy: { session: { startedAt: 'desc' } },
      take: Math.min(limit, 200),
    });
    return entries.map((e) => ({
      sessionId: e.session.id,
      sessionName: e.session.name,
      performedAt: e.session.startedAt.toISOString(),
      notes: e.notes,
      sets: e.sets.map((s) => ({ type: s.type, weightKg: num(s.weightKg), reps: s.reps, completed: s.completed })),
    }));
  }

  /**
   * Leistungsdaten für alle trainierten Übungen: letzte 3 Trainings + Bestwerte.
   * Grundlage für Smart Defaults, Progression und Live-Rekorderkennung (auch offline).
   */
  async performance(userId: string): Promise<ExercisePerformance[]> {
    const rows = await this.prisma.$queryRaw<{ id: string; exerciseId: string; sessionId: string; startedAt: Date; rn: bigint }[]>`
      SELECT id, "exerciseId", "sessionId", "startedAt", rn FROM (
        SELECT wse.id, wse."exerciseId", ws.id AS "sessionId", ws."startedAt",
               ROW_NUMBER() OVER (PARTITION BY wse."exerciseId" ORDER BY ws."startedAt" DESC, wse."order" ASC) AS rn
        FROM "WorkoutSessionExercise" wse
        JOIN "WorkoutSession" ws ON ws.id = wse."sessionId"
        WHERE ws."userId" = ${userId}::uuid AND ws.status = 'completed' AND wse."exerciseId" IS NOT NULL
          AND EXISTS (SELECT 1 FROM "WorkoutSet" s WHERE s."sessionExerciseId" = wse.id AND s.completed)
      ) t WHERE rn <= 3`;
    const entryIds = rows.map((r) => r.id);
    const sets = entryIds.length
      ? await this.prisma.workoutSet.findMany({ where: { sessionExerciseId: { in: entryIds } }, orderBy: { order: 'asc' } })
      : [];
    const setsByEntry = new Map<string, typeof sets>();
    for (const s of sets) {
      const list = setsByEntry.get(s.sessionExerciseId) ?? [];
      list.push(s);
      setsByEntry.set(s.sessionExerciseId, list);
    }
    const records = await this.prisma.personalRecord.findMany({ where: { userId } });
    const recByExercise = new Map<string, typeof records>();
    for (const r of records) {
      const l = recByExercise.get(r.exerciseId) ?? [];
      l.push(r);
      recByExercise.set(r.exerciseId, l);
    }
    const byExercise = new Map<string, ExercisePerformance>();
    for (const r of rows.sort((a, b) => Number(a.rn) - Number(b.rn))) {
      let p = byExercise.get(r.exerciseId);
      if (!p) {
        p = {
          exerciseId: r.exerciseId,
          recent: [],
          bests: bestsFromRecords(
            (recByExercise.get(r.exerciseId) ?? []).map((x) => ({ type: x.type, value: Number(x.value), weightKg: num(x.weightKg) })),
          ),
        };
        byExercise.set(r.exerciseId, p);
      }
      p.recent.push({
        sessionId: r.sessionId,
        performedAt: r.startedAt.toISOString(),
        sets: (setsByEntry.get(r.id) ?? []).map((s) => ({ type: s.type, weightKg: num(s.weightKg), reps: s.reps, completed: s.completed })),
      });
    }
    return [...byExercise.values()];
  }
}
