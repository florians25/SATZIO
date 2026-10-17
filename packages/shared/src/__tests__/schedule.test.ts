import { describe, expect, it } from 'vitest';
import {
  advanceRotation,
  findMissedWorkouts,
  getNextWorkout,
  getTodayAssignment,
  getUpcomingRotation,
  getWeekPlan,
  moveWorkout,
  skipRotation,
  swapDates,
  type ScheduleDay,
  type ScheduleState,
} from '../index';

const days: ScheduleDay[] = [
  { id: 'push', name: 'Push', order: 0, weekday: 1 },
  { id: 'pull', name: 'Pull', order: 1, weekday: 2 },
  { id: 'legs', name: 'Legs', order: 2, weekday: 4 },
];
const flexible: ScheduleState = { mode: 'flexible', nextDayIndex: 0, paused: false, overrides: {} };
const fixed: ScheduleState = { ...flexible, mode: 'fixed' };

describe('Trainingsplanung – flexibel', () => {
  it('schlägt immer das nächste Workout vor, egal welcher Wochentag', () => {
    expect(getTodayAssignment(days, flexible, '2026-01-07')).toMatchObject({ type: 'workout', day: { id: 'push' } });
    const after = advanceRotation(days, flexible, 'push');
    expect(getTodayAssignment(days, after, '2026-01-10')).toMatchObject({ day: { id: 'pull' } });
    expect(advanceRotation(days, { ...flexible, nextDayIndex: 2 }, 'legs').nextDayIndex).toBe(0);
  });
  it('verpasste Tage verschieben nichts, Überspringen ist möglich', () => {
    const s = skipRotation(days, flexible);
    expect(getUpcomingRotation(days, s, 4).map((d) => d.id)).toEqual(['pull', 'legs', 'push', 'pull']);
  });
  it('pausierte Pläne schlagen nichts vor', () => {
    expect(getTodayAssignment(days, { ...flexible, paused: true }, '2026-01-05').type).toBe('paused');
    expect(getNextWorkout(days, { ...flexible, paused: true }, '2026-01-05')).toBeNull();
  });
});

describe('Trainingsplanung – feste Wochentage', () => {
  it('ordnet Wochentage zu und erkennt Ruhetage', () => {
    expect(getTodayAssignment(days, fixed, '2026-01-05')).toMatchObject({ type: 'workout', day: { id: 'push' } }); // Mo
    expect(getTodayAssignment(days, fixed, '2026-01-07').type).toBe('rest'); // Mi
    const week = getWeekPlan(days, fixed, '2026-01-07');
    expect(week.map((d) => (d.assignment.type === 'workout' ? d.assignment.day.id : d.assignment.type))).toEqual([
      'push', 'pull', 'rest', 'legs', 'rest', 'rest', 'rest',
    ]);
    expect(getNextWorkout(days, fixed, '2026-01-07')).toMatchObject({ date: '2026-01-08', day: { id: 'legs' } });
  });
  it('findet verpasste Einheiten und verschiebt sie', () => {
    const missed = findMissedWorkouts(days, fixed, { '2026-01-05': ['push'] }, '2026-01-07', 2);
    expect(missed.map((m) => m.day.id)).toEqual(['pull']);
    const moved = moveWorkout(fixed, '2026-01-06', '2026-01-07', 'pull');
    expect(getTodayAssignment(days, moved, '2026-01-07')).toMatchObject({ day: { id: 'pull' }, moved: true });
    expect(getTodayAssignment(days, moved, '2026-01-06').type).toBe('rest');
    expect(findMissedWorkouts(days, moved, { '2026-01-05': ['push'] }, '2026-01-07', 2)).toEqual([]);
  });
  it('tauscht Trainingstage', () => {
    const s = swapDates(days, fixed, '2026-01-05', '2026-01-07');
    expect(getTodayAssignment(days, s, '2026-01-05').type).toBe('rest');
    expect(getTodayAssignment(days, s, '2026-01-07')).toMatchObject({ day: { id: 'push' } });
  });
});
