import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { computePersonalRecords, recordKey, type FinishSummary } from '@satzio/shared';
import { dec, num } from '../common/util';
import { PrismaService } from '../prisma/prisma.service';

type NewRecord = FinishSummary['newRecords'][number];

/**
 * Persönliche Rekorde werden je Übung vollständig aus der Historie neu
 * berechnet (deterministisch). Dadurch sind Rekorde nach nachträglichen
 * Korrekturen korrekt und doppelte Synchronisierungen erzeugen keine Duplikate.
 */
@Injectable()
export class RecordsService {
  constructor(private readonly prisma: PrismaService) {}

  async recompute(userId: string, exerciseIds: (string | null | undefined)[], forSessionId?: string): Promise<NewRecord[]> {
    const ids = [...new Set(exerciseIds.filter((x): x is string => !!x))];
    const improvements: NewRecord[] = [];
    for (const exerciseId of ids) {
      const entries = await this.prisma.workoutSessionExercise.findMany({
        where: { exerciseId, session: { userId, status: 'completed' } },
        include: { sets: true, session: { select: { id: true, startedAt: true } } },
      });
      const history = entries.map((e) => ({
        sessionId: e.session.id,
        performedAt: e.session.startedAt.toISOString(),
        sets: e.sets.map((s) => ({ id: s.id, type: s.type, weightKg: num(s.weightKg), reps: s.reps, completed: s.completed })),
      }));
      // Mehrere Einträge derselben Übung in einer Einheit zusammenführen
      const merged = new Map<string, (typeof history)[number]>();
      for (const h of history) {
        const m = merged.get(h.sessionId);
        if (m) m.sets.push(...h.sets);
        else merged.set(h.sessionId, { ...h, sets: [...h.sets] });
      }
      const computed = computePersonalRecords([...merged.values()]);
      const existing = await this.prisma.personalRecord.findMany({ where: { userId, exerciseId } });
      const existingByKey = new Map(existing.map((r) => [r.recordKey, r]));
      const keep = new Set<string>();
      const exerciseName = entries[0]?.exerciseName ?? '';

      // Rekorde, die schon vor dieser Einheit existierten (für "neu"-Erkennung)
      const before = forSessionId
        ? computePersonalRecords([...merged.values()].filter((h) => h.sessionId !== forSessionId))
        : [];
      const beforeByKey = new Map(before.map((r) => [recordKey(r.type, r.weightKg), r]));

      for (const r of computed) {
        const key = recordKey(r.type, r.weightKg);
        keep.add(key);
        const data = {
          type: r.type,
          value: dec(r.value)!,
          weightKg: dec(r.weightKg),
          reps: r.reps,
          sessionId: r.sessionId,
          setId: r.setId,
          achievedAt: new Date(r.achievedAt),
        };
        const cur = existingByKey.get(key);
        if (!cur) {
          await this.prisma.personalRecord.create({ data: { userId, exerciseId, recordKey: key, ...data } });
        } else if (Number(cur.value) !== r.value || cur.sessionId !== r.sessionId || cur.setId !== r.setId) {
          await this.prisma.personalRecord.update({ where: { id: cur.id }, data });
        }
        const prev = beforeByKey.get(key);
        if (forSessionId && r.sessionId === forSessionId && prev && r.value > prev.value) {
          improvements.push({ exerciseId, exerciseName, type: r.type, value: r.value, weightKg: r.weightKg, reps: r.reps });
        }
      }
      const stale = existing.filter((r) => !keep.has(r.recordKey)).map((r) => r.id);
      if (stale.length) await this.prisma.personalRecord.deleteMany({ where: { id: { in: stale } } });
    }
    return improvements;
  }

  async list(userId: string) {
    const rows = await this.prisma.personalRecord.findMany({
      where: { userId },
      include: { exercise: { select: { nameDe: true } } },
      orderBy: { achievedAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      exerciseId: r.exerciseId,
      exerciseName: r.exercise.nameDe,
      type: r.type,
      value: Number(r.value),
      weightKg: num(r.weightKg),
      reps: r.reps,
      sessionId: r.sessionId,
      achievedAt: r.achievedAt.toISOString(),
    }));
  }
}

export type { Prisma };
