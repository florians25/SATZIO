import type { InviteListItem, InviteResponse, InviteView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronRight, Play, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import { fmtTime } from '@/lib/format';
import { socialKeys, useExerciseMap, useInvites, usePerformance } from '@/lib/queries';
import { isOpenInvite, isTodayAccepted, nameOf, startInviteWorkout } from '@/lib/social';
import { useActiveWorkouts } from '@/lib/workout';
import { fmtInviteWhen } from './parts';

/** Kompakte Karte auf „Heute“: offene Einladungen (inline zusagen/absagen) und heutige Verabredungen. */
export function TodayInvitesCard() {
  const invites = useInvites();
  const all = invites.data ?? [];
  const open = all.filter(isOpenInvite);
  const today = all.filter(isTodayAccepted);
  if (!open.length && !today.length) return null;
  return (
    <Card className="overflow-hidden" data-testid="today-invites">
      <Link to="/social" className="flex items-center gap-2 px-4 pb-1 pt-3">
        <Users className="h-4 w-4 text-primary" />
        <span className="flex-1 text-xs font-bold uppercase tracking-[0.14em] text-muted">Einladungen</span>
        {open.length > 0 && <Badge tone="primary">{open.length}</Badge>}
        <ChevronRight className="h-4 w-4 text-muted" />
      </Link>
      <div className="divide-y divide-border">
        {today.map((i) => (
          <TodayRow key={i.id} invite={i} />
        ))}
        {open.slice(0, 3).map((i) => (
          <OpenRow key={i.id} invite={i} />
        ))}
      </div>
    </Card>
  );
}

function withWhom(i: InviteListItem): string {
  const names = i.isHost ? i.acceptedNames : [nameOf(i.host), ...i.acceptedNames.filter((n) => n !== nameOf(i.host))];
  return names.length ? names.slice(0, 2).join(' & ') + (names.length > 2 ? ` +${names.length - 2}` : '') : 'deinen Freunden';
}

function TodayRow({ invite }: { invite: InviteListItem }) {
  const navigate = useNavigate();
  const active = useActiveWorkouts();
  const { map: performance } = usePerformance();
  const exercises = useExerciseMap();
  const [busy, setBusy] = useState(false);
  const running = invite.mySessionId ? active.find((a) => a.id === invite.mySessionId) : undefined;

  const start = async () => {
    if (running) {
      navigate(`/workout/${running.id}`);
      return;
    }
    setBusy(true);
    try {
      const id = await startInviteWorkout(invite.id, { performance, exercises, activeSessionId: active[0]?.id ?? null });
      navigate(`/workout/${id}`);
    } catch (e) {
      toast.error(errorMessage(e, 'Training konnte nicht gestartet werden.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/invites/${invite.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-semibold">
          Heute mit {withWhom(invite)} um {fmtTime(invite.startsAt)}
        </span>
        <span className="block truncate text-sm text-muted">{invite.title}{invite.location ? ` · ${invite.location}` : ''}</span>
      </Link>
      <Button size="sm" onClick={() => void start()} loading={busy}>
        <Play className="h-4 w-4" /> {running ? 'Weiter' : 'Starten'}
      </Button>
    </div>
  );
}

function OpenRow({ invite }: { invite: InviteListItem }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<InviteResponse | null>(null);
  const respond = async (status: InviteResponse) => {
    setBusy(status);
    try {
      const v = await api<InviteView>(`/invites/${invite.id}/respond`, { method: 'POST', body: { status } });
      qc.setQueryData(socialKeys.invite(invite.id), v);
      await qc.invalidateQueries({ queryKey: socialKeys.invites });
      toast.success(status === 'accepted' ? 'Zugesagt' : 'Abgesagt');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/invites/${invite.id}`} className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{invite.title}</span>
        <span className="block truncate text-sm text-muted">
          {nameOf(invite.host)} · {fmtInviteWhen(invite.startsAt)}
        </span>
      </Link>
      <Button size="icon" variant="secondary" aria-label={`${invite.title} absagen`} loading={busy === 'declined'} onClick={() => void respond('declined')}>
        <X className="h-5 w-5" />
      </Button>
      <Button size="icon" aria-label={`${invite.title} zusagen`} loading={busy === 'accepted'} onClick={() => void respond('accepted')}>
        <Check className="h-5 w-5" />
      </Button>
    </div>
  );
}
