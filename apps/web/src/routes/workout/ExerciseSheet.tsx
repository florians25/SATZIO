import { MUSCLE_LABELS_DE, type ExerciseListItem, type ExercisePerformance, type WeightUnit } from '@satzio/shared';
import { ArrowDown, ArrowUp, Info, Replace, Timer, Trash2 } from 'lucide-react';
import { Link } from 'react-router';
import { ExerciseImage } from '@/components/MuscleMap';
import { Textarea } from '@/components/ui/input';
import { Sheet, SheetAction } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { fmtRelativeDay, fmtWeight } from '@/lib/format';
import { REST_PRESETS, useTimer } from '@/lib/timer';
import { useWorkout } from '@/lib/workout';

export function ExerciseSheet({
  exId,
  onClose,
  onReplace,
  performance,
  listItem,
  unit,
  defaultRest,
}: {
  exId: string | null;
  onClose: () => void;
  onReplace: (exId: string) => void;
  performance: ExercisePerformance | undefined;
  listItem: ExerciseListItem | undefined;
  unit: WeightUnit;
  defaultRest: number;
}) {
  const ex = useWorkout((s) => (exId ? s.session?.exercises.find((e) => e.id === exId) : undefined));
  const { updateExercise, removeExercise, moveExercise } = useWorkout.getState();
  const startTimer = useTimer((s) => s.start);
  if (!exId) return null;
  return (
    <Sheet open={!!ex} onOpenChange={(o) => !o && onClose()} title={ex?.name ?? ''} description={ex?.primaryMuscle ? MUSCLE_LABELS_DE[ex.primaryMuscle] : undefined}>
      {ex && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <ExerciseImage primary={ex.primaryMuscle} secondary={listItem?.secondaryMuscles} imageUrl={listItem?.imageUrl} className="h-28 w-40 shrink-0" compact={false} />
            <div className="min-w-0 text-sm">
              <p className="font-semibold">Letztes Training</p>
              {performance?.recent[0] ? (
                <>
                  <p className="text-muted">{fmtRelativeDay(performance.recent[0].performedAt)}</p>
                  <p className="mt-1 tabular">
                    {performance.recent[0].sets
                      .filter((s) => s.completed)
                      .map((s) => `${fmtWeight(s.weightKg, unit)} × ${s.reps ?? '–'}`)
                      .join(' · ')}
                  </p>
                </>
              ) : (
                <p className="text-muted">Noch keine Daten – trage einfach deine Werte ein.</p>
              )}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Pausenzeit</p>
            <div className="flex gap-1.5">
              {REST_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateExercise(ex.id, { restSeconds: s })}
                  className={cn(
                    'h-10 flex-1 rounded-xl border text-sm font-semibold',
                    (ex.restSeconds ?? defaultRest) === s ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2',
                  )}
                >
                  {s < 60 ? `${s}s` : `${s / 60}${s % 60 ? ',5' : ''} min`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Notiz zur Übung</p>
            <Textarea
              defaultValue={ex.notes ?? ''}
              placeholder="z. B. Sitz Stufe 4, enger Griff …"
              className="min-h-20"
              onBlur={(e) => {
                const v = e.target.value.trim() || null;
                if (v !== ex.notes) updateExercise(ex.id, { notes: v });
              }}
            />
          </div>
          <div>
            <SheetAction icon={<Timer />} onClick={() => { startTimer(ex.restSeconds ?? defaultRest, ex.name); onClose(); }}>
              Pausentimer starten
            </SheetAction>
            <SheetAction icon={<Replace />} onClick={() => onReplace(ex.id)}>
              Übung ersetzen
            </SheetAction>
            <SheetAction icon={<ArrowUp />} onClick={() => moveExercise(ex.id, -1)}>
              Nach oben
            </SheetAction>
            <SheetAction icon={<ArrowDown />} onClick={() => moveExercise(ex.id, 1)}>
              Nach unten
            </SheetAction>
            {ex.exerciseId && (
              <SheetAction icon={<Info />}>
                <Link to={`/exercises/${ex.exerciseId}`} onClick={onClose} className="block">
                  Übungsinfos & Ausführung
                </Link>
              </SheetAction>
            )}
            <SheetAction icon={<Trash2 />} tone="danger" onClick={() => { removeExercise(ex.id); onClose(); }}>
              Übung entfernen
            </SheetAction>
          </div>
        </div>
      )}
    </Sheet>
  );
}
