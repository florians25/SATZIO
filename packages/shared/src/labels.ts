import type {
  Difficulty,
  Equipment,
  ExerciseCategory,
  Goal,
  Level,
  MotivationLevel,
  MuscleGroup,
  PersonalRecordType,
  SetType,
  ThemeMode,
  Weekday,
} from './enums';

export const MUSCLE_LABELS_DE: Record<MuscleGroup, string> = {
  chest: 'Brust',
  back: 'Rücken',
  shoulders: 'Schultern',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  abs: 'Bauch',
  core: 'Core',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  glutes: 'Gesäß',
  calves: 'Waden',
  full_body: 'Ganzkörper',
};

export const MUSCLE_LABELS_EN: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  abs: 'Abs',
  core: 'Core',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  full_body: 'Full body',
};

export const EQUIPMENT_LABELS_DE: Record<Equipment, string> = {
  barbell: 'Langhantel',
  dumbbell: 'Kurzhantel',
  cable: 'Kabelzug',
  machine: 'Maschine',
  smith_machine: 'Multipresse',
  kettlebell: 'Kettlebell',
  bodyweight: 'Eigengewicht',
  band: 'Widerstandsband',
  other: 'Sonstiges',
};

export const EQUIPMENT_LABELS_EN: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  cable: 'Cable',
  machine: 'Machine',
  smith_machine: 'Smith machine',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
  band: 'Resistance band',
  other: 'Other',
};

export const CATEGORY_LABELS_DE: Record<ExerciseCategory, string> = {
  compound: 'Grundübung',
  isolation: 'Isolationsübung',
  cardio: 'Ausdauer',
  mobility: 'Mobilität',
  plyometric: 'Sprungkraft',
};

export const DIFFICULTY_LABELS_DE: Record<Difficulty, string> = {
  beginner: 'Einsteiger',
  intermediate: 'Fortgeschritten',
  advanced: 'Erfahren',
};

export const SET_TYPE_LABELS_DE: Record<SetType, string> = {
  warmup: 'Aufwärmsatz',
  working: 'Arbeitssatz',
  drop: 'Dropsatz',
  failure: 'Bis Muskelversagen',
};

export const SET_TYPE_SHORT_DE: Record<SetType, string> = {
  warmup: 'W',
  working: '',
  drop: 'D',
  failure: 'F',
};

export const GOAL_LABELS_DE: Record<Goal, string> = {
  muscle_gain: 'Muskelaufbau',
  strength: 'Stärker werden',
  fitness: 'Fitness verbessern',
  weight_loss: 'Abnehmen',
  general: 'Allgemein fit bleiben',
};

export const LEVEL_LABELS_DE: Record<Level, string> = {
  beginner: 'Anfänger',
  intermediate: 'Fortgeschritten',
  advanced: 'Erfahren',
};

export const MOTIVATION_LABELS_DE: Record<MotivationLevel, string> = {
  off: 'Aus',
  subtle: 'Dezent',
  normal: 'Normal',
  intense: 'Intensiv',
};

export const THEME_LABELS_DE: Record<ThemeMode, string> = {
  dark: 'Dunkel',
  light: 'Hell',
  system: 'System',
};

export const PR_TYPE_LABELS_DE: Record<PersonalRecordType, string> = {
  max_weight: 'Höchstes Gewicht',
  max_reps_at_weight: 'Meiste Wiederholungen',
  max_set_volume: 'Höchstes Satzvolumen',
  max_session_volume: 'Höchstes Übungsvolumen',
  est_1rm: 'Geschätztes 1RM',
};

export const WEEKDAY_LABELS_DE: Record<Weekday, string> = {
  1: 'Montag',
  2: 'Dienstag',
  3: 'Mittwoch',
  4: 'Donnerstag',
  5: 'Freitag',
  6: 'Samstag',
  7: 'Sonntag',
};

export const WEEKDAY_SHORT_DE: Record<Weekday, string> = {
  1: 'Mo',
  2: 'Di',
  3: 'Mi',
  4: 'Do',
  5: 'Fr',
  6: 'Sa',
  7: 'So',
};
