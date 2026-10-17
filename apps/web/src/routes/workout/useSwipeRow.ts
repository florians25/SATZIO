import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type MouseEvent as RMouseEvent } from 'react';

/**
 * Wisch-Gesten für Satzzeilen (Touch & Maus über Pointer Events):
 *  → rechts: Satz abhaken (grüne Fläche mit Haken)
 *  ← links:  Aktionen "Duplizieren" / "Löschen" freilegen
 *  lange drücken: Satz duplizieren
 * Achsensperre: erst ab 10 px deutlich horizontaler Bewegung wird gewischt –
 * vertikales Scrollen (touch-action: pan-y) und Tippen bleiben unberührt.
 */
export const ACTIONS_W = 156;
const LOCK = 10;
const TOGGLE_AT = 84;
const OPEN_AT = 56;
const LONG_PRESS_MS = 480;

export type SwipeSide = 'none' | 'right' | 'left';

export function useSwipeRow(opts: { onSwipeRight: () => void; onLongPress: () => void; onArm?: () => void; disabled?: boolean }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const [side, setSide] = useState<SwipeSide>('none');
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const st = useRef<{ x: number; y: number; id: number; lock: null | 'x' | 'y'; base: number; cur: number } | null>(null);
  const lp = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false);
  const armedRef = useRef(false);
  const openRef = useRef(false);

  const reduce = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const place = (x: number, animate: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animate && !reduce() ? 'transform 240ms cubic-bezier(.2,.9,.25,1)' : 'none';
    el.style.transform = x === 0 ? '' : `translate3d(${x}px,0,0)`;
  };
  const clearLp = () => {
    if (lp.current) clearTimeout(lp.current);
    lp.current = null;
  };
  const setOpenState = (o: boolean) => {
    openRef.current = o;
    setOpen(o);
    if (!o) setSide('none');
  };
  const close = () => {
    place(0, true);
    setOpenState(false);
  };

  // Offene Aktionen schließen, sobald woanders getippt wird
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => clearLp, []);

  const onPointerDown = (e: RPointerEvent<HTMLDivElement>) => {
    suppressClick.current = false;
    if (optsRef.current.disabled) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    const inInput = target.tagName === 'INPUT';
    // Maus im Eingabefeld = Text markieren, nicht wischen
    if (e.pointerType === 'mouse' && inInput) return;
    if ((target.closest('[data-swipe-action]'))) return;
    st.current = { x: e.clientX, y: e.clientY, id: e.pointerId, lock: null, base: openRef.current ? -ACTIONS_W : 0, cur: openRef.current ? -ACTIONS_W : 0 };
    clearLp();
    if (!(inInput && document.activeElement === target) && !openRef.current) {
      lp.current = setTimeout(() => {
        lp.current = null;
        if (st.current && st.current.lock === null) {
          suppressClick.current = true;
          st.current = null;
          optsRef.current.onLongPress();
        }
      }, LONG_PRESS_MS);
    }
  };

  const onPointerMove = (e: RPointerEvent<HTMLDivElement>) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (s.lock === null) {
      if (Math.abs(dx) > LOCK && Math.abs(dx) > Math.abs(dy) * 1.3) {
        s.lock = 'x';
        clearLp();
        try {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
      } else if (Math.abs(dy) > LOCK) {
        clearLp();
        st.current = null;
        return;
      } else {
        if (Math.abs(dx) > 6 || Math.abs(dy) > 6) clearLp();
        return;
      }
    }
    let x = s.base + dx;
    // Gummiband-Effekt jenseits der Grenzen
    if (x > TOGGLE_AT + 20) x = TOGGLE_AT + 20 + (x - TOGGLE_AT - 20) * 0.3;
    if (x < -ACTIONS_W) x = -ACTIONS_W + (x + ACTIONS_W) * 0.3;
    s.cur = x;
    place(x, false);
    const nextSide: SwipeSide = x > 0 ? 'right' : x < 0 ? 'left' : 'none';
    setSide((p) => (p === nextSide ? p : nextSide));
    const isArmed = x >= TOGGLE_AT;
    if (isArmed !== armedRef.current) {
      armedRef.current = isArmed;
      setArmed(isArmed);
      if (isArmed) optsRef.current.onArm?.();
    }
  };

  const end = (e: RPointerEvent<HTMLDivElement>, cancelled: boolean) => {
    clearLp();
    const s = st.current;
    st.current = null;
    if (!s || s.id !== e.pointerId || s.lock !== 'x') {
      // Tippen auf die Zeile schließt offene Aktionen
      if (s && openRef.current && !cancelled) {
        suppressClick.current = true;
        close();
      }
      return;
    }
    suppressClick.current = true;
    const x = s.cur;
    armedRef.current = false;
    setArmed(false);
    if (!cancelled && x >= TOGGLE_AT) {
      place(0, true);
      setOpenState(false);
      optsRef.current.onSwipeRight();
    } else if (!cancelled && x <= -OPEN_AT) {
      place(-ACTIONS_W, true);
      setOpenState(true);
      setSide('left');
    } else {
      close();
    }
  };

  return {
    rowRef,
    contentRef,
    side,
    armed,
    open,
    close,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: RPointerEvent<HTMLDivElement>) => end(e, false),
      onPointerCancel: (e: RPointerEvent<HTMLDivElement>) => end(e, true),
      onClickCapture: (e: RMouseEvent<HTMLDivElement>) => {
        if (suppressClick.current) {
          suppressClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }
      },
      onContextMenu: (e: RMouseEvent<HTMLDivElement>) => {
        // Android: langes Drücken soll kein Kontextmenü öffnen
        if ((e.nativeEvent as PointerEvent).pointerType !== 'mouse' && (e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault();
      },
    },
  };
}
