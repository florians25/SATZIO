import { formatRepRange, suggestProgression, type ExercisePerformance, type WeightUnit } from '@satzio/shared';
import { MoreHorizontal, Plus, TrendingUp } from 'lucide-react';
import { memo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ExerciseImage } from '@/components/MuscleMap';
import { cn } from '@/lib/cn';
import { fmtWeight } from '@/lib/format';
import { useWorkout } from '@/lib/workout';
import { SetRow } from './SetRow';

export const ExerciseBlock = memo(function ExerciseBlock({
  exId,
  unit,
  performance,
  imageUrl,
  progressionEnabled,
  onToggle,
  onSetMenu,
  onExerciseMenu,
}: {
  exId: string;
  unit: WeightUnit;
  performance: ExercisePerformance | undefined;
  imageUrl: string | null | undefined;
  progressionEnabled: boolean;
  onToggle: (exId: string, setId: string) => void;
  onSetMenu: (exId: string, setId: string) => void;
  onExerciseMenu: (exId: string) => void;
}) {
  // Nur Struktur abonnieren (IDs, Name) – Satzwerte rendert jede Zeile selbst
  const meta = useWorkout(
    useShallow((s) => {
      const e = s.session?.exercises.find((x) => x.id === exId);
      return e
        ? {
            name: e.name,
            primaryMuscle: e.primaryMuscle,
            restSeconds: e.restSeconds,
            supersetGroup: e.supersetGroup,
            notes: e.notes,
            weightStepKg: e.weightStepKg,
            setIds: e.sets.map((x) => x.id).join(','),
            doneCount: e.sets.filter((x) => x.completed).length,
            targetMin: e.sets.find((x) => x.type === 'working')?.targetRepsMin ?? null,
            targetMax: e.sets.find((x) => x.type === 'working')?.targetRepsMax ?? null,
            workingCount: e.sets.filter((x) => x.type === 'working').length,
            status: s.session?.status,
          }
        : null;
    }),
  );
  const addSet = useWorkout((s) => s.addSet);
  const applySuggestion = useWorkout((s) => s.updateSet);
  if (!meta) return null;
  const setIds = meta.setIds ? meta.setIds.split(',') : [];
  const allDone = setIds.length > 0 && meta.doneCount === setIds.length;

  const suggestion =
    progressionEnabled && meta.status !== 'completed' && performance && meta.targetMax !== null
      ? suggestProgression(
          { sets: meta.workingCount, repsMin: meta.targetMin, repsMax: meta.targetMax },
          performance.recent,
          meta.weightStepKg ?? 2.5,
        )
      : null;

  const applyIncrease = () => {
    if (suggestion?.type !== 'increase') return;
    const ex = useWorkout.getState().session?.exercises.find((e) => e.id === exId);
    ex?.sets.filter((s) => s.type === 'working' && !s.completed).forEach((s) => applySuggestion(exId, s.id, { weightKg: suggestion.toKg }));
  };

  const last = performance?.recent[0];
  const target = meta.targetMin !== null || meta.targetMax !== null ? formatRepRange(meta.targetMin, meta.targetMax) : null;

  return (
    <section className={cn('rounded-[var(--radius-card)] border border-border bg-surface py-2', meta.supersetGroup && 'border-l-4 border-l-primary/70')} aria-label={meta.name}>
      <div className="flex items-center gap-3 px-3 pb-1 pt-1">
        <button type="button" onClick={() => onExerciseMenu(exId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ExerciseImage primary={meta.primaryMuscle} imageUrl={imageUrl} className="h-11 w-11 shrink-0" />
          <span className="min-w-0">
            <span className={cn('block truncate text-[17px] font-bold', allDone && 'text-muted line-through decoration-primary/60')}>{meta.name}</span>
            <span className="block truncate text-xs text-muted">
              {meta.supersetGroup && <span className="font-semibold text-primary">Supersatz {meta.supersetGroup} · </span>}
              {target && `Ziel ${target} Wdh. · `}
              {meta.doneCount}/{setIds.length} Sätze
              {last && ` · zuletzt ${last.sets.filter((x) => x.completed && x.type !== 'warmup').map((x) => `${fmtWeight(x.weightKg, unit)}×${x.reps ?? '–'}`).slice(0, 3).join(', ')}`}
            </span>
          </span>
        </button>
        <button type="button" onClick={() => onExerciseMenu(exId)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label={`Optionen für ${meta.name}`}>
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      {meta.notes && <p className="mx-3 mb-1 rounded-xl bg-surface-2 px-3 py-2 text-sm text-muted">{meta.notes}</p>}
      {suggestion && suggestion.type !== 'hold' && (
        <div className="mx-3 mb-1 flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
          <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1">{suggestion.type === 'increase' ? `Letztes Mal alle Ziele geschafft – heute ${fmtWeight(suggestion.toKg, unit)} ${unit}?` : suggestion.reason}</span>
          {suggestion.type === 'increase' && (
            <button type="button" onClick={applyIncrease} className="h-9 shrink-0 rounded-lg bg-primary px-3 text-xs font-bold text-primary-fg">
              Übernehmen
            </button>
          )}
        </div>
      )}
      {suggestion?.type === 'hold' && <p className="mx-3 mb-1 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">{suggestion.reason}</p>}
      <div className="px-1">
        {setIds.map((id, i) => (
          <SetRow key={id} exId={exId} setId={id} index={i} unit={unit} onToggle={onToggle} onMenu={onSetMenu} />
        ))}
      </div>
      <button
        type="button"
        onClick={() => addSet(exId)}
        className="ml-3 mt-1 flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary hover:bg-surface-2"
      >
        <Plus className="h-4 w-4" /> Satz
      </button>
    </section>
  );
});
