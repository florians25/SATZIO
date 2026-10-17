import { coachMessage, type CoachEvent, type CoachMessage, type MotivationLevel } from '@satzio/shared';
import { create } from 'zustand';

/** Nicht-blockierende Coach-Meldungen (oben eingeblendet, verschwinden automatisch). */
interface CoachState {
  current: (CoachMessage & { id: number }) | null;
  show: (m: CoachMessage) => void;
  clear: () => void;
}

let counter = 0;
let hideTimer: ReturnType<typeof setTimeout> | null = null;

export const useCoach = create<CoachState>((set) => ({
  current: null,
  show(m) {
    const id = ++counter;
    set({ current: { ...m, id } });
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => set((s) => (s.current?.id === id ? { current: null } : s)), m.tone === 'highlight' ? 3500 : 2600);
  },
  clear() {
    set({ current: null });
  },
}));

export function coach(event: CoachEvent, level: MotivationLevel, seed: string) {
  const m = coachMessage(event, level, seed);
  if (m) useCoach.getState().show(m);
}
