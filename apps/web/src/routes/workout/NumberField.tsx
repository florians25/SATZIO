import { parseDecimal } from '@satzio/shared';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

/**
 * Inline-Zahlenfeld im Notizen-Stil. Änderungen werden
 * - beim Verlassen/Enter sofort und
 * - während des Tippens nach kurzer Pause automatisch
 * übernommen. Beim Unmount wird ein ausstehender Wert noch gespeichert.
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
  }
>(function NumberField({ value, onCommit, decimals = true, placeholder = '–', ariaLabel, className, max = 9999, onFocusChange, muted, format }, ref) {
  const fmt = (v: number | null) => (v === null ? '' : format ? format(v) : v.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false }));
  const [text, setText] = useState(fmt(value));
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<string | null>(null);
  const commitRef = useRef(onCommit);
  commitRef.current = onCommit;
  const valueRef = useRef(value);
  valueRef.current = value;

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }));

  // Externe Änderungen (z. B. Schnellaktionen, Sync) übernehmen – aber nicht
  // die laufende Eingabe überschreiben, wenn sie denselben Wert ergibt ("72,")
  useEffect(() => {
    const parsed = parseDecimal(text);
    if (parsed !== value) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  useEffect(() => {
    if (!focused) setText(fmt(valueRef.current));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused]);

  const commit = (raw: string) => {
    pending.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    let n = parseDecimal(raw);
    if (n !== null) {
      if (!decimals) n = Math.round(n);
      n = Math.min(Math.max(0, n), max);
    }
    if (raw.trim() !== '' && n === null) return; // ungültige Eingabe ignorieren
    if (n !== valueRef.current) commitRef.current(n);
  };

  useEffect(
    () => () => {
      if (pending.current !== null) commit(pending.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={decimals ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      aria-label={ariaLabel}
      value={text}
      placeholder={placeholder}
      onFocus={(e) => {
        setFocused(true);
        onFocusChange?.(true);
        requestAnimationFrame(() => e.target.select());
      }}
      onBlur={() => {
        setFocused(false);
        onFocusChange?.(false);
        commit(text);
      }}
      onChange={(e) => {
        const v = e.target.value.replace(/[^\d.,]/g, '');
        setText(v);
        pending.current = v;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => commit(v), 700);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={cn(
        'h-11 min-w-0 rounded-xl bg-transparent px-1.5 text-center text-xl font-bold tabular outline-none transition placeholder:text-muted/50 focus:bg-surface-2 focus:ring-2 focus:ring-primary/40',
        muted && !focused && 'text-muted',
        className,
      )}
    />
  );
});
