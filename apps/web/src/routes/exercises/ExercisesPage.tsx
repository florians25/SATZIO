import { EQUIPMENT, EQUIPMENT_LABELS_DE, MUSCLE_GROUPS, MUSCLE_LABELS_DE, normalizeName, type Equipment, type MuscleGroup } from '@satzio/shared';
import { Plus, Search, SlidersHorizontal, Star } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ExerciseImage } from '@/components/MuscleMap';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { Input } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/cn';
import { useExerciseList } from '@/lib/queries';

export default function ExercisesPage() {
  const { data = [], isLoading } = useExerciseList();
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'all' | 'fav' | 'own'>('all');
  const [muscle, setMuscle] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [filters, setFilters] = useState(false);

  const list = useMemo(() => {
    const nq = normalizeName(q);
    return data.filter((e) => {
      if (tab === 'fav' && !e.isFavorite) return false;
      if (tab === 'own' && !e.isCustom) return false;
      if (muscle && e.primaryMuscle !== muscle && !e.secondaryMuscles.includes(muscle)) return false;
      if (equipment && e.equipment !== equipment) return false;
      if (nq && ![e.nameDe, e.nameEn ?? '', ...e.aliases].some((n) => normalizeName(n).includes(nq))) return false;
      return true;
    });
  }, [data, q, tab, muscle, equipment]);

  const activeFilters = (muscle ? 1 : 0) + (equipment ? 1 : 0);

  return (
    <div>
      <PageHeader
        large
        title="Übungen"
        subtitle={`${data.length} Übungen`}
        right={
          <Button asChild size="icon" variant="ghost" aria-label="Eigene Übung erstellen">
            <Link to="/exercises/new">
              <Plus className="h-6 w-6" />
            </Link>
          </Button>
        }
      />
      <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 space-y-2 bg-bg/95 px-4 pb-2 backdrop-blur">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Suchen, z. B. Bankdrücken" className="pl-11" aria-label="Übungen suchen" />
          </div>
          <Button variant="secondary" size="icon" className="relative h-12 w-12" onClick={() => setFilters(true)} aria-label="Filter">
            <SlidersHorizontal className="h-5 w-5" />
            {activeFilters > 0 && <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-primary text-[11px] font-bold text-primary-fg">{activeFilters}</span>}
          </Button>
        </div>
        <Segmented
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'all', label: 'Alle' },
            { value: 'fav', label: 'Favoriten' },
            { value: 'own', label: 'Eigene' },
          ]}
        />
      </div>
      <div className="px-4">
        {isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        )}
        {!isLoading && list.length === 0 && (
          <EmptyState
            title="Keine Übungen gefunden"
            text={tab === 'fav' ? 'Markiere Übungen mit dem Stern als Favorit.' : 'Passe Suche oder Filter an – oder lege eine eigene Übung an.'}
            action={
              <Button asChild variant="secondary">
                <Link to={`/exercises/new${q ? `?name=${encodeURIComponent(q)}` : ''}`}>Eigene Übung erstellen</Link>
              </Button>
            }
          />
        )}
        <ul className="divide-y divide-border">
          {list.map((e) => (
            <li key={e.id}>
              <Link to={`/exercises/${e.id}`} className="flex min-h-16 items-center gap-3 py-2">
                <ExerciseImage primary={e.primaryMuscle} secondary={e.secondaryMuscles} imageUrl={e.imageUrl} className="h-12 w-12 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <span className="truncate">{e.nameDe}</span>
                    {e.isFavorite && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                  </p>
                  <p className="truncate text-sm text-muted">
                    {MUSCLE_LABELS_DE[e.primaryMuscle]} · {EQUIPMENT_LABELS_DE[e.equipment]}
                    {e.isCustom && ' · Eigene'}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <Sheet
        open={filters}
        onOpenChange={setFilters}
        title="Filter"
        footer={
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => { setMuscle(null); setEquipment(null); }}>
              Zurücksetzen
            </Button>
            <Button onClick={() => setFilters(false)}>{list.length} anzeigen</Button>
          </div>
        }
      >
        <p className="mb-2 text-sm font-medium text-muted">Muskelgruppe</p>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {MUSCLE_GROUPS.map((m) => (
            <FilterChip key={m} active={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
              {MUSCLE_LABELS_DE[m]}
            </FilterChip>
          ))}
        </div>
        <p className="mb-2 text-sm font-medium text-muted">Equipment</p>
        <div className="flex flex-wrap gap-1.5">
          {EQUIPMENT.map((m) => (
            <FilterChip key={m} active={equipment === m} onClick={() => setEquipment(equipment === m ? null : m)}>
              {EQUIPMENT_LABELS_DE[m]}
            </FilterChip>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('h-10 rounded-full border px-3.5 text-sm font-medium', active ? 'border-primary bg-primary text-primary-fg' : 'border-border bg-surface-2 text-muted')}
    >
      {children}
    </button>
  );
}
