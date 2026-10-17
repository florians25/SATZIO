import type { FriendRequestResult, FriendSearchResult, FriendView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Check, Copy, Link2, MoreHorizontal, RefreshCw, Search, Share2, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui/card';
import { Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/controls';
import { Input, Label } from '@/components/ui/input';
import { ConfirmSheet, Sheet, SheetAction } from '@/components/ui/sheet';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { fmtRelativeDay } from '@/lib/format';
import { socialKeys, useFriendCode, useFriends, useInvites, useUpdateSettings } from '@/lib/queries';
import { appUrl, nameOf, shareLink } from '@/lib/social';
import { Avatar, InviteRow } from './parts';

export default function SocialPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') === 'friends' ? 'friends' : 'invites';
  const friends = useFriends();
  const invites = useInvites();
  const incoming = friends.data?.incoming.length ?? 0;
  const openInvites = (invites.data ?? []).filter((i) => i.status === 'scheduled' && !i.isHost && (i.myStatus === 'invited' || i.myStatus === 'maybe')).length;

  return (
    <div>
      <PageHeader title="Freunde & Training" back="/profile" />
      <div className="px-4 pb-8">
        <Tabs value={tab} onValueChange={(v) => setParams(v === 'friends' ? { tab: 'friends' } : {}, { replace: true })}>
          <TabsList className="mb-4">
            <TabsTrigger value="invites">
              Einladungen {openInvites > 0 && <Badge tone="primary" className="ml-1">{openInvites}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="friends">
              Freunde {incoming > 0 && <Badge tone="primary" className="ml-1">{incoming}</Badge>}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="invites">
            <InvitesTab />
          </TabsContent>
          <TabsContent value="friends">
            <FriendsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function InvitesTab() {
  const invites = useInvites();
  const friends = useFriends();
  const all = invites.data ?? [];
  const cutoff = Date.now() - 6 * 3600_000;
  const upcoming = all.filter((i) => new Date(i.startsAt).getTime() >= cutoff && i.myStatus !== 'declined');
  const past = all.filter((i) => !upcoming.includes(i)).reverse();
  const hasFriends = (friends.data?.friends.length ?? 0) > 0;

  return (
    <div className="space-y-5">
      <Button asChild size="lg" block>
        <Link to="/invites/new">
          <CalendarPlus className="h-5 w-5" /> Training planen
        </Link>
      </Button>
      {!hasFriends && friends.data && (
        <p className="px-1 text-sm text-muted">Füge zuerst Freunde hinzu, um sie zum gemeinsamen Training einzuladen.</p>
      )}
      {invites.isLoading && <Skeleton className="h-24 rounded-3xl" />}
      {invites.data && all.length === 0 && (
        <EmptyState icon={<Users className="h-10 w-10" />} title="Noch keine Einladungen" text="Plane ein Training und lade Freunde ein – ihr seht euren Fortschritt dann live." />
      )}
      {upcoming.length > 0 && (
        <section>
          <SectionTitle>Geplant</SectionTitle>
          <Card className="divide-y divide-border overflow-hidden">
            {upcoming.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
          </Card>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <SectionTitle>Vergangen & abgesagt</SectionTitle>
          <Card className="divide-y divide-border overflow-hidden">
            {past.map((i) => (
              <InviteRow key={i.id} invite={i} />
            ))}
          </Card>
        </section>
      )}
    </div>
  );
}

function FriendsTab() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const friends = useFriends();
  const [add, setAdd] = useState(false);
  const [menu, setMenu] = useState<FriendView | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<FriendView | null>(null);
  const data = friends.data;
  const refresh = () => qc.invalidateQueries({ queryKey: socialKeys.friends });

  const act = async (path: string, method: 'POST' | 'DELETE', success?: string) => {
    try {
      await api(path, { method });
      if (success) toast.success(success);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      await refresh();
    }
  };

  return (
    <div className="space-y-5">
      <Button size="lg" block onClick={() => setAdd(true)}>
        <UserPlus className="h-5 w-5" /> Freund hinzufügen
      </Button>

      {data && data.incoming.length > 0 && (
        <section>
          <SectionTitle>Anfragen</SectionTitle>
          <Card className="divide-y divide-border overflow-hidden">
            {data.incoming.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={r.user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{nameOf(r.user)}</p>
                  <p className="truncate text-sm text-muted">@{r.user.username}</p>
                </div>
                <Button size="icon" variant="secondary" aria-label={`Anfrage von ${nameOf(r.user)} ablehnen`} onClick={() => void act(`/friends/requests/${r.id}/decline`, 'POST')}>
                  <X className="h-5 w-5" />
                </Button>
                <Button size="icon" aria-label={`Anfrage von ${nameOf(r.user)} annehmen`} onClick={() => void act(`/friends/requests/${r.id}/accept`, 'POST', `Du bist jetzt mit ${nameOf(r.user)} befreundet.`)}>
                  <Check className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <section>
        <SectionTitle>Freunde {data ? `(${data.friends.length})` : ''}</SectionTitle>
        {friends.isLoading && <Skeleton className="h-20 rounded-3xl" />}
        {data && data.friends.length === 0 && (
          <Card>
            <EmptyState icon={<Users className="h-10 w-10" />} title="Noch keine Freunde" text="Füge Freunde per Benutzername oder mit deinem persönlichen Einladungslink hinzu." />
          </Card>
        )}
        {data && data.friends.length > 0 && (
          <Card className="divide-y divide-border overflow-hidden">
            {data.friends.map((f) => (
              <div key={f.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={f} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{nameOf(f)}</p>
                  <p className="truncate text-sm text-muted">
                    @{f.username}
                    {f.activity && (
                      <>
                        {' · '}
                        {f.activity.lastWorkoutAt ? `zuletzt trainiert: ${fmtRelativeDay(f.activity.lastWorkoutAt)}` : 'noch kein Training'}
                        {f.activity.streakWeeks > 0 ? ` · ${f.activity.streakWeeks} Wo. Serie` : ''}
                      </>
                    )}
                  </p>
                </div>
                <Button size="icon" variant="ghost" aria-label={`Optionen für ${nameOf(f)}`} onClick={() => setMenu(f)}>
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>
            ))}
          </Card>
        )}
      </section>

      {data && data.outgoing.length > 0 && (
        <section>
          <SectionTitle>Gesendete Anfragen</SectionTitle>
          <Card className="divide-y divide-border overflow-hidden">
            {data.outgoing.map((r) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={r.user} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{nameOf(r.user)}</p>
                  <p className="truncate text-sm text-muted">Ausstehend · @{r.user.username}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => void act(`/friends/requests/${r.id}`, 'DELETE')}>
                  Zurückziehen
                </Button>
              </div>
            ))}
          </Card>
        </section>
      )}

      <PrivacySection />

      <AddFriendSheet open={add} onOpenChange={setAdd} />
      <Sheet open={!!menu} onOpenChange={(o) => !o && setMenu(null)} title={menu ? nameOf(menu) : ''}>
        {menu && (
          <>
            <SheetAction
              icon={<CalendarPlus />}
              onClick={() => {
                setMenu(null);
                navigate(`/invites/new?friend=${menu.id}`);
              }}
            >
              Zum Training einladen
            </SheetAction>
            <SheetAction
              icon={<UserMinus />}
              tone="danger"
              onClick={() => {
                setConfirmRemove(menu);
                setMenu(null);
              }}
            >
              Freund entfernen
            </SheetAction>
          </>
        )}
      </Sheet>
      <ConfirmSheet
        open={!!confirmRemove}
        onOpenChange={(o) => !o && setConfirmRemove(null)}
        title={`${confirmRemove ? nameOf(confirmRemove) : ''} entfernen?`}
        text="Ihr seht danach keine gemeinsamen Aktivitäten mehr. Bestehende Einladungen bleiben erhalten."
        confirmLabel="Entfernen"
        onConfirm={() => confirmRemove && void act(`/friends/${confirmRemove.id}`, 'DELETE')}
      />
    </div>
  );
}

function PrivacySection() {
  const settings = useAuth((s) => s.user?.settings);
  const update = useUpdateSettings();
  if (!settings) return null;
  return (
    <section>
      <SectionTitle>Privatsphäre</SectionTitle>
      <Card className="divide-y divide-border">
        <label className="flex min-h-16 items-center gap-3 px-4 py-3">
          <span className="flex-1">
            <span className="block font-medium">Anfragen per Benutzername</span>
            <span className="block text-sm text-muted">Über deinen persönlichen Einladungslink kann man dich immer anfragen.</span>
          </span>
          <Switch checked={settings.allowFriendRequests} onCheckedChange={(v) => update.mutate({ allowFriendRequests: v })} aria-label="Anfragen per Benutzername erlauben" />
        </label>
        <label className="flex min-h-16 items-center gap-3 px-4 py-3">
          <span className="flex-1">
            <span className="block font-medium">Aktivität mit Freunden teilen</span>
            <span className="block text-sm text-muted">Freunde sehen dein letztes Trainingsdatum und deine Serie – keine Gewichte oder Körperdaten.</span>
          </span>
          <Switch checked={settings.shareActivityWithFriends} onCheckedChange={(v) => update.mutate({ shareActivityWithFriends: v })} aria-label="Aktivität mit Freunden teilen" />
        </label>
      </Card>
      <p className="mt-2 px-1 text-xs text-muted">
        Im gemeinsamen Training sehen nur Teilnehmende mit Zusage deinen Live-Fortschritt (aktuelle Übung, Sätze) – und nur für dieses Training.
      </p>
    </section>
  );
}

export function AddFriendSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [username, setUsername] = useState('');
  const [result, setResult] = useState<FriendSearchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const code = useFriendCode(open);
  const link = code.data ? appUrl(`/friends/add/${code.data.code}`, code.data.url) : null;

  const search = async () => {
    const q = username.trim();
    if (q.length < 3) return;
    setBusy(true);
    try {
      setResult(await api<FriendSearchResult>(`/friends/search?username=${encodeURIComponent(q)}`));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    if (!result?.user) return;
    setBusy(true);
    try {
      const r = await api<FriendRequestResult>('/friends/requests', { method: 'POST', body: { username: result.user.username } });
      toast.success(r.status === 'accepted' ? `Du bist jetzt mit ${nameOf(r.user)} befreundet.` : `Anfrage an ${nameOf(r.user)} gesendet.`);
      setResult({ ...result, relation: r.status === 'accepted' ? 'friend' : 'outgoing', canRequest: false });
      await qc.invalidateQueries({ queryKey: socialKeys.friends });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    try {
      const next = await api<{ code: string; url: string }>('/friends/code/regenerate', { method: 'POST' });
      qc.setQueryData(socialKeys.friendCode, next);
      toast.success('Neuer Link erstellt. Der alte Link funktioniert nicht mehr.');
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const relationText: Record<string, string> = {
    self: 'Das bist du.',
    friend: 'Ihr seid bereits befreundet.',
    outgoing: 'Anfrage gesendet.',
    incoming: 'Diese Person hat dir eine Anfrage geschickt.',
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) {
          setResult(null);
          setUsername('');
        }
      }}
      title="Freund hinzufügen"
    >
      <form
        className="space-y-2"
        onSubmit={(e) => {
          e.preventDefault();
          void search();
        }}
      >
        <Label htmlFor="friend-username">Exakter Benutzername</Label>
        <div className="flex gap-2">
          <Input
            id="friend-username"
            value={username}
            onChange={(e) => {
              setUsername(e.target.value);
              setResult(null);
            }}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="z. B. max_mustermann"
            maxLength={30}
          />
          <Button type="submit" size="icon" aria-label="Suchen" loading={busy && !result} disabled={username.trim().length < 3}>
            <Search className="h-5 w-5" />
          </Button>
        </div>
      </form>
      {result && !result.user && <p className="mt-3 text-sm text-muted">Kein Konto mit genau diesem Benutzernamen gefunden.</p>}
      {result?.user && (
        <Card className="mt-3 flex items-center gap-3 p-3">
          <Avatar user={result.user} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{nameOf(result.user)}</p>
            <p className="truncate text-sm text-muted">
              {result.relation && relationText[result.relation] ? relationText[result.relation] : result.canRequest ? `@${result.user.username}` : 'Nimmt keine Anfragen per Benutzername an.'}
            </p>
          </div>
          {result.canRequest && (
            <Button size="sm" onClick={() => void send()} loading={busy}>
              {result.relation === 'incoming' ? 'Annehmen' : 'Anfrage senden'}
            </Button>
          )}
        </Card>
      )}

      <div className="mt-6 border-t border-border pt-4">
        <p className="font-semibold">Dein Einladungslink</p>
        <p className="text-sm text-muted">Wer den Link öffnet, kann dir eine Freundschaftsanfrage senden – auch ohne deinen Benutzernamen.</p>
        <div className="mt-3 flex items-center gap-2 rounded-2xl border border-border bg-surface-2 px-3 py-2">
          <Link2 className="h-4 w-4 shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate text-sm" data-testid="friend-link">
            {link ?? 'Lade …'}
          </span>
          {link && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Link kopieren"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  toast.success('Link kopiert');
                } catch {
                  toast.message(link);
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          )}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Button variant="secondary" disabled={!link} onClick={() => link && void shareLink(link, 'SATZIO', 'Lass uns zusammen trainieren! Füge mich in SATZIO hinzu:')}>
            <Share2 className="h-4 w-4" /> Teilen
          </Button>
          <Button variant="secondary" onClick={() => void regenerate()}>
            <RefreshCw className="h-4 w-4" /> Neuer Link
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
