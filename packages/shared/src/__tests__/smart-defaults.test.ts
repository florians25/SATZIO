import { describe, expect, it } from 'vitest';
import { buildPrefilledSets, nextSetDefaults } from '../index';

const planned = [
  { type: 'warmup' as const, repsMin: 10, repsMax: 10, targetWeightKg: null },
  { type: 'working' as const, repsMin: 8, repsMax: 12, targetWeightKg: null },
  { type: 'working' as const, repsMin: 8, repsMax: 12, targetWeightKg: null },
  { type: 'working' as const, repsMin: 8, repsMax: 12, targetWeightKg: null },
];

describe('Smart Defaults', () => {
  it('übernimmt die letzten tatsächlichen Werte je Satzposition', () => {
    const last = {
      sessionId: 's',
      performedAt: '2026-01-01',
      sets: [
        { type: 'warmup' as const, weightKg: 40, reps: 10, completed: true },
        { type: 'working' as const, weightKg: 60, reps: 12, completed: true },
        { type: 'working' as const, weightKg: 70, reps: 10, completed: true },
      ],
    };
    const res = buildPrefilledSets({ planned, last });
    expect(res).toHaveLength(4);
    expect(res[0]).toMatchObject({ type: 'warmup', weightKg: 40, reps: 10, weightSource: 'history' });
    expect(res[1]).toMatchObject({ weightKg: 60, reps: 12, weightSource: 'history', repsSource: 'history' });
    expect(res[2]).toMatchObject({ weightKg: 70, reps: 10 });
    // 3. Arbeitssatz hatte kein Gegenstück → letzter Satz desselben Typs
    expect(res[3]).toMatchObject({ weightKg: 70, reps: 10, weightSource: 'history' });
  });

  it('erfindet keine Gewichte ohne Historie', () => {
    const res = buildPrefilledSets({ planned });
    expect(res.every((s) => s.weightKg === null && s.weightSource === 'none')).toBe(true);
    expect(res[1]).toMatchObject({ reps: 8, repsSource: 'plan', targetRepsMin: 8, targetRepsMax: 12 });
  });

  it('nutzt Plan-Zielgewicht und eigene Standardwerte', () => {
    const res = buildPrefilledSets({
      planned: [{ type: 'working', repsMin: 5, repsMax: 5, targetWeightKg: 100 }],
      userDefaults: { defaultWeightKg: 50 },
    });
    expect(res[0]).toMatchObject({ weightKg: 100, weightSource: 'plan', reps: 5 });
    const res2 = buildPrefilledSets({
      planned: [{ type: 'working', repsMin: null, repsMax: null, targetWeightKg: null }],
      userDefaults: { defaultWeightKg: 50, defaultReps: 10 },
    });
    expect(res2[0]).toMatchObject({ weightKg: 50, weightSource: 'user_default', reps: 10, repsSource: 'user_default' });
  });

  it('verwirft veraltete Wiederholungen außerhalb des neuen Zielbereichs', () => {
    const res = buildPrefilledSets({
      planned: [{ type: 'working', repsMin: 3, repsMax: 5, targetWeightKg: null }],
      last: { sessionId: 's', performedAt: 'x', sets: [{ type: 'working', weightKg: 80, reps: 10, completed: true }] },
    });
    expect(res[0]).toMatchObject({ weightKg: 80, weightSource: 'history', reps: 3, repsSource: 'plan' });
  });

  it('ohne Plan: Satzanzahl aus letztem Training bzw. 3 leere Sätze', () => {
    const res = buildPrefilledSets({
      last: {
        sessionId: 's',
        performedAt: 'x',
        sets: [
          { type: 'working', weightKg: 20, reps: 15, completed: true },
          { type: 'working', weightKg: 20, reps: 12, completed: true },
        ],
      },
    });
    expect(res).toHaveLength(2);
    expect(buildPrefilledSets({})).toHaveLength(3);
  });

  it('neuer Satz kopiert den letzten Arbeitssatz', () => {
    expect(
      nextSetDefaults([
        { type: 'working', weightKg: 70, reps: 8, completed: true },
        { type: 'warmup', weightKg: 20, reps: 10, completed: true },
      ]),
    ).toMatchObject({ type: 'working', weightKg: 70, reps: 8 });
    expect(nextSetDefaults([])).toMatchObject({ weightKg: null, reps: null });
  });
});
