import type { PlanDayView, PlanSaveInput, PlanView } from '@satzio/shared';
import { api } from '@/lib/api';
import { uuid } from '@/lib/ids';
import { queryClient } from '@/lib/query';

export async function createEmptyPlan(name: string, activate: boolean): Promise<PlanView> {
  const plan = await api<PlanView>('/plans', {
    method: 'POST',
    body: {
      name,
      description: null,
      scheduleMode: 'flexible',
      activate,
      days: [{ id: uuid(), name: 'Tag 1', weekday: null, notes: null, exercises: [] }],
    },
  });
  void queryClient.invalidateQueries({ queryKey: ['plans'] });
  void queryClient.invalidateQueries({ queryKey: ['today'] });
  return plan;
}

export function toSaveInput(plan: Pick<PlanView, 'name' | 'description' | 'scheduleMode' | 'days'>, changeNote?: string): PlanSaveInput {
  return {
    name: plan.name,
    description: plan.description,
    scheduleMode: plan.scheduleMode,
    changeNote,
    days: plan.days.map((d: PlanDayView) => ({
      id: d.id,
      name: d.name,
      weekday: d.weekday,
      notes: d.notes,
      exercises: d.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exerciseId,
        restSeconds: e.restSeconds,
        notes: e.notes,
        supersetGroup: e.supersetGroup,
        weightStepKg: e.weightStepKg,
        sets: e.sets.map((s) => ({ id: s.id, type: s.type, repsMin: s.repsMin, repsMax: s.repsMax, targetWeightKg: s.targetWeightKg })),
      })),
    })),
  };
}
