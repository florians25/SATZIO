import { describe, expect, it } from 'vitest';
import { computeWeeklyStreak, isoWeekKey, suggestProgression } from '../index';

const ws = (weightKg: number, reps: number) => ({ weightKg, reps, completed: true, type: 'working' as const });

describe('Progressionsvorschläge', () => {
  const target = { sets: 3, repsMin: 8, repsMax: 12 };
  it('schlägt eine moderate Steigerung vor, wenn alle Zielsätze geschafft sind', () => {
    const s = suggestProgression(target, [{ performedAt: '2026-01-08', sets: [ws(60, 12), ws(60, 12), ws(60, 12)] }]);
    expect(s).toMatchObject({ type: 'increase', fromKg: 60, toKg: 62.5 });
    expect(s && 'reason' in s && s.reason).toContain('62,5 kg');
  });
  it('kein Vorschlag, wenn ein Satz fehlt oder zu wenige Wdh.', () => {
    expect(suggestProgression(target, [{ performedAt: 'x', sets: [ws(60, 12), ws(60, 11), ws(60, 12)] }])).toBeNull();
    expect(suggestProgression(target, [{ performedAt: 'x', sets: [ws(60, 12), ws(60, 12)] }])).toBeNull();
    expect(suggestProgression(target, [])).toBeNull();
  });
  it('respektiert konfigurierbare Schritte (z. B. Kurzhanteln 2 kg)', () => {
    const s = suggestProgression(target, [{ performedAt: 'x', sets: [ws(20, 12), ws(20, 12), ws(20, 12)] }], 2);
    expect(s).toMatchObject({ type: 'increase', toKg: 22 });
  });
  it('erkennt Stagnation und steigert dann nicht', () => {
    const h = [
      { performedAt: '3', sets: [ws(80, 7), ws(80, 6), ws(80, 6)] },
      { performedAt: '2', sets: [ws(80, 7), ws(80, 7), ws(80, 6)] },
      { performedAt: '1', sets: [ws(80, 8), ws(80, 7), ws(80, 6)] },
    ];
    expect(suggestProgression(target, h)).toMatchObject({ type: 'hold', weightKg: 80 });
  });
  it('Eigengewicht: mehr Wiederholungen statt Gewicht', () => {
    const s = suggestProgression(target, [{ performedAt: 'x', sets: [ws(0, 12), ws(0, 12), ws(0, 13)] }]);
    expect(s?.type).toBe('reps');
  });
});

describe('Trainingsserien', () => {
  it('ISO-Wochen korrekt', () => {
    expect(isoWeekKey('2026-01-01')).toBe('2026-W01');
    expect(isoWeekKey('2024-12-30')).toBe('2025-W01');
    expect(isoWeekKey('2027-01-03')).toBe('2026-W53');
  });
  it('zählt Wochen mit erreichtem Ziel – Ruhetage brechen die Serie nicht', () => {
    // Ziel: 3x pro Woche; Wochen ab Mo 2026-01-05
    const dates = [
      '2026-01-05', '2026-01-07', '2026-01-09', // KW2 ✓
      '2026-01-12', '2026-01-14', '2026-01-16', // KW3 ✓
      '2026-01-19', '2026-01-21', // KW4 (laufend, noch nicht erreicht)
    ];
    const r = computeWeeklyStreak(dates, 3, '2026-01-22');
    expect(r.current).toBe(2);
    expect(r.thisWeekCount).toBe(2);
    expect(r.longest).toBe(2);
  });
  it('bricht bei verpasster Woche', () => {
    const dates = ['2026-01-05', '2026-01-07', '2026-01-19', '2026-01-21'];
    const r = computeWeeklyStreak(dates, 2, '2026-02-05');
    expect(r.current).toBe(0);
    expect(r.longest).toBe(1);
    expect(r.weeksGoalReached).toBe(2);
  });
  it('laufende Woche zählt, sobald Ziel erreicht', () => {
    const r = computeWeeklyStreak(['2026-01-12', '2026-01-19', '2026-01-20'], 2, '2026-01-21');
    expect(r.current).toBe(1);
  });
  it('flexibel (Ziel 0) bedeutet mindestens 1 Training/Woche', () => {
    const r = computeWeeklyStreak(['2026-01-05', '2026-01-12', '2026-01-19'], 0, '2026-01-20');
    expect(r.current).toBe(3);
  });
});
