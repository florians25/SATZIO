import { Prisma } from '@prisma/client';
import {
  totalReps,
  totalVolume,
  workoutDurationMinutes,
  type WorkoutExerciseView,
  type WorkoutSessionView,
  type WorkoutSetView,
  type WorkoutSummaryView,
} from '@satzio/shared';
import { num } from '../common/util';

export const sessionInclude = {
  exercises: { orderBy: { order: 'asc' }, include: { sets: { orderBy: { order: 'asc' } } } },
} satisfies Prisma.WorkoutSessionInclude;

export type FullSession = Prisma.WorkoutSessionGetPayload<{ include: typeof sessionInclude }>;
type DbSet = Prisma.WorkoutSetGetPayload<object>;
type DbExercise = Prisma.WorkoutSessionExerciseGetPayload<{ include: { sets: true } }>;

export function setView(s: DbSet): WorkoutSetView {
  return {
    id: s.id,
    order: s.order,
    type: s.type,
    weightKg: num(s.weightKg),
    reps: s.reps,
    completed: s.completed,
    completedAt: s.completedAt?.toISOString() ?? null,
    targetRepsMin: s.targetRepsMin,
    targetRepsMax: s.targetRepsMax,
    targetWeightKg: num(s.targetWeightKg),
    weightSource: s.weightSource,
    repsSource: s.repsSource,
    rpe: num(s.rpe),
    version: s.version,
  };
}

export function exerciseView(e: DbExercise): WorkoutExerciseView {
  return {
    id: e.id,
    exerciseId: e.exerciseId,
    name: e.exerciseName,
    primaryMuscle: e.primaryMuscle,
    order: e.order,
    notes: e.notes,
    restSeconds: e.restSeconds,
    supersetGroup: e.supersetGroup,
    planExerciseId: e.planExerciseId,
    weightStepKg: num(e.weightStepKg),
    version: e.version,
    sets: [...e.sets].sort((a, b) => a.order - b.order).map(setView),
  };
}

export function sessionView(s: FullSession): WorkoutSessionView {
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    planId: s.planId,
    planDayId: s.planDayId,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    pausedAt: s.pausedAt?.toISOString() ?? null,
    pausedSeconds: s.pausedSeconds,
    notes: s.notes,
    perceivedExertion: s.perceivedExertion,
    version: s.version,
    updatedAt: s.updatedAt.toISOString(),
    exercises: s.exercises.map(exerciseView),
  };
}

export function flatSets(s: FullSession) {
  return s.exercises.flatMap((e) =>
    e.sets.map((x) => ({ type: x.type, weightKg: num(x.weightKg), reps: x.reps, completed: x.completed })),
  );
}

export function summaryView(s: FullSession, recordCount = 0): WorkoutSummaryView {
  const sets = flatSets(s);
  return {
    id: s.id,
    name: s.name,
    status: s.status,
    startedAt: s.startedAt.toISOString(),
    endedAt: s.endedAt?.toISOString() ?? null,
    durationMinutes: workoutDurationMinutes(s.startedAt, s.endedAt, s.pausedSeconds),
    exerciseCount: s.exercises.length,
    setCount: sets.length,
    completedSetCount: sets.filter((x) => x.completed).length,
    totalReps: totalReps(sets),
    volumeKg: totalVolume(sets),
    recordCount,
    exerciseNames: s.exercises.map((e) => e.exerciseName),
    planDayId: s.planDayId,
  };
}
