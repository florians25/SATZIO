import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { beep, notify, vibrate } from './feedback';

/**
 * PAUSENTIMER
 * Speichert eine absolute Endzeit (nicht "verbleibende Sekunden") →
 * bleibt bei Navigation korrekt und wird nach App-Neustart rekonstruiert.
 * Hinweis: Im Hintergrund (v. a. iOS) können Browser JavaScript pausieren;
 * Ton/Vibration/Benachrichtigung erfolgen dann beim nächsten Aktivwerden.
 */
interface TimerState {
  endsAt: number | null;
  duration: number;
  label: string | null;
  firedFor: number | null;
  start: (seconds: number, label?: string | null) => void;
  extend: (seconds: number) => void;
  skip: () => void;
}

const KEY = 'satzio-rest-timer';

function load(): Pick<TimerState, 'endsAt' | 'duration' | 'label'> {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.endsAt === 'number' && v.endsAt > Date.now() - 60_000) return v;
  } catch {
    /* ignore */
  }
  return { endsAt: null, duration: 0, label: null };
}

function save(s: Pick<TimerState, 'endsAt' | 'duration' | 'label'>) {
  try {
    localStorage.setItem(KEY, JSON.stringify({ endsAt: s.endsAt, duration: s.duration, label: s.label }));
  } catch {
    /* ignore */
  }
}

let notifyTimeout: ReturnType<typeof setTimeout> | null = null;
let prefs = { sound: false, vibration: true, notifications: false };

export function setTimerPrefs(p: typeof prefs) {
  prefs = p;
}

function armNotification(endsAt: number | null, label: string | null) {
  if (notifyTimeout) clearTimeout(notifyTimeout);
  notifyTimeout = null;
  if (!endsAt) return;
  notifyTimeout = setTimeout(() => {
    if (document.visibilityState !== 'visible' && prefs.notifications) {
      void notify('Pause vorbei', label ? `Weiter mit ${label}` : 'Weiter geht’s mit dem nächsten Satz.');
    }
  }, Math.max(0, endsAt - Date.now()));
}

export const useTimer = create<TimerState>((set, get) => ({
  ...load(),
  firedFor: null,
  start(seconds, label = null) {
    if (seconds <= 0) return;
    const endsAt = Date.now() + seconds * 1000;
    set({ endsAt, duration: seconds, label, firedFor: null });
    save({ endsAt, duration: seconds, label });
    armNotification(endsAt, label);
  },
  extend(seconds) {
    const { endsAt, duration, label } = get();
    const base = endsAt && endsAt > Date.now() ? endsAt : Date.now();
    const next = base + seconds * 1000;
    set({ endsAt: next, duration: duration + seconds, firedFor: null });
    save({ endsAt: next, duration: duration + seconds, label });
    armNotification(next, label);
  },
  skip() {
    set({ endsAt: null, duration: 0, label: null });
    save({ endsAt: null, duration: 0, label: null });
    armNotification(null, null);
  },
}));

/** Tickt nur, solange ein Timer läuft. */
export function useTimerRemaining(): number | null {
  const endsAt = useTimer((s) => s.endsAt);
  const [nowTs, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  return Math.max(0, Math.ceil((endsAt - nowTs) / 1000));
}

/** Einmaliges Signal bei Ablauf (läuft global im App-Rahmen). */
export function useTimerAlarm() {
  const remaining = useTimerRemaining();
  const endsAt = useTimer((s) => s.endsAt);
  const firedFor = useTimer((s) => s.firedFor);
  useEffect(() => {
    if (remaining === 0 && endsAt && firedFor !== endsAt) {
      useTimer.setState({ firedFor: endsAt });
      if (prefs.vibration) vibrate([180, 80, 180]);
      if (prefs.sound) beep(3);
      // Abgelaufenen Timer nach kurzer Zeit ausblenden
      setTimeout(() => {
        if (useTimer.getState().endsAt === endsAt) useTimer.getState().skip();
      }, 4000);
    }
  }, [remaining, endsAt, firedFor]);
}

export const REST_PRESETS = [30, 60, 90, 120, 180];
