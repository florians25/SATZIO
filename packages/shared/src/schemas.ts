import { z } from 'zod';
import {
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  DIFFICULTIES,
  MUSCLE_GROUPS,
  PREFILL_SOURCES,
  SCHEDULE_MODES,
  SET_TYPES,
} from './enums';

/** Gemeinsame Validierungsschemata für Client und Server. */

export const uuid = z.string().uuid();
const weight = z.number().min(0).max(2000).nullable();
const repsValue = z.number().int().min(0).max(1000).nullable();
const repsTarget = z.number().int().min(0).max(1000).nullable();
const isoDate = z.string().datetime({ offset: true });
const shortText = (max: number) => z.string().trim().max(max);

export const setTypeSchema = z.enum(SET_TYPES);
export const muscleSchema = z.enum(MUSCLE_GROUPS);

/* ---------------------------------- Pläne --------------------------------- */

export const plannedSetSchema = z.object({
  id: uuid,
  type: setTypeSchema,
  repsMin: repsTarget,
  repsMax: repsTarget,
  targetWeightKg: weight,
});

export const planExerciseSchema = z.object({
  id: uuid,
  exerciseId: uuid,
  restSeconds: z.number().int().min(0).max(1800).nullable(),
  notes: shortText(1000).nullable(),
  supersetGroup: shortText(8).nullable(),
  weightStepKg: z.number().min(0).max(50).nullable(),
  sets: z.array(plannedSetSchema).max(30),
});

export const planDaySchema = z.object({
  id: uuid,
  name: shortText(80).min(1),
  weekday: z.number().int().min(1).max(7).nullable(),
  notes: shortText(1000).nullable(),
  exercises: z.array(planExerciseSchema).max(40),
});

export const planSaveSchema = z.object({
  name: shortText(100).min(1),
  description: shortText(4000).nullable(),
  scheduleMode: z.enum(SCHEDULE_MODES),
  days: z.array(planDaySchema).max(14),
  changeNote: shortText(200).optional(),
});
export type PlanSaveInput = z.infer<typeof planSaveSchema>;

/* ------------------------------ Eigene Übungen ----------------------------- */

export const customExerciseSchema = z.object({
  nameDe: shortText(100).min(2),
  nameEn: shortText(100).nullable().optional(),
  descriptionDe: shortText(2000).nullable().optional(),
  primaryMuscle: muscleSchema,
  secondaryMuscles: z.array(muscleSchema).max(6).default([]),
  equipment: z.enum(EQUIPMENT),
  category: z.enum(EXERCISE_CATEGORIES).default('compound'),
  difficulty: z.enum(DIFFICULTIES).default('beginner'),
  stepsDe: z.array(shortText(500)).max(15).default([]),
  aliases: z.array(shortText(60)).max(10).default([]),
});
export type CustomExerciseInput = z.infer<typeof customExerciseSchema>;

/* ------------------------------ Synchronisation ---------------------------- */

export const syncSetSchema = z.object({
  id: uuid,
  order: z.number().int().min(0).max(1000),
  type: setTypeSchema,
  weightKg: weight,
  reps: repsValue,
  completed: z.boolean(),
  completedAt: isoDate.nullable(),
  targetRepsMin: repsTarget,
  targetRepsMax: repsTarget,
  targetWeightKg: weight,
  weightSource: z.enum(PREFILL_SOURCES),
  repsSource: z.enum(PREFILL_SOURCES),
  rpe: z.number().min(1).max(10).nullable(),
});
export type SyncSet = z.infer<typeof syncSetSchema>;

export const syncExerciseSchema = z.object({
  id: uuid,
  exerciseId: uuid.nullable(),
  name: shortText(120).min(1),
  primaryMuscle: muscleSchema.nullable(),
  order: z.number().int().min(0).max(1000),
  notes: shortText(2000).nullable(),
  restSeconds: z.number().int().min(0).max(1800).nullable(),
  supersetGroup: shortText(8).nullable(),
  planExerciseId: uuid.nullable(),
  weightStepKg: z.number().min(0).max(50).nullable(),
  sets: z.array(syncSetSchema).max(50),
});
export type SyncExercise = z.infer<typeof syncExerciseSchema>;

export const syncSessionSchema = z.object({
  id: uuid,
  name: shortText(120).min(1),
  planId: uuid.nullable(),
  planDayId: uuid.nullable(),
  startedAt: isoDate,
  notes: shortText(4000).nullable(),
  exercises: z.array(syncExerciseSchema).max(60),
});
export type SyncSession = z.infer<typeof syncSessionSchema>;

const sessionPatch = z
  .object({
    name: shortText(120).min(1),
    notes: shortText(4000).nullable(),
    status: z.enum(['active', 'paused']),
    pausedAt: isoDate.nullable(),
    pausedSeconds: z.number().int().min(0).max(7 * 86400),
    perceivedExertion: z.number().int().min(1).max(10).nullable(),
    startedAt: isoDate,
    endedAt: isoDate.nullable(),
  })
  .partial();

const exercisePatch = z
  .object({
    notes: shortText(2000).nullable(),
    restSeconds: z.number().int().min(0).max(1800).nullable(),
    supersetGroup: shortText(8).nullable(),
    weightStepKg: z.number().min(0).max(50).nullable(),
  })
  .partial();

const setPatch = z
  .object({
    weightKg: weight,
    reps: repsValue,
    completed: z.boolean(),
    completedAt: isoDate.nullable(),
    type: setTypeSchema,
    order: z.number().int().min(0).max(1000),
    rpe: z.number().min(1).max(10).nullable(),
    weightSource: z.enum(PREFILL_SOURCES),
    repsSource: z.enum(PREFILL_SOURCES),
  })
  .partial();

const opBase = {
  opId: uuid,
  clientTs: isoDate,
  baseVersion: z.number().int().min(0).nullable(),
};

export const syncOperationSchema = z.discriminatedUnion('type', [
  z.object({ ...opBase, type: z.literal('session.create'), payload: z.object({ session: syncSessionSchema }) }),
  z.object({ ...opBase, type: z.literal('session.update'), payload: z.object({ id: uuid, patch: sessionPatch }) }),
  z.object({
    ...opBase,
    type: z.literal('session.finish'),
    payload: z.object({
      id: uuid,
      endedAt: isoDate,
      pausedSeconds: z.number().int().min(0).max(7 * 86400).optional(),
      notes: shortText(4000).nullable().optional(),
      perceivedExertion: z.number().int().min(1).max(10).nullable().optional(),
    }),
  }),
  z.object({ ...opBase, type: z.literal('session.delete'), payload: z.object({ id: uuid }) }),
  z.object({
    ...opBase,
    type: z.literal('exercise.add'),
    payload: z.object({ sessionId: uuid, exercise: syncExerciseSchema }),
  }),
  z.object({ ...opBase, type: z.literal('exercise.update'), payload: z.object({ id: uuid, patch: exercisePatch }) }),
  z.object({
    ...opBase,
    type: z.literal('exercise.replace'),
    payload: z.object({
      id: uuid,
      exerciseId: uuid.nullable(),
      name: shortText(120).min(1),
      primaryMuscle: muscleSchema.nullable(),
    }),
  }),
  z.object({ ...opBase, type: z.literal('exercise.delete'), payload: z.object({ id: uuid }) }),
  z.object({
    ...opBase,
    type: z.literal('exercise.reorder'),
    payload: z.object({ sessionId: uuid, order: z.array(uuid).max(60) }),
  }),
  z.object({ ...opBase, type: z.literal('set.add'), payload: z.object({ exerciseId: uuid, set: syncSetSchema }) }),
  z.object({ ...opBase, type: z.literal('set.update'), payload: z.object({ id: uuid, patch: setPatch }) }),
  z.object({ ...opBase, type: z.literal('set.delete'), payload: z.object({ id: uuid }) }),
]);
export type SyncOperation = z.infer<typeof syncOperationSchema>;
export type SyncOperationType = SyncOperation['type'];

export const syncRequestSchema = z.object({
  deviceId: z.string().min(8).max(64),
  operations: z.array(syncOperationSchema).min(1).max(100),
});
export type SyncRequest = z.infer<typeof syncRequestSchema>;

export type SyncResultStatus = 'applied' | 'duplicate' | 'conflict' | 'not_found' | 'rejected';

export interface SyncOperationResult {
  opId: string;
  status: SyncResultStatus;
  entityType: 'session' | 'exercise' | 'set';
  entityId: string;
  /** Neue Serverversion der Entität nach Anwendung. */
  version?: number;
  /** Aktueller Serverstand bei Konflikten. */
  serverEntity?: unknown;
  error?: string;
  /** Bei session.finish: Zusammenfassung (Rekorde, Achievements). */
  summary?: unknown;
}

export interface SyncResponse {
  results: SyncOperationResult[];
  serverTime: string;
}

/** Welche Entität prüft eine Operation auf Konflikte? */
export function operationTarget(op: SyncOperation): { entityType: 'session' | 'exercise' | 'set'; entityId: string } {
  switch (op.type) {
    case 'session.create':
      return { entityType: 'session', entityId: op.payload.session.id };
    case 'session.update':
    case 'session.finish':
    case 'session.delete':
      return { entityType: 'session', entityId: op.payload.id };
    case 'exercise.add':
      return { entityType: 'exercise', entityId: op.payload.exercise.id };
    case 'exercise.update':
    case 'exercise.replace':
    case 'exercise.delete':
      return { entityType: 'exercise', entityId: op.payload.id };
    case 'exercise.reorder':
      return { entityType: 'session', entityId: op.payload.sessionId };
    case 'set.add':
      return { entityType: 'set', entityId: op.payload.set.id };
    case 'set.update':
    case 'set.delete':
      return { entityType: 'set', entityId: op.payload.id };
  }
}

/* ------------------------------- Plan-Austausch ---------------------------- */

/** Format für das Teilen von Trainingsplänen zwischen Accounts (JSON). */
export const sharedPlanSchema = z.object({
  format: z.literal('satzio-plan'),
  version: z.literal(1),
  plan: z.object({
    name: shortText(100).min(1),
    description: shortText(4000).nullable(),
    scheduleMode: z.enum(SCHEDULE_MODES),
    days: z
      .array(
        z.object({
          name: shortText(80).min(1),
          weekday: z.number().int().min(1).max(7).nullable(),
          notes: shortText(1000).nullable(),
          exercises: z
            .array(
              z.object({
                slug: z.string().max(120).nullable(),
                name: shortText(120).min(1),
                primaryMuscle: muscleSchema.nullable(),
                restSeconds: z.number().int().min(0).max(1800).nullable(),
                notes: shortText(1000).nullable(),
                supersetGroup: shortText(8).nullable(),
                sets: z
                  .array(
                    z.object({
                      type: setTypeSchema,
                      repsMin: repsTarget,
                      repsMax: repsTarget,
                      targetWeightKg: weight,
                    }),
                  )
                  .max(30),
              }),
            )
            .max(40),
        }),
      )
      .max(14),
  }),
});
export type SharedPlan = z.infer<typeof sharedPlanSchema>;
