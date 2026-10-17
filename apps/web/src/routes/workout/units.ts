import { fromKg, type WeightUnit } from '@satzio/shared';

/** Anzeigeeinheit; intern bleibt alles in kg. */
export function fromKgDisplay(kg: number, unit: WeightUnit): number {
  return fromKg(kg, unit);
}

/** Gewichtsschritte für Schnellaktionen in der Anzeigeeinheit. */
export function quickSteps(stepsKg: number[], exerciseStepKg: number | null, unit: WeightUnit): number[] {
  if (unit === 'lbs') return [5, 10];
  const steps = exerciseStepKg ? [exerciseStepKg, ...stepsKg.filter((s) => s > exerciseStepKg)] : stepsKg;
  return [...new Set(steps)].slice(0, 2);
}
