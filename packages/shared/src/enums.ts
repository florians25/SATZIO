/**
 * Zentrale Aufzählungstypen. Werte sind stabile, englische Schlüssel (DB/API),
 * deutsche Anzeigenamen stehen in labels.ts.
 */

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
  'full_body',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'cable',
  'machine',
  'smith_machine',
  'kettlebell',
  'bodyweight',
  'band',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EXERCISE_CATEGORIES = [
  'compound',
  'isolation',
  'cardio',
  'mobility',
  'plyometric',
] as const;
export type ExerciseCategory = (typeof EXERCISE_CATEGORIES)[number];

export const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const SET_TYPES = ['warmup', 'working', 'drop', 'failure'] as const;
export type SetType = (typeof SET_TYPES)[number];

export const GOALS = ['muscle_gain', 'strength', 'fitness', 'weight_loss', 'general'] as const;
export type Goal = (typeof GOALS)[number];

export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export type Level = (typeof LEVELS)[number];

export const WEIGHT_UNITS = ['kg', 'lbs'] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

export const MOTIVATION_LEVELS = ['off', 'subtle', 'normal', 'intense'] as const;
export type MotivationLevel = (typeof MOTIVATION_LEVELS)[number];

export const THEME_MODES = ['dark', 'light', 'system'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

export const LANGUAGES = ['de', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

export const WORKOUT_STATUSES = ['active', 'paused', 'completed'] as const;
export type WorkoutStatus = (typeof WORKOUT_STATUSES)[number];

export const WORKOUT_MODES = ['list', 'guided'] as const;
export type WorkoutMode = (typeof WORKOUT_MODES)[number];

export const SCHEDULE_MODES = ['flexible', 'fixed'] as const;
export type ScheduleMode = (typeof SCHEDULE_MODES)[number];

export const PR_TYPES = [
  'max_weight',
  'max_reps_at_weight',
  'max_set_volume',
  'max_session_volume',
  'est_1rm',
] as const;
export type PersonalRecordType = (typeof PR_TYPES)[number];

/** Herkunft eines vorbelegten Wertes – macht Smart Defaults nachvollziehbar. */
export const PREFILL_SOURCES = ['history', 'plan', 'user_default', 'manual', 'none'] as const;
export type PrefillSource = (typeof PREFILL_SOURCES)[number];

/** Trainingstage pro Woche; 0 = flexibel. */
export const TRAINING_DAY_OPTIONS = [2, 3, 4, 5, 6, 0] as const;

export const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const; // ISO: 1 = Montag … 7 = Sonntag
export type Weekday = (typeof WEEKDAYS)[number];
