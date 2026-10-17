import type { SharedPlan } from './schemas';

/** Text-Export eines Plans/Workouts im Notizen-Stil (für Teilen & Zwischenablage). */
export function planToNotesText(plan: SharedPlan['plan']): string {
  const lines: string[] = [plan.name.toUpperCase(), ''];
  for (const day of plan.days) {
    lines.push(day.name);
    for (const ex of day.exercises) {
      const working = ex.sets.filter((s) => s.type === 'working');
      const sample = working[0] ?? ex.sets[0];
      if (!sample) {
        lines.push(ex.name);
        continue;
      }
      const reps =
        sample.repsMin !== null && sample.repsMax !== null && sample.repsMin !== sample.repsMax
          ? `${sample.repsMin}-${sample.repsMax}`
          : String(sample.repsMin ?? sample.repsMax ?? '');
      const weight =
        sample.targetWeightKg !== null
          ? ` ${sample.targetWeightKg.toLocaleString('de-DE', { maximumFractionDigits: 2 })}kg`
          : '';
      lines.push(`${ex.name} ${working.length || ex.sets.length}x${reps}${weight}`.trim());
    }
    lines.push('');
  }
  return lines.join('\n').trim() + '\n';
}
