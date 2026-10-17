import { fromKg, type WeeklyPoint } from '@satzio/shared';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Skeleton } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useExerciseProgress } from '@/lib/queries';

/**
 * Diagramme: eine Achse, dünne Linien, abgerundete Balkenenden, zurückhaltendes
 * Raster, Tooltips. Ausschließlich echte Daten – leere Zustände mit Hinweis.
 */
const axis = { stroke: 'var(--muted)', fontSize: 11, tickLine: false, axisLine: false } as const;
const grid = <CartesianGrid stroke="var(--border)" strokeDasharray="0" vertical={false} />;
const tooltipStyle = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, color: 'var(--text)', fontSize: 13 },
  labelStyle: { color: 'var(--muted)' },
  cursor: { fill: 'color-mix(in srgb, var(--primary) 10%, transparent)', stroke: 'var(--muted)' },
};

const shortDate = (d: string) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

export function ChartEmpty({ text }: { text: string }) {
  return <div className="grid h-48 place-items-center px-6 text-center text-sm text-muted">{text}</div>;
}

export function WeeklyBarChart({ data, metric }: { data: WeeklyPoint[]; metric: 'volumeKg' | 'workouts' | 'sets' }) {
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  if (!data.length || data.every((d) => d[metric] === 0)) return <ChartEmpty text="Noch keine Trainings in diesem Zeitraum." />;
  const rows = data.map((d) => ({ ...d, value: metric === 'volumeKg' ? Math.round(fromKg(d.volumeKg, unit)) : d[metric] }));
  const label = metric === 'volumeKg' ? `Volumen (${unit})` : metric === 'workouts' ? 'Trainings' : 'Sätze';
  return (
    <div className="h-52" role="img" aria-label={`${label} pro Woche`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap={2}>
          {grid}
          <XAxis dataKey="week" tickFormatter={shortDate} {...axis} minTickGap={16} />
          <YAxis {...axis} allowDecimals={metric === 'volumeKg'} tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v.toLocaleString('de-DE'))} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => `Woche ab ${shortDate(String(l))}`} formatter={(v) => [Number(v).toLocaleString('de-DE'), label]} />
          <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ExerciseProgressChart({ exerciseId, range }: { exerciseId: string; range: string }) {
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const q = useExerciseProgress(exerciseId, range);
  if (q.isLoading) return <Skeleton className="h-52" />;
  const data = (q.data ?? []).map((p) => ({
    date: p.date,
    max: p.maxWeightKg === null ? null : fromKg(p.maxWeightKg, unit),
    e1rm: p.est1rmKg === null ? null : fromKg(p.est1rmKg, unit),
  }));
  if (data.length < 1) return <ChartEmpty text="Noch keine Daten – trainiere diese Übung, dann siehst du hier deine Entwicklung." />;
  return (
    <div>
      <div className="h-52" role="img" aria-label="Gewichtsentwicklung">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            {grid}
            <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={16} />
            <YAxis {...axis} domain={['auto', 'auto']} />
            <Tooltip
              {...tooltipStyle}
              labelFormatter={(l) => new Date(String(l)).toLocaleDateString('de-DE')}
              formatter={(v, name) => [`${Number(v).toLocaleString('de-DE')} ${unit}`, name === 'max' ? 'Höchstes Gewicht' : 'Geschätztes 1RM']}
            />
            <Line type="monotone" dataKey="e1rm" stroke="var(--muted)" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls isAnimationActive={false} />
            <Line type="monotone" dataKey="max" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 6 }} connectNulls isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 px-1 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary" /> Höchstes Gewicht
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-muted" /> Geschätztes 1RM (Schätzung)
        </span>
      </div>
    </div>
  );
}

export function BodyWeightChart({ points, unit }: { points: { date: string; value: number }[]; unit: 'kg' | 'lbs' }) {
  if (points.length < 2) return <ChartEmpty text="Trage mindestens zwei Messungen ein, um einen Verlauf zu sehen." />;
  return (
    <div className="h-52" role="img" aria-label="Körpergewichtsverlauf">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          {grid}
          <XAxis dataKey="date" tickFormatter={shortDate} {...axis} minTickGap={16} />
          <YAxis {...axis} domain={['auto', 'auto']} />
          <Tooltip {...tooltipStyle} labelFormatter={(l) => new Date(String(l)).toLocaleDateString('de-DE')} formatter={(v) => [`${Number(v).toLocaleString('de-DE')} ${unit}`, 'Körpergewicht']} />
          <Line type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={2} dot={{ r: 4, fill: 'var(--primary)', stroke: 'var(--surface)', strokeWidth: 2 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
