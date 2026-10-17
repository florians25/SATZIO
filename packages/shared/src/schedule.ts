import type { ScheduleMode, Weekday } from './enums';
import { addDays, diffDays, isoWeekday, startOfIsoWeek } from './dates';

/**
 * TRAININGSPLANUNG
 *
 * flexible: Rotation. Es folgt immer das nächste Workout der Reihe, egal an
 *           welchem Tag trainiert wird. Verpasste Tage verschieben nichts.
 * fixed:    Feste Wochentage je Trainingstag. Einzelne Termine können per
 *           "overrides" verschoben, getauscht oder als Ruhetag markiert werden.
 * paused:   Plan pausiert – keine Vorschläge, Serien laufen nicht weiter.
 */
export interface ScheduleDay {
  id: string;
  name: string;
  order: number;
  weekday: Weekday | null;
}

export interface ScheduleState {
  mode: ScheduleMode;
  /** Index (nach Sortierung) des nächsten Tages in der Rotation. */
  nextDayIndex: number;
  paused: boolean;
  /** Datum → Trainingstag-ID oder null (= Ruhetag) für Einzeländerungen im festen Modus. */
  overrides: Record<string, string | null>;
}

export type DayAssignment =
  | { type: 'workout'; day: ScheduleDay; moved?: boolean }
  | { type: 'rest' }
  | { type: 'paused' }
  | { type: 'none' };

function sorted(days: ScheduleDay[]): ScheduleDay[] {
  return [...days].sort((a, b) => a.order - b.order);
}

export function normalizeIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

/** Zuordnung eines Datums im festen Modus (ohne Pausen-/Rotationslogik). */
export function fixedAssignment(days: ScheduleDay[], state: ScheduleState, dateKey: string): DayAssignment {
  if (Object.prototype.hasOwnProperty.call(state.overrides, dateKey)) {
    const id = state.overrides[dateKey];
    if (id === null) return { type: 'rest' };
    const day = days.find((d) => d.id === id);
    return day ? { type: 'workout', day, moved: true } : { type: 'rest' };
  }
  const wd = isoWeekday(dateKey);
  const day = sorted(days).find((d) => d.weekday === wd);
  return day ? { type: 'workout', day } : { type: 'rest' };
}

/** Was steht heute an? */
export function getTodayAssignment(days: ScheduleDay[], state: ScheduleState, todayKey: string): DayAssignment {
  if (!days.length) return { type: 'none' };
  if (state.paused) return { type: 'paused' };
  if (state.mode === 'flexible') {
    const list = sorted(days);
    return { type: 'workout', day: list[normalizeIndex(state.nextDayIndex, list.length)] };
  }
  return fixedAssignment(days, state, todayKey);
}

/** Wochenübersicht (Mo–So) für den festen Modus bzw. Reihenfolge im flexiblen Modus. */
export function getWeekPlan(
  days: ScheduleDay[],
  state: ScheduleState,
  anyDateInWeek: string,
): { date: string; weekday: Weekday; assignment: DayAssignment }[] {
  const monday = startOfIsoWeek(anyDateInWeek);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i);
    const assignment: DayAssignment = state.paused
      ? { type: 'paused' }
      : state.mode === 'fixed'
        ? fixedAssignment(days, state, date)
        : { type: 'none' };
    return { date, weekday: (i + 1) as Weekday, assignment };
  });
}

/** Die nächsten n Workouts in der Rotation (flexibler Modus). */
export function getUpcomingRotation(days: ScheduleDay[], state: ScheduleState, count = 7): ScheduleDay[] {
  const list = sorted(days);
  if (!list.length) return [];
  return Array.from({ length: count }, (_, i) => list[normalizeIndex(state.nextDayIndex + i, list.length)]);
}

/** Nächstes Workout ab einem Datum (inklusive). */
export function getNextWorkout(
  days: ScheduleDay[],
  state: ScheduleState,
  fromKey: string,
  horizonDays = 14,
): { date: string | null; day: ScheduleDay } | null {
  if (!days.length || state.paused) return null;
  if (state.mode === 'flexible') {
    const list = sorted(days);
    return { date: null, day: list[normalizeIndex(state.nextDayIndex, list.length)] };
  }
  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(fromKey, i);
    const a = fixedAssignment(days, state, date);
    if (a.type === 'workout') return { date, day: a.day };
  }
  return null;
}

/** Nach Abschluss eines Workouts: Rotation auf den Folgetag setzen. */
export function advanceRotation(days: ScheduleDay[], state: ScheduleState, completedDayId: string): ScheduleState {
  const list = sorted(days);
  const idx = list.findIndex((d) => d.id === completedDayId);
  if (idx === -1) return state;
  return { ...state, nextDayIndex: normalizeIndex(idx + 1, list.length) };
}

/** Einen Tag in der Rotation überspringen. */
export function skipRotation(days: ScheduleDay[], state: ScheduleState): ScheduleState {
  return { ...state, nextDayIndex: normalizeIndex(state.nextDayIndex + 1, days.length) };
}

/**
 * Verpasste Trainings im festen Modus finden: geplante Tage der letzten
 * `lookbackDays`, an denen dieser Trainingstag nicht absolviert wurde.
 * `completedByDate`: Datum → IDs der absolvierten Trainingstage.
 */
export function findMissedWorkouts(
  days: ScheduleDay[],
  state: ScheduleState,
  completedByDate: Record<string, string[]>,
  todayKey: string,
  lookbackDays = 6,
): { date: string; day: ScheduleDay }[] {
  if (state.mode !== 'fixed' || state.paused) return [];
  const completedIds = new Set<string>();
  for (let i = lookbackDays; i >= 0; i--) {
    for (const id of completedByDate[addDays(todayKey, -i)] ?? []) completedIds.add(id);
  }
  const missed: { date: string; day: ScheduleDay }[] = [];
  for (let i = lookbackDays; i >= 1; i--) {
    const date = addDays(todayKey, -i);
    const a = fixedAssignment(days, state, date);
    if (a.type !== 'workout') continue;
    // gilt als nachgeholt, wenn der Tag danach (bis heute) absolviert wurde
    const doneLater = Object.entries(completedByDate).some(
      ([d, ids]) => d >= date && d <= todayKey && ids.includes(a.day.id),
    );
    if (!doneLater) missed.push({ date, day: a.day });
  }
  return missed;
}

/** Verpasstes Training auf ein Datum (z. B. heute) verschieben. */
export function moveWorkout(state: ScheduleState, fromDate: string, toDate: string, dayId: string): ScheduleState {
  return { ...state, overrides: { ...state.overrides, [fromDate]: null, [toDate]: dayId } };
}

/** Zwei Termine im festen Modus tauschen. */
export function swapDates(days: ScheduleDay[], state: ScheduleState, a: string, b: string): ScheduleState {
  const aa = fixedAssignment(days, state, a);
  const bb = fixedAssignment(days, state, b);
  return {
    ...state,
    overrides: {
      ...state.overrides,
      [a]: bb.type === 'workout' ? bb.day.id : null,
      [b]: aa.type === 'workout' ? aa.day.id : null,
    },
  };
}

/** Alte Einzeländerungen (älter als `keepDays`) entfernen. */
export function pruneOverrides(state: ScheduleState, todayKey: string, keepDays = 30): ScheduleState {
  const overrides: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(state.overrides)) {
    if (diffDays(todayKey, k) <= keepDays) overrides[k] = v;
  }
  return { ...state, overrides };
}

export const DEFAULT_SCHEDULE_STATE: ScheduleState = {
  mode: 'flexible',
  nextDayIndex: 0,
  paused: false,
  overrides: {},
};

/** Schlägt sinnvolle Wochentage für n Trainingstage vor. */
export function suggestWeekdays(count: number): Weekday[] {
  const presets: Record<number, Weekday[]> = {
    1: [1],
    2: [1, 4],
    3: [1, 3, 5],
    4: [1, 2, 4, 5],
    5: [1, 2, 3, 5, 6],
    6: [1, 2, 3, 4, 5, 6],
    7: [1, 2, 3, 4, 5, 6, 7],
  };
  return presets[Math.min(7, Math.max(1, count))];
}
