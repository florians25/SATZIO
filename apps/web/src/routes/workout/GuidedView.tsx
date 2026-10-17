import { formatRepRange, matchHistorySet, SET_TYPE_LABELS_DE, toKg, type ExerciseListItem, type ExercisePerformance, type WeightUnit } from '@satzio/shared';
import { Check, ChevronLeft, ChevronRight, List, Minus, Plus, SkipForward } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ExerciseImage } from '@/components/MuscleMap';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/card';
import { Sheet, SheetAction } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { fmtWeight } from '@/lib/format';
import { useWorkout } from '@/lib/workout';
import { useKeypad } from './keypad-store';
import { NumberField } from './NumberField';
import { fromKgDisplay, quickSteps } from './units';

/**
 * Geführter Trainingsmodus: eine Übung, ein Satz im Fokus, große Zahlen.
 * Arbeitet auf denselben Daten wie die Liste – Wechsel jederzeit möglich.
 */
export function GuidedView({
  unit,
  stepsKg,
  performance,
  exerciseMap,
  onToggle,
  onFinish,
}: {
  unit: WeightUnit;
  stepsKg: number[];
  performance: Map<string, ExercisePerformance>;
  exerciseMap: Map<string, ExerciseListItem>;
  onToggle: (exId: string, setId: string) => void;
  onFinish: () => void;
}) {
  const session = useWorkout((s) => s.session)!;
  const updateSet = useWorkout((s) => s.updateSet);
  const addSet = useWorkout((s) => s.addSet);
  const exercises = useMemo(() => [...session.exercises].sort((a, b) => a.order - b.order), [session.exercises]);
  const firstOpen = exercises.findIndex((e) => e.sets.some((s) => !s.completed));
  const [exIndex, setExIndex] = useState(firstOpen >= 0 ? firstOpen : 0);
  const [setIndex, setSetIndex] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);

  const ex = exercises[Math.min(exIndex, exercises.length - 1)];
  const autoSet = ex ? ex.sets.findIndex((s) => !s.completed) : -1;
  const sIdx = setIndex ?? (autoSet >= 0 ? autoSet : Math.max(0, (ex?.sets.length ?? 1) - 1));
  const set = ex?.sets[sIdx];

  const goEx = (i: number) => {
    setExIndex(i);
    setSetIndex(null);
  };

  // Zahlentastatur springt zu einem anderen Satz (Weiter / Satz fertig) → mitgehen
  const kpActive = useKeypad((s) => s.active);
  useEffect(() => {
    if (!kpActive) return;
    const ei = exercises.findIndex((e) => e.id === kpActive.exId);
    if (ei < 0) return;
    const si = exercises[ei].sets.findIndex((x) => x.id === kpActive.setId);
    if (ei !== exIndex) setExIndex(ei);
    if (si >= 0) setSetIndex(si);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpActive]);

  const all = session.exercises.flatMap((e) => e.sets);
  const done = all.filter((s) => s.completed).length;

  if (!ex) {
    return <p className="p-6 text-center text-muted">Noch keine Übungen. Füge eine Übung hinzu.</p>;
  }

  const perf = ex.exerciseId ? performance.get(ex.exerciseId) : undefined;
  const typeIdx = set ? ex.sets.filter((s, i) => s.type === set.type && i < sIdx).length : 0;
  const prev = set && perf?.recent[0] ? matchHistorySet(perf.recent[0].sets, set.type, typeIdx) : null;
  const steps = quickSteps(stepsKg, ex.weightStepKg, unit);
  const exDone = ex.sets.every((s) => s.completed);
  const allDone = done === all.length && all.length > 0;
  const next = exercises.slice(exIndex + 1).find((e) => e.sets.some((s) => !s.completed)) ?? exercises.find((e, i) => i !== exIndex && e.sets.some((s) => !s.completed));
  const item = ex.exerciseId ? exerciseMap.get(ex.exerciseId) : undefined;

  // aktuellen Stand aus dem Store lesen (eine laufende Eingabe wurde beim Blur gerade gespeichert)
  const fresh = () => (set ? useWorkout.getState().session?.exercises.find((e) => e.id === ex.id)?.sets.find((x) => x.id === set.id) : undefined);
  const changeWeight = (deltaDisplay: number) => {
    const cur = fresh();
    if (!cur) return;
    updateSet(ex.id, cur.id, { weightKg: Math.max(0, Math.round(((cur.weightKg ?? 0) + toKg(deltaDisplay, unit)) * 1000) / 1000) });
  };
  const changeReps = (d: number) => {
    const cur = fresh();
    if (cur) updateSet(ex.id, cur.id, { reps: Math.max(0, (cur.reps ?? 0) + d) });
  };

  return (
    <div className="space-y-4 px-4 pb-6">
      <div>
        <div className="mb-1 flex justify-between text-xs text-muted">
          <span>
            Übung {exIndex + 1} von {exercises.length}
          </span>
          <span>
            {done}/{all.length} Sätze
          </span>
        </div>
        <ProgressBar value={all.length ? (done / all.length) * 100 : 0} />
      </div>

      <div className="flex items-center gap-3">
        <ExerciseImage primary={ex.primaryMuscle} secondary={item?.secondaryMuscles} imageUrl={item?.imageUrl} className="h-24 w-32 shrink-0" compact={false} />
        <div className="min-w-0">
          <h2 className="text-2xl font-extrabold leading-tight">{ex.name}</h2>
          <p className="text-sm text-muted">
            {ex.sets.length} Sätze
            {set && (set.targetRepsMin !== null || set.targetRepsMax !== null) && ` · Ziel ${formatRepRange(set.targetRepsMin, set.targetRepsMax)} Wdh.`}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sätze">
        {ex.sets.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={i === sIdx}
            onClick={() => setSetIndex(i)}
            className={cn(
              'grid h-10 min-w-10 place-items-center rounded-xl border px-2 text-sm font-bold',
              s.completed ? 'border-primary bg-primary text-primary-fg' : i === sIdx ? 'border-primary text-primary' : 'border-border text-muted',
            )}
          >
            {s.completed ? <Check className="h-4 w-4" strokeWidth={3} /> : s.type === 'working' ? i + 1 : SET_TYPE_LABELS_DE[s.type][0]}
          </button>
        ))}
        <button type="button" onClick={() => addSet(ex.id)} className="grid h-10 w-10 place-items-center rounded-xl border border-dashed border-border text-muted" aria-label="Satz hinzufügen">
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {set && (
        <div className={cn('rounded-3xl border bg-surface p-4', set.completed ? 'border-primary/50' : 'border-border')}>
          <p className="mb-3 text-sm font-semibold text-muted">
            Satz {sIdx + 1} · {SET_TYPE_LABELS_DE[set.type]}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Stepper
              label={unit}
              onMinus={() => changeWeight(-steps[0])}
              onPlus={() => changeWeight(steps[0])}
              field={
                <NumberField
                  key={`w-${set.id}`}
                  value={set.weightKg === null ? null : fromKgDisplay(set.weightKg, unit)}
                  onCommit={(v) => updateSet(ex.id, set.id, { weightKg: v === null ? null : toKg(v, unit) })}
                  ariaLabel={`Gewicht in ${unit}`}
                  className="h-16 w-full text-4xl font-extrabold"
                  max={unit === 'kg' ? 1000 : 2200}
                  kp={{ exId: ex.id, setId: set.id, field: 'weight' }}
                />
              }
            />
            <Stepper
              label="Wdh."
              onMinus={() => changeReps(-1)}
              onPlus={() => changeReps(1)}
              field={
                <NumberField
                  key={`r-${set.id}`}
                  value={set.reps}
                  decimals={false}
                  onCommit={(v) => updateSet(ex.id, set.id, { reps: v })}
                  ariaLabel="Wiederholungen"
                  className="h-16 w-full text-4xl font-extrabold"
                  max={500}
                  kp={{ exId: ex.id, setId: set.id, field: 'reps' }}
                />
              }
            />
          </div>
          <p className="mt-3 text-center text-sm text-muted">
            {prev ? `Letztes Mal: ${fmtWeight(prev.weightKg, unit)} ${unit} × ${prev.reps ?? '–'}` : 'Noch kein Vergleichswert'}
          </p>
          <Button size="lg" block className="mt-3 h-16 text-lg" variant={set.completed ? 'secondary' : 'primary'} onClick={() => onToggle(ex.id, set.id)}>
            <Check className="h-6 w-6" strokeWidth={3} /> {set.completed ? 'Erledigt – rückgängig' : 'Satz abschließen'}
          </Button>
        </div>
      )}

      {allDone ? (
        <Button size="lg" block onClick={onFinish}>
          Training abschließen
        </Button>
      ) : (
        exDone &&
        next && (
          <Button size="lg" block variant="secondary" onClick={() => goEx(exercises.indexOf(next))}>
            Nächste Übung: {next.name} <ChevronRight className="h-5 w-5" />
          </Button>
        )
      )}

      <div className="grid grid-cols-3 gap-2">
        <Button variant="ghost" disabled={exIndex === 0} onClick={() => goEx(Math.max(0, exIndex - 1))}>
          <ChevronLeft className="h-5 w-5" /> Zurück
        </Button>
        <Button variant="ghost" onClick={() => setListOpen(true)}>
          <List className="h-5 w-5" /> Übungen
        </Button>
        <Button variant="ghost" disabled={exIndex >= exercises.length - 1} onClick={() => goEx(Math.min(exercises.length - 1, exIndex + 1))}>
          <SkipForward className="h-5 w-5" /> Weiter
        </Button>
      </div>

      <Sheet open={listOpen} onOpenChange={setListOpen} title="Übung wählen" description="Reihenfolge frei wählbar – überspringen jederzeit möglich.">
        {exercises.map((e, i) => {
          const d = e.sets.filter((s) => s.completed).length;
          return (
            <SheetAction
              key={e.id}
              icon={d === e.sets.length && e.sets.length ? <Check className="text-primary" /> : <span className="text-sm font-bold">{i + 1}</span>}
              hint={`${d}/${e.sets.length} Sätze`}
              onClick={() => {
                goEx(i);
                setListOpen(false);
              }}
            >
              {e.name}
            </SheetAction>
          );
        })}
      </Sheet>
    </div>
  );
}

function Stepper({ label, field, onMinus, onPlus }: { label: string; field: React.ReactNode; onMinus: () => void; onPlus: () => void }) {
  return (
    <div className="rounded-2xl bg-surface-2 p-2">
      <div className="text-center">{field}</div>
      <p className="text-center text-xs font-semibold text-muted">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-1.5">
        <button type="button" onClick={onMinus} className="grid h-11 place-items-center rounded-xl bg-surface text-text active:bg-surface-3" aria-label={`${label} verringern`}>
          <Minus className="h-5 w-5" />
        </button>
        <button type="button" onClick={onPlus} className="grid h-11 place-items-center rounded-xl bg-surface text-text active:bg-surface-3" aria-label={`${label} erhöhen`}>
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
