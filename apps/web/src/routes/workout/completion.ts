import { bestsFromRecords, detectSetRecords, type CurrentBests, type WorkoutSetView } from '@satzio/shared';
import { useAuth } from '@/lib/auth';
import { coach } from '@/lib/coach';
import { vibrate } from '@/lib/feedback';
import { usePerformance } from '@/lib/queries';
import { useTimer } from '@/lib/timer';
import { useWorkout } from '@/lib/workout';

/**
 * Nebenwirkungen beim Abhaken eines Satzes: Haptik, Pausentimer,
 * Coach-Meldungen und Live-Erkennung persönlicher Rekorde.
 */
export function useSetToggle() {
  const toggle = useWorkout((s) => s.toggleSet);
  const settings = useAuth((s) => s.user?.settings);
  const { map: performance } = usePerformance();

  return (exId: string, setId: string) => {
    const before = useWorkout.getState().session;
    const result = toggle(exId, setId);
    const session = useWorkout.getState().session;
    if (!result || !before || !session || !settings) return;
    if (!result.completed) return;
    if (settings.vibrationEnabled) vibrate(15);
    if (session.status === 'completed') return;

    const ex = session.exercises.find((e) => e.id === exId)!;
    const all = session.exercises.flatMap((e) => e.sets);
    const total = all.length;
    const doneAfter = all.filter((s) => s.completed).length;
    const doneBefore = before.exercises.flatMap((e) => e.sets).filter((s) => s.completed).length;
    const remainingInExercise = ex.sets.filter((s) => !s.completed).length;
    const level = settings.motivationLevel;

    // Pausentimer automatisch starten (nicht nach dem allerletzten Satz)
    if (settings.autoStartRestTimer && doneAfter < total) {
      const rest = ex.restSeconds ?? settings.defaultRestSeconds;
      const nextEx = remainingInExercise > 0 ? ex : [...session.exercises].sort((a, b) => a.order - b.order).find((e) => e.sets.some((s) => !s.completed));
      useTimer.getState().start(rest, nextEx?.name ?? null);
    }

    // Persönlicher Rekord? (verglichen mit Historie + bisherigen Sätzen dieser Einheit)
    if (ex.exerciseId) {
      const perf = performance.get(ex.exerciseId);
      if (perf) {
        const bests = mergeSessionBests(perf.bests, ex.sets.filter((s) => s.id !== setId));
        const prs = detectSetRecords(result, bests);
        if (prs.length) {
          coach({ type: 'personal_record', exerciseName: ex.name }, level === 'off' ? 'off' : 'subtle', session.id);
          if (settings.vibrationEnabled) vibrate([30, 40, 60]);
          return;
        }
      }
    }
    if (total > 1 && doneBefore < total / 2 && doneAfter >= total / 2) {
      coach({ type: 'halfway' }, level, session.id);
      return;
    }
    if (remainingInExercise === 0) {
      const remainingExercises = session.exercises.filter((e) => e.sets.some((s) => !s.completed)).length;
      coach({ type: 'exercise_completed', remainingExercises }, level, `${session.id}:${exId}`);
      return;
    }
    coach({ type: 'set_completed', completedSets: doneAfter, totalSets: total, remainingInExercise }, level, `${session.id}:${setId}`);
  };
}

function mergeSessionBests(base: CurrentBests, sets: WorkoutSetView[]): CurrentBests {
  const extra = sets
    .filter((s) => s.completed && s.type !== 'warmup' && s.reps)
    .flatMap((s) => [
      { type: 'max_weight' as const, value: s.weightKg ?? 0, weightKg: s.weightKg },
      { type: 'max_reps_at_weight' as const, value: s.reps ?? 0, weightKg: s.weightKg ?? 0 },
    ])
    .sort((a, b) => a.value - b.value); // größter Wert zuletzt → gewinnt
  const merged = bestsFromRecords(extra);
  const out: CurrentBests = { ...base, maxRepsByWeight: { ...base.maxRepsByWeight } };
  if (merged.maxWeight !== null && (out.maxWeight === null || merged.maxWeight > out.maxWeight)) out.maxWeight = merged.maxWeight;
  for (const [w, r] of Object.entries(merged.maxRepsByWeight)) {
    if (out.maxRepsByWeight[w] === undefined || r > out.maxRepsByWeight[w]) out.maxRepsByWeight[w] = r;
  }
  return out;
}
