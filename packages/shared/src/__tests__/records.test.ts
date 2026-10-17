import { describe, expect, it } from 'vitest';
import { bestsFromRecords, computePersonalRecords, detectSetRecords } from '../index';

const w = (weightKg: number, reps: number, completed = true, id?: string) => ({
  id,
  weightKg,
  reps,
  completed,
  type: 'working' as const,
});

describe('Persönliche Rekorde', () => {
  const history = [
    { sessionId: 's1', performedAt: '2026-01-01T10:00:00Z', sets: [w(80, 10, true, 'a'), w(80, 8, true, 'b')] },
    { sessionId: 's2', performedAt: '2026-01-08T10:00:00Z', sets: [w(85, 6, true, 'c'), w(80, 11, true, 'd')] },
    { sessionId: 's3', performedAt: '2026-01-15T10:00:00Z', sets: [w(90, 1, false, 'e')] },
  ];

  it('erkennt Rekorde deterministisch und ohne Duplikate', () => {
    const recs = computePersonalRecords(history);
    const byKey = Object.fromEntries(recs.map((r) => [r.type + (r.type === 'max_reps_at_weight' ? `:${r.weightKg}` : ''), r]));
    expect(byKey.max_weight.value).toBe(85);
    expect(byKey.max_weight.sessionId).toBe('s2');
    expect(byKey['max_reps_at_weight:80'].value).toBe(11);
    expect(byKey.max_set_volume.value).toBe(880);
    expect(byKey.est_1rm.value).toBe(109.3);
    expect(byKey.max_session_volume.value).toBe(1440);
    expect(byKey.max_session_volume.sessionId).toBe('s1');
    // Wiederholte Berechnung liefert identisches Ergebnis (Idempotenz)
    expect(computePersonalRecords(history)).toEqual(recs);
    // Nicht abgeschlossene Sätze zählen nicht
    expect(recs.some((r) => r.sessionId === 's3')).toBe(false);
  });

  it('berechnet nach nachträglicher Korrektur neu', () => {
    const corrected = history.map((h) => (h.sessionId === 's2' ? { ...h, sets: [w(82.5, 6), w(80, 11)] } : h));
    const recs = computePersonalRecords(corrected);
    expect(recs.find((r) => r.type === 'max_weight')?.value).toBe(82.5);
  });

  it('erkennt Live-Rekorde beim Abhaken', () => {
    const bests = bestsFromRecords(computePersonalRecords(history));
    expect(detectSetRecords(w(87.5, 3), bests)).toContain('max_weight');
    expect(detectSetRecords(w(80, 12), bests)).toContain('max_reps_at_weight');
    expect(detectSetRecords(w(70, 5), bests)).toEqual([]);
    expect(detectSetRecords({ ...w(100, 5), type: 'warmup' }, bests)).toEqual([]);
    expect(detectSetRecords(w(100, 5), null)).toEqual([]);
  });
});
