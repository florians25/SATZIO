import { matchHistorySet, type ExerciseListItem, type ExercisePerformance, type WeightUnit } from '@satzio/shared';
import { ArrowRight, Check, ChevronDown, Delete, History, Repeat, Timer } from 'lucide-react';
import { AnimatePresence, motion, useDragControls, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { vibrate } from '@/lib/feedback';
import { fmtClock } from '@/lib/format';
import { useTimerRemaining } from '@/lib/timer';
import { useWorkout } from '@/lib/workout';
import { getEditor, nextFieldAfter, nextOpenSet, useKeypad, type KeypadField } from './keypad-store';
import { PlateCalculator } from './PlateCalculator';
import { PLATE_CONFIG, usesBarbell } from './plates';
import { fromKgDisplay, quickSteps } from './units';

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false });
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * App-eigene Zahlentastatur (unten angedockt) für Gewicht & Wiederholungen.
 * Tastendrücke gehen an das aktive NumberField (Editor-Registry), das die
 * Entprellung/Speicherung wie bei normaler Eingabe übernimmt.
 */
export function Keypad({
  unit,
  stepsKg,
  haptics,
  performance,
  exerciseMap,
  onToggle,
}: {
  unit: WeightUnit;
  stepsKg: number[];
  haptics: boolean;
  performance: Map<string, ExercisePerformance>;
  exerciseMap: Map<string, ExerciseListItem>;
  onToggle: (exId: string, setId: string) => void;
}) {
  const active = useKeypad((s) => s.active);
  // letztes aktives Feld für die Ausblend-Animation festhalten
  const lastActive = useRef(active);
  if (active) lastActive.current = active;
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const panelRef = useRef<HTMLDivElement>(null);
  const [platesOpen, setPlatesOpen] = useState(false);

  // Höhe messen → Platz unter der Liste reservieren
  useEffect(() => {
    const el = panelRef.current;
    if (!active || !el) return;
    const ro = new ResizeObserver(() => useKeypad.getState().setHeight(el.getBoundingClientRect().height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  // Fokus wanderte (per Tastatur) in die Tastatur und dann woanders hin → schließen
  useEffect(() => {
    if (!active) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (panelRef.current?.contains(t) || t.closest?.('[data-kp-field]')) return;
      if (document.activeElement && (document.activeElement as HTMLElement).dataset?.kpField) return;
      useKeypad.getState().close();
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [active]);

  useEffect(() => () => useKeypad.getState().close(), []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="keypad"
          data-keypad
          role="group"
          aria-label="Zahlentastatur"
          className="fixed inset-x-0 bottom-0 z-40"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={reduce ? { duration: 0 } : { type: 'spring', damping: 36, stiffness: 460, mass: 0.8 }}
          drag="y"
          dragListener={false}
          dragControls={controls}
          dragConstraints={{ top: 0, bottom: 0 }}
          dragElastic={{ top: 0, bottom: 0.7 }}
          onDragEnd={(_, info) => {
            if (info.offset.y > 60 || info.velocity.y > 450) useKeypad.getState().close();
          }}
          // Fokus bleibt im Zahlenfeld
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div ref={panelRef} className="mx-auto max-w-2xl rounded-t-[26px] border-t border-border bg-surface/95 pb-safe shadow-[0_-12px_40px_rgb(0_0_0/0.35)] backdrop-blur-xl">
            <KeypadBody
              active={lastActive.current!}
              unit={unit}
              stepsKg={stepsKg}
              haptics={haptics}
              performance={performance}
              exerciseMap={exerciseMap}
              onToggle={onToggle}
              platesOpen={platesOpen}
              setPlatesOpen={setPlatesOpen}
              onDragStart={(e) => controls.start(e)}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function KeypadBody({
  active,
  unit,
  stepsKg,
  haptics,
  performance,
  exerciseMap,
  onToggle,
  platesOpen,
  setPlatesOpen,
  onDragStart,
}: {
  active: KeypadField;
  unit: WeightUnit;
  stepsKg: number[];
  haptics: boolean;
  performance: Map<string, ExercisePerformance>;
  exerciseMap: Map<string, ExerciseListItem>;
  onToggle: (exId: string, setId: string) => void;
  platesOpen: boolean;
  setPlatesOpen: (o: boolean) => void;
  onDragStart: (e: React.PointerEvent) => void;
}) {
  const live = useKeypad((s) => s.live);
  const ex = useWorkout((s) => s.session?.exercises.find((e) => e.id === active.exId));
  const idx = ex ? ex.sets.findIndex((s) => s.id === active.setId) : -1;
  const set = ex?.sets[idx];
  if (!ex || !set) return null;

  const isWeight = active.field === 'weight';
  const tick = () => haptics && vibrate(8);
  const ed = () => getEditor();
  const press = (k: string) => {
    tick();
    ed()?.key(k);
  };
  const setVal = (v: number | null) => {
    tick();
    ed()?.set(v);
  };
  const adjust = (d: number) => setVal(Math.max(0, r2((ed()?.get() ?? 0) + d)));
  const goNext = () => {
    tick();
    ed()?.commit();
    const s = useWorkout.getState().session;
    const n = s ? nextFieldAfter(s.exercises, active) : null;
    if (n) useKeypad.getState().activate(n);
    else useKeypad.getState().close();
  };
  const finishSet = () => {
    ed()?.commit();
    const cur = useWorkout.getState().session?.exercises.find((e) => e.id === active.exId)?.sets.find((s) => s.id === active.setId);
    if (cur && !cur.completed) onToggle(active.exId, active.setId);
    else tick();
    const s = useWorkout.getState().session;
    const n = s ? nextOpenSet(s.exercises, active) : null;
    if (n) useKeypad.getState().activate(n);
    else useKeypad.getState().close();
  };

  // Vergleichswerte
  const valueOf = (s: { weightKg: number | null; reps: number | null } | null | undefined) =>
    !s ? null : isWeight ? (s.weightKg === null ? null : fromKgDisplay(s.weightKg, unit)) : s.reps;
  const perf = ex.exerciseId ? performance.get(ex.exerciseId) : undefined;
  const typeIdx = ex.sets.filter((s, i) => i < idx && s.type === set.type).length;
  const lastTime = valueOf(perf?.recent[0] ? matchHistorySet(perf.recent[0].sets, set.type, typeIdx) : null);
  const prevSet = idx > 0 ? ex.sets[idx - 1] : null;
  const prevVal = valueOf(prevSet);

  const item = ex.exerciseId ? exerciseMap.get(ex.exerciseId) : undefined;
  const barbell = isWeight && usesBarbell(item?.equipment);
  const steps = quickSteps(stepsKg, ex.weightStepKg, unit);

  const repChips = (() => {
    const lo = set.targetRepsMin;
    const hi = set.targetRepsMax;
    if (lo !== null && hi !== null && hi >= lo) {
      const span = hi - lo;
      const step = span > 7 ? Math.ceil(span / 6) : 1;
      const out: number[] = [];
      for (let v = lo; v <= hi; v += step) out.push(v);
      if (out[out.length - 1] !== hi) out.push(hi);
      return out;
    }
    const one = lo ?? hi;
    if (one !== null) return [one - 2, one - 1, one, one + 1, one + 2].filter((v) => v > 0);
    return [5, 6, 8, 10, 12, 15];
  })();

  const bar = PLATE_CONFIG[unit].bar;

  return (
    <div className="select-none">
      {/* Kopfzeile = Griff zum Wegwischen */}
      <div className="cursor-grab touch-none px-3 pt-2" onPointerDown={onDragStart}>
        <div className="mx-auto mb-1.5 h-1.5 w-10 rounded-full bg-muted/35" aria-hidden />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-muted">
              {ex.name} · Satz {idx + 1}
            </p>
            <p className="text-[15px] font-bold leading-tight">{isWeight ? `Gewicht in ${unit}` : 'Wiederholungen'}</p>
          </div>
          <RestChip />
          {barbell && (
            <button
              type="button"
              onClick={() => {
                tick();
                setPlatesOpen(!platesOpen);
              }}
              aria-pressed={platesOpen}
              aria-label="Scheibenrechner"
              className={cn('flex h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-bold', platesOpen ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-surface-2 text-text')}
            >
              <PlateIcon /> Scheiben
            </button>
          )}
          <button
            type="button"
            onClick={() => useKeypad.getState().close()}
            className="flex h-9 items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-bold text-text"
            aria-label="Fertig – Tastatur schließen"
          >
            <ChevronDown className="h-4 w-4" /> Fertig
          </button>
        </div>
      </div>

      {barbell && platesOpen && (
        <div className="pt-2">
          <PlateCalculator weight={live} unit={unit} onAdd={(p) => setVal(r2(Math.max(live ?? 0, bar) + 2 * p))} />
        </div>
      )}

      {/* Schnellwahl */}
      <div className="space-y-1.5 px-3 pb-2 pt-2">
        {!isWeight && (
          <div className="flex gap-1.5" aria-label="Wiederholungen wählen">
            {repChips.map((v) => (
              <Chip key={v} onClick={() => setVal(v)} active={live === v} className="flex-1 text-base" ariaLabel={`${v} Wiederholungen`}>
                {v}
              </Chip>
            ))}
          </div>
        )}
        <div className="no-scrollbar -mx-3 flex gap-1.5 overflow-x-auto px-3">
          {isWeight ? (
            <>
              {[...steps].reverse().map((s) => (
                <Chip key={`-${s}`} onClick={() => adjust(-s)} ariaLabel={`${fmt(s)} ${unit} weniger`} className="min-w-[3.4rem]">
                  −{fmt(s)}
                </Chip>
              ))}
              {steps.map((s) => (
                <Chip key={`+${s}`} onClick={() => adjust(s)} ariaLabel={`${fmt(s)} ${unit} mehr`} className="min-w-[3.4rem]">
                  +{fmt(s)}
                </Chip>
              ))}
            </>
          ) : (
            <>
              <Chip onClick={() => adjust(-1)} ariaLabel="Eine Wiederholung weniger" className="min-w-[3rem]">
                −1
              </Chip>
              <Chip onClick={() => adjust(1)} ariaLabel="Eine Wiederholung mehr" className="min-w-[3rem]">
                +1
              </Chip>
            </>
          )}
          {lastTime !== null && (
            <Chip onClick={() => setVal(lastTime)} ariaLabel={`Wie letztes Mal: ${fmt(lastTime)}`} tone="primary">
              <History className="h-3.5 w-3.5" /> Letztes Mal <b className="tabular">{fmt(lastTime)}</b>
            </Chip>
          )}
          {prevVal !== null && (
            <Chip onClick={() => setVal(prevVal)} ariaLabel={`Wie vorheriger Satz: ${fmt(prevVal)}`}>
              <Repeat className="h-3.5 w-3.5" /> Wie Satz {idx} <b className="tabular">{fmt(prevVal)}</b>
            </Chip>
          )}
        </div>
      </div>

      {/* Tasten */}
      <div className="grid grid-cols-4 gap-1.5 px-3 pb-3">
        {['1', '2', '3'].map((k) => (
          <Key key={k} onClick={() => press(k)}>
            {k}
          </Key>
        ))}
        <button
          type="button"
          onClick={goNext}
          className="row-span-2 flex flex-col items-center justify-center gap-1 rounded-2xl bg-surface-3 text-[15px] font-bold text-text transition active:scale-[0.97] active:brightness-125"
          aria-label="Weiter"
        >
          <ArrowRight className="h-6 w-6" />
          Weiter
        </button>
        {['4', '5', '6', '7', '8', '9'].map((k) => (
          <Key key={k} onClick={() => press(k)}>
            {k}
          </Key>
        ))}
        <button
          type="button"
          onClick={finishSet}
          className={cn(
            'row-span-2 flex flex-col items-center justify-center gap-1 rounded-2xl text-[15px] font-extrabold leading-tight transition active:scale-[0.97]',
            set.completed ? 'bg-primary/20 text-primary' : 'bg-primary text-primary-fg shadow-[0_6px_20px_-6px_var(--primary)]',
          )}
          aria-label="Satz fertig"
        >
          <Check className="h-7 w-7" strokeWidth={3.2} />
          {set.completed ? 'Nächster' : <>Satz<br />fertig</>}
        </button>
        <Key onClick={() => press(',')} disabled={!isWeight} ariaLabel="Komma">
          ,
        </Key>
        <Key onClick={() => press('0')}>0</Key>
        <Key onClick={() => press('back')} ariaLabel="Rücktaste">
          <Delete className="h-6 w-6" />
        </Key>
      </div>
    </div>
  );
}

function Key({ children, onClick, disabled, ariaLabel }: { children: ReactNode; onClick: () => void; disabled?: boolean; ariaLabel?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="grid h-14 place-items-center rounded-2xl bg-surface-2 text-[26px] font-semibold tabular text-text transition active:scale-[0.96] active:bg-surface-3 disabled:opacity-25"
    >
      {children}
    </button>
  );
}

function Chip({ children, onClick, ariaLabel, className, tone, active }: { children: ReactNode; onClick: () => void; ariaLabel: string; className?: string; tone?: 'primary'; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        'flex h-10 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-3 text-sm font-semibold tabular transition active:scale-95',
        active ? 'border-primary bg-primary text-primary-fg' : tone === 'primary' ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-surface text-text',
        className,
      )}
    >
      {children}
    </button>
  );
}

function RestChip() {
  const remaining = useTimerRemaining();
  if (remaining === null) return null;
  return (
    <span className="flex h-9 items-center gap-1 rounded-full bg-primary/15 px-2.5 text-xs font-bold text-primary tabular" aria-label="Pause läuft">
      <Timer className="h-3.5 w-3.5" /> {fmtClock(remaining)}
    </span>
  );
}

function PlateIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden>
      <rect x="1" y="9" width="18" height="2" rx="1" fill="currentColor" opacity=".5" />
      <rect x="5" y="3" width="3" height="14" rx="1" fill="currentColor" />
      <rect x="9" y="5" width="2.5" height="10" rx="1" fill="currentColor" />
      <rect x="12.5" y="7" width="2" height="6" rx="1" fill="currentColor" />
    </svg>
  );
}

export function KeypadSpacer() {
  const active = useKeypad((s) => !!s.active);
  const height = useKeypad((s) => s.height);
  // Beim Schließen kurz verzögert verkleinern → kein Springen unter dem Finger
  const [h, setH] = useState(0);
  useEffect(() => {
    if (active) {
      setH(height || 380);
      return;
    }
    const t = setTimeout(() => setH(0), 320);
    return () => clearTimeout(t);
  }, [active, height]);
  return <div aria-hidden style={{ height: h }} />;
}
