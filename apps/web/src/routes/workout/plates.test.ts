import { describe, expect, it } from 'vitest';
import { calcPlates, groupPlates, PLATE_CONFIG, usesBarbell } from './plates';

describe('calcPlates', () => {
  const kg = PLATE_CONFIG.kg;
  const lbs = PLATE_CONFIG.lbs;

  it('rechnet Standard-kg-Gewichte', () => {
    expect(calcPlates(100, kg).perSide).toEqual([25, 15]);
    expect(calcPlates(60, kg).perSide).toEqual([20]);
    expect(calcPlates(142.5, kg).perSide).toEqual([25, 25, 10, 1.25]);
    expect(calcPlates(142.5, kg).remainder).toBe(0);
  });

  it('kommt mit 1,25-kg-Scheiben ohne Fließkommafehler klar', () => {
    const r = calcPlates(22.5, kg);
    expect(r.perSide).toEqual([1.25]);
    expect(r.loaded).toBe(22.5);
    expect(r.remainder).toBe(0);
  });

  it('meldet nicht steckbaren Rest', () => {
    const r = calcPlates(61, kg);
    expect(r.perSide).toEqual([20]);
    expect(r.loaded).toBe(60);
    expect(r.remainder).toBe(1);
  });

  it('leere Stange und Gewicht unter Stangengewicht', () => {
    expect(calcPlates(20, kg)).toMatchObject({ perSide: [], loaded: 20, remainder: 0, belowBar: false });
    expect(calcPlates(15, kg)).toMatchObject({ perSide: [], belowBar: true });
  });

  it('rechnet in lbs mit 45er-Stange', () => {
    expect(calcPlates(225, lbs).perSide).toEqual([45, 45]);
    expect(calcPlates(185, lbs).perSide).toEqual([45, 25]);
    expect(calcPlates(140, lbs).perSide).toEqual([45, 2.5]);
  });

  it('gruppiert Scheiben', () => {
    expect(groupPlates([25, 25, 10, 1.25])).toEqual([
      { plate: 25, count: 2 },
      { plate: 10, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
  });

  it('erkennt Langhantel-Übungen', () => {
    expect(usesBarbell('barbell')).toBe(true);
    expect(usesBarbell('smith_machine')).toBe(true);
    expect(usesBarbell('dumbbell')).toBe(false);
    expect(usesBarbell(undefined)).toBe(false);
  });
});
