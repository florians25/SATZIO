import type {
  Difficulty,
  Equipment,
  ExerciseCategory,
  Goal,
  Level,
  MotivationLevel,
  MuscleGroup,
  PersonalRecordType,
  PrefillSource,
  ScheduleMode,
  SetType,
  ThemeMode,
  WeightUnit,
  WorkoutMode,
  WorkoutStatus,
} from './enums';
import type { DayAssignment } from './schedule';
import type { CurrentBests } from './records';

/** Antwort-Typen der REST-API (gemeinsam für Client und Server). */

export interface UserProfileView {
  displayName: string | null;
  avatarUrl: string | null;
  goal: Goal | null;
  level: Level | null;
  trainingDaysPerWeek: number | null;
  heightCm: number | null;
  bodyWeightKg: number | null;
  targetWeightKg: number | null;
  activePlanId: string | null;
  onboardingCompleted: boolean;
}

export interface UserSettingsView {
  unit: WeightUnit;
  defaultRestSeconds: number;
  autoStartRestTimer: boolean;
  weightStepsKg: number[];
  motivationLevel: MotivationLevel;
  theme: ThemeMode;
  language: 'de' | 'en';
  timeZone: string;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  notificationsEnabled: boolean;
  progressionEnabled: boolean;
  gamificationEnabled: boolean;
  workoutMode: WorkoutMode;
}

export interface UserView {
  id: string;
  email: string;
  username: string;
  emailVerified: boolean;
  createdAt: string;
  profile: UserProfileView;
  settings: UserSettingsView;
}

export interface AuthResponse {
  accessToken: string;
  expiresIn: number;
  csrfToken?: string;
  refreshToken?: string;
  refreshExpiresAt?: string;
  user: UserView;
}

export interface MetaView {
  name: string;
  version: string;
  registrationEnabled: boolean;
  mailEnabled: boolean;
  serverTime: string;
}

export interface ExerciseView {
  id: string;
  slug: string;
  nameDe: string;
  nameEn: string | null;
  aliases: string[];
  descriptionDe: string | null;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  difficulty: Difficulty;
  stepsDe: string[];
  mistakesDe: string[];
  safetyDe: string | null;
  alternatives: string[];
  weightStepKg: number | null;
  isCustom: boolean;
  isFavorite: boolean;
  media: { url: string; kind: string; isPlaceholder: boolean; source: string | null; license: string | null }[];
  userSettings: {
    weightStepKg: number | null;
    defaultWeightKg: number | null;
    defaultReps: number | null;
    defaultRestSeconds: number | null;
    equipmentSettings: string | null;
    notes: string | null;
  } | null;
}

export interface PlannedSetView {
  id: string;
  type: SetType;
  repsMin: number | null;
  repsMax: number | null;
  targetWeightKg: number | null;
}

export interface PlanExerciseView {
  id: string;
  exerciseId: string;
  exerciseName: string;
  exerciseSlug: string;
  primaryMuscle: MuscleGroup;
  equipment: Equipment;
  restSeconds: number | null;
  notes: string | null;
  supersetGroup: string | null;
  weightStepKg: number | null;
  sets: PlannedSetView[];
}

export interface PlanDayView {
  id: string;
  name: string;
  order: number;
  weekday: number | null;
  notes: string | null;
  exercises: PlanExerciseView[];
}

export interface ScheduleView {
  mode: ScheduleMode;
  nextDayIndex: number;
  paused: boolean;
  overrides: Record<string, string | null>;
}

export interface PlanView {
  id: string;
  name: string;
  description: string | null;
  scheduleMode: ScheduleMode;
  isFavorite: boolean;
  isActive: boolean;
  archived: boolean;
  version: number;
  sourceTemplate: string | null;
  createdAt: string;
  updatedAt: string;
  days: PlanDayView[];
  schedule: ScheduleView;
}

export interface PlanSummaryView {
  id: string;
  name: string;
  description: string | null;
  isFavorite: boolean;
  isActive: boolean;
  archived: boolean;
  dayCount: number;
  exerciseCount: number;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface WorkoutSetView {
  id: string;
  order: number;
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  completedAt: string | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  weightSource: PrefillSource;
  repsSource: PrefillSource;
  rpe: number | null;
  version: number;
}

export interface WorkoutExerciseView {
  id: string;
  exerciseId: string | null;
  name: string;
  primaryMuscle: MuscleGroup | null;
  order: number;
  notes: string | null;
  restSeconds: number | null;
  supersetGroup: string | null;
  planExerciseId: string | null;
  weightStepKg: number | null;
  version: number;
  sets: WorkoutSetView[];
}

export interface WorkoutSessionView {
  id: string;
  name: string;
  status: WorkoutStatus;
  planId: string | null;
  planDayId: string | null;
  startedAt: string;
  endedAt: string | null;
  pausedAt: string | null;
  pausedSeconds: number;
  notes: string | null;
  perceivedExertion: number | null;
  version: number;
  exercises: WorkoutExerciseView[];
  updatedAt: string;
}

export interface WorkoutSummaryView {
  id: string;
  name: string;
  status: WorkoutStatus;
  startedAt: string;
  endedAt: string | null;
  durationMinutes: number;
  exerciseCount: number;
  setCount: number;
  completedSetCount: number;
  totalReps: number;
  volumeKg: number;
  recordCount: number;
  exerciseNames: string[];
  planDayId: string | null;
}

export interface FinishSummary {
  sessionId: string;
  name: string;
  durationMinutes: number;
  exerciseCount: number;
  setCount: number;
  totalReps: number;
  volumeKg: number;
  newRecords: { exerciseId: string; exerciseName: string; type: PersonalRecordType; value: number; weightKg: number | null; reps: number | null }[];
  unlockedAchievements: { code: string; title: string; description: string; icon: string }[];
  comparison: { previousSessionId: string; previousVolumeKg: number; previousDurationMinutes: number; previousCompletedSets: number } | null;
}

/** Leistungsdaten je Übung für Smart Defaults, Progression und Live-Rekorde (offline cachebar). */
export interface ExercisePerformance {
  exerciseId: string;
  /** Neueste zuerst, max. 3 Trainings. */
  recent: { sessionId: string; performedAt: string; sets: { type: SetType; weightKg: number | null; reps: number | null; completed: boolean }[] }[];
  bests: CurrentBests;
}

export interface TodayView {
  date: string;
  plan: PlanView | null;
  assignment: DayAssignment;
  nextWorkout: { date: string | null; dayId: string; dayName: string } | null;
  missed: { date: string; dayId: string; dayName: string }[];
  activeSessions: WorkoutSessionView[];
  completedToday: WorkoutSummaryView[];
  week: { date: string; weekday: number; type: 'workout' | 'rest' | 'paused' | 'none'; dayId: string | null; dayName: string | null; done: boolean }[];
  streak: { current: number; longest: number; thisWeekCount: number; weeklyGoal: number };
}

export interface PersonalRecordView {
  id: string;
  exerciseId: string;
  exerciseName: string;
  type: PersonalRecordType;
  value: number;
  weightKg: number | null;
  reps: number | null;
  sessionId: string | null;
  achievedAt: string;
}

export interface AchievementView {
  code: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: string | null;
}

export interface BodyWeightEntryView {
  id: string;
  measuredAt: string;
  weightKg: number | null;
  bodyFatPct: number | null;
  measurements: Record<string, number | null> | null;
  notes: string | null;
}

export interface AnalyticsOverview {
  range: string;
  workouts: number;
  totalVolumeKg: number;
  totalSets: number;
  totalReps: number;
  avgDurationMinutes: number;
  workoutsPerWeek: number;
  prCount: number;
  streak: { current: number; longest: number; thisWeekCount: number; weeklyGoal: number };
  allTimeWorkouts: number;
}

export interface WeeklyPoint {
  week: string; // Montag YYYY-MM-DD
  workouts: number;
  volumeKg: number;
  sets: number;
}

export interface ExerciseProgressPoint {
  date: string;
  sessionId: string;
  maxWeightKg: number | null;
  est1rmKg: number | null;
  volumeKg: number;
  bestSet: { weightKg: number | null; reps: number | null } | null;
}

export interface MuscleGroupStat {
  muscle: MuscleGroup;
  sets: number;
  volumeKg: number;
  lastTrained: string | null;
}

export interface ExerciseListItem {
  id: string;
  slug: string;
  nameDe: string;
  nameEn: string | null;
  aliases: string[];
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  difficulty: Difficulty;
  weightStepKg: number | null;
  isCustom: boolean;
  isFavorite: boolean;
  imageUrl: string | null;
  userDefaults: { weightStepKg: number | null; defaultWeightKg: number | null; defaultReps: number | null; defaultRestSeconds: number | null } | null;
}
