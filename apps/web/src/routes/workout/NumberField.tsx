import { parseDecimal } from '@satzio/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/cn';
import { applyKey, getEditor, nextFieldAfter, registerEditor, sameField, useKeypad, type FieldEditor, type KeypadField } from './keypad-store';
import { useWorkout } from '@/lib/workout';

/**
 * Inline-Zahlenfeld im Notizen-Stil. Änderungen werden
 * - beim Verlassen/Enter sofort und
 * - während des Tippens nach kurzer Pause automatisch
 * übernommen. Beim Unmount wird ein ausstehender Wert noch gespeichert.
 *
 * Mit `kp` arbeitet das Feld mit der App-eigenen Zahlentastatur: es bleibt ein
 * echtes <input> (fokussierbar, per Hardware-Tastatur und Playwright `fill`
 * bedienbar), blendet aber die System-Tastatur aus (inputMode="none").
 */
export interface NumberFieldHandle {
  focus: () => void;
}

export const NumberField = forwardRef<
  NumberFieldHandle,
  {
    value: number | null;
    onCommit: (v: number | null) => void;
    decimals?: boolean;
    placeholder?: string;
    ariaLabel: string;
    className?: string;
    max?: number;
    onFocusChange?: (focused: boolean) => void;
    muted?: boolean;
    format?: (v: number) => string;
    /** Feld-Identität für die Zahlentastatur. */
    kp?: KeypadField;
    /** Element, das beim Aktivieren über der Tastatur sichtbar sein soll. */
    scrollTarget?: () => HTMLElement | null;
  }
>(function NumberField({ value, onCommit, decimals = true, placeholder = '–', ariaLabel, className, max = 9999, onFocusChange, muted, format, kp, scrollTarget }, ref) {
  const fmt = (v: number | null) => (v === null ? '' : format ? format(v) : v.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false }));
  const [text, setTextState] = useState(fmt(value));
  const textRef = useRef(text);
  const setText = (t: string) => {
    textRef.current = t;
    setTextState(t);
  };
  const [focused, setFocused] = useState(false);
  const [fresh, setFreshState] = useState(false);
  const freshRef = useRef(false);
  const setFresh = (f: boolean) => {
    freshRef.current = f;
    setFreshState(f);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const valueRef = useRef(value);
  valueRef.current = value;
  const scrollRef = useRef(scrollTarget);
  scrollRef.current = scrollTarget;

  const isActive = useKeypad((s) => (kp ? sameField(s.active, kp) : false));
  const activeRef = useRef(isActive);
  activeRef.current = isActive;

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  // Externe Änderungen (z. B. Schnellaktionen, Sync) übernehmen – aber nicht
  // die laufende Eingabe überschreiben, wenn sie denselben Wert ergibt ("72,")
  useEffect(() => {
    const parsed = parseDecimal(textRef.current);
    if (parsed !== value) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    if (!focused && !isActive) setText(fmt(valueRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, isActive]);

  const clamp = (n: number) => {
    let v = n;
    if (!decimals) v = Math.round(v);
    return Math.min(Math.max(0, v), max);
  };

  const commit = (raw: string) => {
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    let n = parseDecimal(raw);
    if (n !== null) n = clamp(n);
    if (raw.trim() !== '' && n === null) return; // ungültige Eingabe ignorieren
    if (n !== valueRef.current) commitRef.current(n);
  };

  const type = (v: string) => {
    setText(v);
    if (activeRef.current) useKeypad.setState({ live: parseDecimal(v) });
    pending.current = v;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => commit(v), 700);
  };

  useEffect(
    () => () => {
      if (pending.current !== null) commit(pending.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Aktiv über die Tastatur: registrieren, fokussieren, sichtbar halten
  useEffect(() => {
    if (!isActive) return;
    setFresh(true);
    const ed: FieldEditor = {
      key: (k) => {
        const next = applyKey(textRef.current, k, { fresh: freshRef.current, decimals, max });
        if (next === null) return;
        setFresh(false);
        type(next);
      },
      set: (v) => {
        const n = v === null ? null : clamp(Math.round(v * 100) / 100);
        setText(fmt(n));
        useKeypad.setState({ live: n });
        setFresh(true);
        pending.current = null;
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        if (n !== valueRef.current) commitRef.current(n);
      },
      get: () => parseDecimal(textRef.current),
      commit: () => commit(textRef.current),
    };
    const unregister = registerEditor(ed);
    useKeypad.setState({ live: parseDecimal(textRef.current) });
    const input = inputRef.current;
    if (input && document.activeElement !== input) input.focus({ preventScroll: true });
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => ensureVisible(scrollRef.current?.() ?? input)));
    return () => {
      cancelAnimationFrame(raf);
      unregister();
      setFresh(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={kp ? 'none' : decimals ? 'decimal' : 'numeric'}
      enterKeyHint={kp ? 'next' : 'done'}
      autoComplete="off"
      aria-label={ariaLabel}
      data-kp-field={kp ? kp.field : undefined}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        onFocusChange?.(true);
        if (kp) useKeypad.getState().activate(kp);
        else requestAnimationFrame(() => e.target.select());
      }}
      onBlur={(e) => {
        setFocused(false);
        onFocusChange?.(false);
        commit(textRef.current);
        if (!kp) return;
        const to = e.relatedTarget as HTMLElement | null;
        // Fokus wandert in die Tastatur oder zu einem anderen Zahlenfeld → offen lassen
        if (to && (to.closest('[data-keypad]') || to.dataset.kpField)) return;
        if (sameField(useKeypad.getState().active, kp)) useKeypad.getState().close();
      }}
      onChange={(e) => {
        setFresh(false);
        type(e.target.value.replace(/[^\d.,]/g, ''));
      }}
      onKeyDown={(e) => {
        if (!kp) {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          return;
        }
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        // Hardware-Tastatur: gleiche Logik wie die Bildschirmtastatur
        if (/^\d$/.test(e.key) || e.key === ',' || e.key === '.' || e.key === 'Backspace') {
          e.preventDefault();
          getEditor()?.key(e.key === 'Backspace' ? 'back' : e.key);
        } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
          e.preventDefault();
          commit(textRef.current);
          const session = useWorkout.getState().session;
          const next = session ? nextFieldAfter(session.exercises, kp) : null;
          if (next) useKeypad.getState().activate(next);
          else useKeypad.getState().close();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          useKeypad.getState().close();
        }
      }}
      className={cn(
        'h-11 min-w-0 rounded-xl bg-transparent px-1.5 text-center text-xl font-bold tabular outline-none transition placeholder:text-muted/50 focus:bg-surface-2 focus:ring-2 focus:ring-primary/40',
        muted && !focused && !isActive && 'text-muted',
        isActive && 'bg-primary/10 ring-2 ring-primary caret-transparent focus:bg-primary/10 focus:ring-primary',
        isActive && fresh && text !== '' && 'text-primary',
        className,
      )}
    />
  );
});

/** Zeile so scrollen, dass sie zwischen Kopfzeile und Tastatur sichtbar ist. */
export function ensureVisible(el: HTMLElement | null | undefined) {
  if (!el) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const kpH = useKeypad.getState().height || 380;
  const r = el.getBoundingClientRect();
  const bottomLimit = window.innerHeight - kpH - 12;
  const topLimit = 84;
  let dy = 0;
  if (r.bottom > bottomLimit) dy = r.bottom - bottomLimit;
  else if (r.top < topLimit) dy = r.top - topLimit;
  if (Math.abs(dy) > 1) window.scrollBy({ top: dy, behavior: reduce ? 'auto' : 'smooth' });
}
