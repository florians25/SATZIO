import { addDays, isoWeekKey, startOfIsoWeek } from './dates';

/**
 * TRAININGSSERIEN (Streaks)
 *
 * Eine Serie zählt aufeinanderfolgende Kalenderwochen, in denen das
 * Wochenziel (geplante Trainingstage pro Woche) erreicht wurde. Dadurch
 * zerstören Ruhetage die Serie nicht – entscheidend ist nur, ob in der Woche
 * so oft trainiert wurde wie geplant. Die laufende Woche bricht die Serie nie,
 * solange sie noch nicht vorbei ist; sie zählt mit, sobald das Ziel erreicht ist.
 * Bei flexiblem Plan (Ziel 0) gilt mindestens 1 Training pro Woche.
 */
export interface StreakResult {
  current: number;
  longest: number;
  thisWeekCount: number;
  weeklyGoal: number;
  weeksGoalReached: number;
}

export function computeWeeklyStreak(workoutDateKeys: string[], weeklyGoal: number, todayKey: string): StreakResult {
  const goal = Math.max(1, weeklyGoal || 1);
  const perWeek = new Map<string, number>();
  for (const k of workoutDateKeys) {
    const w = isoWeekKey(k);
    perWeek.set(w, (perWeek.get(w) ?? 0) + 1);
  }
  const reached = (wk: string) => (perWeek.get(wk) ?? 0) >= goal;

  const thisWeekStart = startOfIsoWeek(todayKey);
  const thisWeek = isoWeekKey(thisWeekStart);
  const thisWeekCount = perWeek.get(thisWeek) ?? 0;

  let current = reached(thisWeek) ? 1 : 0;
  let cursor = addDays(thisWeekStart, -7);
  while (reached(isoWeekKey(cursor))) {
    current++;
    cursor = addDays(cursor, -7);
  }

  // Längste Serie: über alle Wochen vom ersten Training bis heute
  let longest = 0;
  let run = 0;
  let weeksGoalReached = 0;
  if (workoutDateKeys.length) {
    const first = [...workoutDateKeys].sort()[0];
    let wk = startOfIsoWeek(first);
    while (wk <= thisWeekStart) {
      const key = isoWeekKey(wk);
      if (reached(key)) {
        run++;
        weeksGoalReached++;
        longest = Math.max(longest, run);
      } else if (key !== thisWeek) {
        run = 0;
      }
      wk = addDays(wk, 7);
    }
  }
  return { current, longest: Math.max(longest, current), thisWeekCount, weeklyGoal: goal, weeksGoalReached };
}

/** Tage mit Training innerhalb des Zeitraums (für Kalenderansicht/Frequenz). */
export function workoutsPerWeek(workoutDateKeys: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const k of workoutDateKeys) {
    const wk = startOfIsoWeek(k);
    m.set(wk, (m.get(wk) ?? 0) + 1);
  }
  return m;
}
