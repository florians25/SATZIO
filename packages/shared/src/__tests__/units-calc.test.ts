import { describe, expect, it } from 'vitest';
import {
  adjustWeight,
  estimateOneRepMax,
  formatRepRange,
  fromKg,
  parseDecimal,
  parseRepRange,
  repsInRange,
  roundToStep,
  setVolume,
  toKg,
  totalReps,
  totalVolume,
  workoutDurationMinutes,
} from '../index';

describe('Gewichtsumrechnung', () => {
  it('rechnet kg ↔ lbs verlustfrei für typische Werte', () => {
    expect(toKg(135, 'lbs')).toBeCloseTo(61.235, 3);
    expect(fromKg(toKg(135, 'lbs'), 'lbs')).toBe(135);
    expect(fromKg(toKg(225, 'lbs'), 'lbs')).toBe(225);
    expect(toKg(80, 'kg')).toBe(80);
    expect(fromKg(100, 'lbs')).toBe(220.5);
  });
  it('parst deutsche Dezimalzahlen', () => {
    expect(parseDecimal('22,5')).toBe(22.5);
    expect(parseDecimal('22.5')).toBe(22.5);
    expect(parseDecimal(' 80 ')).toBe(80);
    expect(parseDecimal('')).toBeNull();
    expect(parseDecimal('abc')).toBeNull();
    expect(parseDecimal('1,2,3')).toBeNull();
  });
  it('passt Gewichte an und rundet auf Stufen', () => {
    expect(adjustWeight(60, 2.5)).toBe(62.5);
    expect(adjustWeight(1, -5)).toBe(0);
    expect(adjustWeight(null, 5)).toBe(5);
    expect(roundToStep(61.2, 2.5)).toBe(60);
    expect(roundToStep(61.3, 2.5)).toBe(62.5);
  });
});

describe('Trainingsvolumen', () => {
  const sets = [
    { weightKg: 60, reps: 12, completed: true, type: 'warmup' as const },
    { weightKg: 80, reps: 10, completed: true, type: 'working' as const },
    { weightKg: 80, reps: 8, completed: true, type: 'working' as const },
    { weightKg: 80, reps: 8, completed: false, type: 'working' as const },
    { weightKg: null, reps: 10, completed: true, type: 'working' as const },
  ];
  it('zählt nur abgeschlossene Arbeitssätze', () => {
    expect(totalVolume(sets)).toBe(1440);
    expect(totalVolume(sets, { includeWarmup: true })).toBe(2160);
    expect(totalReps(sets)).toBe(28);
  });
  it('Satzvolumen', () => {
    expect(setVolume(sets[1])).toBe(800);
    expect(setVolume(sets[3])).toBe(0);
  });
});

describe('Wiederholungsbereiche', () => {
  it('parst Bereiche', () => {
    expect(parseRepRange('8-12')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('12–8')).toEqual({ min: 8, max: 12 });
    expect(parseRepRange('10')).toEqual({ min: 10, max: 10 });
    expect(parseRepRange('8 bis 10')).toEqual({ min: 8, max: 10 });
    expect(parseRepRange('x')).toBeNull();
  });
  it('formatiert und bewertet', () => {
    expect(formatRepRange(8, 12)).toBe('8–12');
    expect(formatRepRange(10, 10)).toBe('10');
    expect(repsInRange(7, 8, 12)).toBe('below');
    expect(repsInRange(12, 8, 12)).toBe('in');
    expect(repsInRange(13, 8, 12)).toBe('above');
    expect(repsInRange(null, 8, 12)).toBe('unknown');
  });
});

describe('Geschätztes 1RM', () => {
  it('nutzt Epley und kennzeichnet Grenzen', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBe(133.3);
    expect(estimateOneRepMax(100, 15)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
    expect(estimateOneRepMax(null, 5)).toBeNull();
  });
});

describe('Trainingsdauer', () => {
  it('zieht Pausen ab', () => {
    expect(workoutDurationMinutes('2026-01-01T10:00:00Z', '2026-01-01T11:08:00Z')).toBe(68);
    expect(workoutDurationMinutes('2026-01-01T10:00:00Z', '2026-01-01T11:08:00Z', 600)).toBe(58);
  });
});
