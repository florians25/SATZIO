import {
  parseRepRange,
  planToNotesText,
  toKg,
  formatRepRange,
  SET_TYPE_SHORT_DE,
  WEEKDAY_SHORT_DE,
  type ExerciseListItem,
  type PlanDayView,
  type PlanExerciseView,
  type PlanView,
  type SetType,
  type SharedPlan,
  type Weekday,
} from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import {
  Archive,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  CloudOff,
  Copy,
  Download,
  FileText,
  History,
  Link2,
  Loader2,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  Replace,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { ExercisePicker } from '@/components/ExercisePicker';
import { ExerciseImage } from '@/components/MuscleMap';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, SectionTitle, Skeleton } from '@/components/ui/card';
import { Segmented, Switch } from '@/components/ui/controls';
import { Input, Textarea } from '@/components/ui/input';
import { ConfirmSheet, Sheet, SheetAction } from '@/components/ui/sheet';
import { api, ApiError, downloadFile, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { kvDel, kvGet, kvSet } from '@/lib/db';
import { fmtDate, fmtTime } from '@/lib/format';
import { uuid } from '@/lib/ids';
import { qk, useExerciseMap, usePerformance, usePlan } from '@/lib/queries';
import { REST_PRESETS } from '@/lib/timer';
import { createWorkout } from '@/lib/workout';
import { NumberField } from '../workout/NumberField';
import { fromKgDisplay } from '../workout/units';
import { toSaveInput } from './plan-utils';

type Draft = Pick<PlanView, 'name' | 'description' | 'scheduleMode' | 'days'>;
type SaveState = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

const SET_TYPE_CYCLE: SetType[] = ['working', 'warmup', 'drop', 'failure'];

export default function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const plan = usePlan(id);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [dayId, setDayId] = useState<string | null>(null);
  const [save, setSave] = useState<SaveState>('idle');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [picker, setPicker] = useState<null | { replace?: string }>(null);
  const [menu, setMenu] = useState(false);
  const [dayMenu, setDayMenu] = useState(false);
  const [versions, setVersions] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exMap = useExerciseMap();
  const { map: performance } = usePerformance();

  // Initialisieren: ungespeicherter lokaler Entwurf hat Vorrang
  useEffect(() => {
    if (!plan.data || draft) return;
    void kvGet<Draft>(`plan-draft:${plan.data.id}`).then((local) => {
      const d = local ?? { name: plan.data.name, description: plan.data.description, scheduleMode: plan.data.scheduleMode, days: plan.data.days };
      setDraft(d);
      setDayId(d.days[0]?.id ?? null);
      if (local) {
        dirty.current = true;
        scheduleSave(d, 100);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.data]);

  const doSave = async (d: Draft) => {
    if (!id) return;
    setSave('saving');
    try {
      const saved = await api<PlanView>(`/plans/${id}`, { method: 'PUT', body: toSaveInput(d) });
      dirty.current = false;
      await kvDel(`plan-draft:${id}`);
      qc.setQueryData(qk.plan(id), saved);
      void qc.invalidateQueries({ queryKey: ['plans'] });
      void qc.invalidateQueries({ queryKey: qk.today });
      setSave('saved');
    } catch (e) {
      setSave(e instanceof ApiError && e.isNetwork ? 'offline' : 'error');
      if (!(e instanceof ApiError && e.isNetwork)) toast.error(errorMessage(e));
    }
  };

  const scheduleSave = (d: Draft, delay = 800) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void doSave(d), delay);
  };

  const update = (fn: (d: Draft) => Draft) => {
    setDraft((cur) => {
      if (!cur) return cur;
      const next = fn(structuredClone(cur));
      dirty.current = true;
      void kvSet(`plan-draft:${id}`, next);
      scheduleSave(next);
      return next;
    });
  };

  // Offline gespeicherte Entwürfe bei Verbindung nachreichen
  useEffect(() => {
    const onOnline = () => {
      if (dirty.current && draft) void doSave(draft);
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  });

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (plan.isLoading || !draft) {
    return (
      <div>
        <PageHeader title="Plan" back="/plans" />
        <div className="space-y-3 p-4">
          <Skeleton className="h-12" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }
  if (!plan.data) return <div className="p-6 text-center text-muted">Plan nicht gefunden.</div>;
  const p = plan.data;
  const day = draft.days.find((d) => d.id === dayId) ?? draft.days[0];

  const updateDay = (fn: (d: PlanDayView) => PlanDayView) =>
    update((d) => ({ ...d, days: d.days.map((x) => (x.id === day?.id ? fn(x) : x)) }));

  const addExercise = (ex: ExerciseListItem) => {
    if (picker?.replace) {
      const rid = picker.replace;
      updateDay((d) => ({
        ...d,
        exercises: d.exercises.map((e) => (e.id === rid ? { ...e, exerciseId: ex.id, exerciseName: ex.nameDe, exerciseSlug: ex.slug, primaryMuscle: ex.primaryMuscle, equipment: ex.equipment } : e)),
      }));
    } else {
      const isolation = ex.category === 'isolation';
      updateDay((d) => ({
        ...d,
        exercises: [
          ...d.exercises,
          {
            id: uuid(),
            exerciseId: ex.id,
            exerciseName: ex.nameDe,
            exerciseSlug: ex.slug,
            primaryMuscle: ex.primaryMuscle,
            equipment: ex.equipment,
            restSeconds: isolation ? 60 : 90,
            notes: null,
            supersetGroup: null,
            weightStepKg: null,
            sets: Array.from({ length: 3 }, () => ({ id: uuid(), type: 'working' as SetType, repsMin: isolation ? 10 : 8, repsMax: isolation ? 15 : 12, targetWeightKg: null })),
          },
        ],
      }));
    }
    setPicker(null);
  };

  const patchSchedule = async (body: Record<string, unknown>) => {
    try {
      const saved = await api<PlanView>(`/plans/${p.id}/schedule`, { method: 'PATCH', body });
      qc.setQueryData(qk.plan(p.id), saved);
      void qc.invalidateQueries({ queryKey: qk.today });
      if (body.mode) update((d) => ({ ...d, scheduleMode: body.mode as Draft['scheduleMode'] }));
      if (body.weekdays) update((d) => ({ ...d, days: d.days.map((x) => ({ ...x, weekday: saved.days.find((s) => s.id === x.id)?.weekday ?? x.weekday })) }));
    } catch (e) {
      toast.error(errorMessage(e, 'Planung kann nur mit Verbindung geändert werden.'));
    }
  };

  return (
    <div>
      <PageHeader
        title={draft.name || 'Plan'}
        subtitle={<SaveStatus state={save} />}
        back="/plans"
        right={
          <Button size="icon" variant="ghost" onClick={() => setMenu(true)} aria-label="Planmenü">
            <MoreVertical className="h-5 w-5" />
          </Button>
        }
      />
      <div className="space-y-5 px-4 pb-8">
        <div className="space-y-2">
          <Input value={draft.name} onChange={(e) => update((d) => ({ ...d, name: e.target.value }))} aria-label="Name des Plans" className="text-lg font-bold" />
          <Textarea
            value={draft.description ?? ''}
            onChange={(e) => update((d) => ({ ...d, description: e.target.value || null }))}
            placeholder="Beschreibung (optional)"
            className="min-h-16"
            aria-label="Beschreibung"
          />
          {!p.isActive && (
            <Button
              variant="secondary"
              block
              onClick={async () => {
                await api(`/plans/${p.id}/activate`, { method: 'POST' });
                await Promise.all([qc.invalidateQueries({ queryKey: qk.plan(p.id) }), qc.invalidateQueries({ queryKey: ['plans'] }), qc.invalidateQueries({ queryKey: qk.today })]);
                toast.success('Aktiver Plan festgelegt');
              }}
            >
              <Check className="h-4 w-4" /> Als aktiven Plan festlegen
            </Button>
          )}
        </div>

        <ScheduleCard plan={p} draft={draft} onPatch={patchSchedule} />

        <section>
          <SectionTitle>Trainingstage</SectionTitle>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
            {draft.days.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setDayId(d.id)}
                className={cn('h-11 shrink-0 rounded-2xl border px-4 font-semibold', d.id === day?.id ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface text-muted')}
              >
                {d.name}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                const nd: PlanDayView = { id: uuid(), name: `Tag ${draft.days.length + 1}`, order: draft.days.length, weekday: null, notes: null, exercises: [] };
                update((d) => ({ ...d, days: [...d.days, nd] }));
                setDayId(nd.id);
              }}
              className="flex h-11 shrink-0 items-center gap-1 rounded-2xl border border-dashed border-border px-4 font-semibold text-muted"
            >
              <Plus className="h-4 w-4" /> Tag
            </button>
          </div>
        </section>

        {day && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={day.name} onChange={(e) => updateDay((d) => ({ ...d, name: e.target.value }))} aria-label="Name des Trainingstags" className="font-semibold" />
              <Button size="icon" variant="secondary" onClick={() => setDayMenu(true)} aria-label="Tagesoptionen">
                <MoreVertical className="h-5 w-5" />
              </Button>
            </div>
            {day.exercises.map((e, i) => (
              <PlanExerciseCard
                key={e.id}
                ex={e}
                imageUrl={exMap.get(e.exerciseId)?.imageUrl}
                index={i}
                count={day.exercises.length}
                nextHasGroup={day.exercises[i + 1]?.supersetGroup === e.supersetGroup && !!e.supersetGroup}
                onChange={(fn) => updateDay((d) => ({ ...d, exercises: d.exercises.map((x) => (x.id === e.id ? fn(x) : x)) }))}
                onMove={(dir) =>
                  updateDay((d) => {
                    const list = [...d.exercises];
                    const j = i + dir;
                    if (j < 0 || j >= list.length) return d;
                    [list[i], list[j]] = [list[j], list[i]];
                    return { ...d, exercises: list };
                  })
                }
                onRemove={() => updateDay((d) => ({ ...d, exercises: d.exercises.filter((x) => x.id !== e.id) }))}
                onReplace={() => setPicker({ replace: e.id })}
                onSuperset={(on) =>
                  updateDay((d) => {
                    const list = [...d.exercises];
                    const next = list[i + 1];
                    if (!next) return d;
                    const used = new Set(list.map((x) => x.supersetGroup).filter(Boolean));
                    const letter = on ? e.supersetGroup ?? 'ABCDEFGH'.split('').find((l) => !used.has(l)) ?? 'A' : null;
                    list[i] = { ...list[i], supersetGroup: letter };
                    list[i + 1] = { ...next, supersetGroup: letter };
                    return { ...d, exercises: list };
                  })
                }
              />
            ))}
            <Button variant="secondary" block onClick={() => setPicker({})}>
              <Plus className="h-4 w-4" /> Übung hinzufügen
            </Button>
          </section>
        )}
      </div>

      <ExercisePicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} onSelect={addExercise} title={picker?.replace ? 'Übung ersetzen' : 'Übung hinzufügen'} />

      <Sheet open={dayMenu} onOpenChange={setDayMenu} title={day?.name ?? 'Tag'}>
        <DayMenu
          day={day}
          draft={draft}
          planId={p.id}
          onClose={() => setDayMenu(false)}
          onUpdate={update}
          onSelect={setDayId}
          onStart={async () => {
            if (!day) return;
            const w = await createWorkout({ name: day.name, planId: p.id, day, exercises: exMap, performance });
            navigate(`/workout/${w.id}`);
          }}
        />
      </Sheet>

      <Sheet open={menu} onOpenChange={setMenu} title={draft.name}>
        <SheetAction
          icon={<Star />}
          onClick={async () => {
            await api(`/plans/${p.id}/favorite`, { method: 'PATCH', body: { favorite: !p.isFavorite } });
            await qc.invalidateQueries({ queryKey: qk.plan(p.id) });
            void qc.invalidateQueries({ queryKey: ['plans'] });
            setMenu(false);
          }}
        >
          {p.isFavorite ? 'Favorit entfernen' : 'Als Favorit markieren'}
        </SheetAction>
        <SheetAction
          icon={<Copy />}
          onClick={async () => {
            try {
              const dup = await api<PlanView>(`/plans/${p.id}/duplicate`, { method: 'POST' });
              void qc.invalidateQueries({ queryKey: ['plans'] });
              setMenu(false);
              navigate(`/plans/${dup.id}`);
              toast.success('Plan dupliziert');
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Plan duplizieren
        </SheetAction>
        <SheetAction
          icon={<Download />}
          hint="JSON-Datei zum Teilen mit anderen SATZIO-Konten"
          onClick={() => void downloadFile(`/plans/${p.id}/export`, `${draft.name.replace(/[^\w\-äöüÄÖÜß ]/g, '')}.satzio.json`).catch((e) => toast.error(errorMessage(e)))}
        >
          Plan exportieren / teilen
        </SheetAction>
        <SheetAction
          icon={<FileText />}
          onClick={async () => {
            try {
              const shared = await api<SharedPlan>(`/plans/${p.id}/export`);
              await navigator.clipboard.writeText(planToNotesText(shared.plan));
              toast.success('Als Text kopiert');
            } catch (e) {
              toast.error(errorMessage(e));
            }
          }}
        >
          Als Notiz-Text kopieren
        </SheetAction>
        <SheetAction icon={<History />} onClick={() => { setMenu(false); setVersions(true); }}>
          Änderungsverlauf
        </SheetAction>
        <SheetAction
          icon={<Archive />}
          onClick={async () => {
            await api(`/plans/${p.id}/archive`, { method: 'PATCH', body: { archived: !p.archived } });
            await Promise.all([qc.invalidateQueries({ queryKey: ['plans'] }), qc.invalidateQueries({ queryKey: qk.plan(p.id) }), qc.invalidateQueries({ queryKey: qk.today })]);
            setMenu(false);
            toast.success(p.archived ? 'Plan wiederhergestellt' : 'Plan archiviert');
          }}
        >
          {p.archived ? 'Aus Archiv wiederherstellen' : 'Archivieren'}
        </SheetAction>
        <SheetAction icon={<Trash2 />} tone="danger" onClick={() => { setMenu(false); setConfirmDelete(true); }}>
          Plan löschen
        </SheetAction>
      </Sheet>
      <VersionsSheet open={versions} onOpenChange={setVersions} planId={p.id} onRestored={(v) => { setDraft({ name: v.name, description: v.description, scheduleMode: v.scheduleMode, days: v.days }); }} />
      <ConfirmSheet
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Plan löschen?"
        text="Der Plan wird gelöscht. Deine bisherigen Trainings bleiben in der Historie erhalten."
        confirmLabel="Plan löschen"
        onConfirm={async () => {
          try {
            await api(`/plans/${p.id}`, { method: 'DELETE' });
            await kvDel(`plan-draft:${p.id}`);
            await Promise.all([qc.invalidateQueries({ queryKey: ['plans'] }), qc.invalidateQueries({ queryKey: qk.today })]);
            navigate('/plans', { replace: true });
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function SaveStatus({ state }: { state: SaveState }) {
  if (state === 'saving')
    return (
      <span className="inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Speichert …
      </span>
    );
  if (state === 'saved')
    return (
      <span className="inline-flex items-center gap-1 text-success">
        <Check className="h-3 w-3" /> Gespeichert
      </span>
    );
  if (state === 'offline')
    return (
      <span className="inline-flex items-center gap-1 text-warning">
        <CloudOff className="h-3 w-3" /> Offline – wird später gespeichert
      </span>
    );
  if (state === 'error') return <span className="text-error">Speichern fehlgeschlagen</span>;
  return <span>Änderungen werden automatisch gespeichert</span>;
}

function ScheduleCard({ plan, draft, onPatch }: { plan: PlanView; draft: Draft; onPatch: (b: Record<string, unknown>) => void }) {
  const fixed = plan.schedule.mode === 'fixed';
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Planung</p>
          <p className="text-sm text-muted">{fixed ? 'Feste Wochentage' : 'Flexibel: es folgt immer das nächste Workout'}</p>
        </div>
        <Segmented
          size="sm"
          className="w-44"
          value={plan.schedule.mode}
          onChange={(mode) => onPatch({ mode })}
          options={[
            { value: 'flexible', label: 'Flexibel' },
            { value: 'fixed', label: 'Wochentage' },
          ]}
        />
      </div>
      {fixed ? (
        <div className="space-y-2">
          {draft.days.map((d) => (
            <div key={d.id} className="flex items-center gap-2">
              <span className="w-24 truncate text-sm font-medium">{d.name}</span>
              <div className="flex flex-1 gap-1">
                {([1, 2, 3, 4, 5, 6, 7] as Weekday[]).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => onPatch({ weekdays: { [d.id]: d.weekday === w ? null : w } })}
                    className={cn('h-9 flex-1 rounded-lg text-xs font-semibold', d.weekday === w ? 'bg-primary text-primary-fg' : 'bg-surface-2 text-muted')}
                    aria-pressed={d.weekday === w}
                    aria-label={`${d.name} am ${WEEKDAY_SHORT_DE[w]}`}
                  >
                    {WEEKDAY_SHORT_DE[w]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        draft.days.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">Nächstes Training:</span>
            <select
              className="h-10 flex-1 rounded-xl border border-border bg-surface-2 px-3"
              value={plan.schedule.nextDayIndex}
              onChange={(e) => onPatch({ nextDayIndex: Number(e.target.value) })}
              aria-label="Nächstes Training"
            >
              {draft.days.map((d, i) => (
                <option key={d.id} value={i}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        )
      )}
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Plan pausieren</span>
        <Switch checked={plan.schedule.paused} onCheckedChange={(paused) => onPatch({ paused })} />
      </label>
    </Card>
  );
}

function PlanExerciseCard({
  ex,
  imageUrl,
  index,
  count,
  nextHasGroup,
  onChange,
  onMove,
  onRemove,
  onReplace,
  onSuperset,
}: {
  ex: PlanExerciseView;
  imageUrl: string | null | undefined;
  index: number;
  count: number;
  nextHasGroup: boolean;
  onChange: (fn: (e: PlanExerciseView) => PlanExerciseView) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
  onReplace: () => void;
  onSuperset: (on: boolean) => void;
}) {
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const [menu, setMenu] = useState(false);
  const setSet = (sid: string, patch: Partial<PlanExerciseView['sets'][number]>) =>
    onChange((e) => ({ ...e, sets: e.sets.map((s) => (s.id === sid ? { ...s, ...patch } : s)) }));
  return (
    <Card className={cn('p-3', ex.supersetGroup && 'border-l-4 border-l-primary/70')}>
      <div className="flex items-center gap-3">
        <ExerciseImage primary={ex.primaryMuscle} imageUrl={imageUrl} className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{ex.exerciseName}</p>
          <p className="text-xs text-muted">
            {ex.supersetGroup && <span className="font-semibold text-primary">Supersatz {ex.supersetGroup} · </span>}
            Pause {ex.restSeconds ?? 90} s
          </p>
        </div>
        <Button size="icon-sm" variant="ghost" onClick={() => setMenu(true)} aria-label={`Optionen für ${ex.exerciseName}`}>
          <MoreVertical className="h-5 w-5" />
        </Button>
      </div>
      <div className="mt-2 space-y-1">
        <div className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] gap-2 px-1 text-xs text-muted">
          <span>Art</span>
          <span>Wdh.</span>
          <span>Gewicht ({unit})</span>
          <span />
        </div>
        {ex.sets.map((s) => (
          <div key={s.id} className="grid grid-cols-[2.5rem_1fr_1fr_2.5rem] items-center gap-2">
            <button
              type="button"
              onClick={() => setSet(s.id, { type: SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(s.type) + 1) % SET_TYPE_CYCLE.length] })}
              className={cn('h-10 rounded-xl bg-surface-2 text-sm font-bold', s.type !== 'working' && 'text-warning')}
              aria-label="Satzart wechseln"
              title="Tippen: Arbeits-, Aufwärm-, Drop- oder Versagenssatz"
            >
              {SET_TYPE_SHORT_DE[s.type] || 'A'}
            </button>
            <RepsInput value={formatRepRange(s.repsMin, s.repsMax)} onCommit={(r) => setSet(s.id, { repsMin: r?.min ?? null, repsMax: r?.max ?? null })} />
            <div className="rounded-xl bg-surface-2">
              <NumberField
                value={s.targetWeightKg === null ? null : fromKgDisplay(s.targetWeightKg, unit)}
                onCommit={(v) => setSet(s.id, { targetWeightKg: v === null ? null : toKg(v, unit) })}
                ariaLabel="Zielgewicht"
                className="h-10 w-full text-base"
                placeholder="optional"
              />
            </div>
            <button type="button" onClick={() => onChange((e) => ({ ...e, sets: e.sets.filter((x) => x.id !== s.id) }))} className="grid h-10 place-items-center rounded-xl text-muted hover:bg-surface-2" aria-label="Satz entfernen">
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onChange((e) => ({ ...e, sets: [...e.sets, { ...(e.sets[e.sets.length - 1] ?? { type: 'working' as SetType, repsMin: 8, repsMax: 12, targetWeightKg: null }), id: uuid() }] }))}
        className="mt-1 flex h-10 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-primary"
      >
        <Plus className="h-4 w-4" /> Satz
      </button>
      <Sheet open={menu} onOpenChange={setMenu} title={ex.exerciseName}>
        <div className="space-y-4">
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Pausenzeit</p>
            <div className="flex gap-1.5">
              {REST_PRESETS.map((sec) => (
                <button key={sec} type="button" onClick={() => onChange((e) => ({ ...e, restSeconds: sec }))} className={cn('h-10 flex-1 rounded-xl border text-sm font-semibold', (ex.restSeconds ?? 90) === sec ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2')}>
                  {sec}s
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-muted">Gewichtsschritt für diese Übung (kg)</p>
            <div className="flex gap-1.5">
              {[null, 0.5, 1, 1.25, 2, 2.5, 5].map((st) => (
                <button key={String(st)} type="button" onClick={() => onChange((e) => ({ ...e, weightStepKg: st }))} className={cn('h-10 flex-1 rounded-xl border text-xs font-semibold', ex.weightStepKg === st ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2')}>
                  {st === null ? 'Std.' : st.toLocaleString('de-DE')}
                </button>
              ))}
            </div>
          </div>
          <Textarea defaultValue={ex.notes ?? ''} placeholder="Persönliche Notiz zur Übung" className="min-h-20" onBlur={(e) => onChange((x) => ({ ...x, notes: e.target.value.trim() || null }))} />
          <div>
            {index < count - 1 && (
              <SheetAction icon={<Link2 />} onClick={() => { onSuperset(!nextHasGroup); setMenu(false); }}>
                {nextHasGroup ? 'Supersatz mit nächster Übung auflösen' : 'Mit nächster Übung als Supersatz'}
              </SheetAction>
            )}
            <SheetAction icon={<Replace />} onClick={() => { setMenu(false); onReplace(); }}>
              Übung ersetzen
            </SheetAction>
            <SheetAction icon={<ArrowUp />} disabled={index === 0} onClick={() => onMove(-1)}>
              Nach oben
            </SheetAction>
            <SheetAction icon={<ArrowDown />} disabled={index === count - 1} onClick={() => onMove(1)}>
              Nach unten
            </SheetAction>
            <SheetAction icon={<Trash2 />} tone="danger" onClick={() => { setMenu(false); onRemove(); }}>
              Übung entfernen
            </SheetAction>
          </div>
        </div>
      </Sheet>
    </Card>
  );
}

function RepsInput({ value, onCommit }: { value: string; onCommit: (r: { min: number | null; max: number | null } | null) => void }) {
  const [text, setText] = useState(value === '–' ? '' : value);
  useEffect(() => setText(value === '–' ? '' : value), [value]);
  return (
    <input
      value={text}
      inputMode="numeric"
      onChange={(e) => setText(e.target.value.replace(/[^\d\-–\s]/g, ''))}
      onBlur={() => onCommit(text.trim() ? parseRepRange(text) : null)}
      placeholder="8–12"
      aria-label="Wiederholungen (z. B. 8-12)"
      className="h-10 w-full rounded-xl bg-surface-2 px-2 text-center text-base font-semibold tabular outline-none focus:ring-2 focus:ring-primary/40"
    />
  );
}

function DayMenu({
  day,
  draft,
  planId,
  onClose,
  onUpdate,
  onSelect,
  onStart,
}: {
  day: PlanDayView | undefined;
  draft: Draft;
  planId: string;
  onClose: () => void;
  onUpdate: (fn: (d: Draft) => Draft) => void;
  onSelect: (id: string) => void;
  onStart: () => Promise<void>;
}) {
  void planId;
  if (!day) return null;
  const idx = draft.days.findIndex((d) => d.id === day.id);
  return (
    <div>
      <SheetAction icon={<Play />} onClick={() => { onClose(); void onStart(); }}>
        Diesen Tag jetzt trainieren
      </SheetAction>
      <SheetAction
        icon={<Copy />}
        onClick={() => {
          const copy: PlanDayView = {
            ...structuredClone(day),
            id: uuid(),
            name: `${day.name} (Kopie)`,
            weekday: null,
            exercises: day.exercises.map((e) => ({ ...e, id: uuid(), sets: e.sets.map((s) => ({ ...s, id: uuid() })) })),
          };
          onUpdate((d) => ({ ...d, days: [...d.days.slice(0, idx + 1), copy, ...d.days.slice(idx + 1)] }));
          onSelect(copy.id);
          onClose();
        }}
      >
        Trainingstag duplizieren
      </SheetAction>
      <SheetAction
        icon={<ArrowLeft />}
        disabled={idx === 0}
        onClick={() =>
          onUpdate((d) => {
            const list = [...d.days];
            [list[idx - 1], list[idx]] = [list[idx], list[idx - 1]];
            return { ...d, days: list };
          })
        }
      >
        Nach vorne verschieben
      </SheetAction>
      <SheetAction
        icon={<ArrowRight />}
        disabled={idx === draft.days.length - 1}
        onClick={() =>
          onUpdate((d) => {
            const list = [...d.days];
            [list[idx + 1], list[idx]] = [list[idx], list[idx + 1]];
            return { ...d, days: list };
          })
        }
      >
        Nach hinten verschieben
      </SheetAction>
      <SheetAction icon={<Pencil />} onClick={onClose} hint="Name direkt im Feld oben ändern">
        Umbenennen
      </SheetAction>
      <SheetAction
        icon={<Trash2 />}
        tone="danger"
        disabled={draft.days.length <= 1}
        onClick={() => {
          onUpdate((d) => ({ ...d, days: d.days.filter((x) => x.id !== day.id) }));
          onSelect(draft.days.find((x) => x.id !== day.id)?.id ?? '');
          onClose();
        }}
      >
        Trainingstag löschen
      </SheetAction>
    </div>
  );
}

function VersionsSheet({ open, onOpenChange, planId, onRestored }: { open: boolean; onOpenChange: (o: boolean) => void; planId: string; onRestored: (p: PlanView) => void }) {
  const [list, setList] = useState<{ version: number; createdAt: string; changeNote: string | null }[] | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    if (open) void api<{ version: number; createdAt: string; changeNote: string | null }[]>(`/plans/${planId}/versions`).then(setList).catch(() => setList([]));
  }, [open, planId]);
  const sorted = useMemo(() => list ?? [], [list]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Änderungsverlauf" description="Bisherige Trainings bleiben von Planänderungen unberührt.">
      {!list && <Skeleton className="h-20" />}
      {sorted.map((v, i) => (
        <div key={v.version} className="flex items-center gap-3 border-b border-border py-3 last:border-0">
          <div className="flex-1">
            <p className="font-medium">Version {v.version}{i === 0 && ' (aktuell)'}</p>
            <p className="text-sm text-muted">
              {fmtDate(v.createdAt)} {fmtTime(v.createdAt)}
              {v.changeNote && ` · ${v.changeNote}`}
            </p>
          </div>
          {i > 0 && (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                try {
                  const restored = await api<PlanView>(`/plans/${planId}/versions/${v.version}/restore`, { method: 'POST' });
                  qc.setQueryData(qk.plan(planId), restored);
                  onRestored(restored);
                  onOpenChange(false);
                  toast.success(`Version ${v.version} wiederhergestellt`);
                } catch (e) {
                  toast.error(errorMessage(e));
                }
              }}
            >
              Wiederherstellen
            </Button>
          )}
        </div>
      ))}
    </Sheet>
  );
}
