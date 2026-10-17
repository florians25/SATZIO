import {
  PR_TYPE_LABELS_DE,
  suggestProgression,
  totalReps,
  totalVolume,
  workoutDurationMinutes,
  type FinishSummary,
  type WorkoutSessionView,
} from '@satzio/shared';
import { useQuery } from '@tanstack/react-query';
import { Award, Clock, Dumbbell, Edit3, Flame, Layers, Repeat, Share2, TrendingUp, Trophy } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { coach } from '@/lib/coach';
import { db, kvGet } from '@/lib/db';
import { fmtDuration, fmtVolume, fmtWeight } from '@/lib/format';
import { usePerformance, useToday } from '@/lib/queries';
import { useSyncState } from '@/lib/sync';

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuth((s) => s.user)!;
  const unit = user.settings.unit;
  const [local, setLocal] = useState<WorkoutSessionView | null>(null);
  const pending = useSyncState((s) => s.pending);
  const { map: performance } = usePerformance();
  const today = useToday();

  useEffect(() => {
    if (id) void db.workouts.get(id).then((w) => setLocal(w ?? null));
  }, [id]);

  // Serverzusammenfassung (Rekorde, Achievements, Vergleich) – sobald synchronisiert
  const server = useQuery({
    queryKey: ['summary', id, pending],
    enabled: !!id,
    queryFn: async () => (await kvGet<FinishSummary>(`summary:${id}`)) ?? api<FinishSummary>(`/workouts/${id}/summary`),
    retry: false,
  });

  useEffect(() => {
    if (server.data) coach({ type: 'workout_completed' }, user.settings.motivationLevel, id ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!server.data]);

  const stats = useMemo(() => {
    if (server.data) return server.data;
    if (!local) return null;
    const sets = local.exercises.flatMap((e) => e.sets);
    return {
      sessionId: local.id,
      name: local.name,
      durationMinutes: workoutDurationMinutes(local.startedAt, local.endedAt, local.pausedSeconds),
      exerciseCount: local.exercises.filter((e) => e.sets.some((s) => s.completed)).length,
      setCount: sets.filter((s) => s.completed).length,
      totalReps: totalReps(sets, { includeWarmup: true }),
      volumeKg: totalVolume(sets),
      newRecords: [],
      unlockedAchievements: [],
      comparison: null,
    } satisfies FinishSummary;
  }, [server.data, local]);

  // Vorschläge fürs nächste Mal (transparent, regelbasiert, Nutzer entscheidet)
  const suggestions = useMemo(() => {
    if (!local || !user.settings.progressionEnabled) return [];
    return local.exercises
      .map((e) => {
        const working = e.sets.filter((s) => s.type === 'working');
        const target = working[0];
        if (!target || target.targetRepsMax === null) return null;
        const history = [{ performedAt: local.startedAt, sets: e.sets }, ...(e.exerciseId ? (performance.get(e.exerciseId)?.recent ?? []).filter((r) => r.sessionId !== local.id) : [])];
        const s = suggestProgression({ sets: working.length, repsMin: target.targetRepsMin, repsMax: target.targetRepsMax }, history, e.weightStepKg ?? 2.5);
        return s && s.type === 'increase' ? { name: e.name, ...s } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [local, performance, user.settings.progressionEnabled]);

  if (!stats) return <div className="p-6 text-center text-muted">Lädt …</div>;

  const share = async () => {
    const text = `${stats.name} abgeschlossen 💪\n${stats.durationMinutes} Min · ${stats.setCount} Sätze · ${fmtVolume(stats.volumeKg, unit)}${stats.newRecords.length ? ` · ${stats.newRecords.length} neue Rekorde` : ''}\n– getrackt mit SATZIO`;
    try {
      if (navigator.share) await navigator.share({ title: 'SATZIO Workout', text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success('In die Zwischenablage kopiert');
      }
    } catch {
      /* abgebrochen */
    }
  };

  const items = [
    { icon: Clock, label: 'Dauer', value: fmtDuration(stats.durationMinutes) },
    { icon: Dumbbell, label: 'Übungen', value: stats.exerciseCount },
    { icon: Layers, label: 'Sätze', value: stats.setCount },
    { icon: Repeat, label: 'Wiederholungen', value: stats.totalReps.toLocaleString('de-DE') },
    { icon: Flame, label: 'Trainingsvolumen', value: fmtVolume(stats.volumeKg, unit) },
    { icon: Trophy, label: 'Neue Rekorde', value: server.data ? stats.newRecords.length : '…' },
  ];
  const next = today.data?.nextWorkout;

  return (
    <div className="px-4 pb-10 pt-safe">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="pt-8 text-center">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">Workout complete</p>
        <h1 className="mt-2 text-3xl font-extrabold">{stats.name} abgeschlossen!</h1>
        {!server.data && <p className="mt-2 text-sm text-muted">{pending > 0 ? 'Wird synchronisiert – Rekorde folgen.' : ''}</p>}
      </motion.div>

      <div className="mt-6 grid grid-cols-2 gap-2">
        {items.map(({ icon: Icon, label, value }, i) => (
          <motion.div key={label} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 * i }}>
            <Card className="p-4">
              <Icon className="h-5 w-5 text-muted" />
              <p className="mt-2 text-2xl font-extrabold tabular">{value}</p>
              <p className="text-xs text-muted">{label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {stats.comparison && (
        <Card className="mt-3 p-4 text-sm">
          <p className="font-semibold">Vergleich mit dem letzten Mal</p>
          <p className="mt-1 text-muted">
            Volumen {fmtVolume(stats.comparison.previousVolumeKg, unit)} → {fmtVolume(stats.volumeKg, unit)}
            {stats.comparison.previousVolumeKg > 0 && (
              <span className={stats.volumeKg >= stats.comparison.previousVolumeKg ? 'text-success' : 'text-warning'}>
                {' '}
                ({stats.volumeKg >= stats.comparison.previousVolumeKg ? '+' : ''}
                {Math.round(((stats.volumeKg - stats.comparison.previousVolumeKg) / stats.comparison.previousVolumeKg) * 100)} %)
              </span>
            )}
            {' · '}Sätze {stats.comparison.previousCompletedSets} → {stats.setCount}
          </p>
        </Card>
      )}

      {stats.newRecords.length > 0 && (
        <Card className="mt-3 border-primary/40 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Trophy className="h-5 w-5 text-primary" /> Neue persönliche Rekorde
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {stats.newRecords.map((r, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>
                  {r.exerciseName} · {PR_TYPE_LABELS_DE[r.type]}
                </span>
                <span className="font-semibold tabular">
                  {r.type === 'max_reps_at_weight' ? `${r.value} × ${fmtWeight(r.weightKg, unit)} ${unit}` : `${fmtWeight(r.value, unit)} ${unit}`}
                  {r.type === 'est_1rm' && ' (geschätzt)'}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {stats.unlockedAchievements.length > 0 && user.settings.gamificationEnabled && (
        <Card className="mt-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <Award className="h-5 w-5 text-primary" /> Freigeschaltet
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {stats.unlockedAchievements.map((a) => (
              <motion.li key={a.code} initial={{ x: -8, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
                <span className="font-semibold">{a.title}</span> <span className="text-muted">– {a.description}</span>
              </motion.li>
            ))}
          </ul>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card className="mt-3 p-4">
          <p className="flex items-center gap-2 font-semibold">
            <TrendingUp className="h-5 w-5 text-primary" /> Fürs nächste Mal
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {suggestions.map((s) => (
              <li key={s.name}>
                <span className="font-semibold">{s.name}:</span> <span className="text-muted">Alle Zielsätze geschafft – {fmtWeight(s.toKg, unit)} {unit} ausprobieren?</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">Du entscheidest im nächsten Training selbst, ob du den Vorschlag übernimmst.</p>
        </Card>
      )}

      {next && (
        <Card className="mt-3 p-4 text-sm">
          <p className="text-muted">Nächstes Training</p>
          <p className="font-semibold">
            {next.dayName}
            {next.date && ` · ${new Date(next.date).toLocaleDateString('de-DE', { weekday: 'long' })}`}
          </p>
        </Card>
      )}

      <div className="mt-6 grid gap-2">
        <Button size="lg" block onClick={() => navigate('/', { replace: true })}>
          Fertig
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" asChild>
            <Link to={`/workout/${id}`}>
              <Edit3 className="h-4 w-4" /> Bearbeiten
            </Link>
          </Button>
          <Button variant="secondary" onClick={() => void share()}>
            <Share2 className="h-4 w-4" /> Teilen
          </Button>
        </div>
      </div>
    </div>
  );
}
