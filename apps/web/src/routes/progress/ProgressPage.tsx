import { MUSCLE_LABELS_DE, PR_TYPE_LABELS_DE, type PersonalRecordView } from '@satzio/shared';
import { CalendarDays, ChevronRight, Flame, History, Scale, Trophy } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/PageHeader';
import { Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui/card';
import { Segmented, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtDuration, fmtVolume, fmtWeight } from '@/lib/format';
import { useAnalyticsOverview, useMuscles, useRecords, useTrainedExercises, useWeekly } from '@/lib/queries';
import { ExerciseProgressChart, WeeklyBarChart } from './charts';

const RANGES = [
  { value: '7d', label: '7 T' },
  { value: '30d', label: '30 T' },
  { value: '90d', label: '90 T' },
  { value: '6m', label: '6 M' },
  { value: '1y', label: '1 J' },
  { value: 'all', label: 'Alles' },
];

export default function ProgressPage() {
  const [range, setRange] = useState('90d');
  return (
    <div>
      <PageHeader large title="Fortschritt" subtitle="Deine Zahlen – aus deinen echten Trainings" />
      <div className="space-y-4 px-4 pb-6">
        <div className="grid grid-cols-2 gap-2">
          <Link to="/history" className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3 font-semibold">
            <History className="h-5 w-5 text-primary" /> Historie
          </Link>
          <Link to="/history?view=calendar" className="flex items-center gap-2 rounded-2xl border border-border bg-surface p-3 font-semibold">
            <CalendarDays className="h-5 w-5 text-primary" /> Kalender
          </Link>
        </div>
        <Segmented size="sm" value={range} onChange={setRange} options={RANGES} ariaLabel="Zeitraum" />
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Übersicht</TabsTrigger>
            <TabsTrigger value="exercises">Übungen</TabsTrigger>
            <TabsTrigger value="records">Rekorde</TabsTrigger>
            <TabsTrigger value="muscles">Muskeln</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="mt-4">
            <Overview range={range} />
          </TabsContent>
          <TabsContent value="exercises" className="mt-4">
            <ExercisesTab range={range} />
          </TabsContent>
          <TabsContent value="records" className="mt-4">
            <RecordsTab />
          </TabsContent>
          <TabsContent value="muscles" className="mt-4">
            <MusclesTab range={range} />
          </TabsContent>
        </Tabs>
        <Link to="/profile/body" className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <Scale className="h-5 w-5 text-primary" />
          <span className="flex-1 font-semibold">Körpergewicht & Maße</span>
          <ChevronRight className="h-5 w-5 text-muted" />
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-2xl font-extrabold tabular">{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </Card>
  );
}

function Overview({ range }: { range: string }) {
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const ov = useAnalyticsOverview(range);
  const weekly = useWeekly(range);
  const [metric, setMetric] = useState<'volumeKg' | 'workouts' | 'sets'>('volumeKg');
  if (ov.isLoading) return <Skeleton className="h-64" />;
  const o = ov.data;
  if (!o) return <EmptyState title="Statistik nicht verfügbar" text="Keine Verbindung und keine gespeicherten Daten." />;
  return (
    <div className="space-y-4">
      {o.allTimeWorkouts === 0 && (
        <Card className="p-4 text-sm text-muted">Sobald du dein erstes Training abschließt, erscheinen hier deine echten Statistiken.</Card>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Trainings" value={o.workouts} />
        <Stat label="Pro Woche (Ø)" value={o.workoutsPerWeek.toLocaleString('de-DE')} />
        <Stat label="Trainingsvolumen" value={fmtVolume(o.totalVolumeKg, unit)} />
        <Stat label="Ø Dauer" value={o.avgDurationMinutes ? fmtDuration(o.avgDurationMinutes) : '–'} />
        <Stat label="Sätze" value={o.totalSets.toLocaleString('de-DE')} />
        <Stat label="Rekorde" value={o.prCount} />
      </div>
      <Card className="flex items-center gap-3 p-4">
        <Flame className="h-6 w-6 text-primary" />
        <div className="flex-1">
          <p className="font-semibold">
            Serie: {o.streak.current} {o.streak.current === 1 ? 'Woche' : 'Wochen'}
          </p>
          <p className="text-sm text-muted">
            Längste: {o.streak.longest} · Wochenziel {o.streak.weeklyGoal}× – Ruhetage zählen nicht gegen dich
          </p>
        </div>
      </Card>
      <section>
        <div className="mb-2 flex items-center justify-between gap-2">
          <SectionTitle className="mb-0">Pro Woche</SectionTitle>
          <Segmented
            size="sm"
            className="w-56"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'volumeKg', label: 'Volumen' },
              { value: 'workouts', label: 'Trainings' },
              { value: 'sets', label: 'Sätze' },
            ]}
          />
        </div>
        <Card className="p-3">{weekly.isLoading ? <Skeleton className="h-52" /> : <WeeklyBarChart data={weekly.data ?? []} metric={metric} />}</Card>
      </section>
    </div>
  );
}

function ExercisesTab({ range }: { range: string }) {
  const trained = useTrainedExercises();
  const [selected, setSelected] = useState<string | null>(null);
  const id = selected ?? trained.data?.[0]?.exerciseId ?? null;
  if (trained.isLoading) return <Skeleton className="h-64" />;
  if (!trained.data?.length) return <EmptyState title="Noch keine Übungsdaten" text="Nach deinem ersten Training siehst du hier die Kraftentwicklung je Übung." />;
  return (
    <div className="space-y-3">
      <select value={id ?? ''} onChange={(e) => setSelected(e.target.value)} className="h-12 w-full rounded-2xl border border-border bg-surface-2 px-3 text-base" aria-label="Übung wählen">
        {trained.data.map((t) => (
          <option key={t.exerciseId} value={t.exerciseId}>
            {t.name} ({t.sessions}×)
          </option>
        ))}
      </select>
      {id && (
        <Card className="p-3">
          <ExerciseProgressChart exerciseId={id} range={range} />
        </Card>
      )}
    </div>
  );
}

function RecordsTab() {
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const recs = useRecords();
  const grouped = useMemo(() => {
    const m = new Map<string, PersonalRecordView[]>();
    for (const r of recs.data ?? []) {
      if (r.type === 'max_reps_at_weight') continue;
      const l = m.get(r.exerciseName) ?? [];
      l.push(r);
      m.set(r.exerciseName, l);
    }
    return [...m.entries()];
  }, [recs.data]);
  if (recs.isLoading) return <Skeleton className="h-64" />;
  if (!grouped.length) return <EmptyState icon={<Trophy className="h-8 w-8" />} title="Noch keine Rekorde" text="Rekorde werden automatisch aus abgeschlossenen Sätzen erkannt." />;
  return (
    <div className="space-y-2">
      {grouped.map(([name, list]) => (
        <Card key={name} className="p-4">
          <p className="font-semibold">{name}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {list.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="text-muted">{PR_TYPE_LABELS_DE[r.type]}</span>
                <span className="tabular font-semibold">
                  {r.type === 'max_set_volume' || r.type === 'max_session_volume' ? fmtVolume(r.value, unit) : `${fmtWeight(r.value, unit)} ${unit}`}
                  {r.type === 'max_weight' && r.reps ? ` × ${r.reps}` : ''}
                  {r.type === 'est_1rm' && <span className="font-normal text-muted"> (Schätzung)</span>}
                  <span className="ml-2 font-normal text-muted">{fmtDate(r.achievedAt, { day: '2-digit', month: '2-digit', year: '2-digit' })}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      <p className="px-1 text-xs text-muted">Das geschätzte 1RM wird nach der Epley-Formel aus Sätzen mit bis zu 12 Wiederholungen berechnet und ist eine Schätzung.</p>
    </div>
  );
}

function MusclesTab({ range }: { range: string }) {
  const q = useMuscles(range);
  if (q.isLoading) return <Skeleton className="h-64" />;
  if (!q.data?.length) return <EmptyState title="Noch keine Daten" text="Hier siehst du, welche Muskelgruppen du wie oft trainiert hast." />;
  const max = Math.max(...q.data.map((m) => m.sets));
  return (
    <Card className="p-4">
      <ul className="space-y-3">
        {q.data.map((m) => (
          <li key={m.muscle}>
            <div className="flex justify-between text-sm">
              <span className="font-medium">{MUSCLE_LABELS_DE[m.muscle]}</span>
              <span className="tabular text-muted">
                {m.sets.toLocaleString('de-DE')} Sätze{m.lastTrained && ` · zuletzt ${fmtDate(m.lastTrained, { day: '2-digit', month: '2-digit' })}`}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-primary" style={{ width: `${(m.sets / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">Sekundär beanspruchte Muskeln zählen mit halbem Gewicht.</p>
    </Card>
  );
}
