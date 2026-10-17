import { formatRepRange, SET_TYPE_SHORT_DE, toKg, type WeightUnit } from '@satzio/shared';
import { Check, MoreHorizontal } from 'lucide-react';
import { memo, useState } from 'react';
import { cn } from '@/lib/cn';
import { fromKgDisplay } from './units';
import { useWorkout } from '@/lib/workout';
import { NumberField } from './NumberField';

/**
 * Eine Satzzeile im Notizen-Stil:  ☐  80 kg × 8   (Ziel 8–12)  ⋯
 * Abonniert nur ihren eigenen Satz → Änderungen rendern nicht die ganze Liste neu.
 */
export const SetRow = memo(function SetRow({
  exId,
  setId,
  index,
  unit,
  steps,
  onToggle,
  onMenu,
  readOnlyTimer,
}: {
  exId: string;
  setId: string;
  index: number;
  unit: WeightUnit;
  steps: number[];
  onToggle: (exId: string, setId: string) => void;
  onMenu: (exId: string, setId: string) => void;
  readOnlyTimer?: boolean;
}) {
  const set = useWorkout((s) => s.session?.exercises.find((e) => e.id === exId)?.sets.find((x) => x.id === setId));
  const updateSet = useWorkout((s) => s.updateSet);
  const [focus, setFocus] = useState<'weight' | 'reps' | null>(null);
  if (!set) return null;
  void readOnlyTimer;

  const typeLabel = SET_TYPE_SHORT_DE[set.type];
  const target = formatRepRange(set.targetRepsMin, set.targetRepsMax);
  const fromHistory = set.weightSource === 'history' || set.repsSource === 'history';

  const adjust = (deltaKg: number) => {
    const next = Math.max(0, Math.round(((set.weightKg ?? 0) + deltaKg) * 1000) / 1000);
    updateSet(exId, setId, { weightKg: next });
  };

  return (
    <div className={cn('rounded-2xl transition', set.completed && 'bg-primary/[0.06]', focus && 'bg-surface-2')}>
      <div className="flex items-center gap-1 pl-1 pr-0.5">
        <button
          type="button"
          onClick={() => onToggle(exId, setId)}
          aria-pressed={set.completed}
          aria-label={set.completed ? `Satz ${index + 1} als offen markieren` : `Satz ${index + 1} abhaken`}
          className="grid h-12 w-12 shrink-0 place-items-center"
        >
          <span
            className={cn(
              'grid h-8 w-8 place-items-center rounded-[10px] border-2 transition',
              set.completed ? 'animate-pop border-primary bg-primary text-primary-fg' : 'border-muted/60 text-transparent',
            )}
          >
            <Check className="h-5 w-5" strokeWidth={3.2} />
          </span>
        </button>
        <span className={cn('w-5 shrink-0 text-center text-xs font-bold', set.type === 'working' ? 'text-muted/70' : 'text-warning')} aria-label={`Satz ${index + 1}`}>
          {typeLabel || index + 1}
        </span>
        <div className="flex min-w-0 flex-1 items-center">
          <NumberField
            value={set.weightKg === null ? null : fromKgDisplay(set.weightKg, unit)}
            onCommit={(v) => updateSet(exId, setId, { weightKg: v === null ? null : toKg(v, unit) })}
            ariaLabel={`Gewicht Satz ${index + 1} in ${unit}`}
            className="w-[4.6rem]"
            muted={set.completed}
            onFocusChange={(f) => setFocus(f ? 'weight' : null)}
            max={unit === 'kg' ? 1000 : 2200}
          />
          <span className={cn('text-sm font-medium text-muted', set.completed && 'opacity-70')}>{unit}</span>
          <span className="px-1.5 text-lg text-muted" aria-hidden>
            ×
          </span>
          <NumberField
            value={set.reps}
            decimals={false}
            onCommit={(v) => updateSet(exId, setId, { reps: v })}
            ariaLabel={`Wiederholungen Satz ${index + 1}`}
            className="w-12"
            placeholder={target !== '–' ? target.split('–')[0] : '–'}
            muted={set.completed}
            onFocusChange={(f) => setFocus(f ? 'reps' : null)}
            max={500}
          />
          {target !== '–' && <span className="ml-1 hidden truncate text-xs text-muted min-[380px]:inline">Ziel {target}</span>}
        </div>
        {fromHistory && !set.completed && (
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" title="Wert aus deinem letzten Training" aria-label="Aus letztem Training übernommen" />
        )}
        <button
          type="button"
          onClick={() => onMenu(exId, setId)}
          className="grid h-11 w-10 shrink-0 place-items-center rounded-xl text-muted hover:bg-surface-2"
          aria-label={`Optionen für Satz ${index + 1}`}
        >
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>
      {focus === 'weight' && (
        <div className="flex gap-1.5 px-3 pb-2">
          {[...steps].reverse().map((s) => (
            <QuickButton key={`-${s}`} label={`−${fmtStep(s, unit)}`} onClick={() => adjust(-toKg(s, unit))} />
          ))}
          {steps.map((s) => (
            <QuickButton key={`+${s}`} label={`+${fmtStep(s, unit)}`} onClick={() => adjust(toKg(s, unit))} />
          ))}
        </div>
      )}
    </div>
  );
});

function fmtStep(s: number, _unit: WeightUnit) {
  return s.toLocaleString('de-DE');
}

function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      // pointerdown + preventDefault: Eingabefeld behält den Fokus
      onPointerDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      onClick={(e) => {
        if (e.detail === 0) onClick(); // Tastaturbedienung
      }}
      className="h-10 flex-1 rounded-xl border border-border bg-surface text-sm font-semibold tabular active:bg-surface-3"
    >
      {label}
    </button>
  );
}
