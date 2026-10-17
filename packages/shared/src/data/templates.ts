import type { TemplateExercise, TemplateSet, WorkoutTemplate } from '../types';

/*
 * Mitgelieferte Trainingsvorlagen. Gewichte bleiben bewusst leer –
 * sie werden aus der Historie oder manuell ergänzt.
 */

/** Ein Aufwärmsatz mit 10 Wiederholungen. */
const warmup = (): TemplateSet => ({ type: 'warmup', repsMin: 10, repsMax: 10 });

/** `count` Arbeitssätze mit Wiederholungsbereich. */
const work = (count: number, repsMin: number, repsMax: number = repsMin): TemplateSet[] =>
  Array.from({ length: count }, () => ({ type: 'working' as const, repsMin, repsMax }));

/** Aufwärmsatz + Arbeitssätze (für schwere Grundübungen). */
const heavy = (count: number, repsMin: number, repsMax: number = repsMin): TemplateSet[] => [
  warmup(),
  ...work(count, repsMin, repsMax),
];

const ex = (
  exercise: string,
  sets: TemplateSet[],
  restSeconds: number,
  extra: Pick<TemplateExercise, 'supersetGroup' | 'notes'> = {},
): TemplateExercise => ({ exercise, sets, restSeconds, ...extra });

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'full-body-2',
    name: 'Ganzkörper 2 Tage',
    description:
      'Zwei abwechselnde Ganzkörpereinheiten pro Woche. Ideal für Einsteiger und alle mit wenig Zeit.',
    level: 'beginner',
    goals: ['general', 'muscle_gain', 'fitness'],
    daysPerWeek: 2,
    durationMinutes: 60,
    days: [
      {
        name: 'Ganzkörper A',
        exercises: [
          ex('barbell-back-squat', heavy(3, 8, 10), 150),
          ex('dumbbell-bench-press', work(3, 8, 12), 120),
          ex('lat-pulldown', work(3, 8, 12), 90),
          ex('romanian-deadlift', work(3, 8, 12), 120),
          ex('dumbbell-lateral-raise', work(3, 12, 15), 60),
          ex('crunch', work(3, 12, 20), 60),
        ],
      },
      {
        name: 'Ganzkörper B',
        exercises: [
          ex('leg-press', work(3, 10, 12), 120),
          ex('dumbbell-shoulder-press', work(3, 8, 12), 90),
          ex('seated-cable-row', work(3, 10, 12), 90),
          ex('incline-dumbbell-press', work(3, 8, 12), 90),
          ex('lying-leg-curl', work(3, 10, 15), 60),
          ex('dumbbell-curl', work(3, 10, 15), 60, { supersetGroup: 'A' }),
          ex('tricep-pushdown', work(3, 10, 15), 60, { supersetGroup: 'A' }),
          ex('lying-leg-raise', work(3, 12, 20), 60),
        ],
      },
    ],
  },
  {
    id: 'full-body-3',
    name: 'Ganzkörper 3 Tage',
    description:
      'Drei verschiedene Ganzkörpereinheiten (A/B/C) pro Woche. Jede Muskelgruppe wird häufig trainiert – ein solides Fundament für Kraft und Muskelaufbau.',
    level: 'beginner',
    goals: ['muscle_gain', 'strength', 'general'],
    daysPerWeek: 3,
    durationMinutes: 60,
    days: [
      {
        name: 'Ganzkörper A',
        exercises: [
          ex('barbell-back-squat', heavy(3, 6, 8), 150),
          ex('barbell-bench-press', heavy(3, 6, 8), 150),
          ex('barbell-row', work(3, 8, 10), 120),
          ex('dumbbell-lateral-raise', work(3, 12, 15), 60),
          ex('barbell-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('skull-crusher', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('crunch', work(3, 15, 20), 60),
        ],
      },
      {
        name: 'Ganzkörper B',
        exercises: [
          ex('deadlift', heavy(3, 5), 180),
          ex('overhead-press', heavy(3, 6, 8), 150),
          ex('lat-pulldown', work(3, 8, 12), 90),
          ex('leg-press', work(3, 10, 12), 120),
          ex('face-pull', work(3, 12, 15), 60),
          ex('dead-bug', work(3, 10, 12), 60, { notes: 'Wiederholungen pro Seite' }),
        ],
      },
      {
        name: 'Ganzkörper C',
        exercises: [
          ex('bulgarian-split-squat', work(3, 8, 12), 90, { notes: 'Wiederholungen pro Bein' }),
          ex('incline-dumbbell-press', work(3, 8, 12), 90),
          ex('pull-up', work(3, 6, 10), 120, { notes: 'Alternativ: Klimmzüge unterstützt' }),
          ex('romanian-deadlift', work(3, 8, 12), 120),
          ex('hammer-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('overhead-tricep-extension', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('cable-crunch', work(3, 12, 20), 60),
        ],
      },
    ],
  },
  {
    id: 'push-pull-legs',
    name: 'Push / Pull / Legs',
    description:
      'Klassischer Split nach Bewegungsmustern: Drücken, Ziehen, Beine. Lässt sich 3× oder 6× pro Woche durchlaufen.',
    level: 'intermediate',
    goals: ['muscle_gain', 'strength'],
    daysPerWeek: 3,
    durationMinutes: 75,
    days: [
      {
        name: 'Push',
        exercises: [
          ex('barbell-bench-press', heavy(4, 6, 8), 150),
          ex('incline-dumbbell-press', work(3, 8, 12), 120),
          ex('dumbbell-shoulder-press', work(3, 8, 12), 90),
          ex('cable-fly', work(3, 12, 15), 60),
          ex('dumbbell-lateral-raise', work(4, 12, 15), 60),
          ex('tricep-pushdown', work(3, 10, 15), 60),
          ex('overhead-tricep-extension', work(3, 10, 15), 60),
        ],
      },
      {
        name: 'Pull',
        exercises: [
          ex('pull-up', work(4, 6, 10), 120),
          ex('barbell-row', work(3, 8, 10), 120),
          ex('seated-cable-row', work(3, 10, 12), 90),
          ex('face-pull', work(3, 12, 15), 60),
          ex('reverse-fly', work(3, 12, 15), 60),
          ex('barbell-curl', work(3, 8, 12), 60),
          ex('hammer-curl', work(3, 10, 12), 60),
        ],
      },
      {
        name: 'Beine',
        exercises: [
          ex('barbell-back-squat', heavy(4, 6, 8), 180),
          ex('romanian-deadlift', work(3, 8, 10), 120),
          ex('leg-press', work(3, 10, 12), 120),
          ex('leg-extension', work(3, 12, 15), 60),
          ex('seated-leg-curl', work(3, 10, 15), 60),
          ex('standing-calf-raise', work(4, 10, 15), 60),
          ex('hanging-leg-raise', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Oberkörper / Unterkörper',
    description:
      'Vier Einheiten pro Woche im Wechsel von Ober- und Unterkörper. Kombiniert schwere Grundübungen mit Volumen für den Muskelaufbau.',
    level: 'intermediate',
    goals: ['strength', 'muscle_gain'],
    daysPerWeek: 4,
    durationMinutes: 70,
    days: [
      {
        name: 'Oberkörper A',
        exercises: [
          ex('barbell-bench-press', heavy(4, 4, 6), 180),
          ex('barbell-row', heavy(4, 6, 8), 150),
          ex('overhead-press', work(3, 6, 8), 150),
          ex('lat-pulldown', work(3, 8, 12), 90),
          ex('dumbbell-lateral-raise', work(3, 12, 15), 60),
          ex('ez-bar-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('skull-crusher', work(3, 10, 12), 60, { supersetGroup: 'A' }),
        ],
      },
      {
        name: 'Unterkörper A',
        exercises: [
          ex('barbell-back-squat', heavy(4, 4, 6), 180),
          ex('romanian-deadlift', work(3, 6, 8), 150),
          ex('leg-press', work(3, 10, 12), 120),
          ex('lying-leg-curl', work(3, 10, 12), 60),
          ex('standing-calf-raise', work(4, 10, 15), 60),
          ex('cable-crunch', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'Oberkörper B',
        exercises: [
          ex('incline-dumbbell-press', work(4, 8, 10), 120),
          ex('pull-up', work(4, 6, 10), 120),
          ex('dumbbell-shoulder-press', work(3, 8, 12), 90),
          ex('seated-cable-row', work(3, 10, 12), 90),
          ex('cable-fly', work(3, 12, 15), 60),
          ex('face-pull', work(3, 12, 15), 60),
          ex('hammer-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('tricep-pushdown', work(3, 10, 12), 60, { supersetGroup: 'A' }),
        ],
      },
      {
        name: 'Unterkörper B',
        exercises: [
          ex('deadlift', heavy(3, 3, 5), 180),
          ex('front-squat', work(3, 6, 8), 150),
          ex('bulgarian-split-squat', work(3, 8, 10), 90, { notes: 'Wiederholungen pro Bein' }),
          ex('seated-leg-curl', work(3, 10, 15), 60),
          ex('seated-calf-raise', work(4, 12, 15), 60),
          ex('hanging-leg-raise', work(3, 10, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'hypertrophy-4',
    name: '4-Tage-Muskelaufbau',
    description:
      'Muskelaufbau-Split mit vier Einheiten: Brust & Trizeps, Rücken & Bizeps, Beine sowie Schultern & Arme. Fokus auf moderate Wiederholungen und ausreichend Volumen.',
    level: 'intermediate',
    goals: ['muscle_gain'],
    daysPerWeek: 4,
    durationMinutes: 75,
    days: [
      {
        name: 'Brust & Trizeps',
        exercises: [
          ex('barbell-bench-press', heavy(4, 8, 10), 120),
          ex('incline-dumbbell-press', work(3, 8, 12), 90),
          ex('machine-chest-press', work(3, 10, 12), 90),
          ex('pec-deck', work(3, 12, 15), 60),
          ex('dips', work(3, 8, 12), 90),
          ex('rope-pushdown', work(3, 10, 15), 60),
          ex('skull-crusher', work(3, 10, 12), 60),
        ],
      },
      {
        name: 'Rücken & Bizeps',
        exercises: [
          ex('lat-pulldown', work(4, 8, 12), 90),
          ex('t-bar-row', work(4, 8, 10), 120),
          ex('seated-cable-row', work(3, 10, 12), 90),
          ex('straight-arm-pulldown', work(3, 12, 15), 60),
          ex('ez-bar-curl', work(3, 8, 12), 60),
          ex('incline-dumbbell-curl', work(3, 10, 12), 60),
          ex('back-extension', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'Beine',
        exercises: [
          ex('barbell-back-squat', heavy(4, 8, 10), 120),
          ex('leg-press', work(4, 10, 12), 120),
          ex('romanian-deadlift', work(3, 8, 12), 120),
          ex('walking-lunge', work(3, 10, 12), 90, { notes: 'Wiederholungen pro Bein' }),
          ex('leg-extension', work(3, 12, 15), 60),
          ex('lying-leg-curl', work(3, 10, 15), 60),
          ex('standing-calf-raise', work(4, 12, 15), 60),
        ],
      },
      {
        name: 'Schultern & Arme',
        exercises: [
          ex('dumbbell-shoulder-press', work(4, 8, 12), 90),
          ex('dumbbell-lateral-raise', work(4, 12, 15), 60),
          ex('rear-delt-machine', work(3, 12, 15), 60),
          ex('cable-lateral-raise', work(3, 12, 15), 60),
          ex('barbell-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('tricep-pushdown', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('hammer-curl', work(3, 10, 12), 60, { supersetGroup: 'B' }),
          ex('overhead-tricep-extension', work(3, 10, 12), 60, { supersetGroup: 'B' }),
        ],
      },
    ],
  },
  {
    id: 'hypertrophy-5',
    name: '5-Tage-Muskelaufbau',
    description:
      'Klassischer Bodybuilding-Split mit einer Muskelgruppe pro Tag. Hohes Volumen für erfahrene Trainierende.',
    level: 'advanced',
    goals: ['muscle_gain'],
    daysPerWeek: 5,
    durationMinutes: 75,
    days: [
      {
        name: 'Brust',
        exercises: [
          ex('barbell-bench-press', heavy(4, 6, 10), 120),
          ex('incline-barbell-bench-press', work(3, 8, 10), 120),
          ex('dips', work(3, 8, 12), 90),
          ex('dumbbell-fly', work(3, 10, 12), 60),
          ex('cable-fly', work(3, 12, 15), 60),
          ex('low-to-high-cable-fly', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'Rücken',
        exercises: [
          ex('deadlift', heavy(3, 6, 8), 150),
          ex('pull-up', work(4, 6, 10), 120),
          ex('barbell-row', work(3, 8, 10), 120),
          ex('close-grip-lat-pulldown', work(3, 10, 12), 90),
          ex('chest-supported-dumbbell-row', work(3, 10, 12), 90),
          ex('shrug', work(3, 10, 15), 60),
        ],
      },
      {
        name: 'Beine',
        exercises: [
          ex('barbell-back-squat', heavy(4, 8, 10), 150),
          ex('hack-squat', work(3, 10, 12), 120),
          ex('romanian-deadlift', work(3, 8, 10), 120),
          ex('leg-extension', work(3, 12, 15), 60),
          ex('seated-leg-curl', work(3, 12, 15), 60),
          ex('seated-calf-raise', work(4, 12, 15), 60),
          ex('hanging-leg-raise', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'Schultern',
        exercises: [
          ex('overhead-press', heavy(4, 6, 10), 150),
          ex('arnold-press', work(3, 8, 12), 90),
          ex('dumbbell-lateral-raise', work(4, 12, 15), 60),
          ex('cable-lateral-raise', work(3, 12, 15), 60),
          ex('face-pull', work(3, 12, 15), 60),
          ex('reverse-fly', work(3, 12, 15), 60),
        ],
      },
      {
        name: 'Arme',
        exercises: [
          ex('close-grip-bench-press', work(4, 8, 10), 120),
          ex('barbell-curl', work(3, 8, 12), 60),
          ex('preacher-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('overhead-tricep-extension', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('hammer-curl', work(3, 10, 12), 60, { supersetGroup: 'B' }),
          ex('rope-pushdown', work(3, 10, 15), 60, { supersetGroup: 'B' }),
          ex('wrist-curl', work(3, 12, 15), 60),
          ex('ab-wheel-rollout', work(3, 10, 12), 60),
        ],
      },
    ],
  },
  {
    id: 'beginner-strength',
    name: 'Anfänger Krafttraining',
    description:
      'Einfaches 5×5-Programm mit zwei abwechselnden Einheiten (A/B) an drei Tagen pro Woche. Fokus auf die großen Grundübungen und stetige Steigerung.',
    level: 'beginner',
    goals: ['strength'],
    daysPerWeek: 3,
    durationMinutes: 60,
    days: [
      {
        name: 'Training A',
        exercises: [
          ex('barbell-back-squat', heavy(5, 5), 180),
          ex('barbell-bench-press', heavy(5, 5), 180),
          ex('barbell-row', work(5, 5), 150),
          ex('face-pull', work(3, 12, 15), 60),
          ex('dead-bug', work(3, 10, 12), 60, { notes: 'Wiederholungen pro Seite' }),
        ],
      },
      {
        name: 'Training B',
        exercises: [
          ex('barbell-back-squat', heavy(5, 5), 180),
          ex('overhead-press', heavy(5, 5), 180),
          ex('deadlift', heavy(3, 5), 180),
          ex('chin-up', work(3, 5, 8), 150, { notes: 'Alternativ: Klimmzüge unterstützt' }),
          ex('lying-leg-raise', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'advanced-strength',
    name: 'Fortgeschrittenes Krafttraining',
    description:
      'Vier Einheiten pro Woche, jeweils um eine Hauptübung (Kniebeuge, Bankdrücken, Kreuzheben, Schulterdrücken) aufgebaut. Niedrige Wiederholungen, lange Pausen.',
    level: 'advanced',
    goals: ['strength'],
    daysPerWeek: 4,
    durationMinutes: 90,
    days: [
      {
        name: 'Kniebeuge',
        exercises: [
          ex('barbell-back-squat', heavy(5, 3, 5), 180),
          ex('front-squat', work(3, 4, 6), 180),
          ex('romanian-deadlift', work(3, 6, 8), 150),
          ex('bulgarian-split-squat', work(3, 6, 8), 120, { notes: 'Wiederholungen pro Bein' }),
          ex('hanging-leg-raise', work(3, 10, 15), 60),
        ],
      },
      {
        name: 'Bankdrücken',
        exercises: [
          ex('barbell-bench-press', heavy(5, 3, 5), 180),
          ex('close-grip-bench-press', work(3, 4, 6), 150),
          ex('barbell-row', work(4, 6, 8), 150),
          ex('dips', work(3, 6, 8), 120),
          ex('tricep-pushdown', work(3, 10, 12), 60),
        ],
      },
      {
        name: 'Kreuzheben',
        exercises: [
          ex('deadlift', heavy(4, 3, 5), 180),
          ex('good-morning', work(3, 6, 8), 150),
          ex('pull-up', work(4, 4, 6), 150),
          ex('pendlay-row', work(3, 5, 6), 150),
          ex('back-extension', work(3, 10, 12), 60),
          ex('ab-wheel-rollout', work(3, 8, 12), 60),
        ],
      },
      {
        name: 'Schulterdrücken',
        exercises: [
          ex('overhead-press', heavy(5, 3, 5), 180),
          ex('push-press', work(3, 3, 5), 180),
          ex('incline-barbell-bench-press', work(3, 5, 6), 150),
          ex('chin-up', work(4, 5, 8), 150),
          ex('face-pull', work(3, 12, 15), 60),
          ex('ez-bar-curl', work(3, 8, 10), 60),
        ],
      },
    ],
  },
  {
    id: 'quick-30',
    name: 'Kurzes 30-Minuten-Workout',
    description:
      'Kompakte Ganzkörpereinheiten für Tage mit wenig Zeit. Kurze Pausen halten den Puls oben.',
    level: 'beginner',
    goals: ['fitness', 'general', 'weight_loss'],
    daysPerWeek: 3,
    durationMinutes: 30,
    days: [
      {
        name: 'Workout A',
        exercises: [
          ex('goblet-squat', work(3, 10, 12), 60),
          ex('push-up', work(3, 8, 15), 60),
          ex('dumbbell-row', work(3, 10, 12), 60, { notes: 'Wiederholungen pro Arm' }),
          ex('dumbbell-romanian-deadlift', work(3, 10, 12), 60),
          ex('mountain-climber', work(3, 20, 30), 45, { notes: 'Wiederholungen gesamt (beide Beine)' }),
        ],
      },
      {
        name: 'Workout B',
        exercises: [
          ex('walking-lunge', work(3, 10, 12), 60, { notes: 'Wiederholungen pro Bein' }),
          ex('dumbbell-bench-press', work(3, 8, 12), 60),
          ex('lat-pulldown', work(3, 10, 12), 60),
          ex('glute-bridge', work(3, 12, 15), 45),
          ex('crunch', work(3, 15, 20), 45),
        ],
      },
    ],
  },
  {
    id: 'machines',
    name: 'Gerätebasiertes Training',
    description:
      'Ganzkörpertraining ausschließlich an Maschinen und Kabelzügen. Geführte Bewegungen machen den Einstieg leicht und sicher.',
    level: 'beginner',
    goals: ['muscle_gain', 'general'],
    daysPerWeek: 3,
    durationMinutes: 60,
    days: [
      {
        name: 'Geräte A',
        exercises: [
          ex('leg-press', work(3, 10, 12), 120),
          ex('machine-chest-press', work(3, 10, 12), 90),
          ex('lat-pulldown', work(3, 10, 12), 90),
          ex('machine-shoulder-press', work(3, 10, 12), 90),
          ex('lying-leg-curl', work(3, 12, 15), 60),
          ex('machine-crunch', work(3, 12, 20), 60),
        ],
      },
      {
        name: 'Geräte B',
        exercises: [
          ex('hack-squat', work(3, 10, 12), 120),
          ex('machine-row', work(3, 10, 12), 90),
          ex('incline-machine-press', work(3, 10, 12), 90),
          ex('leg-extension', work(3, 12, 15), 60),
          ex('machine-lateral-raise', work(3, 12, 15), 60),
          ex('machine-bicep-curl', work(3, 10, 15), 60, { supersetGroup: 'A' }),
          ex('tricep-dip-machine', work(3, 10, 15), 60, { supersetGroup: 'A' }),
        ],
      },
      {
        name: 'Geräte C',
        exercises: [
          ex('smith-machine-squat', work(3, 8, 12), 120),
          ex('assisted-pull-up', work(3, 8, 12), 90),
          ex('pec-deck', work(3, 12, 15), 60),
          ex('seated-leg-curl', work(3, 12, 15), 60),
          ex('hip-abduction-machine', work(3, 12, 15), 60),
          ex('rear-delt-machine', work(3, 12, 15), 60),
          ex('standing-calf-raise', work(3, 12, 15), 60),
        ],
      },
    ],
  },
  {
    id: 'dumbbells',
    name: 'Kurzhanteltraining',
    description:
      'Ganzkörpertraining nur mit Kurzhanteln und Körpergewicht – perfekt für zu Hause oder kleine Studios.',
    level: 'beginner',
    goals: ['muscle_gain', 'general', 'fitness'],
    daysPerWeek: 3,
    durationMinutes: 50,
    days: [
      {
        name: 'Kurzhantel A',
        exercises: [
          ex('goblet-squat', work(3, 10, 12), 90),
          ex('dumbbell-bench-press', work(3, 8, 12), 90),
          ex('dumbbell-row', work(3, 10, 12), 90, { notes: 'Wiederholungen pro Arm' }),
          ex('dumbbell-shoulder-press', work(3, 8, 12), 90),
          ex('dumbbell-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('overhead-tricep-extension', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('crunch', work(3, 15, 20), 60),
        ],
      },
      {
        name: 'Kurzhantel B',
        exercises: [
          ex('dumbbell-romanian-deadlift', work(3, 10, 12), 90),
          ex('incline-dumbbell-press', work(3, 8, 12), 90),
          ex('chest-supported-dumbbell-row', work(3, 10, 12), 90),
          ex('bulgarian-split-squat', work(3, 8, 12), 90, { notes: 'Wiederholungen pro Bein' }),
          ex('dumbbell-lateral-raise', work(3, 12, 15), 60),
          ex('dead-bug', work(3, 10, 12), 60, { notes: 'Wiederholungen pro Seite' }),
        ],
      },
      {
        name: 'Kurzhantel C',
        exercises: [
          ex('walking-lunge', work(3, 10, 12), 90, { notes: 'Wiederholungen pro Bein' }),
          ex('push-up', work(3, 8, 15), 90),
          ex('arnold-press', work(3, 8, 12), 90),
          ex('dumbbell-pullover', work(3, 10, 12), 60),
          ex('hammer-curl', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('tricep-kickback', work(3, 10, 12), 60, { supersetGroup: 'A' }),
          ex('single-leg-calf-raise', work(3, 12, 15), 60, { notes: 'Wiederholungen pro Bein' }),
          ex('russian-twist', work(3, 12, 20), 60),
        ],
      },
    ],
  },
];
