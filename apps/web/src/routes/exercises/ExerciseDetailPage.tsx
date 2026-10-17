import {
  CATEGORY_LABELS_DE,
  DIFFICULTY_LABELS_DE,
  EQUIPMENT_LABELS_DE,
  MUSCLE_LABELS_DE,
  toKg,
  type PlanView,
  type SetType,
  type UserExerciseSettingsInput,
} from '@satzio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Camera, ImageOff, ListPlus, Pencil, ShieldAlert, Star, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ExerciseImage } from '@/components/MuscleMap';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Card, SectionTitle, Skeleton } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { ConfirmSheet, Sheet, SheetAction } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtRelativeDay, fmtWeight } from '@/lib/format';
import { uuid } from '@/lib/ids';
import { qk, useExerciseDetail, useExerciseList, usePlans } from '@/lib/queries';
import { NumberField } from '../workout/NumberField';
import { fromKgDisplay } from '../workout/units';
import { toSaveInput } from '../plans/plan-utils';
import { ExerciseProgressChart } from '../progress/charts';

export default function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const ex = useExerciseDetail(id);
  const { data: list = [] } = useExerciseList();
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [addToPlan, setAddToPlan] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const history = useQuery({
    queryKey: qk.exerciseHistory(id ?? ''),
    enabled: !!id,
    queryFn: () => api<{ sessionId: string; sessionName: string; performedAt: string; sets: { type: SetType; weightKg: number | null; reps: number | null; completed: boolean }[] }[]>(`/exercises/${id}/history`),
  });

  if (ex.isLoading) {
    return (
      <div>
        <PageHeader title="Übung" back />
        <div className="space-y-3 p-4">
          <Skeleton className="h-48" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }
  if (!ex.data) return <div className="p-6 text-center text-muted">Übung nicht gefunden.</div>;
  const e = ex.data;
  const photo = e.media.find((m) => !m.isPlaceholder);
  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: qk.exercise(e.id) }), qc.invalidateQueries({ queryKey: qk.exercises })]);

  const toggleFav = async () => {
    try {
      await api(`/exercises/${e.id}/favorite`, { method: e.isFavorite ? 'DELETE' : 'PUT' });
      await refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const saveSettings = async (patch: UserExerciseSettingsInput) => {
    try {
      await api(`/exercises/${e.id}/settings`, { method: 'PATCH', body: patch });
      await refresh();
      toast.success('Gespeichert');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const upload = async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    try {
      await api(`/exercises/${e.id}/images`, { method: 'POST', form });
      await refresh();
      toast.success('Bild hochgeladen');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <PageHeader
        title={e.nameDe}
        back
        right={
          <Button size="icon" variant="ghost" onClick={() => void toggleFav()} aria-label={e.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'} aria-pressed={e.isFavorite}>
            <Star className={e.isFavorite ? 'h-6 w-6 fill-primary text-primary' : 'h-6 w-6'} />
          </Button>
        }
      />
      <div className="space-y-5 px-4 pb-10">
        <div className="relative">
          <ExerciseImage imageUrl={photo?.url} primary={e.primaryMuscle} secondary={e.secondaryMuscles} className="aspect-[16/10] w-full" compact={false} />
          {!photo && (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 rounded-full bg-bg/80 px-2 py-1 text-[11px] text-muted">
              <ImageOff className="h-3 w-3" /> Schematische Grafik – kein Übungsfoto vorhanden
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone="primary">{MUSCLE_LABELS_DE[e.primaryMuscle]}</Badge>
          {e.secondaryMuscles.map((m) => (
            <Badge key={m}>{MUSCLE_LABELS_DE[m]}</Badge>
          ))}
          <Badge>{EQUIPMENT_LABELS_DE[e.equipment]}</Badge>
          <Badge>{CATEGORY_LABELS_DE[e.category]}</Badge>
          <Badge>{DIFFICULTY_LABELS_DE[e.difficulty]}</Badge>
          {e.isCustom && <Badge tone="warning">Eigene Übung</Badge>}
        </div>
        {e.descriptionDe && <p className="text-[15px] leading-relaxed">{e.descriptionDe}</p>}

        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => setAddToPlan(true)}>
            <ListPlus className="h-4 w-4" /> Zu Plan hinzufügen
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <Camera className="h-4 w-4" /> Eigenes Bild
          </Button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(ev) => ev.target.files?.[0] && void upload(ev.target.files[0])} />
        </div>

        {e.stepsDe.length > 0 && (
          <section>
            <SectionTitle>Ausführung</SectionTitle>
            <ol className="space-y-2">
              {e.stepsDe.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-bold text-primary">{i + 1}</span>
                  <span className="pt-0.5">{s}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
        {e.mistakesDe.length > 0 && (
          <section>
            <SectionTitle>Typische Fehler</SectionTitle>
            <ul className="space-y-1.5">
              {e.mistakesDe.map((m, i) => (
                <li key={i} className="flex gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" /> {m}
                </li>
              ))}
            </ul>
          </section>
        )}
        {e.safetyDe && (
          <Card className="flex gap-3 border-warning/30 bg-warning/5 p-4 text-sm">
            <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
            <p>{e.safetyDe}</p>
          </Card>
        )}

        <section>
          <SectionTitle>Meine Einstellungen</SectionTitle>
          <Card className="space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Gewichtsschritt (kg)</Label>
                <div className="rounded-2xl border border-border bg-surface-2">
                  <NumberField value={e.userSettings?.weightStepKg ?? null} onCommit={(v) => void saveSettings({ weightStepKg: v })} ariaLabel="Gewichtsschritt" className="h-12 w-full text-base" placeholder={String(e.weightStepKg ?? 2.5)} />
                </div>
              </div>
              <div>
                <Label>Pause (Sek.)</Label>
                <div className="rounded-2xl border border-border bg-surface-2">
                  <NumberField value={e.userSettings?.defaultRestSeconds ?? null} decimals={false} onCommit={(v) => void saveSettings({ defaultRestSeconds: v })} ariaLabel="Pause" className="h-12 w-full text-base" placeholder="Standard" />
                </div>
              </div>
              <div>
                <Label>Standardgewicht ({unit})</Label>
                <div className="rounded-2xl border border-border bg-surface-2">
                  <NumberField
                    value={e.userSettings?.defaultWeightKg != null ? fromKgDisplay(e.userSettings.defaultWeightKg, unit) : null}
                    onCommit={(v) => void saveSettings({ defaultWeightKg: v === null ? null : toKg(v, unit) })}
                    ariaLabel="Standardgewicht"
                    className="h-12 w-full text-base"
                    placeholder="–"
                  />
                </div>
              </div>
              <div>
                <Label>Standard-Wdh.</Label>
                <div className="rounded-2xl border border-border bg-surface-2">
                  <NumberField value={e.userSettings?.defaultReps ?? null} decimals={false} onCommit={(v) => void saveSettings({ defaultReps: v })} ariaLabel="Standard-Wiederholungen" className="h-12 w-full text-base" placeholder="–" />
                </div>
              </div>
            </div>
            <div>
              <Label htmlFor="eqs">Geräteeinstellung</Label>
              <Input id="eqs" defaultValue={e.userSettings?.equipmentSettings ?? ''} placeholder="z. B. Sitz Stufe 4, Polster 2" onBlur={(ev) => ev.target.value !== (e.userSettings?.equipmentSettings ?? '') && void saveSettings({ equipmentSettings: ev.target.value || null })} />
            </div>
            <div>
              <Label htmlFor="exn">Persönliche Notiz</Label>
              <Textarea id="exn" defaultValue={e.userSettings?.notes ?? ''} className="min-h-20" onBlur={(ev) => ev.target.value !== (e.userSettings?.notes ?? '') && void saveSettings({ notes: ev.target.value || null })} />
            </div>
            <p className="text-xs text-muted">Standardwerte nutzt SATZIO nur, wenn es noch keine Werte aus deinem letzten Training gibt.</p>
          </Card>
        </section>

        <section>
          <SectionTitle>Entwicklung</SectionTitle>
          <Card className="p-3">
            <ExerciseProgressChart exerciseId={e.id} range="all" />
          </Card>
        </section>

        <section>
          <SectionTitle>Verlauf</SectionTitle>
          {history.data?.length === 0 && <p className="px-1 text-sm text-muted">Diese Übung hast du noch nicht trainiert.</p>}
          <div className="space-y-2">
            {history.data?.slice(0, 10).map((h) => (
              <Link key={h.sessionId} to={`/workout/${h.sessionId}`} className="block rounded-2xl border border-border bg-surface p-3">
                <p className="text-sm text-muted">
                  {fmtRelativeDay(h.performedAt)} · {h.sessionName}
                </p>
                <p className="mt-0.5 tabular">
                  {h.sets
                    .filter((s) => s.completed)
                    .map((s) => `${fmtWeight(s.weightKg, unit)} × ${s.reps ?? '–'}`)
                    .join(' · ') || '–'}
                </p>
              </Link>
            ))}
          </div>
        </section>

        {e.alternatives.length > 0 && (
          <section>
            <SectionTitle>Alternativen</SectionTitle>
            <div className="flex flex-wrap gap-2">
              {e.alternatives.map((slug) => {
                const alt = list.find((x) => x.slug === slug);
                return alt ? (
                  <Link key={slug} to={`/exercises/${alt.id}`} className="rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium">
                    {alt.nameDe}
                  </Link>
                ) : null;
              })}
            </div>
          </section>
        )}

        {(photo || e.isCustom) && (
          <div className="space-y-2">
            {photo && (
              <Button
                variant="ghost"
                block
                onClick={async () => {
                  await api(`/exercises/${e.id}/images`, { method: 'DELETE' });
                  await refresh();
                }}
              >
                Eigene Bilder entfernen
              </Button>
            )}
            {e.isCustom && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" asChild>
                  <Link to={`/exercises/${e.id}/edit`}>
                    <Pencil className="h-4 w-4" /> Bearbeiten
                  </Link>
                </Button>
                <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4" /> Löschen
                </Button>
              </div>
            )}
          </div>
        )}
        <p className="text-center text-xs text-muted">Grafiken: eigene schematische Darstellung (Platzhalter). Keine medizinische Beratung.</p>
      </div>
      <AddToPlanSheet open={addToPlan} onOpenChange={setAddToPlan} exerciseId={e.id} isolation={e.category === 'isolation'} />
      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Eigene Übung löschen?"
        text="Wird die Übung in Plänen verwendet, wird sie nur archiviert. Deine Trainingshistorie bleibt erhalten."
        confirmLabel="Löschen"
        onConfirm={async () => {
          try {
            await api(`/exercises/${e.id}`, { method: 'DELETE' });
            await qc.invalidateQueries({ queryKey: qk.exercises });
            navigate('/exercises', { replace: true });
          } catch (err) {
            toast.error(errorMessage(err));
          }
        }}
      />
    </div>
  );
}

function AddToPlanSheet({ open, onOpenChange, exerciseId, isolation }: { open: boolean; onOpenChange: (o: boolean) => void; exerciseId: string; isolation: boolean }) {
  const plans = usePlans();
  const [planId, setPlanId] = useState<string | null>(null);
  const qc = useQueryClient();
  const plan = useQuery({ queryKey: qk.plan(planId ?? ''), enabled: !!planId, queryFn: () => api<PlanView>(`/plans/${planId}`) });
  const add = async (dayId: string) => {
    if (!plan.data) return;
    const input = toSaveInput(plan.data, 'Übung hinzugefügt');
    const day = input.days.find((d) => d.id === dayId);
    if (!day) return;
    day.exercises.push({
      id: uuid(),
      exerciseId,
      restSeconds: isolation ? 60 : 90,
      notes: null,
      supersetGroup: null,
      weightStepKg: null,
      sets: Array.from({ length: 3 }, () => ({ id: uuid(), type: 'working' as const, repsMin: isolation ? 10 : 8, repsMax: isolation ? 15 : 12, targetWeightKg: null })),
    });
    try {
      const saved = await api<PlanView>(`/plans/${plan.data.id}`, { method: 'PUT', body: input });
      qc.setQueryData(qk.plan(saved.id), saved);
      void qc.invalidateQueries({ queryKey: qk.today });
      toast.success(`Zu „${day.name}“ hinzugefügt`);
      onOpenChange(false);
      setPlanId(null);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };
  return (
    <Sheet open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setPlanId(null); }} title={planId ? 'Welcher Tag?' : 'Zu welchem Plan?'}>
      {!planId &&
        plans.data?.map((p) => (
          <SheetAction key={p.id} onClick={() => setPlanId(p.id)} hint={`${p.dayCount} Tage`}>
            {p.name}
          </SheetAction>
        ))}
      {!planId && plans.data?.length === 0 && <p className="text-sm text-muted">Du hast noch keinen Plan.</p>}
      {planId && !plan.data && <Skeleton className="h-20" />}
      {plan.data?.days.map((d) => (
        <SheetAction key={d.id} onClick={() => void add(d.id)} hint={`${d.exercises.length} Übungen`}>
          {d.name}
        </SheetAction>
      ))}
    </Sheet>
  );
}
