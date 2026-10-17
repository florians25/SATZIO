import { useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronRight, ClipboardPaste, FileJson, LayoutTemplate, Plus, Star } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import { fmtRelativeDay } from '@/lib/format';
import { usePlans } from '@/lib/queries';
import type { PlanView } from '@satzio/shared';
import { createEmptyPlan } from './plan-utils';

export default function PlansPage() {
  const plans = usePlans();
  const [showArchived, setShowArchived] = useState(false);
  const archived = usePlans(true);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      const p = await createEmptyPlan('Neuer Plan', !(plans.data ?? []).some((x) => x.isActive));
      navigate(`/plans/${p.id}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const importJson = async (file: File) => {
    try {
      const body = JSON.parse(await file.text());
      const p = await api<PlanView>('/plans/import', { method: 'POST', body });
      await qc.invalidateQueries({ queryKey: ['plans'] });
      toast.success(`„${p.name}“ importiert`);
      navigate(`/plans/${p.id}`);
    } catch (e) {
      toast.error(e instanceof SyntaxError ? 'Die Datei ist kein gültiger SATZIO-Plan.' : errorMessage(e));
    }
  };

  const archivedList = (archived.data ?? []).filter((p) => p.archived);

  return (
    <div>
      <PageHeader large title="Pläne" subtitle="Deine Trainingspläne" right={<Button size="icon" variant="ghost" onClick={() => void create()} aria-label="Neuen Plan erstellen" loading={busy}>{!busy && <Plus className="h-6 w-6" />}</Button>} />
      <div className="space-y-5 px-4">
        <div className="grid grid-cols-3 gap-2">
          <QuickTile to="/plans/templates" icon={<LayoutTemplate />} label="Vorlagen" />
          <QuickTile to="/plans/import" icon={<ClipboardPaste />} label="Notizen importieren" />
          <button type="button" onClick={() => fileRef.current?.click()} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center text-xs font-semibold">
            <FileJson className="h-6 w-6 text-primary" />
            Plan-Datei importieren
          </button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && void importJson(e.target.files[0])} />
        </div>

        <section>
          <SectionTitle>Meine Pläne</SectionTitle>
          {plans.isLoading && <Skeleton className="h-20" />}
          {plans.data?.length === 0 && (
            <Card>
              <EmptyState title="Noch keine Pläne" text="Starte mit einer Vorlage, importiere deine Notizen oder erstelle einen eigenen Plan." action={<Button onClick={() => void create()}>Plan erstellen</Button>} />
            </Card>
          )}
          <div className="space-y-2">
            {plans.data?.map((p) => (
              <Link key={p.id} to={`/plans/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 font-semibold">
                    <span className="truncate">{p.name}</span>
                    {p.isFavorite && <Star className="h-4 w-4 shrink-0 fill-primary text-primary" />}
                  </p>
                  <p className="text-sm text-muted">
                    {p.dayCount} {p.dayCount === 1 ? 'Tag' : 'Tage'} · {p.exerciseCount} Übungen
                    {p.lastUsedAt && ` · zuletzt ${fmtRelativeDay(p.lastUsedAt)}`}
                  </p>
                </div>
                {p.isActive && <Badge tone="primary">Aktiv</Badge>}
                <ChevronRight className="h-5 w-5 text-muted" />
              </Link>
            ))}
          </div>
        </section>

        {archivedList.length > 0 && (
          <section>
            <button type="button" className="flex items-center gap-2 px-1 text-sm font-semibold text-muted" onClick={() => setShowArchived((v) => !v)}>
              <Archive className="h-4 w-4" /> Archiv ({archivedList.length}) {showArchived ? 'ausblenden' : 'anzeigen'}
            </button>
            {showArchived && (
              <div className="mt-2 space-y-2">
                {archivedList.map((p) => (
                  <Link key={p.id} to={`/plans/${p.id}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 opacity-70">
                    <span className="flex-1 truncate font-semibold">{p.name}</span>
                    <ChevronRight className="h-5 w-5 text-muted" />
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

function QuickTile({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-center text-xs font-semibold [&>svg]:h-6 [&>svg]:w-6 [&>svg]:text-primary">
      {icon}
      {label}
    </Link>
  );
}
