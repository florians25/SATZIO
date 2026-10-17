import type { SetLike } from './types';
import { round } from './units';

/** Nur abgeschlossene Sätze mit Gewicht und Wiederholungen zählen ins Volumen. */
export function isCountableSet(s: SetLike): boolean {
  return s.completed && s.reps !== null && s.reps > 0;
}

/** Volumen eines Satzes = Gewicht × Wiederholungen (Eigengewicht ohne Zusatzlast = 0). */
export function setVolume(s: SetLike): number {
  if (!isCountableSet(s)) return 0;
  return round((s.weightKg ?? 0) * (s.reps ?? 0), 2);
}

export function totalVolume(sets: SetLike[], { includeWarmup = false } = {}): number {
  return round(
    sets
      .filter((s) => includeWarmup || s.type !== 'warmup')
      .reduce((sum, s) => sum + setVolume(s), 0),
    2,
  );
}

export function totalReps(sets: SetLike[], { includeWarmup = false } = {}): number {
  return sets
    .filter((s) => isCountableSet(s) && (includeWarmup || s.type !== 'warmup'))
    .reduce((sum, s) => sum + (s.reps ?? 0), 0);
}

export function completedSetCount(sets: SetLike[]): number {
  return sets.filter((s) => s.completed).length;
}

/**
 * Geschätztes 1RM nach Epley (für 2–12 Wdh. halbwegs belastbar).
 * Ausdrücklich eine Schätzung! Bei 1 Wdh. = Gewicht. Über 12 Wdh. wird
 * keine Schätzung mehr abgegeben (zu ungenau).
 */
export function estimateOneRepMax(weightKg: number | null, reps: number | null): number | null {
  if (weightKg === null || reps === null || weightKg <= 0 || reps <= 0) return null;
  if (reps === 1) return round(weightKg, 2);
  if (reps > 12) return null;
  return round(weightKg * (1 + reps / 30), 1);
}

/** Alternative Formel nach Brzycki – für Vergleiche/Tests. */
export function estimateOneRepMaxBrzycki(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return round(weightKg * (36 / (37 - reps)), 1);
}

export interface RepRange {
  min: number | null;
  max: number | null;
}

/** Parst "8-12", "8–12", "10", "8 bis 12". */
export function parseRepRange(input: string): RepRange | null {
  const s = input.trim().replace(/\s+/g, ' ');
  const range = /^(\d{1,3})\s*(?:-|–|—|bis)\s*(\d{1,3})$/i.exec(s);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    return { min: Math.min(a, b), max: Math.max(a, b) };
  }
  const single = /^(\d{1,3})$/.exec(s);
  if (single) {
    const n = Number(single[1]);
    return { min: n, max: n };
  }
  return null;
}

export function formatRepRange(min: number | null, max: number | null): string {
  if (min === null && max === null) return '–';
  if (min === null) return String(max);
  if (max === null || min === max) return String(min);
  return `${min}–${max}`;
}

/** Liegt die Wiederholungszahl im Zielbereich? */
export function repsInRange(reps: number | null, min: number | null, max: number | null): 'below' | 'in' | 'above' | 'unknown' {
  if (reps === null || (min === null && max === null)) return 'unknown';
  const lo = min ?? max!;
  const hi = max ?? min!;
  if (reps < lo) return 'below';
  if (reps > hi) return 'above';
  return 'in';
}

/** Trainingsdauer in Minuten, abzüglich Pausenzeit. */
export function workoutDurationMinutes(
  startedAt: string | Date,
  endedAt: string | Date | null,
  pausedSeconds = 0,
  now: Date = new Date(),
): number {
  const start = new Date(startedAt).getTime();
  const end = endedAt ? new Date(endedAt).getTime() : now.getTime();
  const ms = Math.max(0, end - start - pausedSeconds * 1000);
  return Math.round(ms / 60000);
}
