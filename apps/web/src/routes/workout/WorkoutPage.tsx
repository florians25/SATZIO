import { workoutDurationMinutes, type ExerciseListItem } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, ClipboardPaste, MoreVertical, Pause, Play, Plus, Trash2, Type } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { ExercisePicker } from '@/components/ExercisePicker';
import { SyncIndicator } from '@/components/SyncIndicator';
import { Button } from '@/components/ui/button';
import { ProgressBar, Skeleton } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';
import { ConfirmSheet, Sheet, SheetAction } from '@/components/ui/sheet';
import { useAuth } from '@/lib/auth';
import { unlockAudio } from '@/lib/feedback';
import { fmtClock, fmtDate } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useExerciseMap, usePerformance, useUpdateSettings } from '@/lib/queries';
import { useTimer } from '@/lib/timer';
import { flushWrites, useWorkout } from '@/lib/workout';
import { useSetToggle } from './completion';
import { ExerciseBlock } from './ExerciseBlock';
import { ExerciseSheet } from './ExerciseSheet';
import { FinishSheet } from './FinishSheet';
import { GuidedView } from './GuidedView';
import { RestTimerBar } from './RestTimerBar';
import { SetSheet } from './SetSheet';
import { TextInputSheet } from './TextInputSheet';

export default function WorkoutPage() {
  const { id } = useParams<{ id: string }>();
  const t = useT();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const settings = user.settings;
  const open = useWorkout((s) => s.open);
  const loading = useWorkout((s) => s.loading);
  const sessionId = useWorkout((s) => s.session?.id);
  const status = useWorkout((s) => s.session?.status);
  const name = useWorkout((s) => s.session?.name);
  const exerciseIds = useWorkout((s) => (s.session ? [...s.session.exercises].sort((a, b) => a.order - b.order).map((e) => e.id).join(',') : ''));
  const progress = useWorkout(
    useShallow((s) => {
      const sets = s.session?.exercises.flatMap((e) => e.sets) ?? [];
      return { done: sets.filter((x) => x.completed).length, total: sets.length };
    }),
  );
  const { map: performance } = usePerformance();
  const exerciseMap = useExerciseMap();
  const updateSettings = useUpdateSettings();
  const onToggle = useSetToggle();
  const qc = useQueryClient();

  const [mode, setMode] = useState(settings.workoutMode);
  const [setTarget, setSetTarget] = useState<{ exId: string; setId: string } | null>(null);
  const [exMenu, setExMenu] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | { replace?: string }>(null);
  const [textSheet, setTextSheet] = useState(false);
  const [menu, setMenu] = useState(false);
  const [finishOpen, setFinishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [rename, setRename] = useState(false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;
    void open(id).then((s) => setNotFound(!s));
  }, [id, open]);

  useEffect(() => {
    // Beim Verlassen ausstehende lokale Schreibvorgänge abschließen
    return () => {
      void flushWrites();
    };
  }, []);

  const toggle = useCallback(
    (exId: string, setId: string) => {
      unlockAudio();
      onToggle(exId, setId);
    },
    [onToggle],
  );
  const openSetMenu = useCallback((exId: string, setId: string) => setSetTarget({ exId, setId }), []);
  const openExMenu = useCallback((exId: string) => setExMenu(exId), []);

  if (loading || (!sessionId && !notFound)) {
    return (
      <div className="space-y-3 p-4 pt-safe">
        <Skeleton className="h-12" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }
  if (notFound || !sessionId || sessionId !== id) {
    return (
      <div className="p-6 pt-safe text-center">
        <p className="font-semibold">Training nicht gefunden</p>
        <p className="mt-1 text-sm text-muted">Es wurde möglicherweise gelöscht oder ist offline nicht verfügbar.</p>
        <Button className="mt-4" onClick={() => navigate('/')}>
          Zur Startseite
        </Button>
      </div>
    );
  }

  const completed = status === 'completed';
  const ids = exerciseIds ? exerciseIds.split(',') : [];

  const onSelectExercise = (ex: ExerciseListItem) => {
    if (picker?.replace) useWorkout.getState().replaceExercise(picker.replace, { id: ex.id, nameDe: ex.nameDe, primaryMuscle: ex.primaryMuscle });
    else useWorkout.getState().addExercise(ex, { performance: performance.get(ex.id) });
    setPicker(null);
    setExMenu(null);
  };

  const togglePause = () => {
    const s = useWorkout.getState().session!;
    if (s.status === 'paused') {
      const extra = s.pausedAt ? Math.round((Date.now() - new Date(s.pausedAt).getTime()) / 1000) : 0;
      useWorkout.getState().updateSession({ status: 'active', pausedAt: null, pausedSeconds: s.pausedSeconds + extra });
    } else {
      useWorkout.getState().updateSession({ status: 'paused', pausedAt: new Date().toISOString() });
      useTimer.getState().skip();
    }
    setMenu(false);
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 pt-safe backdrop-blur-xl">
        <div className="flex h-14 items-center gap-1 px-2">
          <button type="button" onClick={() => (completed ? navigate(-1) : navigate('/'))} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Zurück">
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button type="button" onClick={() => setRename(true)} className="min-w-0 flex-1 text-left">
            <h1 className="truncate text-base font-extrabold uppercase tracking-wide">{name}</h1>
            <p className="text-xs text-muted tabular">
              {completed ? <CompletedInfo /> : <Elapsed />} · {progress.done}/{progress.total} Sätze
            </p>
          </button>
          <SyncIndicator />
          <button type="button" onClick={() => setMenu(true)} className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface-2" aria-label="Trainingsmenü">
            <MoreVertical className="h-5 w-5" />
          </button>
        </div>
        <ProgressBar value={progress.total ? (progress.done / progress.total) * 100 : 0} className="h-1 rounded-none" />
      </header>

      {status === 'paused' && (
        <button type="button" onClick={togglePause} className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center gap-3 rounded-2xl bg-warning/15 p-3 text-left text-sm text-warning">
          <Pause className="h-5 w-5" /> <span className="flex-1 font-semibold">Training pausiert</span> <span className="font-semibold">Fortsetzen</span>
        </button>
      )}

      {!completed && (
        <div className="px-4 pt-3">
          <Segmented
            size="sm"
            ariaLabel="Ansicht"
            value={mode}
            onChange={(m) => {
              setMode(m);
              updateSettings.mutate({ workoutMode: m });
            }}
            options={[
              { value: 'list', label: t.workout.listMode },
              { value: 'guided', label: t.workout.guidedMode },
            ]}
          />
        </div>
      )}

      <div className="pb-40 pt-3">
        {mode === 'guided' && !completed ? (
          <GuidedView unit={settings.unit} stepsKg={settings.weightStepsKg} performance={performance} exerciseMap={exerciseMap} onToggle={toggle} onFinish={() => setFinishOpen(true)} />
        ) : (
          <div className="space-y-3 px-3">
            {ids.length === 0 && (
              <div className="rounded-3xl border border-dashed border-border p-8 text-center">
                <p className="font-semibold">Noch keine Übungen</p>
                <p className="mt-1 text-sm text-muted">Füge eine Übung hinzu oder schreib sie einfach als Text.</p>
              </div>
            )}
            {ids.map((exId) => {
              const exerciseId = useWorkout.getState().session?.exercises.find((e) => e.id === exId)?.exerciseId;
              return (
                <ExerciseBlock
                  key={exId}
                  exId={exId}
                  unit={settings.unit}
                  stepsKg={settings.weightStepsKg}
                  performance={exerciseId ? performance.get(exerciseId) : undefined}
                  imageUrl={exerciseId ? exerciseMap.get(exerciseId)?.imageUrl : null}
                  progressionEnabled={settings.progressionEnabled}
                  onToggle={toggle}
                  onSetMenu={openSetMenu}
                  onExerciseMenu={openExMenu}
                />
              );
            })}
            <div className="grid grid-cols-2 gap-2 pt-1">
              <Button variant="secondary" onClick={() => setPicker({})}>
                <Plus className="h-4 w-4" /> {t.workout.addExercise}
              </Button>
              <Button variant="secondary" onClick={() => setTextSheet(true)}>
                <Type className="h-4 w-4" /> Per Text
              </Button>
            </div>
            {completed ? (
              <p className="pt-2 text-center text-sm text-muted">Abgeschlossenes Training – Änderungen werden automatisch gespeichert.</p>
            ) : (
              <Button size="lg" block className="mt-2" onClick={() => setFinishOpen(true)}>
                <Check className="h-5 w-5" /> {t.workout.finish}
              </Button>
            )}
          </div>
        )}
      </div>

      {!completed && (
        <div className="fixed inset-x-0 bottom-0 z-30 pb-safe">
          <div className="mx-auto flex max-w-2xl justify-end gap-2 px-3 pb-3">
            <RestTimerBar defaultRest={settings.defaultRestSeconds} />
          </div>
        </div>
      )}

      <SetSheet target={setTarget} onClose={() => setSetTarget(null)} />
      <ExerciseSheet
        exId={exMenu}
        onClose={() => setExMenu(null)}
        onReplace={(exId) => setPicker({ replace: exId })}
        performance={(() => {
          const e = useWorkout.getState().session?.exercises.find((x) => x.id === exMenu);
          return e?.exerciseId ? performance.get(e.exerciseId) : undefined;
        })()}
        listItem={(() => {
          const e = useWorkout.getState().session?.exercises.find((x) => x.id === exMenu);
          return e?.exerciseId ? exerciseMap.get(e.exerciseId) : undefined;
        })()}
        unit={settings.unit}
        defaultRest={settings.defaultRestSeconds}
      />
      <ExercisePicker open={!!picker} onOpenChange={(o) => !o && setPicker(null)} onSelect={onSelectExercise} title={picker?.replace ? 'Übung ersetzen' : 'Übung hinzufügen'} />
      <TextInputSheet open={textSheet} onOpenChange={setTextSheet} />
      <FinishSheet
        open={finishOpen}
        onOpenChange={setFinishOpen}
        onFinished={() => {
          useTimer.getState().skip();
          void qc.invalidateQueries({ queryKey: ['today'] });
          navigate(`/workout/${sessionId}/summary`, { replace: true });
        }}
      />
      <Sheet open={menu} onOpenChange={setMenu} title="Training">
        {!completed && (
          <SheetAction icon={status === 'paused' ? <Play /> : <Pause />} onClick={togglePause}>
            {status === 'paused' ? 'Training fortsetzen' : 'Training pausieren'}
          </SheetAction>
        )}
        <SheetAction icon={<Plus />} onClick={() => { setMenu(false); setPicker({}); }}>
          Übung hinzufügen
        </SheetAction>
        <SheetAction icon={<ClipboardPaste />} onClick={() => { setMenu(false); setTextSheet(true); }}>
          Übungen per Text hinzufügen
        </SheetAction>
        <SheetAction icon={<Type />} onClick={() => { setMenu(false); setRename(true); }}>
          Umbenennen & Notiz
        </SheetAction>
        {!completed && (
          <SheetAction icon={<Check />} onClick={() => { setMenu(false); setFinishOpen(true); }}>
            Training abschließen
          </SheetAction>
        )}
        <SheetAction icon={<Trash2 />} tone="danger" onClick={() => { setMenu(false); setDiscardOpen(true); }}>
          {completed ? 'Training löschen' : 'Training verwerfen'}
        </SheetAction>
      </Sheet>
      <RenameSheet open={rename} onOpenChange={setRename} />
      <ConfirmSheet
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title={completed ? 'Training löschen?' : 'Training verwerfen?'}
        text="Alle Sätze dieses Trainings werden gelöscht. Das kann nicht rückgängig gemacht werden."
        confirmLabel={completed ? 'Löschen' : 'Verwerfen'}
        onConfirm={async () => {
          useTimer.getState().skip();
          await useWorkout.getState().discard();
          void qc.invalidateQueries({ queryKey: ['history'] });
          navigate('/', { replace: true });
        }}
      />
    </div>
  );
}

function Elapsed() {
  const s = useWorkout((st) => st.session);
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  if (!s) return null;
  const pausedExtra = s.status === 'paused' && s.pausedAt ? (Date.now() - new Date(s.pausedAt).getTime()) / 1000 : 0;
  const secs = (Date.now() - new Date(s.startedAt).getTime()) / 1000 - s.pausedSeconds - pausedExtra;
  return <>{fmtClock(secs)}</>;
}

function CompletedInfo() {
  const s = useWorkout((st) => st.session);
  if (!s) return null;
  return (
    <>
      {fmtDate(s.startedAt)} · {workoutDurationMinutes(s.startedAt, s.endedAt, s.pausedSeconds)} Min.
    </>
  );
}

function RenameSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const s = useWorkout((st) => st.session);
  const update = useWorkout((st) => st.updateSession);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  useEffect(() => {
    if (open && s) {
      setName(s.name);
      setNotes(s.notes ?? '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Training bearbeiten">
      <div className="space-y-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Name" />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notiz zum Training"
          className="min-h-24 w-full rounded-2xl border border-border bg-surface-2 p-3 outline-none focus:border-primary/70"
        />
        <Button
          block
          onClick={() => {
            if (s) update({ name: name.trim() || s.name, notes: notes.trim() || null });
            onOpenChange(false);
          }}
        >
          Übernehmen
        </Button>
      </div>
    </Sheet>
  );
}
