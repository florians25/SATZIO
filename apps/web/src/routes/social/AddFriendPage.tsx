import type { FriendCodePreview, FriendRequestResult } from '@satzio/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, EmptyState, Skeleton } from '@/components/ui/card';
import { api, errorMessage } from '@/lib/api';
import { socialKeys } from '@/lib/queries';
import { nameOf } from '@/lib/social';
import { Avatar } from './parts';

/** Persönlicher Einladungslink eines anderen Nutzers: Vorschau + Anfrage senden. */
export default function AddFriendPage() {
  const { code = '' } = useParams<{ code: string }>();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const q = useQuery({ queryKey: ['friend-code-preview', code], queryFn: () => api<FriendCodePreview>(`/friends/code/${encodeURIComponent(code)}`), retry: false });
  const pv = q.data;

  const send = async () => {
    setBusy(true);
    try {
      const r = await api<FriendRequestResult>('/friends/requests', { method: 'POST', body: { code } });
      toast.success(r.status === 'accepted' ? `Du bist jetzt mit ${nameOf(r.user)} befreundet.` : `Anfrage an ${nameOf(r.user)} gesendet.`);
      await Promise.all([qc.invalidateQueries({ queryKey: socialKeys.friends }), q.refetch()]);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const hint: Record<string, string> = {
    self: 'Das ist dein eigener Einladungslink.',
    friend: 'Ihr seid bereits befreundet.',
    outgoing: 'Deine Anfrage ist gesendet.',
    incoming: 'Diese Person hat dir bereits eine Anfrage geschickt.',
    none: 'Möchtest du eine Freundschaftsanfrage senden?',
  };

  return (
    <div>
      <PageHeader title="Freund hinzufügen" back="/social?tab=friends" />
      <div className="px-4">
        {q.isLoading && <Skeleton className="h-48 rounded-3xl" />}
        {q.isError && (
          <EmptyState icon={<UserPlus className="h-10 w-10" />} title="Link ungültig" text={errorMessage(q.error)} action={<Button asChild variant="secondary"><Link to="/social?tab=friends">Zu deinen Freunden</Link></Button>} />
        )}
        {pv && (
          <Card className="flex flex-col items-center p-6 text-center">
            <Avatar user={pv.user} size={72} />
            <p className="mt-3 text-xl font-extrabold">{nameOf(pv.user)}</p>
            <p className="text-sm text-muted">@{pv.user.username}</p>
            <p className="mt-3 text-sm text-muted">{hint[pv.relation]}</p>
            {(pv.relation === 'none' || pv.relation === 'incoming') && (
              <Button size="lg" block className="mt-4" loading={busy} onClick={() => void send()}>
                <UserPlus className="h-5 w-5" /> {pv.relation === 'incoming' ? 'Anfrage annehmen' : 'Freundschaftsanfrage senden'}
              </Button>
            )}
            {pv.relation === 'friend' && (
              <Button asChild size="lg" block className="mt-4">
                <Link to={`/invites/new?friend=${pv.user.id}`}>Zum Training einladen</Link>
              </Button>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
