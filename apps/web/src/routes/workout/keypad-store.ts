import { create } from 'zustand';

/**
 * ZAHLENTASTATUR-ZUSTAND
 * Bewusst winzig: nur welches Feld aktiv ist. Zeilen abonnieren per Selektor
 * ausschließlich "bin ich aktiv?" → beim Tippen rendert nur die betroffene Zeile.
 */
export type KeypadFieldKind = 'weight' | 'reps';
export interface KeypadField {
  exId: string;
  setId: string;
  field: KeypadFieldKind;
}

/** Schnittstelle des gerade aktiven Eingabefelds (registriert vom NumberField). */
export interface FieldEditor {
  /** Ziffer '0'–'9', ',' oder 'back' */
  key: (k: string) => void;
  /** Wert direkt setzen und sofort speichern (Schnellaktionen). */
  set: (v: number | null) => void;
  /** Aktueller (ggf. noch nicht gespeicherter) Wert. */
  get: () => number | null;
  /** Ausstehende Eingabe sofort speichern. */
  commit: () => void;
}

interface KeypadState {
  active: KeypadField | null;
  /** Gemessene Höhe des Panels (für Platz unter der Liste). */
  height: number;
  /** Live-Wert des aktiven Felds (auch vor dem Speichern) – für den Scheibenrechner. */
  live: number | null;
  activate: (f: KeypadField) => void;
  close: () => void;
  setHeight: (h: number) => void;
}

let editor: FieldEditor | null = null;
export const registerEditor = (e: FieldEditor) => {
  editor = e;
  return () => {
    if (editor === e) editor = null;
  };
};
export const getEditor = () => editor;

export const useKeypad = create<KeypadState>((set, get) => ({
  active: null,
  height: 0,
  live: null,
  activate(f) {
    const a = get().active;
    if (a && a.exId === f.exId && a.setId === f.setId && a.field === f.field) return;
    set({ active: f });
  },
  close() {
    editor?.commit();
    if (get().active) set({ active: null });
    const el = document.activeElement as HTMLElement | null;
    if (el?.dataset?.kpField) el.blur();
  },
  setHeight(h) {
    if (Math.abs(get().height - h) > 1) set({ height: h });
  },
}));

export const sameField = (a: KeypadField | null, b: { exId: string; setId: string; field?: KeypadFieldKind }) =>
  !!a && a.exId === b.exId && a.setId === b.setId && (b.field === undefined || a.field === b.field);

// ───────────────────────── reine Hilfsfunktionen (getestet) ─────────────────────────

interface ExLike {
  id: string;
  order: number;
  sets: { id: string; completed: boolean }[];
}

function flatSets(exercises: ExLike[]) {
  return [...exercises].sort((a, b) => a.order - b.order).flatMap((e) => e.sets.map((s) => ({ exId: e.id, setId: s.id, completed: s.completed })));
}

/** "Weiter" wie in einer Tabelle: Gewicht → Wdh. → Gewicht des nächsten Satzes. */
export function nextFieldAfter(exercises: ExLike[], cur: KeypadField): KeypadField | null {
  if (cur.field === 'weight') return { ...cur, field: 'reps' };
  const all = flatSets(exercises);
  const i = all.findIndex((s) => s.exId === cur.exId && s.setId === cur.setId);
  const n = i >= 0 ? all[i + 1] : undefined;
  return n ? { exId: n.exId, setId: n.setId, field: 'weight' } : null;
}

/** Nach "Satz fertig": nächster offener Satz (erst dahinter, dann von vorn). */
export function nextOpenSet(exercises: ExLike[], cur: { exId: string; setId: string }): KeypadField | null {
  const all = flatSets(exercises);
  const i = all.findIndex((s) => s.exId === cur.exId && s.setId === cur.setId);
  const order = [...all.slice(i + 1), ...all.slice(0, Math.max(0, i))];
  const n = order.find((s) => !s.completed);
  return n ? { exId: n.exId, setId: n.setId, field: 'weight' } : null;
}

/**
 * Tastendruck auf einen Eingabetext anwenden.
 * fresh = erster Tastendruck nach dem Aktivieren → ersetzt den Wert.
 * Gibt null zurück, wenn der Tastendruck ignoriert wird.
 */
export function applyKey(text: string, key: string, opts: { fresh: boolean; decimals: boolean; max: number }): string | null {
  const cur = opts.fresh ? '' : text;
  if (key === 'back') return opts.fresh ? '' : text.slice(0, -1);
  if (key === ',' || key === '.') {
    if (!opts.decimals || cur.includes(',')) return null;
    return (cur === '' ? '0' : cur) + ',';
  }
  if (!/^\d$/.test(key)) return null;
  const [int, frac] = cur.split(',');
  if (frac !== undefined && frac.length >= 2) return null;
  const base = frac === undefined && int === '0' ? '' : cur;
  const next = base + key;
  const n = Number(next.replace(',', '.'));
  if (!Number.isFinite(n) || n > opts.max) return null;
  return next;
}
