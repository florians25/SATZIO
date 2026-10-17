/**
 * Seed: Übungsbibliothek und Achievement-Definitionen.
 * Idempotent (Upsert über stabile Slugs/Codes). Fasst NIEMALS Nutzerdaten an:
 * eigene Übungen (ownerId != null), Pläne, Workouts usw. bleiben unberührt.
 */
import { PrismaClient } from '@prisma/client';
import { ACHIEVEMENTS, EXERCISES } from '@satzio/shared';

const prisma = new PrismaClient();

async function main() {
  let created = 0;
  let updated = 0;
  for (const e of EXERCISES) {
    const data = {
      nameDe: e.nameDe,
      nameEn: e.nameEn,
      aliases: e.aliases,
      descriptionDe: e.descriptionDe,
      descriptionEn: e.descriptionEn,
      primaryMuscle: e.primaryMuscle,
      equipment: e.equipment,
      category: e.category,
      difficulty: e.difficulty,
      stepsDe: e.stepsDe,
      mistakesDe: e.mistakesDe,
      safetyDe: e.safetyDe ?? null,
      alternatives: e.alternatives,
      weightStepKg: e.weightStepKg ?? null,
    };
    const existing = await prisma.exercise.findUnique({ where: { slug: e.slug } });
    if (existing && existing.ownerId !== null) {
      console.warn(`Slug ${e.slug} gehört zu einer eigenen Übung – übersprungen.`);
      continue;
    }
    const ex = existing
      ? await prisma.exercise.update({ where: { id: existing.id }, data })
      : await prisma.exercise.create({ data: { slug: e.slug, ...data } });
    existing ? updated++ : created++;
    await prisma.exerciseMuscle.deleteMany({ where: { exerciseId: ex.id } });
    await prisma.exerciseMuscle.createMany({
      data: [
        { exerciseId: ex.id, muscle: e.primaryMuscle, role: 'primary' },
        ...e.secondaryMuscles.filter((m) => m !== e.primaryMuscle).map((m) => ({ exerciseId: ex.id, muscle: m, role: 'secondary' as const })),
      ],
      skipDuplicates: true,
    });
    const placeholder = await prisma.exerciseMedia.findFirst({ where: { exerciseId: ex.id, uploadedById: null, isPlaceholder: true } });
    if (!placeholder) {
      await prisma.exerciseMedia.create({
        data: {
          exerciseId: ex.id,
          kind: 'placeholder',
          url: `generated:muscle-map/${e.primaryMuscle}`,
          source: 'SATZIO – generierte Muskelgruppen-Grafik (kein Foto)',
          license: 'Eigene Grafik (Projektlizenz)',
          isPlaceholder: true,
        },
      });
    }
  }
  for (const [i, a] of ACHIEVEMENTS.entries()) {
    await prisma.achievement.upsert({
      where: { code: a.code },
      create: { code: a.code, title: a.title, description: a.description, icon: a.icon, sortOrder: i },
      update: { title: a.title, description: a.description, icon: a.icon, sortOrder: i },
    });
  }
  console.log(`Seed abgeschlossen: ${created} Übungen neu, ${updated} aktualisiert, ${ACHIEVEMENTS.length} Achievements.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
