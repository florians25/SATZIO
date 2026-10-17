import { describe, expect, it } from 'vitest';
import { coachMessage, evaluateAchievements } from '../index';

describe('SATZIO Coach', () => {
  it('schweigt bei "Aus" und ist dezent standardmäßig', () => {
    expect(coachMessage({ type: 'halfway' }, 'off')).toBeNull();
    expect(coachMessage({ type: 'set_completed', completedSets: 1, totalSets: 10, remainingInExercise: 2 }, 'subtle')).toBeNull();
    expect(coachMessage({ type: 'halfway' }, 'subtle')).not.toBeNull();
    expect(coachMessage({ type: 'set_completed', completedSets: 1, totalSets: 10, remainingInExercise: 2 }, 'intense')?.text).toBe(
      'Stark! Noch zwei Sätze.',
    );
  });
  it('ist deterministisch', () => {
    const a = coachMessage({ type: 'workout_completed' }, 'normal', 'abc');
    const b = coachMessage({ type: 'workout_completed' }, 'normal', 'abc');
    expect(a).toEqual(b);
  });
  it('meldet Rekorde und Restübungen', () => {
    expect(coachMessage({ type: 'personal_record', exerciseName: 'Bankdrücken' }, 'subtle')?.text).toContain('Bankdrücken');
    expect(coachMessage({ type: 'exercise_completed', remainingExercises: 1 }, 'normal')?.text).toBe(
      'Noch eine Übung bis zum Feierabend.',
    );
  });
});

describe('Achievements', () => {
  const base = { workoutCount: 0, prCount: 0, weeksGoalReached: 0, longestWeeklyStreak: 0, newMaxSessionVolume: false, totalVolumeKg: 0 };
  it('schaltet passende Achievements frei, keine doppelten', () => {
    expect(evaluateAchievements({ ...base, workoutCount: 1 }, new Set())).toEqual(['first_workout']);
    expect(evaluateAchievements({ ...base, workoutCount: 10, prCount: 1 }, new Set(['first_workout']))).toEqual([
      'workouts_10',
      'first_pr',
    ]);
  });
});
