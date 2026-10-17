import type { InviteListItem, ParticipantStatus, PublicUserView } from '@satzio/shared';
import { CalendarClock, ChevronRight, MapPin, Users } from 'lucide-react';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { fmtTime } from '@/lib/format';
import { isToday, nameOf } from '@/lib/social';

export function Avatar({ user, size = 40, className }: { user: Pick<PublicUserView, 'displayName' | 'username' | 'avatarUrl'>; size?: number; className?: string }) {
  return (
    <span
      className={cn('grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 font-bold text-primary', className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      aria-hidden
    >
      {user.avatarUrl ? <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" /> : nameOf(user).slice(0, 1).toUpperCase()}
    </span>
  );
}

export const STATUS_LABEL: Record<ParticipantStatus, string> = {
  invited: 'Eingeladen',
  accepted: 'Zugesagt',
  declined: 'Abgesagt',
  maybe: 'Vielleicht',
  requested: 'Möchte teilnehmen',
  rejected: 'Abgelehnt',
};

const STATUS_TONE: Record<ParticipantStatus, 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
  invited: 'default',
  accepted: 'success',
  declined: 'error',
  maybe: 'warning',
  requested: 'primary',
  rejected: 'error',
};

export function StatusBadge({ status }: { status: ParticipantStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>;
}

export function fmtInviteWhen(iso: string): string {
  const d = new Date(iso);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const day = isToday(iso)
    ? 'Heute'
    : d.toDateString() === tomorrow.toDateString()
      ? 'Morgen'
      : d.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${day}, ${fmtTime(d)} Uhr`;
}

export function InviteRow({ invite }: { invite: InviteListItem }) {
  const cancelled = invite.status === 'cancelled';
  const others = invite.acceptedNames.length ? `mit ${invite.acceptedNames.join(', ')}` : invite.isHost ? `${invite.counts.invited + invite.counts.maybe} offen` : `von ${nameOf(invite.host)}`;
  return (
    <Link to={`/invites/${invite.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 transition hover:bg-surface-2 active:bg-surface-3">
      <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary', cancelled && 'bg-surface-2 text-muted')}>
        <CalendarClock className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate font-semibold', cancelled && 'text-muted line-through')}>{invite.title}</span>
        <span className="flex items-center gap-1.5 truncate text-sm text-muted">
          {fmtInviteWhen(invite.startsAt)}
          {invite.location && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{invite.location}</span>
            </>
          )}
        </span>
        <span className="flex items-center gap-1 truncate text-xs text-muted">
          <Users className="h-3.5 w-3.5 shrink-0" /> {others}
        </span>
      </span>
      {cancelled ? <Badge tone="error">Abgesagt</Badge> : invite.isHost ? <Badge tone="primary">Gastgeber</Badge> : <StatusBadge status={invite.myStatus} />}
      <ChevronRight className="h-5 w-5 shrink-0 text-muted" />
    </Link>
  );
}

export function relTime(iso: string, serverNow?: string): string {
  const now = serverNow ? new Date(serverNow).getTime() : Date.now();
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return 'gerade eben';
  if (s < 60) return `vor ${s} s`;
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  return fmtTime(iso);
}
