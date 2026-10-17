import { describe, expect, it } from 'vitest';
import {
  DIFFICULTIES,
  EQUIPMENT,
  EXERCISE_CATEGORIES,
  GOALS,
  LEVELS,
  MUSCLE_GROUPS,
  SET_TYPES,
} from '../enums';
import { EXERCISES } from './exercises';
import { WORKOUT_TEMPLATES } from './templates';

const norm = (s: string) => s.trim().toLowerCase();
const slugs = new Set(EXERCISES.map((e) => e.slug));
const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

describe('EXERCISES', () => {
  it('enthält mindestens 150 Übungen', () => {
    expect(EXERCISES.length).toBeGreaterThanOrEqual(150);
  });

  it('hat eindeutige Slugs in kebab-case', () => {
    expect(slugs.size).toBe(EXERCISES.length);
    for (const e of EXERCISES) expect(e.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it('hat eindeutige deutsche Namen', () => {
    const names = EXERCISES.map((e) => norm(e.nameDe));
    expect(new Set(names).size).toBe(names.length);
  });

  it('nutzt jede Muskelgruppe und jedes Equipment mindestens einmal', () => {
    const muscles = new Set(EXERCISES.map((e) => e.primaryMuscle));
    for (const m of MUSCLE_GROUPS) expect(muscles, m).toContain(m);
    const equipment = new Set(EXERCISES.map((e) => e.equipment));
    for (const eq of EQUIPMENT) expect(equipment, eq).toContain(eq);
  });

  it('verwendet nur gültige Enum-Werte', () => {
    for (const e of EXERCISES) {
      expect(MUSCLE_GROUPS, e.slug).toContain(e.primaryMuscle);
      for (const m of e.secondaryMuscles) expect(MUSCLE_GROUPS, e.slug).toContain(m);
      expect(EQUIPMENT, e.slug).toContain(e.equipment);
      expect(EXERCISE_CATEGORIES, e.slug).toContain(e.category);
      expect(DIFFICULTIES, e.slug).toContain(e.difficulty);
    }
  });

  it('enthält den primären Muskel nicht in den sekundären Muskeln', () => {
    for (const e of EXERCISES) {
      expect(e.secondaryMuscles, e.slug).not.toContain(e.primaryMuscle);
      expect(new Set(e.secondaryMuscles).size, e.slug).toBe(e.secondaryMuscles.length);
      expect(e.secondaryMuscles.length, e.slug).toBeLessThanOrEqual(3);
    }
  });

  it('verweist bei Alternativen nur auf existierende, fremde Übungen', () => {
    for (const e of EXERCISES) {
      expect(e.alternatives.length, e.slug).toBeGreaterThanOrEqual(1);
      for (const alt of e.alternatives) {
        expect(slugs.has(alt), `${e.slug} -> ${alt}`).toBe(true);
        expect(alt, e.slug).not.toBe(e.slug);
      }
    }
  });

  it('hat eindeutige Aliase, die keinem fremden deutschen Namen entsprechen', () => {
    const aliasOwner = new Map<string, string>();
    const nameOwner = new Map(EXERCISES.map((e) => [norm(e.nameDe), e.slug]));
    for (const e of EXERCISES) {
      const own = new Set<string>();
      for (const alias of e.aliases) {
        const key = norm(alias);
        expect(key.length, e.slug).toBeGreaterThan(0);
        if (own.has(key)) continue; // Duplikat innerhalb derselben Übung ist harmlos
        own.add(key);
        const prev = aliasOwner.get(key);
        expect(prev === undefined || prev === e.slug, `Alias "${alias}" bei ${prev} und ${e.slug}`).toBe(true);
        aliasOwner.set(key, e.slug);
        const nameSlug = nameOwner.get(key);
        expect(
          nameSlug === undefined || nameSlug === e.slug,
          `Alias "${alias}" von ${e.slug} entspricht nameDe von ${nameSlug}`,
        ).toBe(true);
      }
    }
  });

  it('hat Texte, Schritte und Fehler', () => {
    for (const e of EXERCISES) {
      expect(e.nameDe.trim(), e.slug).not.toBe('');
      expect(e.nameEn.trim(), e.slug).not.toBe('');
      expect(e.descriptionDe.trim(), e.slug).not.toBe('');
      expect(e.descriptionEn.trim(), e.slug).not.toBe('');
      expect(e.stepsDe.length, e.slug).toBeGreaterThan(0);
      for (const s of e.stepsDe) expect(s.trim(), e.slug).not.toBe('');
      expect(e.mistakesDe.length, e.slug).toBeGreaterThan(0);
      if (e.weightStepKg !== undefined) expect(e.weightStepKg, e.slug).toBeGreaterThan(0);
    }
  });
});

describe('WORKOUT_TEMPLATES', () => {
  it('enthält genau 11 Vorlagen mit eindeutigen IDs', () => {
    expect(WORKOUT_TEMPLATES).toHaveLength(11);
    const ids = WORKOUT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('verwendet gültige Level und Ziele', () => {
    for (const t of WORKOUT_TEMPLATES) {
      expect(LEVELS, t.id).toContain(t.level);
      expect(t.goals.length, t.id).toBeGreaterThan(0);
      for (const g of t.goals) expect(GOALS, t.id).toContain(g);
      expect(t.days.length, t.id).toBeGreaterThan(0);
    }
  });

  it('verweist nur auf existierende Übungen mit gültigen Sätzen', () => {
    for (const t of WORKOUT_TEMPLATES) {
      for (const day of t.days) {
        const max = t.id === 'quick-30' ? 5 : 8;
        expect(day.exercises.length, `${t.id}/${day.name}`).toBeGreaterThanOrEqual(4);
        expect(day.exercises.length, `${t.id}/${day.name}`).toBeLessThanOrEqual(max);
        for (const te of day.exercises) {
          const where = `${t.id}/${day.name}/${te.exercise}`;
          expect(slugs.has(te.exercise), where).toBe(true);
          expect(te.sets.length, where).toBeGreaterThan(0);
          expect(te.restSeconds, where).toBeGreaterThan(0);
          for (const set of te.sets) {
            expect(SET_TYPES, where).toContain(set.type);
            expect(set.repsMin, where).toBeGreaterThan(0);
            expect(set.repsMin, where).toBeLessThanOrEqual(set.repsMax);
          }
        }
      }
    }
  });

  it('hat benachbarte Supersatz-Paare', () => {
    for (const t of WORKOUT_TEMPLATES) {
      for (const day of t.days) {
        const groups = day.exercises.map((e) => e.supersetGroup);
        const seen = new Set<string>();
        groups.forEach((g, i) => {
          if (!g) return;
          if (groups[i - 1] === g) return; // Fortsetzung derselben Gruppe
          expect(seen.has(g), `${t.id}/${day.name}: Gruppe ${g} nicht zusammenhängend`).toBe(false);
          seen.add(g);
        });
        for (const g of seen) {
          expect(groups.filter((x) => x === g).length, `${t.id}/${day.name}/${g}`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });

  it('enthält keine Gewichtsangaben', () => {
    for (const t of WORKOUT_TEMPLATES) {
      for (const day of t.days) {
        for (const te of day.exercises) {
          for (const key of Object.keys(te)) expect(key.toLowerCase()).not.toContain('weight');
          for (const set of te.sets) {
            expect(Object.keys(set).sort()).toEqual(['repsMax', 'repsMin', 'type']);
          }
        }
      }
    }
  });

  it('nutzt in der Kurzhantel-Vorlage nur Kurzhantel- und Körpergewichtsübungen', () => {
    const t = WORKOUT_TEMPLATES.find((x) => x.id === 'dumbbells');
    expect(t).toBeDefined();
    for (const day of t!.days) {
      for (const te of day.exercises) {
        expect(['dumbbell', 'bodyweight'], te.exercise).toContain(bySlug.get(te.exercise)?.equipment);
      }
    }
  });
});
