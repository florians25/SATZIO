import { GOALS, GOAL_LABELS_DE, LEVELS, LEVEL_LABELS_DE, toKg, fromKg, type ProfileUpdateInput, type UserView } from '@satzio/shared';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { Sheet } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { parseDecimal } from '@satzio/shared';

const sel = 'h-12 w-full rounded-2xl border border-border bg-surface-2 px-3 text-base';

export function EditProfileSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const unit = user.settings.unit;
  const [f, setF] = useState({ displayName: '', username: '', goal: '', level: '', days: '', height: '', target: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    const p = user.profile;
    setF({
      displayName: p.displayName ?? '',
      username: user.username,
      goal: p.goal ?? '',
      level: p.level ?? '',
      days: p.trainingDaysPerWeek === null ? '' : String(p.trainingDaysPerWeek),
      height: p.heightCm?.toString().replace('.', ',') ?? '',
      target: p.targetWeightKg ? String(fromKg(p.targetWeightKg, unit)).replace('.', ',') : '',
    });
  }, [open, user, unit]);

  const save = async () => {
    setBusy(true);
    try {
      const target = parseDecimal(f.target);
      const body: ProfileUpdateInput = {
        displayName: f.displayName.trim() || null,
        username: f.username.trim(),
        goal: (f.goal || null) as ProfileUpdateInput['goal'],
        level: (f.level || null) as ProfileUpdateInput['level'],
        trainingDaysPerWeek: f.days === '' ? null : Number(f.days),
        heightCm: parseDecimal(f.height),
        targetWeightKg: target === null ? null : toKg(target, unit),
      };
      setUser(await api<UserView>('/users/me/profile', { method: 'PATCH', body }));
      toast.success('Profil gespeichert');
      onOpenChange(false);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Profil" footer={<Button block size="lg" loading={busy} onClick={() => void save()}>Speichern</Button>}>
      <div className="space-y-3">
        <div>
          <Label htmlFor="dn">Anzeigename</Label>
          <Input id="dn" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="un">Benutzername</Label>
          <Input id="un" value={f.username} autoCapitalize="none" onChange={(e) => setF({ ...f, username: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="goal">Ziel</Label>
            <select id="goal" className={sel} value={f.goal} onChange={(e) => setF({ ...f, goal: e.target.value })}>
              <option value="">–</option>
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABELS_DE[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="lvl">Erfahrung</Label>
            <select id="lvl" className={sel} value={f.level} onChange={(e) => setF({ ...f, level: e.target.value })}>
              <option value="">–</option>
              {LEVELS.map((g) => (
                <option key={g} value={g}>
                  {LEVEL_LABELS_DE[g]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="days">Trainingstage/Woche</Label>
            <select id="days" className={sel} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })}>
              <option value="">–</option>
              {[2, 3, 4, 5, 6].map((d) => (
                <option key={d} value={d}>
                  {d} Tage
                </option>
              ))}
              <option value="0">Flexibel</option>
            </select>
          </div>
          <div>
            <Label htmlFor="h">Größe (cm, optional)</Label>
            <Input id="h" inputMode="decimal" value={f.height} onChange={(e) => setF({ ...f, height: e.target.value })} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="t">Zielgewicht ({unit}, optional)</Label>
            <Input id="t" inputMode="decimal" value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} />
          </div>
        </div>
        <p className="text-xs text-muted">Alle Körperangaben sind freiwillig. Dein aktuelles Körpergewicht pflegst du unter „Körpergewicht & Maße“.</p>
      </div>
    </Sheet>
  );
}
