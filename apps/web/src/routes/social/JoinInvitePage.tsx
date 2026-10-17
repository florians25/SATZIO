import type { InviteJoinPreview } from '@satzio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, MapPin, Users } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Skeleton } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import { socialKeys } from '@/lib/queries';
import { nameOf } from '@/lib/social';
import { Avatar, fmtInviteWhen } from './parts';

/**
 * Teilen-Link einer Einladung: Nicht-Freunde sehen nur Titel, Zeit, Ort und Gastgeber
 * und können die Teilnahme anfragen – die einladende Person bestätigt.
 */
export default function JoinInvitePage() {
  const { token = '' } = useParams<{ token: string }>();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: socialKeys.join(token), queryFn: () => api<InviteJoinPreview>(`/invites/join/${encodeURIComponent(token)}`), retry: false });
  const pv = q.data;

  if (pv?.inviteId && pv.myStatus !== 'requested') return <Navigate to={`/invites/${pv.inviteId}`} replace />;

  const join = async () => {
    setBusy(true);
    try {
      const next = await api<InviteJoinPreview>(`/invites/join/${encodeURIComponent(token)}`, { method: 'POST' });
      qc.setQueryData(socialKeys.join(token), next);
      toast.success('Anfrage gesendet. Du wirst benachrichtigt, sobald sie bestätigt ist.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <PageHeader title="Einladung" back="/social" />
      <div className="px-4">
        {q.isLoading && <Skeleton className="h-56 rounded-3xl" />}
        {q.isError && (
          <EmptyState icon={<CalendarClock className="h-10 w-10" />} title="Einladung nicht gefunden" text="Der Link ist ungültig oder die Einladung wurde gelöscht." action={<Button asChild variant="secondary"><Link to="/">Zur Startseite</Link></Button>} />
        )}
        {pv && (
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <Avatar user={pv.host} size={44} />
              <p className="text-sm text-muted">
                <span className="font-semibold text-text">{nameOf(pv.host)}</span> lädt zum gemeinsamen Training ein
              </p>
            </div>
            <p className="mt-4 text-2xl font-extrabold">{pv.title}</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <CalendarClock className="h-4 w-4" /> {fmtInviteWhen(pv.startsAt)}
            </p>
            {pv.location && (
              <p className="flex items-center gap-1.5 text-sm text-muted">
                <MapPin className="h-4 w-4" /> {pv.location}
              </p>
            )}
            <p className="flex items-center gap-1.5 text-sm text-muted">
              <Users className="h-4 w-4" /> {pv.participantCount} {pv.participantCount === 1 ? 'Zusage' : 'Zusagen'}
            </p>
            {pv.status === 'cancelled' && <p className="mt-4 font-semibold text-error">Dieses Training wurde abgesagt.</p>}
            {pv.myStatus === 'requested' && <p className="mt-4 rounded-2xl bg-surface-2 p-3 text-sm">Deine Anfrage ist gesendet. {nameOf(pv.host)} muss sie noch bestätigen.</p>}
            {pv.myStatus === 'rejected' && <p className="mt-4 text-sm text-muted">Eine Teilnahme ist leider nicht möglich.</p>}
            {pv.joinable && (
              <Button size="lg" block className="mt-5" loading={busy} onClick={() => void join()}>
                Teilnahme anfragen
              </Button>
            )}
            {!pv.joinable && !pv.myStatus && pv.status !== 'cancelled' && <p className="mt-4 text-sm text-muted">Diesem Training kann nicht mehr beigetreten werden.</p>}
            <p className="mt-4 text-xs text-muted">{nameOf(pv.host)} sieht deinen Namen und Benutzernamen. Erst nach Bestätigung siehst du die Teilnehmenden und das Workout.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
