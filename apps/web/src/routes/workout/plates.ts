import type { Equipment, WeightUnit } from '@satzio/shared';

/**
 * SCHEIBENRECHNER
 * Reine Berechnung (ohne UI), welche Scheiben pro Seite auf die Stange müssen.
 * Gerechnet wird in der Anzeigeeinheit (kg oder lbs) in ganzzahligen
 * Hundertsteln, damit 1,25-kg-Scheiben nicht an Fließkomma-Fehlern scheitern.
 */
export interface PlateConfig {
  bar: number;
  /** Verfügbare Scheiben (je Seite beliebig oft), absteigend sortiert. */
  plates: number[];
}

export const PLATE_CONFIG: Record<WeightUnit, PlateConfig> = {
  kg: { bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25] },
  lbs: { bar: 45, plates: [45, 35, 25, 10, 5, 2.5] },
};

export interface PlateResult {
  bar: number;
  /** Scheiben einer Seite, schwerste zuerst (innen → außen). */
  perSide: number[];
  /** Tatsächlich steckbares Gesamtgewicht. */
  loaded: number;
  /** Differenz zum Zielgewicht, die sich nicht stecken lässt (≥ 0). */
  remainder: number;
  /** Ziel liegt unter dem Stangengewicht. */
  belowBar: boolean;
}

const C = 100;
const toC = (v: number) => Math.round(v * C);

export function calcPlates(total: number, config: PlateConfig): PlateResult {
  const bar = config.bar;
  if (!Number.isFinite(total) || toC(total) <= toC(bar)) {
    return { bar, perSide: [], loaded: bar, remainder: Math.max(0, total - bar), belowBar: toC(total) < toC(bar) };
  }
  let side = Math.floor((toC(total) - toC(bar)) / 2);
  const perSide: number[] = [];
  const sorted = [...config.plates].sort((a, b) => b - a);
  for (const p of sorted) {
    const pc = toC(p);
    while (pc > 0 && side >= pc) {
      perSide.push(p);
      side -= pc;
    }
  }
  const loadedC = toC(bar) + 2 * perSide.reduce((s, p) => s + toC(p), 0);
  return { bar, perSide, loaded: loadedC / C, remainder: (toC(total) - loadedC) / C, belowBar: false };
}

/** Gruppiert gleiche Scheiben: [20, 20, 5] → [{plate: 20, count: 2}, {plate: 5, count: 1}] */
export function groupPlates(perSide: number[]): { plate: number; count: number }[] {
  const out: { plate: number; count: number }[] = [];
  for (const p of perSide) {
    const last = out[out.length - 1];
    if (last && last.plate === p) last.count++;
    else out.push({ plate: p, count: 1 });
  }
  return out;
}

/** Scheibenrechner nur für Langhantel-Übungen sinnvoll. */
export function usesBarbell(equipment: Equipment | null | undefined): boolean {
  return equipment === 'barbell' || equipment === 'smith_machine';
}
