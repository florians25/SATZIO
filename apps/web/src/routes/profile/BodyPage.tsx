import { fromKg, parseDecimal, toKg, type BodyWeightEntryView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtDate, fmtWeight, todayKey } from '@/lib/format';
import { qk, useBodyWeight } from '@/lib/queries';
import { BodyWeightChart } from '../progress/charts';

export default function BodyPage() {
  const user = useAuth((s) => s.user)!;
  const unit = user.settings.unit;
  const q = useBodyWeight();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ date: todayKey(), weight: '', waist: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const entries = q.data ?? [];
  const points = entries
    .filter((e) => e.weightKg !== null)
    .map((e) => ({ date: e.measuredAt, value: fromKg(e.weightKg!, unit) }))
    .reverse();
  const latest = entries.find((e) => e.weightKg !== null);
  const target = user.profile.targetWeightKg;

  const save = async () => {
    setBusy(true);
    try {
      const w = parseDecimal(f.weight);
      const waist = parseDecimal(f.waist);
      await api<BodyWeightEntryView>('/body-weight', {
        method: 'POST',
        body: {
          measuredAt: new Date(`${f.date}T08:00:00`).toISOString(),
          weightKg: w === null ? null : toKg(w, unit),
          measurements: waist !== null ? { waistCm: waist } : null,
          notes: f.notes.trim() || null,
        },
      });
      await qc.invalidateQueries({ queryKey: qk.body });
      setOpen(false);
      setF({ date: todayKey(), weight: '', waist: '', notes: '' });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Körpergewicht & Maße" back right={<Button size="icon" variant="ghost" onClick={() => setOpen(true)} aria-label="Eintrag hinzufügen"><Plus className="h-6 w-6" /></Button>} />
      <div className="space-y-4 px-4 pb-10">
        <p className="text-sm text-muted">Alle Angaben sind freiwillig. SATZIO gibt keine Kalorien- oder Gesundheitsempfehlungen.</p>
        <div className="grid grid-cols-2 gap-2">
          <Card className="p-4">
            <p className="text-2xl font-extrabold tabular">{latest ? `${fmtWeight(latest.weightKg, unit)} ${unit}` : '–'}</p>
            <p className="text-xs text-muted">Aktuell</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-extrabold tabular">{target ? `${fmtWeight(target, unit)} ${unit}` : '–'}</p>
            <p className="text-xs text-muted">Ziel (optional, im Profil)</p>
          </Card>
        </div>
        <Card className="p-3">{q.isLoading ? <Skeleton className="h-52" /> : <BodyWeightChart points={points} unit={unit} />}</Card>
        <section>
          <SectionTitle>Einträge</SectionTitle>
          {entries.length === 0 && !q.isLoading && <EmptyState title="Noch keine Einträge" action={<Button onClick={() => setOpen(true)}>Ersten Eintrag hinzufügen</Button>} />}
          <Card className="divide-y divide-border">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold tabular">
                    {e.weightKg !== null ? `${fmtWeight(e.weightKg, unit)} ${unit}` : '–'}
                    {e.measurements?.waistCm ? <span className="font-normal text-muted"> · Taille {e.measurements.waistCm} cm</span> : null}
                  </p>
                  <p className="text-sm text-muted">
                    {fmtDate(e.measuredAt)}
                    {e.notes && ` · ${e.notes}`}
                  </p>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Eintrag löschen"
                  onClick={async () => {
                    await api(`/body-weight/${e.id}`, { method: 'DELETE' });
                    void qc.invalidateQueries({ queryKey: qk.body });
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </Card>
        </section>
      </div>
      <Sheet open={open} onOpenChange={setOpen} title="Neuer Eintrag" footer={<Button block size="lg" loading={busy} disabled={!f.weight && !f.waist} onClick={() => void save()}>Speichern</Button>}>
        <div className="space-y-3">
          <div>
            <Label htmlFor="d">Datum</Label>
            <Input id="d" type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="w">Gewicht ({unit})</Label>
              <Input id="w" inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="wa">Taille (cm, optional)</Label>
              <Input id="wa" inputMode="decimal" value={f.waist} onChange={(e) => setF({ ...f, waist: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="n">Notiz</Label>
            <Input id="n" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
          </div>
        </div>
      </Sheet>
    </div>
  );
}
