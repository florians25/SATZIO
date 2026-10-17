import type { PrefillSource, SetType } from './enums';
import type { PlannedSetLike, PrefilledSet, SetLike } from './types';

/**
 * SMART DEFAULTS – nachvollziehbare Übernahmelogik
 *
 * 1. Satzanzahl & Satzarten: aus dem Trainingsplan. Ohne Plan aus dem letzten
 *    Training dieser Übung, sonst `defaultSetCount` leere Arbeitssätze.
 * 2. Gewicht je Satz (erste passende Quelle gewinnt):
 *    a) letztes Training: gleicher Satztyp an gleicher Position, sonst der
 *       letzte abgeschlossene Satz desselben Typs  → Quelle "history"
 *    b) Zielgewicht aus dem Plan                    → Quelle "plan"
 *    c) individueller Standardwert der Übung         → Quelle "user_default"
 *    d) sonst leer – es werden NIE Gewichte erfunden → Quelle "none"
 * 3. Wiederholungen je Satz:
 *    a) letztes Training (gleiche Zuordnung wie oben), aber nur, wenn der Wert
 *       im aktuellen Zielbereich des Plans liegt (sonst wäre er veraltet)
 *    b) Plan: untere Grenze des Zielbereichs
 *    c) individueller Standardwert
 *    d) leer
 */
export interface LastPerformance {
  sessionId: string;
  performedAt: string;
  sets: SetLike[];
}

export interface UserExerciseDefaults {
  defaultWeightKg?: number | null;
  defaultReps?: number | null;
}

export interface PrefillInput {
  planned?: PlannedSetLike[] | null;
  last?: LastPerformance | null;
  userDefaults?: UserExerciseDefaults | null;
  defaultSetCount?: number;
}

function usable(s: SetLike): boolean {
  return s.completed && (s.weightKg !== null || s.reps !== null);
}

/** Findet den passenden Vergleichssatz im letzten Training. */
export function matchHistorySet(lastSets: SetLike[], type: SetType, indexWithinType: number): SetLike | null {
  const sameType = lastSets.filter((s) => s.type === type && usable(s));
  if (sameType.length === 0) {
    // Dropsätze/Failure ohne Gegenstück: auf Arbeitssätze zurückfallen
    if (type !== 'working' && type !== 'warmup') return matchHistorySet(lastSets, 'working', indexWithinType);
    return null;
  }
  return sameType[indexWithinType] ?? sameType[sameType.length - 1] ?? null;
}

export function buildPrefilledSets(input: PrefillInput): PrefilledSet[] {
  const { planned, last, userDefaults } = input;
  const defaultSetCount = input.defaultSetCount ?? 3;
  const lastSets = last?.sets ?? [];

  let skeleton: PlannedSetLike[];
  if (planned && planned.length > 0) {
    skeleton = planned;
  } else {
    const fromHistory = lastSets.filter((s) => s.completed);
    skeleton =
      fromHistory.length > 0
        ? fromHistory.map((s) => ({ type: s.type, repsMin: null, repsMax: null, targetWeightKg: null }))
        : Array.from({ length: defaultSetCount }, () => ({
            type: 'working' as SetType,
            repsMin: null,
            repsMax: null,
            targetWeightKg: null,
          }));
  }

  const typeCounters = new Map<SetType, number>();
  return skeleton.map((p) => {
    const idx = typeCounters.get(p.type) ?? 0;
    typeCounters.set(p.type, idx + 1);
    const hist = matchHistorySet(lastSets, p.type, idx);

    let weightKg: number | null = null;
    let weightSource: PrefillSource = 'none';
    if (hist && hist.weightKg !== null) {
      weightKg = hist.weightKg;
      weightSource = 'history';
    } else if (p.targetWeightKg !== null && p.targetWeightKg !== undefined) {
      weightKg = p.targetWeightKg;
      weightSource = 'plan';
    } else if (userDefaults?.defaultWeightKg != null) {
      weightKg = userDefaults.defaultWeightKg;
      weightSource = 'user_default';
    }

    let reps: number | null = null;
    let repsSource: PrefillSource = 'none';
    const hasRange = p.repsMin !== null || p.repsMax !== null;
    const lo = p.repsMin ?? p.repsMax;
    const hi = p.repsMax ?? p.repsMin;
    const histRepsFit =
      hist && hist.reps !== null && (!hasRange || (lo !== null && hi !== null && hist.reps >= lo && hist.reps <= hi));
    if (hist && hist.reps !== null && histRepsFit) {
      reps = hist.reps;
      repsSource = 'history';
    } else if (lo !== null) {
      reps = lo;
      repsSource = 'plan';
    } else if (userDefaults?.defaultReps != null) {
      reps = userDefaults.defaultReps;
      repsSource = 'user_default';
    }

    return {
      type: p.type,
      weightKg,
      reps,
      targetRepsMin: p.repsMin,
      targetRepsMax: p.repsMax,
      targetWeightKg: p.targetWeightKg ?? null,
      weightSource,
      repsSource,
    };
  });
}

/** Werte für einen zusätzlich angehängten Satz: Kopie des letzten Satzes. */
export function nextSetDefaults(existing: (SetLike & { targetRepsMin?: number | null; targetRepsMax?: number | null })[]): {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  targetRepsMin: number | null;
  targetRepsMax: number | null;
} {
  const lastWorking = [...existing].reverse().find((s) => s.type !== 'warmup') ?? existing[existing.length - 1];
  if (!lastWorking) return { type: 'working', weightKg: null, reps: null, targetRepsMin: null, targetRepsMax: null };
  return {
    type: lastWorking.type === 'warmup' ? 'working' : lastWorking.type,
    weightKg: lastWorking.weightKg,
    reps: lastWorking.reps,
    targetRepsMin: lastWorking.targetRepsMin ?? null,
    targetRepsMax: lastWorking.targetRepsMax ?? null,
  };
}

export const PREFILL_SOURCE_LABELS_DE: Record<PrefillSource, string> = {
  history: 'Aus deinem letzten Training',
  plan: 'Aus dem Trainingsplan',
  user_default: 'Dein Standardwert',
  manual: 'Manuell eingegeben',
  none: 'Noch kein Wert',
};
