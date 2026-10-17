import { buildPrefilledSets, formatRepRange, type PlanDayView, type PlanView, type TodayView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, Check, ChevronRight, ClipboardPaste, Coffee, Flame, LayoutTemplate, PauseCircle, Play, Plus, Shuffle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { ExerciseImage } from '@/components/MuscleMap';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, ProgressBar, SectionTitle, Skeleton } from '@/components/ui/card';
import { Sheet, SheetAction } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDateLong, fmtWeight, greeting, todayKey } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { qk, useExerciseMap, usePerformance, useToday } from '@/lib/queries';
import { createWorkout, reconcileActiveSessions, useActiveWorkouts } from '@/lib/workout';
import { createEmptyPlan } from './plans/plan-utils';

export default function Today() {
  const t = useT();
  const user = useAuth((s) => s.user)!;
  const today = useToday();
  const active = useActiveWorkouts();
  const navigate = useNavigate();
  const [pickDay, setPickDay] = useState(false);
  const [starting, setStarting] = useState(false);
  const { map: performance } = usePerformance();
  const exercises = useExerciseMap();
  const unit = user.settings.unit;

  useEffect(() => {
    if (today.data) void reconcileActiveSessions(today.data.activeSessions);
  }, [today.data]);

  const data = today.data;
  const plan = data?.plan ?? null;
  const assignedDay = data?.assignment.type === 'workout' ? plan?.days.find((d) => d.id === (data.assignment as { day: { id: string } }).day.id) ?? null : null;
  const doneToday = data?.completedToday ?? [];
  const current = active[0];

  const start = async (day: PlanDayView | null, name?: string) => {
    if (current) {
      navigate(`/workout/${current.id}`);
      return;
    }
    setStarting(true);
    try {
      const w = await createWorkout({
        name: name ?? day?.name ?? 'Freies Training',
        planId: day ? plan?.id : null,
        day,
        performance,
        exercises,
      });
      navigate(`/workout/${w.id}`);
    } catch (e) {
      toast.error(errorMessage(e, 'Training konnte nicht gestartet werden.'));
    } finally {
      setStarting(false);
    }
  };

  const name = user.profile.displayName || user.username;

  return (
    <div>
      <PageHeader large title={`${greeting()}, ${name}`} subtitle={fmtDateLong(new Date())} />
      <div className="space-y-5 px-4">
        {active.length > 1 && (
          <Card className="flex gap-3 border-warning/40 bg-warning/5 p-4 text-sm">
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
            <div>
              <p className="font-semibold">{active.length} Trainings laufen gleichzeitig</p>
              <p className="text-muted">Vermutlich versehentlich doppelt gestartet. Öffne eines und schließe es ab oder verwirf es.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {active.map((a) => (
                  <Button key={a.id} size="sm" variant="secondary" asChild>
                    <Link to={`/workout/${a.id}`}>
                      {a.name} · {new Date(a.startedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        )}

        {current && <ActiveCard id={current.id} />}

        {!data && today.isLoading && <Skeleton className="h-64 rounded-3xl" />}
        {!data && today.isError && !current && (
          <Card className="p-4 text-sm text-muted">Keine Verbindung und noch keine gespeicherten Daten. Du kannst trotzdem frei trainieren.</Card>
        )}

        {data && !current && (
          <>
            {data.missed.length > 0 && plan && <MissedCard data={data} plan={plan} />}
            {doneToday.length > 0 && (
              <Card className="p-4">
                {doneToday.map((w) => (
                  <Link key={w.id} to={`/workout/${w.id}/summary`} className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-success/15 text-success">
                      <Check className="h-5 w-5" strokeWidth={3} />
                    </span>
                    <span className="flex-1">
                      <span className="block font-semibold">{w.name} erledigt</span>
                      <span className="text-sm text-muted">
                        {w.completedSetCount} Sätze · {w.durationMinutes} Min.
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 text-muted" />
                  </Link>
                ))}
              </Card>
            )}

            {!plan && <NoPlan onFree={() => void start(null)} />}

            {plan && data.assignment.type === 'paused' && (
              <Card className="flex items-center gap-3 p-4">
                <PauseCircle className="h-6 w-6 text-muted" />
                <div className="flex-1">
                  <p className="font-semibold">Plan pausiert</p>
                  <p className="text-sm text-muted">{plan.name}</p>
                </div>
                <ResumePlanButton plan={plan} />
              </Card>
            )}

            {plan && data.assignment.type === 'rest' && (
              <Card className="p-5">
                <div className="flex items-center gap-3">
                  <Coffee className="h-6 w-6 text-muted" />
                  <div>
                    <p className="font-semibold">Heute ist Ruhetag</p>
                    {data.nextWorkout && (
                      <p className="text-sm text-muted">
                        Nächstes Training: {data.nextWorkout.dayName}
                        {data.nextWorkout.date && ` · ${new Date(data.nextWorkout.date).toLocaleDateString('de-DE', { weekday: 'long' })}`}
                      </p>
                    )}
                  </div>
                </div>
                <Button variant="secondary" block className="mt-4" onClick={() => setPickDay(true)}>
                  Trotzdem trainieren
                </Button>
              </Card>
            )}

            {plan && assignedDay && (
              <DayCard
                plan={plan}
                day={assignedDay}
                done={doneToday.some((w) => w.planDayId === assignedDay.id)}
                unit={unit}
                onStart={() => void start(assignedDay)}
                starting={starting}
                startLabel={t.workout.start}
              />
            )}

            {plan && (
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => setPickDay(true)}>
                  <Shuffle className="h-4 w-4" /> Anderer Tag
                </Button>
                <Button variant="secondary" onClick={() => void start(null)} loading={starting && !assignedDay}>
                  <Plus className="h-4 w-4" /> Frei trainieren
                </Button>
              </div>
            )}

            <WeekStrip data={data} />
          </>
        )}
      </div>

      <Sheet open={pickDay} onOpenChange={setPickDay} title="Welchen Tag trainierst du?">
        {plan?.days.map((d) => (
          <SheetAction
            key={d.id}
            icon={<Play />}
            hint={`${d.exercises.length} Übungen`}
            onClick={() => {
              setPickDay(false);
              void start(d);
            }}
          >
            {d.name}
          </SheetAction>
        ))}
        <SheetAction
          icon={<Plus />}
          onClick={() => {
            setPickDay(false);
            void start(null);
          }}
        >
          {t.workout.free}
        </SheetAction>
      </Sheet>
    </div>
  );
}

function ActiveCard({ id }: { id: string }) {
  const active = useActiveWorkouts().find((a) => a.id === id);
  if (!active) return null;
  const sets = active.exercises.flatMap((e) => e.sets);
  const done = sets.filter((s) => s.completed).length;
  return (
    <Card className="overflow-hidden border-primary/40 p-5">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">{active.status === 'paused' ? 'Pausiert' : 'Training läuft'}</p>
      <p className="mt-1 text-2xl font-extrabold">{active.name}</p>
      <p className="mt-1 text-sm text-muted">
        {done} von {sets.length} Sätzen geschafft
      </p>
      <ProgressBar value={sets.length ? (done / sets.length) * 100 : 0} className="mt-3" />
      <Button asChild size="lg" block className="mt-4">
        <Link to={`/workout/${active.id}`}>
          <Play className="h-5 w-5" /> Training fortsetzen
        </Link>
      </Button>
    </Card>
  );
}

function DayCard({
  plan,
  day,
  done,
  unit,
  onStart,
  starting,
  startLabel,
}: {
  plan: PlanView;
  day: PlanDayView;
  done: boolean;
  unit: 'kg' | 'lbs';
  onStart: () => void;
  starting: boolean;
  startLabel: string;
}) {
  const { map: performance } = usePerformance();
  const exMap = useExerciseMap();
  const totalSets = day.exercises.reduce((s, e) => s + e.sets.length, 0);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted">{plan.name}</p>
          <p className="mt-1 text-2xl font-extrabold uppercase tracking-tight">{day.name}</p>
          <p className="text-sm text-muted">
            {day.exercises.length} Übungen · {totalSets} Sätze
          </p>
        </div>
        {done && (
          <span className="flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-semibold text-success">
            <Check className="h-3.5 w-3.5" /> Erledigt
          </span>
        )}
      </div>
      <Button size="lg" block className="mt-4" onClick={onStart} loading={starting}>
        <Play className="h-5 w-5" /> {done ? 'Nochmal trainieren' : startLabel}
      </Button>
      <ul className="mt-3 divide-y divide-border">
        {day.exercises.map((e) => {
          const pre = buildPrefilledSets({
            planned: e.sets,
            last: performance.get(e.exerciseId)?.recent[0] ?? null,
            userDefaults: exMap.get(e.exerciseId)?.userDefaults ?? null,
          });
          return (
            <li key={e.id} className="flex gap-3 py-3">
              <ExerciseImage primary={e.primaryMuscle} imageUrl={exMap.get(e.exerciseId)?.imageUrl} className="h-12 w-12 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{e.exerciseName}</p>
                <p className="mt-0.5 flex flex-wrap gap-x-2 text-sm tabular text-muted">
                  {pre.map((s, i) => (
                    <span key={i} className={cn(s.type === 'warmup' && 'opacity-60')}>
                      {s.weightKg !== null ? `${fmtWeight(s.weightKg, unit)} ${unit}` : '–'} × {s.reps ?? formatRepRange(s.targetRepsMin, s.targetRepsMax)}
                    </span>
                  ))}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
      {day.exercises.length === 0 && (
        <p className="py-3 text-sm text-muted">
          Noch keine Übungen. <Link to={`/plans/${plan.id}`} className="text-primary">Plan bearbeiten</Link>
        </p>
      )}
    </Card>
  );
}

function NoPlan({ onFree }: { onFree: () => void }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-3">
      <Card className="p-5">
        <p className="text-xl font-extrabold">Noch kein Trainingsplan</p>
        <p className="mt-1 text-sm text-muted">Leg in einer Minute los – oder trainiere einfach frei.</p>
        <Button size="lg" block className="mt-4" onClick={onFree}>
          <Play className="h-5 w-5" /> Freies Training starten
        </Button>
      </Card>
      <div className="grid gap-2">
        <Link to="/plans/templates" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <LayoutTemplate className="h-5 w-5 text-primary" />
          <span className="flex-1 font-semibold">Vorlage übernehmen</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const p = await createEmptyPlan('Mein Trainingsplan', true);
              navigate(`/plans/${p.id}`);
            } catch (e) {
              toast.error(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 text-left"
        >
          <Plus className="h-5 w-5 text-primary" />
          <span className="flex-1 font-semibold">Eigenen Plan erstellen</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </button>
        <Link to="/plans/import" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <ClipboardPaste className="h-5 w-5 text-primary" />
          <span className="flex-1 font-semibold">Trainingsnotizen importieren</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
      </div>
    </div>
  );
}

function MissedCard({ data, plan }: { data: TodayView; plan: PlanView }) {
  const qc = useQueryClient();
  const m = data.missed[data.missed.length - 1];
  const [busy, setBusy] = useState(false);
  return (
    <Card className="flex items-center gap-3 p-4">
      <CalendarClock className="h-6 w-6 shrink-0 text-warning" />
      <div className="flex-1 text-sm">
        <p className="font-semibold">{m.dayName} verpasst</p>
        <p className="text-muted">{new Date(m.date).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api(`/plans/${plan.id}/schedule`, {
              method: 'PATCH',
              body: { overrides: { ...plan.schedule.overrides, [m.date]: null, [todayKey()]: m.dayId } },
            });
            await qc.invalidateQueries({ queryKey: qk.today });
            toast.success(`${m.dayName} auf heute verschoben`);
          } catch (e) {
            toast.error(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Heute nachholen
      </Button>
    </Card>
  );
}

function ResumePlanButton({ plan }: { plan: PlanView }) {
  const qc = useQueryClient();
  return (
    <Button
      size="sm"
      variant="secondary"
      onClick={async () => {
        await api(`/plans/${plan.id}/schedule`, { method: 'PATCH', body: { paused: false } });
        await qc.invalidateQueries({ queryKey: qk.today });
      }}
    >
      Fortsetzen
    </Button>
  );
}

function WeekStrip({ data }: { data: TodayView }) {
  const flexible = data.plan?.schedule.mode !== 'fixed';
  const days = useMemo(() => data.week, [data.week]);
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-1">
        <SectionTitle className="mb-0">Diese Woche</SectionTitle>
        {data.streak.current > 0 && (
          <span className="flex items-center gap-1 text-xs font-semibold text-primary">
            <Flame className="h-3.5 w-3.5" /> {data.streak.current} {data.streak.current === 1 ? 'Woche' : 'Wochen'} Serie
          </span>
        )}
      </div>
      <Card className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const isToday = d.date === data.date;
            return (
              <div key={d.date} className={cn('flex flex-col items-center gap-1 rounded-xl py-2', isToday && 'bg-surface-2')}>
                <span className={cn('text-[11px] font-semibold', isToday ? 'text-text' : 'text-muted')}>
                  {new Date(d.date).toLocaleDateString('de-DE', { weekday: 'short' }).slice(0, 2)}
                </span>
                <span
                  className={cn(
                    'grid h-8 w-8 place-items-center rounded-full text-xs font-bold',
                    d.done ? 'bg-primary text-primary-fg' : d.type === 'workout' ? 'border-2 border-primary/50 text-primary' : 'text-muted',
                  )}
                  title={d.dayName ?? (d.type === 'rest' ? 'Ruhetag' : '')}
                >
                  {d.done ? <Check className="h-4 w-4" strokeWidth={3} /> : Number(d.date.slice(8))}
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 px-1 text-xs text-muted">
          {data.streak.thisWeekCount} von {data.streak.weeklyGoal} Trainings diese Woche
          {flexible && data.plan ? ' · flexible Reihenfolge: es folgt immer das nächste Workout' : ''}
        </p>
      </Card>
    </section>
  );
}
