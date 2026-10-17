import { formatRepRange, type InviteResponse, type InviteView } from '@satzio/shared';
import { useQueryClient } from '@tanstack/react-query';
import { Ban, CalendarClock, Check, MapPin, Pencil, Play, Share2, StickyNote, Trophy, UserPlus, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Badge, Card, EmptyState, SectionTitle, Skeleton } from '@/components/ui/card';
import { Segmented } from '@/components/ui/controls';
import { Input, Label, Textarea } from '@/components/ui/input';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { ApiError, api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { fmtDuration, fmtVolume } from '@/lib/format';
import { socialKeys, useExerciseMap, useFriends, useInvite, useInviteLive, usePerformance } from '@/lib/queries';
import { appUrl, localDay, nameOf, shareLink, startInviteWorkout } from '@/lib/social';
import { useActiveWorkouts } from '@/lib/workout';
import { GroupLivePanel } from './GroupLivePanel';
import { toIso } from './InviteNewPage';
import { Avatar, fmtInviteWhen, StatusBadge } from './parts';

export default function InviteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const q = useInvite(id);
  const inv = q.data;

  if (q.isLoading) {
    return (
      <div>
        <PageHeader title="Einladung" back="/social" />
        <div className="space-y-3 px-4">
          <Skeleton className="h-40 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </div>
    );
  }
  if (!inv) {
    const notFound = q.error instanceof ApiError && q.error.status === 404;
    return (
      <div>
        <PageHeader title="Einladung" back="/social" />
        <EmptyState
          icon={<CalendarClock className="h-10 w-10" />}
          title={notFound ? 'Einladung nicht gefunden' : 'Keine Verbindung'}
          text={notFound ? 'Vielleicht wurde sie gelöscht oder du bist nicht eingeladen.' : errorMessage(q.error)}
          action={
            <Button asChild variant="secondary">
              <Link to="/social">Zur Übersicht</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <InviteDetail inv={inv} />;
}

function InviteDetail({ inv }: { inv: InviteView }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unit = useAuth((s) => s.user?.settings.unit ?? 'kg');
  const active = useActiveWorkouts();
  const { map: performance } = usePerformance();
  const exercises = useExerciseMap();
  const [starting, setStarting] = useState(false);
  const [edit, setEdit] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const cancelled = inv.status === 'cancelled';
  const accepted = inv.myStatus === 'accepted';
  const live = useInviteLive(inv.id, accepted && !cancelled);
  const finished = (live.data?.participants ?? []).filter((p) => p.summary);
  const mySession = inv.mySessionId ? active.find((a) => a.id === inv.mySessionId) : undefined;
  const requests = inv.participants.filter((p) => p.status === 'requested');
  const others = inv.participants.filter((p) => p.status !== 'requested');

  const refresh = async (next?: InviteView) => {
    if (next) qc.setQueryData(socialKeys.invite(inv.id), next);
    await Promise.all([
      qc.invalidateQueries({ queryKey: socialKeys.invites }),
      qc.invalidateQueries({ queryKey: socialKeys.live(inv.id) }),
      next ? Promise.resolve() : qc.invalidateQueries({ queryKey: socialKeys.invite(inv.id) }),
    ]);
  };

  const respond = async (status: InviteResponse) => {
    try {
      await refresh(await api<InviteView>(`/invites/${inv.id}/respond`, { method: 'POST', body: { status } }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const start = async () => {
    if (mySession) {
      navigate(`/workout/${mySession.id}`);
      return;
    }
    setStarting(true);
    try {
      const sessionId = await startInviteWorkout(inv, { performance, exercises, activeSessionId: active[0]?.id ?? null });
      void refresh();
      navigate(`/workout/${sessionId}`);
    } catch (e) {
      toast.error(errorMessage(e, 'Training konnte nicht gestartet werden.'));
    } finally {
      setStarting(false);
    }
  };

  const decide = async (userId: string, approve: boolean) => {
    try {
      await refresh(await api<InviteView>(`/invites/${inv.id}/requests/${userId}`, { method: 'POST', body: { approve } }));
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const isPast = new Date(inv.startsAt).getTime() < Date.now() - 12 * 3600_000;

  return (
    <div>
      <PageHeader
        title={inv.title}
        subtitle={fmtInviteWhen(inv.startsAt)}
        back="/social"
        right={
          inv.isHost && !cancelled ? (
            <Button size="icon" variant="ghost" aria-label="Einladung bearbeiten" onClick={() => setEdit(true)}>
              <Pencil className="h-5 w-5" />
            </Button>
          ) : undefined
        }
      />
      <div className="space-y-5 px-4 pb-10">
        <Card className="p-5">
          {cancelled && (
            <Badge tone="error" className="mb-2">
              Abgesagt
            </Badge>
          )}
          <p className={cn('text-2xl font-extrabold leading-tight', cancelled && 'text-muted line-through')}>{inv.title}</p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
            <CalendarClock className="h-4 w-4" /> {fmtInviteWhen(inv.startsAt)}
          </p>
          {inv.location && (
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <MapPin className="h-4 w-4" /> {inv.location}
            </p>
          )}
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <Avatar user={inv.host} size={16} /> {inv.isHost ? 'Du lädst ein' : `Eingeladen von ${nameOf(inv.host)}`}
          </p>
          {inv.note && (
            <p className="mt-3 flex gap-2 rounded-2xl bg-surface-2 p-3 text-sm">
              <StickyNote className="h-4 w-4 shrink-0 text-muted" /> <span className="whitespace-pre-wrap">{inv.note}</span>
            </p>
          )}

          {!cancelled && !inv.isHost && (
            <div className="mt-4">
              <Segmented<InviteResponse | 'invited'>
                ariaLabel="Deine Antwort"
                value={inv.myStatus === 'accepted' || inv.myStatus === 'declined' || inv.myStatus === 'maybe' ? inv.myStatus : 'invited'}
                onChange={(v) => v !== 'invited' && void respond(v)}
                options={[
                  { value: 'accepted', label: 'Zusagen' },
                  { value: 'maybe', label: 'Vielleicht' },
                  { value: 'declined', label: 'Absagen' },
                ]}
              />
            </div>
          )}

          {!cancelled && !isPast && inv.myStatus !== 'declined' && (
            <Button size="lg" block className="mt-4" onClick={() => void start()} loading={starting}>
              <Play className="h-5 w-5" /> {mySession ? 'Zum Training' : 'Training starten'}
            </Button>
          )}
          {inv.isHost && !cancelled && inv.shareUrl && (
            <Button
              variant="secondary"
              block
              className="mt-2"
              onClick={() => void shareLink(appUrl(`/invites/join/${inv.shareUrl!.split('/').pop()}`, inv.shareUrl), inv.title, `Trainierst du mit? ${inv.title}, ${fmtInviteWhen(inv.startsAt)}`)}
            >
              <Share2 className="h-4 w-4" /> Einladungslink teilen
            </Button>
          )}
        </Card>

        {accepted && !cancelled && <GroupLivePanel inviteId={inv.id} defaultExpanded showSelf />}

        {finished.length > 0 && (
          <section>
            <SectionTitle>Gruppen-Zusammenfassung</SectionTitle>
            <Card className="divide-y divide-border overflow-hidden">
              {finished.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar user={p} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">
                      {nameOf(p)}
                      {p.isMe && <span className="font-normal text-muted"> (du)</span>}
                    </p>
                    <p className="text-sm text-muted">
                      {p.summary!.completedSets} Sätze · {p.summary!.totalReps} Wdh. · {fmtDuration(p.summary!.durationMinutes)}
                    </p>
                  </div>
                  <span className="text-right">
                    <span className="block font-bold tabular">{fmtVolume(p.summary!.volumeKg, unit)}</span>
                    <span className="block text-xs text-muted">Volumen</span>
                  </span>
                </div>
              ))}
            </Card>
            {finished.length > 1 && (
              <p className="mt-2 flex items-center gap-1.5 px-1 text-sm text-muted">
                <Trophy className="h-4 w-4 text-primary" /> Zusammen {fmtVolume(finished.reduce((s, p) => s + (p.summary?.volumeKg ?? 0), 0), unit)} bewegt.
              </p>
            )}
          </section>
        )}

        {inv.isHost && requests.length > 0 && (
          <section>
            <SectionTitle>Beitrittsanfragen</SectionTitle>
            <Card className="divide-y divide-border overflow-hidden">
              {requests.map((p) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <Avatar user={p} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{nameOf(p)}</p>
                    <p className="truncate text-sm text-muted">@{p.username} · über Link</p>
                  </div>
                  <Button size="icon" variant="secondary" aria-label={`${nameOf(p)} ablehnen`} onClick={() => void decide(p.id, false)}>
                    <X className="h-5 w-5" />
                  </Button>
                  <Button size="icon" aria-label={`${nameOf(p)} bestätigen`} onClick={() => void decide(p.id, true)}>
                    <Check className="h-5 w-5" />
                  </Button>
                </div>
              ))}
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>
            Teilnehmende · {inv.counts.accepted} zugesagt
          </SectionTitle>
          <Card className="divide-y divide-border overflow-hidden">
            {others.map((p) => (
              <div key={p.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5" data-testid="invite-participant">
                <Avatar user={p} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {nameOf(p)}
                    {p.isHost && <span className="text-sm font-normal text-muted"> · Gastgeber</span>}
                  </p>
                  <p className="truncate text-xs text-muted">@{p.username}{p.started ? ' · trainiert' : ''}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </Card>
        </section>

        {inv.plan && (
          <section>
            <SectionTitle>Workout · {inv.plan.dayName}</SectionTitle>
            <Card className="divide-y divide-border overflow-hidden">
              {inv.plan.exercises.map((e, i) => (
                <div key={i} className="px-4 py-3">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-sm text-muted">
                    {e.sets.filter((s) => s.type !== 'warmup').length} Sätze
                    {e.sets.length > 0 && ` · ${formatRepRange(e.sets[e.sets.length - 1].repsMin, e.sets[e.sets.length - 1].repsMax)} Wdh.`}
                  </p>
                </div>
              ))}
            </Card>
          </section>
        )}

        {inv.isHost && !cancelled && (
          <Button variant="danger" block onClick={() => setConfirmCancel(true)}>
            <Ban className="h-4 w-4" /> Training absagen
          </Button>
        )}
      </div>

      {inv.isHost && <EditInviteSheet inv={inv} open={edit} onOpenChange={setEdit} onSaved={(v) => void refresh(v)} />}
      <ConfirmSheet
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title="Training absagen?"
        text="Alle Eingeladenen sehen, dass das Training abgesagt ist."
        confirmLabel="Absagen"
        onConfirm={async () => {
          try {
            await refresh(await api<InviteView>(`/invites/${inv.id}/cancel`, { method: 'POST' }));
            toast.success('Training abgesagt');
          } catch (e) {
            toast.error(errorMessage(e));
          }
        }}
      />
    </div>
  );
}

function EditInviteSheet({ inv, open, onOpenChange, onSaved }: { inv: InviteView; open: boolean; onOpenChange: (o: boolean) => void; onSaved: (v: InviteView) => void }) {
  const friends = useFriends();
  const start = new Date(inv.startsAt);
  const [title, setTitle] = useState(inv.title);
  const [date, setDate] = useState(localDay(start));
  const [time, setTime] = useState(`${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`);
  const [location, setLocation] = useState(inv.location ?? '');
  const [note, setNote] = useState(inv.note ?? '');
  const [add, setAdd] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const invitedIds = useMemo(() => new Set(inv.participants.map((p) => p.id)), [inv.participants]);
  const candidates = (friends.data?.friends ?? []).filter((f) => !invitedIds.has(f.id));

  const save = async () => {
    const startsAt = toIso(date, time);
    if (!startsAt || !title.trim()) {
      toast.error('Bitte Titel, Datum und Uhrzeit angeben.');
      return;
    }
    setBusy(true);
    try {
      const v = await api<InviteView>(`/invites/${inv.id}`, {
        method: 'PATCH',
        body: { title: title.trim(), startsAt, location: location.trim() || null, note: note.trim() || null, ...(add.size ? { addFriendIds: [...add] } : {}) },
      });
      onSaved(v);
      setAdd(new Set());
      onOpenChange(false);
      toast.success('Gespeichert');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Einladung bearbeiten"
      footer={
        <Button size="lg" block loading={busy} onClick={() => void save()}>
          Speichern
        </Button>
      }
    >
      <div className="space-y-4">
        <div>
          <Label htmlFor="edit-title">Titel</Label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="edit-date">Datum</Label>
            <Input id="edit-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="edit-time">Uhrzeit</Label>
            <Input id="edit-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="edit-location">Ort</Label>
          <Input id="edit-location" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={120} />
        </div>
        <div>
          <Label htmlFor="edit-note">Notiz</Label>
          <Textarea id="edit-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} className="min-h-20" />
        </div>
        {candidates.length > 0 && (
          <div>
            <Label>Weitere Freunde einladen</Label>
            <div className="flex flex-wrap gap-2">
              {candidates.map((f) => {
                const on = add.has(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    onClick={() =>
                      setAdd((s) => {
                        const n = new Set(s);
                        if (n.has(f.id)) n.delete(f.id);
                        else n.add(f.id);
                        return n;
                      })
                    }
                    className={cn('flex min-h-11 items-center gap-2 rounded-2xl border px-3 text-sm font-medium', on ? 'border-primary bg-primary/12 text-primary' : 'border-border')}
                  >
                    {on ? <Check className="h-4 w-4" /> : <UserPlus className="h-4 w-4 text-muted" />} {nameOf(f)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
