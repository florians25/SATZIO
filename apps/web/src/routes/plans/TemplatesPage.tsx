import { formatRepRange, GOAL_LABELS_DE, LEVEL_LABELS_DE, type PlanView, type WorkoutTemplate } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Clock, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Card, Skeleton } from '@/components/ui/card';
import { Sheet } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useExerciseList, useTemplates } from '@/lib/queries';

export default function TemplatesPage() {
  const { data, isLoading } = useTemplates();
  const user = useAuth((s) => s.user)!;
  const [params] = useSearchParams();
  const onboarding = params.get('onboarding') === '1';
  const [preview, setPreview] = useState<WorkoutTemplate | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: exercises = [] } = useExerciseList();
  const nameBySlug = useMemo(() => new Map(exercises.map((e) => [e.slug, e.nameDe])), [exercises]);

  const sorted = useMemo(() => {
    const days = user.profile.trainingDaysPerWeek ?? 0;
    const score = (t: WorkoutTemplate) =>
      (user.profile.level === t.level ? 2 : 0) + (user.profile.goal && t.goals.includes(user.profile.goal) ? 2 : 0) + (days && t.daysPerWeek === days ? 3 : 0);
    return [...(data ?? [])].sort((a, b) => score(b) - score(a));
  }, [data, user.profile]);
  const recommended = sorted[0]?.id;

  const apply = async (t: WorkoutTemplate) => {
    setBusy(true);
    try {
      const plan = await api<PlanView>('/plans/from-template', { method: 'POST', body: { templateId: t.id, activate: true } });
      await Promise.all([qc.invalidateQueries({ queryKey: ['plans'] }), qc.invalidateQueries({ queryKey: ['today'] })]);
      toast.success(`„${t.name}“ ist jetzt dein aktiver Plan`);
      navigate(onboarding ? '/' : `/plans/${plan.id}`, { replace: onboarding });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Vorlagen" back={onboarding ? undefined : true} subtitle="Gewichte trägst du beim ersten Training selbst ein" />
      <div className="space-y-2 px-4 pb-6">
        {isLoading && <Skeleton className="h-24" />}
        {sorted.map((t) => (
          <button key={t.id} type="button" onClick={() => setPreview(t)} className="block w-full text-left">
            <Card className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="font-bold">{t.name}</p>
                {t.id === recommended && (
                  <Badge tone="primary">
                    <Sparkles className="h-3 w-3" /> Empfohlen
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-sm text-muted">{t.description}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge>{t.daysPerWeek}× / Woche</Badge>
                <Badge>{LEVEL_LABELS_DE[t.level]}</Badge>
                <Badge>
                  <Clock className="h-3 w-3" /> ~{t.durationMinutes} Min.
                </Badge>
              </div>
            </Card>
          </button>
        ))}
        {onboarding && (
          <Button variant="ghost" block onClick={() => navigate('/', { replace: true })}>
            Später entscheiden
          </Button>
        )}
      </div>
      <Sheet
        open={!!preview}
        onOpenChange={(o) => !o && setPreview(null)}
        title={preview?.name ?? ''}
        description={preview ? `${preview.goals.map((g) => GOAL_LABELS_DE[g]).join(', ')}` : undefined}
        footer={
          preview && (
            <Button size="lg" block loading={busy} onClick={() => void apply(preview)}>
              Vorlage übernehmen
            </Button>
          )
        }
      >
        {preview?.days.map((d) => (
          <div key={d.name} className="mb-4">
            <p className="mb-1 font-semibold">{d.name}</p>
            <ul className="space-y-1 text-sm">
              {d.exercises.map((e) => {
                const working = e.sets.filter((s) => s.type === 'working');
                return (
                  <li key={e.exercise} className="flex justify-between gap-2 text-muted">
                    <span className="text-text">
                      {e.supersetGroup && <span className="mr-1 text-primary">{e.supersetGroup}</span>}
                      {nameBySlug.get(e.exercise) ?? e.exercise}
                    </span>
                    <span className="tabular">
                      {working.length} × {formatRepRange(working[0]?.repsMin ?? null, working[0]?.repsMax ?? null)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </Sheet>
    </div>
  );
}
