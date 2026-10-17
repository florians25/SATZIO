import type { MotivationLevel } from './enums';

/**
 * SATZIO COACH – deterministische, lokale Motivationsregeln.
 * Keine KI, keine Zufallszahlen: Die Auswahl hängt reproduzierbar von einem
 * Seed (z. B. Workout-ID + Ereignis) ab.
 */
export type CoachEvent =
  | { type: 'set_completed'; completedSets: number; totalSets: number; remainingInExercise: number }
  | { type: 'halfway' }
  | { type: 'exercise_completed'; remainingExercises: number }
  | { type: 'personal_record'; exerciseName: string }
  | { type: 'workout_completed' }
  | { type: 'weekly_goal_reached'; goal: number }
  | { type: 'milestone'; workouts: number };

export interface CoachMessage {
  text: string;
  tone: 'info' | 'success' | 'highlight';
}

const MIN_LEVEL: Record<CoachEvent['type'], MotivationLevel> = {
  set_completed: 'intense',
  halfway: 'subtle',
  exercise_completed: 'normal',
  personal_record: 'subtle',
  workout_completed: 'subtle',
  weekly_goal_reached: 'subtle',
  milestone: 'subtle',
};

const ORDER: MotivationLevel[] = ['off', 'subtle', 'normal', 'intense'];

export function levelAllows(level: MotivationLevel, required: MotivationLevel): boolean {
  if (level === 'off') return false;
  return ORDER.indexOf(level) >= ORDER.indexOf(required);
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

function pick(options: string[], seed: string): string {
  return options[hash(seed) % options.length];
}

export function coachMessage(event: CoachEvent, level: MotivationLevel, seed = ''): CoachMessage | null {
  if (!levelAllows(level, MIN_LEVEL[event.type])) return null;
  const s = `${seed}:${event.type}`;
  switch (event.type) {
    case 'set_completed': {
      if (event.remainingInExercise === 2) return { text: 'Stark! Noch zwei Sätze.', tone: 'info' };
      if (event.remainingInExercise === 1) return { text: 'Letzter Satz – alles geben.', tone: 'info' };
      return {
        text: pick(['Sauber!', 'Weiter so!', 'Satz im Kasten.', 'Läuft bei dir.', 'Stark!'], `${s}:${event.completedSets}`),
        tone: 'info',
      };
    }
    case 'halfway':
      return { text: pick(['Schon 50 % geschafft!', 'Halbzeit – du bist on fire.', 'Die Hälfte ist geschafft!'], s), tone: 'info' };
    case 'exercise_completed':
      if (event.remainingExercises === 1) return { text: 'Noch eine Übung bis zum Feierabend.', tone: 'info' };
      if (event.remainingExercises === 0) return { text: 'Alle Übungen erledigt – Training abschließen?', tone: 'success' };
      return {
        text: pick(['Übung abgehakt.', 'Erledigt. Weiter geht’s.', 'Die nächste wartet schon.'], `${s}:${event.remainingExercises}`),
        tone: 'info',
      };
    case 'personal_record':
      return { text: `Neuer persönlicher Rekord bei ${event.exerciseName}!`, tone: 'highlight' };
    case 'workout_completed':
      return {
        text: pick(['Training abgeschlossen. Stark gemacht!', 'Heute wieder abgeliefert.', 'Erledigt. Stärker als gestern.'], s),
        tone: 'success',
      };
    case 'weekly_goal_reached':
      return { text: `Wochenziel erreicht: ${event.goal} Trainings!`, tone: 'success' };
    case 'milestone':
      return { text: `${event.workouts}. Training – Meilenstein erreicht!`, tone: 'highlight' };
  }
}

export const MILESTONES = [1, 5, 10, 25, 50, 100, 150, 200, 250, 300, 365, 500, 1000];
