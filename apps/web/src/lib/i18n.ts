import { useAuth } from './auth';

/**
 * Leichtgewichtige Internationalisierung. Deutsch ist Standard und vollständig;
 * weitere Sprachen ergänzen fehlende Schlüssel automatisch aus Deutsch.
 * Neue Texte: Schlüssel in `de` anlegen, optional in `en` übersetzen.
 */
const de = {
  nav: { today: 'Heute', plans: 'Pläne', exercises: 'Übungen', progress: 'Fortschritt', profile: 'Profil' },
  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    back: 'Zurück',
    close: 'Schließen',
    retry: 'Erneut versuchen',
    loading: 'Lädt …',
    offline: 'Offline',
    sets: 'Sätze',
    reps: 'Wdh.',
    weight: 'Gewicht',
  },
  workout: {
    start: 'Training starten',
    resume: 'Training fortsetzen',
    finish: 'Training abschließen',
    addExercise: 'Übung hinzufügen',
    addSet: 'Satz',
    free: 'Freies Training starten',
    listMode: 'Liste',
    guidedMode: 'Geführt',
  },
};

type Dict = typeof de;
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const en: DeepPartial<Dict> = {
  nav: { today: 'Today', plans: 'Plans', exercises: 'Exercises', progress: 'Progress', profile: 'Profile' },
  common: { save: 'Save', cancel: 'Cancel', delete: 'Delete', back: 'Back', close: 'Close', retry: 'Retry', loading: 'Loading …', offline: 'Offline', sets: 'Sets', reps: 'Reps', weight: 'Weight' },
  workout: { start: 'Start workout', resume: 'Resume workout', finish: 'Finish workout', addExercise: 'Add exercise', addSet: 'Set', free: 'Start free workout', listMode: 'List', guidedMode: 'Guided' },
};

function merge<T extends object>(base: T, over: DeepPartial<T> | undefined): T {
  if (!over) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const [k, v] of Object.entries(over)) {
    const b = (base as Record<string, unknown>)[k];
    out[k] = v && typeof v === 'object' && b && typeof b === 'object' ? merge(b as object, v as object) : (v ?? b);
  }
  return out as T;
}

const dicts: Record<string, Dict> = { de, en: merge(de, en) };

export function useT(): Dict {
  const lang = useAuth((s) => s.user?.settings.language ?? 'de');
  return dicts[lang] ?? de;
}
