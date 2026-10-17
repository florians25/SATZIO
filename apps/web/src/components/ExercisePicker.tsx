import { EQUIPMENT_LABELS_DE, MUSCLE_GROUPS, MUSCLE_LABELS_DE, normalizeName, type ExerciseListItem, type MuscleGroup } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { qk, useExerciseList, usePerformance } from '@/lib/queries';
import { ExerciseImage } from './MuscleMap';
import { Input } from './ui/input';
import { Sheet } from './ui/sheet';

/** Übungsauswahl als Bottom Sheet: Suche, Muskelfilter, Favoriten & zuletzt trainierte zuerst. */
export function ExercisePicker({
  open,
  onOpenChange,
  onSelect,
  title = 'Übung hinzufügen',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSelect: (ex: ExerciseListItem) => void;
  title?: string;
}) {
  const { data = [], isLoading } = useExerciseList();
  const { map: perf } = usePerformance();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'fav' | null>(null);
  const [creating, setCreating] = useState(false);
  const qc = useQueryClient();

  const list = useMemo(() => {
    const nq = normalizeName(q);
    let items = data;
    if (nq) {
      items = items.filter((e) => [e.nameDe, e.nameEn ?? '', ...e.aliases].some((n) => normalizeName(n).includes(nq)));
    }
    if (muscle === 'fav') items = items.filter((e) => e.isFavorite);
    else if (muscle) items = items.filter((e) => e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle));
    const recentRank = (e: ExerciseListItem) => {
      const p = perf.get(e.id);
      return p ? new Date(p.recent[0]?.performedAt ?? 0).getTime() : 0;
    };
    return [...items].sort((a, b) => {
      if (nq) {
        const sa = normalizeName(a.nameDe).startsWith(nq) ? 1 : 0;
        const sb = normalizeName(b.nameDe).startsWith(nq) ? 1 : 0;
        if (sa !== sb) return sb - sa;
      }
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      const ra = recentRank(a);
      const rb = recentRank(b);
      if (ra !== rb) return rb - ra;
      return a.nameDe.localeCompare(b.nameDe, 'de');
    });
  }, [data, q, muscle, perf]);

  const createCustom = async () => {
    setCreating(true);
    try {
      await api('/exercises', { method: 'POST', body: { nameDe: q.trim(), primaryMuscle: muscle && muscle !== 'fav' ? muscle : 'full_body', equipment: 'other' } });
      const fresh = await qc.fetchQuery({ queryKey: qk.exercises, queryFn: () => api<ExerciseListItem[]>('/exercises'), staleTime: 0 });
      const created = fresh.find((e) => e.isCustom && e.nameDe === q.trim());
      if (created) {
        onSelect(created);
        setQ('');
      }
    } catch (e) {
      toast.error(errorMessage(e, 'Eigene Übungen können nur mit Verbindung angelegt werden.'));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} className="h-[92dvh]">
      <div className="sticky top-0 z-10 -mx-5 space-y-2 bg-surface px-5 pb-2">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Übung suchen …" className="pl-11" autoFocus={false} aria-label="Übung suchen" />
        </div>
        <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
          <Chip active={muscle === null} onClick={() => setMuscle(null)}>
            Alle
          </Chip>
          <Chip active={muscle === 'fav'} onClick={() => setMuscle('fav')}>
            <Star className="h-3.5 w-3.5" /> Favoriten
          </Chip>
          {MUSCLE_GROUPS.map((m) => (
            <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABELS_DE[m]}
            </Chip>
          ))}
        </div>
      </div>
      {isLoading && <p className="py-6 text-center text-muted">Lädt …</p>}
      <ul className="divide-y divide-border">
        {q.trim().length >= 2 && !list.some((e) => normalizeName(e.nameDe) === normalizeName(q)) && (
          <li>
            <button type="button" disabled={creating} onClick={() => void createCustom()} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary">
                <Plus className="h-5 w-5" />
              </span>
              <span className="flex-1">
                <span className="block font-semibold">„{q.trim()}“ als eigene Übung anlegen</span>
                <span className="text-sm text-muted">Nur für dich sichtbar</span>
              </span>
            </button>
          </li>
        )}
        {list.slice(0, 120).map((e) => (
          <li key={e.id}>
            <button type="button" onClick={() => onSelect(e)} className="flex min-h-14 w-full items-center gap-3 py-2 text-left">
              <ExerciseImage primary={e.primaryMuscle} secondary={e.secondaryMuscles} imageUrl={e.imageUrl} className="h-11 w-11 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{e.nameDe}</span>
                  {e.isFavorite && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                </span>
                <span className="block truncate text-sm text-muted">
                  {MUSCLE_LABELS_DE[e.primaryMuscle]} · {EQUIPMENT_LABELS_DE[e.equipment]}
                  {e.isCustom && ' · Eigene'}
                  {perf.has(e.id) && ' · zuletzt trainiert'}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!isLoading && list.length === 0 && q.trim().length < 2 && <p className="py-6 text-center text-muted">Keine Übungen gefunden.</p>}
    </Sheet>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex h-9 shrink-0 items-center gap-1 rounded-full border px-3 text-sm font-medium transition',
        active ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2 text-muted',
      )}
    >
      {children}
    </button>
  );
}
