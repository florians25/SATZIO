import type {
  Difficulty,
  Equipment,
  ExerciseCategory,
  Goal,
  Level,
  MuscleGroup,
  PersonalRecordType,
  PrefillSource,
  SetType,
} from './enums';

/** Struktur der mitgelieferten Übungsbibliothek (Seed-Daten). */
export interface ExerciseSeed {
  /** Stabile, eindeutige ID in kebab-case (englisch), z. B. "barbell-bench-press". */
  slug: string;
  nameDe: string;
  nameEn: string;
  /** Alternative Schreibweisen, Abkürzungen, umgangssprachliche Namen (de + en). */
  aliases: string[];
  descriptionDe: string;
  descriptionEn: string;
  primaryMuscle: MuscleGroup;
  secondaryMuscles: MuscleGroup[];
  equipment: Equipment;
  category: ExerciseCategory;
  difficulty: Difficulty;
  /** Ausführungsschritte (deutsch). */
  stepsDe: string[];
  /** Typische Fehler (deutsch). */
  mistakesDe: string[];
  /** Optionale Sicherheitshinweise (deutsch). */
  safetyDe?: string;
  /** Slugs alternativer Übungen. */
  alternatives: string[];
  /** Empfohlene Gewichtsschrittweite in kg (Standard: 2,5). */
  weightStepKg?: number;
}

/** Ein Satz in einer Trainingsvorlage. Gewichte bleiben bewusst leer. */
export interface TemplateSet {
  type: SetType;
  repsMin: number;
  repsMax: number;
}

export interface TemplateExercise {
  /** Slug aus der Übungsbibliothek. */
  exercise: string;
  sets: TemplateSet[];
  restSeconds: number;
  /** Gleiche Gruppen-Buchstaben = Supersatz. */
  supersetGroup?: string;
  notes?: string;
}

export interface TemplateDay {
  name: string;
  exercises: TemplateExercise[];
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  description: string;
  level: Level;
  goals: Goal[];
  daysPerWeek: number;
  /** Ungefähre Dauer einer Einheit in Minuten. */
  durationMinutes: number;
  days: TemplateDay[];
}

/** Minimale Satzdaten, die für Berechnungen benötigt werden. */
export interface SetLike {
  weightKg: number | null;
  reps: number | null;
  completed: boolean;
  type: SetType;
}

export interface PerformedSet extends SetLike {
  id?: string;
  sessionId?: string;
  performedAt?: string;
}

export interface PlannedSetLike {
  type: SetType;
  repsMin: number | null;
  repsMax: number | null;
  targetWeightKg: number | null;
}

/** Vorbelegter Satz für ein neues Training inkl. Herkunft der Werte. */
export interface PrefilledSet {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
  targetWeightKg: number | null;
  weightSource: PrefillSource;
  repsSource: PrefillSource;
}

export interface PersonalRecordValue {
  type: PersonalRecordType;
  /** Hauptwert (kg, Wiederholungen oder Volumen in kg). */
  value: number;
  weightKg: number | null;
  reps: number | null;
}
