import type { PersonalRecordType } from './enums';
import type { PersonalRecordValue, SetLike } from './types';
import { estimateOneRepMax, setVolume, totalVolume } from './calc';
import { round } from './units';

export interface SessionSetsForExercise {
  sessionId: string;
  performedAt: string;
  sets: (SetLike & { id?: string })[];
}

export interface DetectedRecord extends PersonalRecordValue {
  sessionId: string;
  setId: string | null;
  achievedAt: string;
}

const relevant = (s: SetLike) => s.completed && s.type !== 'warmup' && s.reps !== null && s.reps > 0;

/** Bestwerte einer einzelnen Satzliste (ohne Aufwärmsätze). */
export function bestOfSets(sets: SetLike[]): {
  maxWeight: number | null;
  maxSetVolume: number | null;
  maxEst1rm: number | null;
  volume: number;
  maxRepsByWeight: Map<number, number>;
} {
  let maxWeight: number | null = null;
  let maxSetVolume: number | null = null;
  let maxEst1rm: number | null = null;
  const maxRepsByWeight = new Map<number, number>();
  for (const s of sets) {
    if (!relevant(s)) continue;
    const w = s.weightKg ?? 0;
    if (w > 0) {
      if (maxWeight === null || w > maxWeight) maxWeight = w;
      const v = setVolume(s);
      if (maxSetVolume === null || v > maxSetVolume) maxSetVolume = v;
      const e = estimateOneRepMax(w, s.reps);
      if (e !== null && (maxEst1rm === null || e > maxEst1rm)) maxEst1rm = e;
    }
    const key = round(w, 3);
    const prev = maxRepsByWeight.get(key) ?? 0;
    if ((s.reps ?? 0) > prev) maxRepsByWeight.set(key, s.reps ?? 0);
  }
  return { maxWeight, maxSetVolume, maxEst1rm, volume: totalVolume(sets), maxRepsByWeight };
}

/**
 * Berechnet die aktuellen persönlichen Rekorde einer Übung vollständig neu
 * aus der chronologisch sortierten Historie. Ergebnis ist deterministisch –
 * dadurch entstehen bei erneuter Synchronisierung oder nachträglichen
 * Korrekturen keine Duplikate.
 *
 * "max_reps_at_weight" wird je Gewicht geführt, aber nur für Gewichte > 0
 * bzw. Eigengewicht (0) gespeichert.
 */
export function computePersonalRecords(history: SessionSetsForExercise[]): DetectedRecord[] {
  const sorted = [...history].sort((a, b) => a.performedAt.localeCompare(b.performedAt));
  const best = new Map<string, DetectedRecord>();

  const consider = (key: string, rec: DetectedRecord) => {
    const cur = best.get(key);
    if (!cur || rec.value > cur.value) best.set(key, rec);
  };

  for (const session of sorted) {
    let sessionVolume = 0;
    for (const s of session.sets) {
      if (!relevant(s)) continue;
      const w = s.weightKg ?? 0;
      const reps = s.reps ?? 0;
      const base = { sessionId: session.sessionId, setId: s.id ?? null, achievedAt: session.performedAt };
      if (w > 0) {
        consider('max_weight', { ...base, type: 'max_weight', value: w, weightKg: w, reps });
        consider('max_set_volume', {
          ...base,
          type: 'max_set_volume',
          value: setVolume(s),
          weightKg: w,
          reps,
        });
        const e1rm = estimateOneRepMax(w, reps);
        if (e1rm !== null) consider('est_1rm', { ...base, type: 'est_1rm', value: e1rm, weightKg: w, reps });
      }
      consider(`max_reps_at_weight:${round(w, 3)}`, {
        ...base,
        type: 'max_reps_at_weight',
        value: reps,
        weightKg: round(w, 3),
        reps,
      });
      sessionVolume += setVolume(s);
    }
    if (sessionVolume > 0) {
      consider('max_session_volume', {
        sessionId: session.sessionId,
        setId: null,
        achievedAt: session.performedAt,
        type: 'max_session_volume',
        value: round(sessionVolume, 2),
        weightKg: null,
        reps: null,
      });
    }
  }
  return [...best.values()];
}

export interface CurrentBests {
  maxWeight: number | null;
  maxSetVolume: number | null;
  est1rm: number | null;
  maxRepsByWeight: Record<string, number>;
  maxSessionVolume: number | null;
}

export function bestsFromRecords(records: Pick<PersonalRecordValue, 'type' | 'value' | 'weightKg'>[]): CurrentBests {
  const r: CurrentBests = { maxWeight: null, maxSetVolume: null, est1rm: null, maxRepsByWeight: {}, maxSessionVolume: null };
  for (const rec of records) {
    switch (rec.type) {
      case 'max_weight':
        r.maxWeight = rec.value;
        break;
      case 'max_set_volume':
        r.maxSetVolume = rec.value;
        break;
      case 'est_1rm':
        r.est1rm = rec.value;
        break;
      case 'max_session_volume':
        r.maxSessionVolume = rec.value;
        break;
      case 'max_reps_at_weight':
        r.maxRepsByWeight[String(round(rec.weightKg ?? 0, 3))] = rec.value;
        break;
    }
  }
  return r;
}

/**
 * Prüft live während des Trainings, ob ein gerade abgehakter Satz einen
 * bisherigen Rekord übertrifft. Gibt die übertroffenen Rekordtypen zurück.
 * Ohne bisherige Historie (null-Bestwerte) wird KEIN Rekord gemeldet,
 * damit das erste Training nicht mit "Rekorden" überflutet wird – ausgenommen
 * es existiert überhaupt ein Vergleichswert.
 */
export function detectSetRecords(
  set: SetLike,
  bests: CurrentBests | null,
): PersonalRecordType[] {
  if (!bests || !relevant(set)) return [];
  const out: PersonalRecordType[] = [];
  const w = set.weightKg ?? 0;
  if (w > 0 && bests.maxWeight !== null && w > bests.maxWeight) out.push('max_weight');
  const e = estimateOneRepMax(w, set.reps);
  if (e !== null && bests.est1rm !== null && e > bests.est1rm) out.push('est_1rm');
  const prevReps = bests.maxRepsByWeight[String(round(w, 3))];
  if (prevReps !== undefined && (set.reps ?? 0) > prevReps) out.push('max_reps_at_weight');
  return out;
}

export function recordKey(type: PersonalRecordType, weightKg: number | null): string {
  return type === 'max_reps_at_weight' ? `${type}:${round(weightKg ?? 0, 3)}` : type;
}
