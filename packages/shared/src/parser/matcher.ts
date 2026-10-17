import { diceSimilarity, normalizeName } from './normalize';

export interface MatchableExercise {
  id: string;
  nameDe: string;
  nameEn?: string | null;
  aliases?: string[];
}

export interface ExerciseMatch<T extends MatchableExercise = MatchableExercise> {
  exercise: T;
  score: number;
  /** exact = Name/Alias exakt, fuzzy = Ähnlichkeit */
  kind: 'exact' | 'fuzzy';
}

function containsWords(haystack: string, needle: string): boolean {
  const words = new Set(haystack.split(' '));
  const need = needle.split(' ');
  return need.length > 0 && need.every((w) => words.has(w));
}

interface IndexEntry<T> {
  key: string;
  exercise: T;
  primary: boolean;
}

/**
 * Index für schnelles Matching von Freitext auf Übungen.
 * Reihenfolge: exakter Name/Alias → Präfix/enthält → Bigramm-Ähnlichkeit.
 */
export class ExerciseMatcher<T extends MatchableExercise = MatchableExercise> {
  private entries: IndexEntry<T>[] = [];
  private exact = new Map<string, T>();

  constructor(exercises: T[]) {
    for (const ex of exercises) {
      const names: [string, boolean][] = [[ex.nameDe, true]];
      if (ex.nameEn) names.push([ex.nameEn, true]);
      for (const a of ex.aliases ?? []) names.push([a, false]);
      for (const [n, primary] of names) {
        const key = normalizeName(n);
        if (!key) continue;
        this.entries.push({ key, exercise: ex, primary });
        // Eigene Übungen (später hinzugefügt) dürfen Bibliotheksnamen nicht verdrängen
        if (!this.exact.has(key)) this.exact.set(key, ex);
      }
    }
  }

  match(raw: string, limit = 5): ExerciseMatch<T>[] {
    const q = normalizeName(raw);
    if (!q) return [];
    const exact = this.exact.get(q);
    const results = new Map<string, ExerciseMatch<T>>();
    if (exact) results.set(exact.id, { exercise: exact, score: 1, kind: 'exact' });

    for (const e of this.entries) {
      if (results.get(e.exercise.id)?.kind === 'exact') continue;
      let score = diceSimilarity(q, e.key);
      const ratio = Math.min(q.length, e.key.length) / Math.max(q.length, e.key.length);
      if (e.key.startsWith(q) || q.startsWith(e.key)) {
        // Präfix (z. B. abgekürzt oder Tippfehler am Ende)
        score = Math.max(score, 0.6 + 0.35 * ratio);
      } else if (containsWords(q, e.key) || containsWords(e.key, q)) {
        // Ganze Wörter enthalten ("schrägbank kh eng" ⊃ "schrägbank kh")
        score = Math.max(score, 0.62 + 0.3 * ratio);
      }
      if (!e.primary) score -= 0.02;
      const cur = results.get(e.exercise.id);
      if (!cur || score > cur.score) results.set(e.exercise.id, { exercise: e.exercise, score: Math.min(score, 0.99), kind: 'fuzzy' });
    }
    return [...results.values()].sort((a, b) => b.score - a.score).slice(0, limit);
  }

  /** Beste Übereinstimmung oberhalb eines Schwellwerts. */
  best(raw: string, threshold = 0.62): ExerciseMatch<T> | null {
    const [top] = this.match(raw, 1);
    return top && top.score >= threshold ? top : null;
  }
}
