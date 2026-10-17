import { describe, expect, it } from 'vitest';
import { ExerciseMatcher, normalizeName, parseWorkoutNotes } from '../parser';

const lib = [
  { id: 'bench', nameDe: 'Bankdrücken', nameEn: 'Bench Press', aliases: ['Bench', 'Flachbank', 'BD'] },
  { id: 'incline', nameDe: 'Schrägbankdrücken Kurzhanteln', nameEn: 'Incline Dumbbell Press', aliases: ['Schrägbank', 'Schrägbank Kurzhanteln', 'Schrägbank KH'] },
  { id: 'lateral', nameDe: 'Seitheben', nameEn: 'Lateral Raise', aliases: ['Seitenheben', 'Lateral Raises'] },
  { id: 'squat', nameDe: 'Kniebeugen', nameEn: 'Back Squat', aliases: ['Squats', 'Kniebeuge'] },
  { id: 'lat', nameDe: 'Latziehen', nameEn: 'Lat Pulldown', aliases: ['Latzug', 'Lat Pulldown'] },
  { id: 'curl', nameDe: 'Bizepscurls Kurzhantel', nameEn: 'Dumbbell Curl', aliases: ['Bizeps', 'Bizepscurls', 'Curls'] },
  { id: 'pullup', nameDe: 'Klimmzüge', nameEn: 'Pull-up', aliases: ['Pull-ups', 'Klimmzug'] },
  { id: 'dips', nameDe: 'Dips', nameEn: 'Dips', aliases: ['Barrenstütz'] },
  { id: 'row', nameDe: 'Rudern am Kabel', nameEn: 'Seated Cable Row', aliases: ['Rudern Kabel', 'Kabelrudern'] },
];

const sets = (r: ReturnType<typeof parseWorkoutNotes>, d = 0, e = 0) =>
  r.days[d].exercises[e].sets.map((s) => [s.weightKg, s.reps]);

describe('Übungserkennung', () => {
  const m = new ExerciseMatcher(lib);
  it('normalisiert Umlaute und Satzzeichen', () => {
    expect(normalizeName('Schrägbank-Drücken (KH)!')).toBe('schraegbank druecken kh');
  });
  it('findet exakte Namen und Aliase', () => {
    expect(m.best('bankdrücken')?.exercise.id).toBe('bench');
    expect(m.best('Bankdruecken')?.exercise.id).toBe('bench');
    expect(m.best('Bench')?.exercise.id).toBe('bench');
    expect(m.best('Squats')?.exercise.id).toBe('squat');
  });
  it('findet Tippfehler unscharf', () => {
    expect(m.best('Bankdrücke')?.exercise.id).toBe('bench');
    expect(m.best('Latzihen')?.exercise.id).toBe('lat');
  });
  it('liefert null für Unbekanntes', () => {
    expect(m.best('Zottmancurls Spezial')).toBeNull();
  });
});

describe('Notes-Parser – Inline-Format', () => {
  it('Bankdrücken 3x10 80kg', () => {
    const r = parseWorkoutNotes('Bankdrücken 3x10 80kg', lib);
    expect(r.days[0].exercises[0].match?.exercise.id).toBe('bench');
    expect(sets(r)).toEqual([[80, 10], [80, 10], [80, 10]]);
  });
  it('Kniebeugen 4x8 100kg', () => {
    expect(sets(parseWorkoutNotes('Kniebeugen 4x8 100kg', lib))).toEqual([[100, 8], [100, 8], [100, 8], [100, 8]]);
  });
  it('Seitheben 3x15 12kg', () => {
    expect(sets(parseWorkoutNotes('Seitheben 3x15 12kg', lib))).toEqual([[12, 15], [12, 15], [12, 15]]);
  });
  it('Latziehen 12x55, 10x60, 8x65 (Wdh × Gewicht)', () => {
    const r = parseWorkoutNotes('Latziehen 12x55, 10x60, 8x65', lib);
    expect(sets(r)).toEqual([[55, 12], [60, 10], [65, 8]]);
    expect(r.days[0].exercises[0].sets.every((s) => !s.uncertain)).toBe(true);
  });
  it('Bizeps 3 Sätze je 12 mit 14kg', () => {
    const r = parseWorkoutNotes('Bizeps 3 Sätze je 12 mit 14kg', lib);
    expect(r.days[0].exercises[0].match?.exercise.id).toBe('curl');
    expect(sets(r)).toEqual([[14, 12], [14, 12], [14, 12]]);
  });
  it('deutsche Dezimalzahlen und Gewicht vorne', () => {
    expect(sets(parseWorkoutNotes('Bankdrücken 82,5kg 2x5', lib))).toEqual([[82.5, 5], [82.5, 5]]);
    expect(sets(parseWorkoutNotes('Bankdrücken 3x5 @ 82.5', lib))).toEqual([[82.5, 5], [82.5, 5], [82.5, 5]]);
  });
  it('Sätze × Wdh × Gewicht und Wiederholungsbereiche', () => {
    expect(sets(parseWorkoutNotes('Kniebeugen 3x5x100', lib))).toEqual([[100, 5], [100, 5], [100, 5]]);
    const r = parseWorkoutNotes('Kniebeugen 4x8-10 100 kg', lib);
    expect(r.days[0].exercises[0].sets[0]).toMatchObject({ weightKg: 100, reps: 8, repsMax: 10 });
    expect(r.days[0].exercises[0].sets).toHaveLength(4);
  });
  it('Eigengewicht erfindet keine Gewichte', () => {
    const r = parseWorkoutNotes('Klimmzüge 3x10\nDips 10, 8, 6', lib);
    expect(sets(r, 0, 0)).toEqual([[null, 10], [null, 10], [null, 10]]);
    expect(sets(r, 0, 1)).toEqual([[null, 10], [null, 8], [null, 6]]);
  });
  it('Zusatzgewicht', () => {
    expect(sets(parseWorkoutNotes('Dips +10kg 3x8', lib))).toEqual([[10, 8], [10, 8], [10, 8]]);
  });
  it('lbs werden in kg umgerechnet', () => {
    const r = parseWorkoutNotes('Bankdrücken 3x5 135lbs', lib);
    expect(r.days[0].exercises[0].sets[0].weightKg).toBeCloseTo(61.235, 2);
    const r2 = parseWorkoutNotes('Bankdrücken 3x5 135', lib, { defaultUnit: 'lbs' });
    expect(r2.days[0].exercises[0].sets[0].weightKg).toBeCloseTo(61.235, 2);
  });
  it('mehrere Zeilen und unbekannte Übungen', () => {
    const r = parseWorkoutNotes('Bankdrücken 3x10 80kg\nZottmancurls 3x12 10kg', lib);
    expect(r.days[0].exercises).toHaveLength(2);
    expect(r.days[0].exercises[1].match).toBeNull();
    expect(r.days[0].exercises[1].rawName).toBe('Zottmancurls');
    expect(r.days[0].exercises[1].warnings[0]).toContain('eigene Übung');
    expect(sets(r, 0, 1)).toEqual([[10, 12], [10, 12], [10, 12]]);
  });
});

describe('Notes-Parser – Blockformat (Import)', () => {
  const text = `Montag Push
Bankdrücken
60x12
70x10
75x8
Schrägbank
24x12
26x10
26x8
Seitheben
10x15
10x15
12x12`;

  it('erkennt Trainingstag, Übungen und Sätze (Gewicht × Wdh.)', () => {
    const r = parseWorkoutNotes(text, lib);
    expect(r.days).toHaveLength(1);
    expect(r.days[0].name).toBe('Montag Push');
    const ex = r.days[0].exercises;
    expect(ex.map((e) => e.match?.exercise.id)).toEqual(['bench', 'incline', 'lateral']);
    expect(sets(r, 0, 0)).toEqual([[60, 12], [70, 10], [75, 8]]);
    expect(sets(r, 0, 1)).toEqual([[24, 12], [26, 10], [26, 8]]);
    // Seitheben ist allein mehrdeutig, Dokument-Heuristik entscheidet → markiert
    expect(sets(r, 0, 2)).toEqual([[10, 15], [10, 15], [12, 12]]);
    expect(ex[2].sets[0].uncertain).toBe(true);
    expect(ex[2].warnings.length).toBeGreaterThan(0);
    expect(r.original).toBe(text);
  });

  it('erkennt mehrere Tage, Häkchen und Notizen', () => {
    const r = parseWorkoutNotes(
      `PUSH DAY
Bankdrücken
✓ 60 kg × 12
✓ 70 kg × 10
☐ 75 kg × 8
// Schulter zwickt leicht

PULL DAY
Latziehen
55x12
60x10`,
      lib,
    );
    expect(r.days.map((d) => d.name)).toEqual(['PUSH DAY', 'PULL DAY']);
    const bench = r.days[0].exercises[0];
    expect(bench.sets.map((s) => s.completed)).toEqual([true, true, false]);
    expect(bench.sets.map((s) => [s.weightKg, s.reps])).toEqual([[60, 12], [70, 10], [75, 8]]);
    expect(bench.notes).toBe('Schulter zwickt leicht');
    expect(sets(r, 1, 0)).toEqual([[55, 12], [60, 10]]);
  });

  it('erkennt Datumszeilen als Trainingstag', () => {
    const r = parseWorkoutNotes('17.10.2026 Push\nBankdrücken 3x10 80kg', lib);
    expect(r.days[0].date).toBe('2026-10-17');
    expect(r.days[0].exercises).toHaveLength(1);
  });

  it('meldet nicht zuordenbare Zeilen statt sie zu verwerfen', () => {
    const r = parseWorkoutNotes('60x12\nBankdrücken 3x10', lib);
    expect(r.unparsedLines).toEqual([{ line: 0, text: '60x12' }]);
  });

  it('Inline-Überschrift mit Doppelpunkt und Kommaliste', () => {
    const r = parseWorkoutNotes('Rudern Kabel: 50x12, 55x10, 55x10', lib);
    expect(r.days[0].exercises[0].match?.exercise.id).toBe('row');
    expect(sets(r)).toEqual([[50, 12], [55, 10], [55, 10]]);
  });
});
