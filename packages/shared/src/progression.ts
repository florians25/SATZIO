import type { SetLike } from './types';
import { round, roundToStep } from './units';

/**
 * SMART PROGRESSION – transparente Regeln, keine automatischen Änderungen.
 *
 * - Grundlage: das letzte Training der Übung (nur abgeschlossene Arbeitssätze).
 * - "increase": Alle geplanten Arbeitssätze wurden mit dem Topgewicht
 *   absolviert und jeder erreichte die obere Grenze des Zielbereichs.
 *   Vorschlag = Topgewicht + eine Gewichtsstufe (moderat).
 * - "reps": wie oben, aber ohne Zusatzgewicht (Eigengewicht) → mehr Wdh.
 * - "hold": Stagnation erkannt (3 Trainings in Folge gleiches Topgewicht und
 *   untere Zielgrenze nicht erreicht) → keine Steigerung, Hinweis auf Technik.
 * - sonst kein Vorschlag.
 * Der Nutzer bestätigt Vorschläge immer selbst.
 */
export interface ProgressionTarget {
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
}

export interface ProgressionSession {
  performedAt: string;
  sets: SetLike[];
}

export type ProgressionSuggestion =
  | { type: 'increase'; fromKg: number; toKg: number; reason: string }
  | { type: 'reps'; reason: string }
  | { type: 'hold'; weightKg: number; reason: string };

function workingSets(sets: SetLike[]) {
  return sets.filter((s) => s.type === 'working' && s.completed && s.reps !== null);
}

function topWeight(sets: SetLike[]): number {
  return sets.reduce((m, s) => Math.max(m, s.weightKg ?? 0), 0);
}

export function suggestProgression(
  target: ProgressionTarget,
  historyNewestFirst: ProgressionSession[],
  stepKg = 2.5,
): ProgressionSuggestion | null {
  if (!historyNewestFirst.length || target.sets <= 0) return null;
  const repsMax = target.repsMax ?? target.repsMin;
  const repsMin = target.repsMin ?? target.repsMax;
  if (repsMax === null || repsMin === null) return null;

  const latest = workingSets(historyNewestFirst[0].sets);
  if (latest.length === 0) return null;
  const top = topWeight(latest);
  const atTop = latest.filter((s) => (s.weightKg ?? 0) === top);

  // Stagnationserkennung über die letzten drei Trainings
  const recent = historyNewestFirst.slice(0, 3).map((h) => workingSets(h.sets));
  if (recent.length === 3 && recent.every((r) => r.length > 0)) {
    const tops = recent.map(topWeight);
    const sameWeight = tops.every((t) => t === tops[0]) && top > 0;
    const missedMin = recent.every((r) => r.some((s) => (s.reps ?? 0) < repsMin));
    if (sameWeight && missedMin) {
      return {
        type: 'hold',
        weightKg: top,
        reason: `Seit drei Trainings bei ${formatKg(top)} kg ohne den Zielbereich zu erreichen. Bleib beim Gewicht und achte auf saubere Wiederholungen.`,
      };
    }
  }

  const allHit = atTop.length >= target.sets && atTop.every((s) => (s.reps ?? 0) >= repsMax);
  if (!allHit) return null;

  if (top <= 0) {
    return {
      type: 'reps',
      reason: `Alle ${target.sets} Sätze mit ${repsMax} Wiederholungen geschafft. Versuche mehr Wiederholungen oder etwas Zusatzgewicht.`,
    };
  }
  const toKg = roundToStep(top + stepKg, stepKg) || round(top + stepKg, 2);
  return {
    type: 'increase',
    fromKg: top,
    toKg,
    reason: `Du hast alle Zielsätze geschafft. Möchtest du beim nächsten Mal ${formatKg(toKg)} kg ausprobieren?`,
  };
}

function formatKg(n: number): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}
