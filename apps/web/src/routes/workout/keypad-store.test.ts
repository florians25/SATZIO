import { describe, expect, it } from 'vitest';
import { applyKey, nextFieldAfter, nextOpenSet } from './keypad-store';

const w = { fresh: false, decimals: true, max: 1000 };

describe('applyKey', () => {
  it('erster Tastendruck ersetzt den Wert', () => {
    expect(applyKey('80', '6', { ...w, fresh: true })).toBe('6');
    expect(applyKey('80', 'back', { ...w, fresh: true })).toBe('');
    expect(applyKey('80', ',', { ...w, fresh: true })).toBe('0,');
  });
  it('hängt danach an', () => {
    expect(applyKey('8', '2', w)).toBe('82');
    expect(applyKey('82', ',', w)).toBe('82,');
    expect(applyKey('82,', '5', w)).toBe('82,5');
    expect(applyKey('82,5', 'back', w)).toBe('82,');
  });
  it('ignoriert ungültige Eingaben', () => {
    expect(applyKey('82,5', ',', w)).toBeNull();
    expect(applyKey('82,25', '1', w)).toBeNull();
    expect(applyKey('100', '1', w)).toBeNull(); // > max
    expect(applyKey('8', ',', { ...w, decimals: false })).toBeNull();
  });
  it('keine führende Null', () => {
    expect(applyKey('0', '5', w)).toBe('5');
    expect(applyKey('0,', '5', w)).toBe('0,5');
  });
});

const exercises = [
  { id: 'b', order: 1, sets: [{ id: 'b1', completed: false }] },
  { id: 'a', order: 0, sets: [{ id: 'a1', completed: true }, { id: 'a2', completed: false }, { id: 'a3', completed: false }] },
];

describe('Navigation', () => {
  it('Weiter: Gewicht → Wdh. → nächster Satz (über Übungen hinweg)', () => {
    expect(nextFieldAfter(exercises, { exId: 'a', setId: 'a2', field: 'weight' })).toEqual({ exId: 'a', setId: 'a2', field: 'reps' });
    expect(nextFieldAfter(exercises, { exId: 'a', setId: 'a3', field: 'reps' })).toEqual({ exId: 'b', setId: 'b1', field: 'weight' });
    expect(nextFieldAfter(exercises, { exId: 'b', setId: 'b1', field: 'reps' })).toBeNull();
  });
  it('Satz fertig: nächster offener Satz, sonst von vorn', () => {
    expect(nextOpenSet(exercises, { exId: 'a', setId: 'a2' })).toEqual({ exId: 'a', setId: 'a3', field: 'weight' });
    expect(nextOpenSet(exercises, { exId: 'b', setId: 'b1' })).toEqual({ exId: 'a', setId: 'a2', field: 'weight' });
    const done = exercises.map((e) => ({ ...e, sets: e.sets.map((s) => ({ ...s, completed: true })) }));
    expect(nextOpenSet(done, { exId: 'a', setId: 'a2' })).toBeNull();
  });
});
