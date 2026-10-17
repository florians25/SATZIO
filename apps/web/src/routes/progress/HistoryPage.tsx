import { ChevronLeft, ChevronRight, Copy, Search } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Skeleton } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDate, fmtVolume } from '@/lib/format';
import { useCalendar, useHistory } from '@/lib/queries';
import { createWorkout, useActiveWorkouts } from '@/lib/workout';
import type { WorkoutSessionView } from '@satzio/shared';

export default function HistoryPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'calendar' ? 'calendar' : 'list';
  return (
    <div>
      <PageHeader title="Trainingshistorie" back="/progress" />
      <div className="space-y-3 px-4 pb-8">
        <Segmented
          size="sm"
          value={view}
          onChange={(v) => setParams(v === 'calendar' ? { view: 'calendar' } : {}, { replace: true })}
          options={[
            { value: 'list', label: 'Liste' },
            { value: 'calendar', label: 'Kalender' },
          ]}
        />
        {view === 'list' ? <ListView /> : <CalendarView />}
      </div>
    </div>
  );
}

function ListView() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const history = useHistory({ search: debounced || undefined, from: from || undefined, to: to ? `${to}T23:59:59` : undefined, limit: '100' });
  const active = useActiveWorkouts();
  const navigate = useNavigate();

  const timer = useRef<number | undefined>(undefined);
  const onSearch = (v: string) => {
    setQ(v);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDebounced(v), 300);
  };

  const repeat = async (id: string) => {
    if (active[0]) return navigate(`/workout/${active[0].id}`);
    try {
      const src = await api<WorkoutSessionView>(`/workouts/${id}`);
      const w = await createWorkout({ name: src.name, planId: src.planId, copyFrom: src });
      navigate(`/workout/${w.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  return (
    <>
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
        <Input value={q} onChange={(e) => onSearch(e.target.value)} placeholder="Übung, Training oder Notiz suchen" className="pl-11" aria-label="Historie durchsuchen" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Von" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Bis" />
      </div>
      {history.isLoading && <Skeleton className="h-40" />}
      {history.data?.length === 0 && <EmptyState title="Keine Trainings gefunden" text={debounced || from || to ? 'Passe Suche oder Zeitraum an.' : 'Abgeschlossene Trainings erscheinen hier.'} />}
      <div className="space-y-2">
        {history.data?.map((w) => (
          <Card key={w.id} className="p-4">
            <Link to={`/workout/${w.id}`} className="block">
              <div className="flex justify-between gap-2">
                <p className="font-bold">{w.name}</p>
                <p className="text-sm text-muted">{fmtDate(w.startedAt, { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
              </div>
              <p className="mt-1 text-sm text-muted">
                {w.durationMinutes} Min. · {w.exerciseCount} Übungen · {w.completedSetCount} Sätze · {fmtVolume(w.volumeKg, unit)}
              </p>
              <p className="mt-1 truncate text-sm">{w.exerciseNames.join(', ')}</p>
            </Link>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void repeat(w.id)}>
                <Copy className="h-4 w-4" /> Erneut starten
              </Button>
              <Button size="sm" variant="ghost" asChild>
                <Link to={`/workout/${w.id}/summary`}>Zusammenfassung</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function CalendarView() {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const cal = useCalendar(month);
  const [y, m] = month.split('-').map(Number);
  const first = new Date(y, m - 1, 1);
  const days = new Date(y, m, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  const byDate = useMemo(() => {
    const map = new Map<string, { id: string; name: string }[]>();
    for (const w of cal.data ?? []) map.set(w.date, [...(map.get(w.date) ?? []), w]);
    return map;
  }, [cal.data]);
  const [selected, setSelected] = useState<string | null>(null);
  const shift = (d: number) => {
    const n = new Date(y, m - 1 + d, 1);
    setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
    setSelected(null);
  };
  const sel = selected ? byDate.get(selected) ?? [] : [];
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <Button size="icon-sm" variant="ghost" onClick={() => shift(-1)} aria-label="Vorheriger Monat">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <p className="font-semibold">{first.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}</p>
        <Button size="icon-sm" variant="ghost" onClick={() => shift(1)} aria-label="Nächster Monat">
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: offset }, (_, i) => (
          <span key={`e${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, '0')}`;
          const has = byDate.has(date);
          return (
            <button
              key={date}
              type="button"
              disabled={!has}
              onClick={() => setSelected(date)}
              className={cn(
                'grid aspect-square place-items-center rounded-xl text-sm font-semibold',
                has ? 'bg-primary text-primary-fg' : 'text-muted',
                selected === date && 'ring-2 ring-text',
              )}
              aria-label={`${i + 1}.${has ? ' Training' : ''}`}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-sm text-muted">{cal.data?.length ?? 0} Trainings in diesem Monat</p>
      {sel.map((w) => (
        <Link key={w.id} to={`/workout/${w.id}`} className="mt-2 flex items-center justify-between rounded-xl bg-surface-2 p-3 font-medium">
          {w.name} <ChevronRight className="h-4 w-4" />
        </Link>
      ))}
    </Card>
  );
}
