import { zodResolver } from '@hookform/resolvers/zod';
import {
  customExerciseSchema,
  EQUIPMENT,
  EQUIPMENT_LABELS_DE,
  EXERCISE_CATEGORIES,
  CATEGORY_LABELS_DE,
  MUSCLE_GROUPS,
  MUSCLE_LABELS_DE,
  type CustomExerciseInput,
  type ExerciseView,
} from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import type { z } from 'zod';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label, Textarea } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { qk, useExerciseDetail } from '@/lib/queries';

type Form = z.input<typeof customExerciseSchema> & { stepsText?: string };

const selectCls = 'h-12 w-full rounded-2xl border border-border bg-surface-2 px-3 text-base';

export default function ExerciseFormPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const existing = useExerciseDetail(id);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { register, handleSubmit, control, reset, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(customExerciseSchema),
    defaultValues: { nameDe: params.get('name') ?? '', primaryMuscle: 'chest', secondaryMuscles: [], equipment: 'dumbbell', category: 'compound', difficulty: 'beginner', stepsDe: [], aliases: [] },
  });

  useEffect(() => {
    if (existing.data) {
      const e = existing.data;
      reset({ nameDe: e.nameDe, nameEn: e.nameEn, descriptionDe: e.descriptionDe, primaryMuscle: e.primaryMuscle, secondaryMuscles: e.secondaryMuscles, equipment: e.equipment, category: e.category, difficulty: e.difficulty, stepsDe: e.stepsDe, aliases: e.aliases });
    }
  }, [existing.data, reset]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      const body: CustomExerciseInput = customExerciseSchema.parse(v);
      const saved = await api<ExerciseView>(id ? `/exercises/${id}` : '/exercises', { method: id ? 'PUT' : 'POST', body });
      await qc.invalidateQueries({ queryKey: qk.exercises });
      qc.setQueryData(qk.exercise(saved.id), saved);
      toast.success('Übung gespeichert');
      navigate(`/exercises/${saved.id}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  });

  return (
    <div>
      <PageHeader title={id ? 'Übung bearbeiten' : 'Eigene Übung'} back />
      <form onSubmit={onSubmit} className="space-y-4 px-4 pb-10" noValidate>
        <div>
          <Label htmlFor="nameDe">Name</Label>
          <Input id="nameDe" {...register('nameDe')} aria-invalid={!!errors.nameDe} />
          <FieldError>{errors.nameDe?.message}</FieldError>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pm">Hauptmuskel</Label>
            <select id="pm" className={selectCls} {...register('primaryMuscle')}>
              {MUSCLE_GROUPS.map((m) => (
                <option key={m} value={m}>
                  {MUSCLE_LABELS_DE[m]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="eq">Equipment</Label>
            <select id="eq" className={selectCls} {...register('equipment')}>
              {EQUIPMENT.map((m) => (
                <option key={m} value={m}>
                  {EQUIPMENT_LABELS_DE[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <Label htmlFor="cat">Kategorie</Label>
            <select id="cat" className={selectCls} {...register('category')}>
              {EXERCISE_CATEGORIES.map((m) => (
                <option key={m} value={m}>
                  {CATEGORY_LABELS_DE[m]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <Label>Weitere Muskeln</Label>
          <Controller
            control={control}
            name="secondaryMuscles"
            render={({ field }) => (
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((m) => {
                  const on = (field.value ?? []).includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => field.onChange(on ? (field.value ?? []).filter((x) => x !== m) : [...(field.value ?? []), m])}
                      className={cn('h-9 rounded-full border px-3 text-sm', on ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2 text-muted')}
                      aria-pressed={on}
                    >
                      {MUSCLE_LABELS_DE[m]}
                    </button>
                  );
                })}
              </div>
            )}
          />
        </div>
        <div>
          <Label htmlFor="desc">Beschreibung (optional)</Label>
          <Textarea id="desc" {...register('descriptionDe')} />
        </div>
        <div>
          <Label htmlFor="steps">Ausführung – ein Schritt pro Zeile (optional)</Label>
          <Controller
            control={control}
            name="stepsDe"
            render={({ field }) => <Textarea id="steps" value={(field.value ?? []).join('\n')} onChange={(e) => field.onChange(e.target.value.split('\n').filter((l, i, a) => l.trim() || i < a.length - 1))} />}
          />
        </div>
        <div>
          <Label htmlFor="aliases">Andere Namen (kommagetrennt, für Suche & Notizen-Import)</Label>
          <Controller
            control={control}
            name="aliases"
            render={({ field }) => <Input id="aliases" defaultValue={(field.value ?? []).join(', ')} onBlur={(e) => field.onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />}
          />
        </div>
        <Button type="submit" size="lg" block loading={isSubmitting}>
          Speichern
        </Button>
      </form>
    </div>
  );
}
