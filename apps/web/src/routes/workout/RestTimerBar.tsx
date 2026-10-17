import { Minus, Plus, Timer, X } from 'lucide-react';
import { useState } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { fmtClock } from '@/lib/format';
import { REST_PRESETS, useTimer, useTimerRemaining } from '@/lib/timer';

/** Pausentimer im Training – blockiert nie die Eingabe. */
export function RestTimerBar({ defaultRest }: { defaultRest: number }) {
  const remaining = useTimerRemaining();
  const { duration, label, extend, skip, start } = useTimer();
  const [presets, setPresets] = useState(false);

  if (remaining === null) {
    return (
      <>
        <button
          type="button"
          onClick={() => setPresets(true)}
          className="flex h-11 items-center gap-2 rounded-2xl border border-border bg-surface px-3 text-sm font-semibold text-muted shadow-float"
          aria-label="Pausentimer starten"
        >
          <Timer className="h-4 w-4" /> Pause
        </button>
        <Sheet open={presets} onOpenChange={setPresets} title="Pausentimer">
          <div className="grid grid-cols-3 gap-2">
            {[...new Set([defaultRest, ...REST_PRESETS])].sort((a, b) => a - b).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  start(s);
                  setPresets(false);
                }}
                className="h-14 rounded-2xl border border-border bg-surface-2 text-lg font-bold tabular"
              >
                {fmtClock(s)}
              </button>
            ))}
          </div>
        </Sheet>
      </>
    );
  }
  const progress = duration ? 1 - remaining / duration : 1;
  const finished = remaining === 0;
  return (
    <div className={`flex-1 overflow-hidden rounded-2xl border shadow-float ${finished ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface'}`} role="timer" aria-live="off">
      <div className="relative flex h-14 items-center gap-1 px-2">
        <div className="absolute inset-y-0 left-0 bg-primary/15 transition-[width] duration-300" style={{ width: `${progress * 100}%` }} aria-hidden />
        <button type="button" onClick={() => extend(-15)} className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-surface-2/60" aria-label="15 Sekunden weniger">
          <Minus className="h-5 w-5" />
        </button>
        <div className="relative flex-1 text-center">
          <div className="text-2xl font-extrabold tabular leading-none">{finished ? 'Los geht’s!' : fmtClock(remaining)}</div>
          {label && !finished && <div className="truncate text-[11px] text-muted">Weiter: {label}</div>}
        </div>
        <button type="button" onClick={() => extend(30)} className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-surface-2/60" aria-label="30 Sekunden mehr">
          <Plus className="h-5 w-5" />
        </button>
        <button type="button" onClick={skip} className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-surface-2/60" aria-label="Pause überspringen">
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
