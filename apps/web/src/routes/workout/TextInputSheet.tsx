import { formatParsedSet, parseWorkoutNotes, type ExerciseListItem } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { qk, useExerciseList, usePerformance } from '@/lib/queries';
import { useWorkout } from '@/lib/workout';

/** Smarte Texteingabe: "Bankdrücken 3x10 80kg" → Übung mit Sätzen. */
export function TextInputSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [text, setText] = useState('');
  const { data: exercises = [] } = useExerciseList();
  const { map: perf } = usePerformance();
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const addExercise = useWorkout((s) => s.addExercise);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const parsed = useMemo(() => (text.trim() ? parseWorkoutNotes(text, exercises, { defaultUnit: unit }) : null), [text, exercises, unit]);
  const items = parsed?.days.flatMap((d) => d.exercises) ?? [];

  const apply = async () => {
    setBusy(true);
    let added = 0;
    for (const p of items) {
      let ex: ExerciseListItem | { id: string | null; nameDe: string; primaryMuscle: null } | undefined = p.match?.exercise as ExerciseListItem | undefined;
      if (!ex) {
        try {
          await api('/exercises', { method: 'POST', body: { nameDe: p.rawName, primaryMuscle: 'full_body', equipment: 'other' } });
          const fresh = await qc.fetchQuery({ queryKey: qk.exercises, queryFn: () => api<ExerciseListItem[]>('/exercises'), staleTime: 0 });
          ex = fresh.find((e) => e.isCustom && e.nameDe === p.rawName);
        } catch {
          // offline: nur als Name speichern
          ex = { id: null, nameDe: p.rawName, primaryMuscle: null };
        }
      }
      if (!ex) continue;
      addExercise(ex, {
        performance: ex.id ? perf.get(ex.id) : undefined,
        sets: p.sets.length
          ? p.sets.map((s, i) => ({
              order: i,
              type: s.type,
              weightKg: s.weightKg,
              reps: s.reps,
              targetRepsMin: s.repsMax ? s.reps : null,
              targetRepsMax: s.repsMax,
              completed: s.completed ?? false,
              completedAt: s.completed ? new Date().toISOString() : null,
              weightSource: 'manual',
              repsSource: 'manual',
            }))
          : undefined,
      });
      added++;
    }
    setBusy(false);
    toast.success(`${added} ${added === 1 ? 'Übung' : 'Übungen'} hinzugefügt`);
    setText('');
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Per Text hinzufügen" description="Schreib einfach wie in deiner Notizen-App.">
      <div className="space-y-3">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Bankdrücken 3x10 80kg\nLatziehen 12x55, 10x60, 8x65\nBizeps 3 Sätze je 12 mit 14kg'}
          className="min-h-32 font-mono text-[15px]"
          autoCapitalize="sentences"
        />
        {items.length > 0 && (
          <ul className="space-y-2" aria-label="Vorschau">
            {items.map((p, i) => (
              <li key={i} className="rounded-2xl bg-surface-2 p-3 text-sm">
                <p className="flex items-center gap-1.5 font-semibold">
                  {p.match ? <Check className="h-4 w-4 text-success" /> : <AlertTriangle className="h-4 w-4 text-warning" />}
                  {p.match ? p.match.exercise.nameDe : `Neu: ${p.rawName}`}
                </p>
                <p className="mt-1 tabular text-muted">{p.sets.length ? p.sets.map(formatParsedSet).join(' · ') : 'Ohne Satzangaben → Standardsätze'}</p>
                {p.warnings.filter((w) => !w.includes('eigene Übung')).map((w) => (
                  <p key={w} className="mt-1 text-xs text-warning">{w}</p>
                ))}
              </li>
            ))}
          </ul>
        )}
        <Button size="lg" block disabled={!items.length} loading={busy} onClick={() => void apply()}>
          {items.length ? `${items.length} ${items.length === 1 ? 'Übung' : 'Übungen'} hinzufügen` : 'Hinzufügen'}
        </Button>
      </div>
    </Sheet>
  );
}
