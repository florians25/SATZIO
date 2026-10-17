import { formatRepRange, SET_TYPE_SHORT_DE, toKg, type WeightUnit } from '@satzio/shared';
import { Check, Copy, MoreHorizontal, RotateCcw, Trash2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { vibrate } from '@/lib/feedback';
import { useWorkout } from '@/lib/workout';
import { useKeypad } from './keypad-store';
import { NumberField } from './NumberField';
import { fromKgDisplay } from './units';
import { ACTIONS_W, useSwipeRow } from './useSwipeRow';

/**
 * Eine Satzzeile im Notizen-Stil:  ☐  80 kg × 8   (Ziel 8–12)  ⋯
 * Abonniert nur ihren eigenen Satz → Änderungen rendern nicht die ganze Liste neu.
 * Wischen → abhaken, Wischen ← Aktionen, lange drücken → duplizieren.
 */
export const SetRow = memo(function SetRow({
  exId,
  setId,
  index,
  unit,
  onToggle,
  onMenu,
}: {
  exId: string;
  setId: string;
  index: number;
  unit: WeightUnit;
  onToggle: (exId: string, setId: string) => void;
  onMenu: (exId: string, setId: string) => void;
}) {
  const set = useWorkout((s) => s.session?.exercises.find((e) => e.id === exId)?.sets.find((x) => x.id === setId));
  const updateSet = useWorkout((s) => s.updateSet);
  // nur "ist ein Feld dieser Zeile aktiv?" abonnieren
  const activeField = useKeypad((s) => (s.active && s.active.exId === exId && s.active.setId === setId ? s.active.field : null));
  const haptics = useAuth((s) => s.user?.settings.vibrationEnabled ?? false);

  const closeKeypadIfHere = () => {
    const a = useKeypad.getState().active;
    if (a && a.setId === setId) useKeypad.getState().close();
  };
  const swipe = useSwipeRow({
    onSwipeRight: () => onToggle(exId, setId),
    onLongPress: () => {
      closeKeypadIfHere();
      useWorkout.getState().duplicateSet(exId, setId);
      if (haptics) vibrate(10);
    },
    onArm: () => haptics && vibrate(6),
  });
  const rowEl = useCallback(() => swipe.rowRef.current, [swipe.rowRef]);

  if (!set) return null;

  const typeLabel = SET_TYPE_SHORT_DE[set.type];
  const target = formatRepRange(set.targetRepsMin, set.targetRepsMax);
  const fromHistory = set.weightSource === 'history' || set.repsSource === 'history';

  return (
    <div ref={swipe.rowRef} data-set-row className="relative isolate overflow-hidden rounded-2xl" {...swipe.handlers}>
      {swipe.side === 'right' && (
        <div className={cn('absolute inset-0 -z-10 flex items-center pl-5 transition-colors', swipe.armed ? 'bg-primary text-primary-fg' : 'bg-primary/25 text-primary')} aria-hidden>
          <span className={cn('flex items-center gap-2 text-sm font-bold transition-transform', swipe.armed && 'scale-110')}>
            {set.completed ? <RotateCcw className="h-5 w-5" strokeWidth={2.6} /> : <Check className="h-6 w-6" strokeWidth={3.2} />}
            {set.completed ? 'Offen' : 'Fertig'}
          </span>
        </div>
      )}
      {swipe.side === 'left' && (
        <div className="absolute inset-y-0 right-0 -z-10 flex" style={{ width: ACTIONS_W }}>
          <button
            type="button"
            data-swipe-action
            tabIndex={swipe.open ? 0 : -1}
            onClick={() => {
              swipe.close();
              closeKeypadIfHere();
              useWorkout.getState().duplicateSet(exId, setId);
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-surface-3 text-[11px] font-semibold text-text"
          >
            <Copy className="h-5 w-5" /> Duplizieren
          </button>
          <button
            type="button"
            data-swipe-action
            tabIndex={swipe.open ? 0 : -1}
            onClick={() => {
              swipe.close();
              closeKeypadIfHere();
              useWorkout.getState().deleteSet(exId, setId);
            }}
            className="flex flex-1 flex-col items-center justify-center gap-0.5 bg-error text-[11px] font-semibold text-white"
          >
            <Trash2 className="h-5 w-5" /> Löschen
          </button>
        </div>
      )}
      <div ref={swipe.contentRef} className="touch-pan-y select-none bg-surface [-webkit-touch-callout:none]">
        <div className={cn('flex items-center gap-1 rounded-2xl pl-1 pr-0.5 transition-colors', set.completed && 'bg-primary/[0.06]', activeField && 'bg-surface-2')}>
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
              className="w-[4.6rem] select-text"
              muted={set.completed}
              max={unit === 'kg' ? 1000 : 2200}
              kp={{ exId, setId, field: 'weight' }}
              scrollTarget={rowEl}
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
              className="w-12 select-text"
              placeholder={target !== '–' ? target.split('–')[0] : '–'}
              muted={set.completed}
              max={500}
              kp={{ exId, setId, field: 'reps' }}
              scrollTarget={rowEl}
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
      </div>
    </div>
  );
});
