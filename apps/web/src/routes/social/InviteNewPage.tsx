import type { InviteView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Check, UserPlus } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui/card';
import { Input, Label, Textarea } from '@/components/ui/input';
import { api, errorMessage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { socialKeys, useFriends, useToday } from '@/lib/queries';
import { localDay, nameOf } from '@/lib/social';
import { Avatar } from './parts';

/** Nächste volle Stunde (Datum rollt ggf. auf morgen). */
function defaultStart(): { date: string; time: string } {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return { date: localDay(d), time: `${String(d.getHours()).padStart(2, '0')}:00` };
}

/** Lokales Datum + Uhrzeit → ISO (UTC). */
export function toIso(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}

export default function InviteNewPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const friends = useFriends();
  const today = useToday();
  const plan = today.data?.plan ?? null;
  const suggestedDay = today.data?.assignment.type === 'workout' ? (today.data.assignment as { day: { id: string } }).day.id : null;

  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => defaultStart().date);
  const [time, setTime] = useState(() => defaultStart().time);
  const [location, setLocation] = useState('');
  const [note, setNote] = useState('');
  const [dayId, setDayId] = useState<string | null | undefined>(undefined);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(params.get('friend') ? [params.get('friend')!] : []));
  const [busy, setBusy] = useState(false);

  const effectiveDayId = dayId === undefined ? suggestedDay : dayId;
  const day = useMemo(() => plan?.days.find((d) => d.id === effectiveDayId) ?? null, [plan, effectiveDayId]);
  const list = friends.data?.friends ?? [];

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const submit = async () => {
    const startsAt = toIso(date, time);
    if (!startsAt) {
      toast.error('Bitte Datum und Uhrzeit angeben.');
      return;
    }
    if (selected.size === 0) {
      toast.error('Bitte mindestens eine Person einladen.');
      return;
    }
    setBusy(true);
    try {
      const inv = await api<InviteView>('/invites', {
        method: 'POST',
        body: {
          ...(title.trim() ? { title: title.trim() } : {}),
          startsAt,
          location: location.trim() || null,
          note: note.trim() || null,
          planDayId: day?.id ?? null,
          friendIds: [...selected],
        },
      });
      qc.setQueryData(socialKeys.invite(inv.id), inv);
      await qc.invalidateQueries({ queryKey: socialKeys.invites });
      toast.success('Einladung verschickt');
      navigate(`/invites/${inv.id}`, { replace: true });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Training planen" back />
      <form
        className="space-y-5 px-4 pb-10"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <Label htmlFor="invite-title">Titel</Label>
          <Input id="invite-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={day?.name ?? 'Gemeinsames Training'} maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="invite-date">Datum</Label>
            <Input id="invite-date" type="date" value={date} min={localDay(new Date())} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <Label htmlFor="invite-time">Uhrzeit</Label>
            <Input id="invite-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required />
          </div>
        </div>
        <div>
          <Label htmlFor="invite-location">Ort (optional)</Label>
          <Input id="invite-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="z. B. FitX Innenstadt" maxLength={120} />
        </div>

        {plan && plan.days.length > 0 && (
          <section>
            <SectionTitle>Workout teilen (optional)</SectionTitle>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Trainingstag">
              <DayChip selected={!day} onClick={() => setDayId(null)}>
                Ohne Plan
              </DayChip>
              {plan.days.map((d) => (
                <DayChip key={d.id} selected={day?.id === d.id} onClick={() => setDayId(d.id)}>
                  {d.name}
                </DayChip>
              ))}
            </div>
            {day && <p className="mt-2 px-1 text-xs text-muted">{day.exercises.length} Übungen aus „{plan.name}“ – alle trainieren dasselbe Workout. Deine Gewichte werden nicht geteilt.</p>}
          </section>
        )}

        <section>
          <SectionTitle>Wen lädst du ein?</SectionTitle>
          {friends.isLoading && <Skeleton className="h-20 rounded-3xl" />}
          {friends.data && list.length === 0 && (
            <Card>
              <EmptyState
                icon={<UserPlus className="h-10 w-10" />}
                title="Noch keine Freunde"
                text="Du kannst nur Freunde einladen."
                action={
                  <Button asChild variant="secondary">
                    <Link to="/social?tab=friends">Freunde hinzufügen</Link>
                  </Button>
                }
              />
            </Card>
          )}
          {list.length > 0 && (
            <Card className="divide-y divide-border overflow-hidden">
              {list.map((f) => {
                const on = selected.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() => toggle(f.id)}
                    className="flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-surface-2"
                  >
                    <Avatar user={f} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{nameOf(f)}</span>
                      <span className="block truncate text-sm text-muted">@{f.username}</span>
                    </span>
                    <span className={cn('grid h-6 w-6 place-items-center rounded-md border-2', on ? 'border-primary bg-primary text-primary-fg' : 'border-border')}>
                      {on && <Check className="h-4 w-4" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </Card>
          )}
        </section>

        <div>
          <Label htmlFor="invite-note">Notiz (optional)</Label>
          <Textarea id="invite-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="z. B. Danach noch Kaffee?" maxLength={1000} className="min-h-20" />
        </div>

        <Button type="submit" size="lg" block loading={busy} disabled={selected.size === 0}>
          Einladung senden{selected.size > 0 ? ` (${selected.size})` : ''}
        </Button>
      </form>
    </div>
  );
}

function DayChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'min-h-11 rounded-2xl border px-4 text-sm font-semibold transition',
        selected ? 'border-primary bg-primary/12 text-primary' : 'border-border bg-surface text-text hover:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}
