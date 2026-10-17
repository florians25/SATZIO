import type { WeightUnit } from './enums';

/** Exakter Umrechnungsfaktor laut internationaler Definition. */
export const KG_PER_LB = 0.45359237;

/** Intern werden alle Gewichte in Kilogramm gespeichert. */
export function toKg(value: number, unit: WeightUnit): number {
  if (unit === 'kg') return round(value, 4);
  return round(value * KG_PER_LB, 4);
}

export function fromKg(kg: number, unit: WeightUnit): number {
  if (unit === 'kg') return round(kg, 2);
  return round(kg / KG_PER_LB, 1);
}

export function round(value: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/**
 * Parst deutsche und englische Zahlenschreibweisen ("22,5", "22.5", " 80 ").
 * Gibt null zurück, wenn keine gültige Zahl erkannt wird.
 */
export function parseDecimal(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === 'number') return Number.isFinite(input) ? input : null;
  const s = input.trim().replace(/\s/g, '').replace(',', '.');
  if (s === '' || s === '.' || s === '-') return null;
  if (!/^-?\d*\.?\d+$|^-?\d+\.$/.test(s)) return null;
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

/** Formatiert ein Gewicht für die Anzeige im deutschen Format (ohne Einheit). */
export function formatWeight(kg: number | null | undefined, unit: WeightUnit = 'kg', locale = 'de-DE'): string {
  if (kg === null || kg === undefined) return '–';
  const v = fromKg(kg, unit);
  return v.toLocaleString(locale, { maximumFractionDigits: unit === 'kg' ? 2 : 1 });
}

export function formatNumber(n: number, locale = 'de-DE', maxFractionDigits = 0): string {
  return n.toLocaleString(locale, { maximumFractionDigits: maxFractionDigits });
}

/** Rundet auf die nächste sinnvolle Scheibenstufe (z. B. 2,5 kg). */
export function roundToStep(kg: number, stepKg: number): number {
  if (stepKg <= 0) return round(kg, 2);
  return round(Math.round(kg / stepKg) * stepKg, 3);
}

/** Wendet eine Gewichtsänderung an, nie unter 0. */
export function adjustWeight(currentKg: number | null, deltaKg: number): number {
  const base = currentKg ?? 0;
  return Math.max(0, round(base + deltaKg, 3));
}

/** Gewichtsschritte für Schnellaktionen in der bevorzugten Einheit. */
export const DEFAULT_WEIGHT_STEPS_KG = [2.5, 5] as const;
export const ALL_WEIGHT_STEPS_KG = [0.5, 1, 2.5, 5] as const;
export const DEFAULT_WEIGHT_STEPS_LBS = [5, 10] as const;
