import type {
  ExerciseListItem,
  ExercisePerformance,
  FriendRequestResult,
  InviteListItem,
  InviteView,
  PlanDayView,
  PublicUserView,
} from '@satzio/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { api, ApiError, isNativeApp } from './api';
import { useAuth } from './auth';
import { db, kvGet, kvSet } from './db';
import { uuid } from './ids';
import { queryClient } from './query';
import { socialKeys } from './queries';
import { createWorkout } from './workout';

/* ───────────────────────────── Anzeige-Helfer ───────────────────────────── */

export function nameOf(u: Pick<PublicUserView, 'displayName' | 'username'>): string {
  return u.displayName || u.username;
}

/** Lokaler Kalendertag (YYYY-MM-DD) eines Zeitpunkts. */
export function localDay(iso: string | Date): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isToday(iso: string): boolean {
  return localDay(iso) === localDay(new Date());
}

/** Offene Einladung: ich bin eingeladen (noch keine feste Zusage) und sie liegt nicht lange zurück. */
export function isOpenInvite(i: InviteListItem): boolean {
  return i.status === 'scheduled' && !i.isHost && (i.myStatus === 'invited' || i.myStatus === 'maybe') && new Date(i.startsAt).getTime() > Date.now() - 6 * 3600_000;
}

/** Heutige Einladung mit Zusage. */
export function isTodayAccepted(i: InviteListItem): boolean {
  return i.status === 'scheduled' && i.myStatus === 'accepted' && isToday(i.startsAt);
}

/** Öffentlicher Link der Web-App (Basis-Pfad berücksichtigt). In nativen Apps nutzt die App die Server-URL. */
export function appUrl(path: string, serverUrl?: string | null): string {
  if (isNativeApp() && serverUrl) return serverUrl;
  const base = `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/$/, '');
  return `${base}${path}`;
}

/** Teilen über das System-Menü, sonst in die Zwischenablage. */
export async function shareLink(url: string, title: string, text?: string) {
  try {
    if (navigator.share) {
      await navigator.share({ title, text, url });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link kopiert');
  } catch {
    toast.message(url);
  }
}

/* ───────────────────────────── Links vor dem Login ───────────────────────────── */

const PENDING_KEY = 'satzio-pending-social';
export type PendingSocial = { kind: 'friend'; code: string } | { kind: 'join'; token: string };

export function setPendingSocial(p: PendingSocial) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(p));
  } catch {
    /* Speicher nicht verfügbar */
  }
}

function takePendingSocial(): PendingSocial | null {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    localStorage.removeItem(PENDING_KEY);
    const p = JSON.parse(raw) as PendingSocial;
    if (p?.kind === 'friend' && typeof p.code === 'string') return p;
    if (p?.kind === 'join' && typeof p.token === 'string') return p;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Verarbeitet einen vor dem Login geöffneten Link (Freund hinzufügen / Einladung beitreten),
 * sobald der Nutzer angemeldet und das Onboarding abgeschlossen ist. Außerdem werden
 * ausstehende Verknüpfungen Training ↔ Einladung erneut versucht.
 */
export function usePendingSocial() {
  const navigate = useNavigate();
  const ready = useAuth((s) => s.status === 'authed' && !!s.user?.profile.onboardingCompleted);
  useEffect(() => {
    if (!ready) return;
    void resumePendingInviteLinks();
    const p = takePendingSocial();
    if (!p) return;
    if (p.kind === 'join') {
      navigate(`/social/join/${p.token}`);
      return;
    }
    void (async () => {
      try {
        const r = await api<FriendRequestResult>('/friends/requests', { method: 'POST', body: { code: p.code } });
        toast.success(
          r.status === 'accepted' ? `Du bist jetzt mit ${nameOf(r.user)} befreundet.` : `Freundschaftsanfrage an ${nameOf(r.user)} gesendet.`,
        );
        await queryClient.invalidateQueries({ queryKey: socialKeys.friends });
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : 'Freundschaftsanfrage konnte nicht gesendet werden.');
      }
    })();
  }, [ready, navigate]);
}

/* ───────────────────────────── Training ↔ Einladung ───────────────────────────── */

const LINKS_KEY = 'invite-links-pending';
const MAP_KEY = 'invite-session-map';
type PendingLink = { inviteId: string; sessionId: string; attempts: number; createdAt: number };

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const inFlight = new Set<string>();
const MAX_AGE_MS = 24 * 3600_000;

async function readLinks(): Promise<Record<string, PendingLink>> {
  return (await kvGet<Record<string, PendingLink>>(LINKS_KEY)) ?? {};
}

async function writeLink(sessionId: string, value: PendingLink | null) {
  const all = await readLinks();
  if (value) all[sessionId] = value;
  else delete all[sessionId];
  await kvSet(LINKS_KEY, all);
}

async function rememberSession(sessionId: string, inviteId: string) {
  const map = (await kvGet<Record<string, string>>(MAP_KEY)) ?? {};
  map[sessionId] = inviteId;
  // nur die letzten 30 Verknüpfungen behalten
  const entries = Object.entries(map).slice(-30);
  await kvSet(MAP_KEY, Object.fromEntries(entries));
  queryClient.setQueryData(socialKeys.forSession(sessionId), inviteId);
}

function backoff(attempts: number) {
  return Math.min(60_000, 1_500 * 2 ** Math.min(attempts, 6));
}

function schedule(sessionId: string, delay: number) {
  const prev = timers.get(sessionId);
  if (prev) clearTimeout(prev);
  timers.set(
    sessionId,
    setTimeout(() => {
      timers.delete(sessionId);
      void attemptLink(sessionId);
    }, delay),
  );
}

/**
 * Verknüpft ein lokal erstelltes Training mit einer Einladung. Der Server antwortet
 * mit 404 SESSION_NOT_SYNCED, bis die Sync-Engine das Training hochgeladen hat –
 * dann wird mit Backoff erneut versucht (auch nach Neustart der App, via IndexedDB).
 */
export async function queueInviteLink(inviteId: string, sessionId: string) {
  await rememberSession(sessionId, inviteId);
  await writeLink(sessionId, { inviteId, sessionId, attempts: 0, createdAt: Date.now() });
  schedule(sessionId, 800);
}

async function attemptLink(sessionId: string) {
  if (inFlight.has(sessionId)) return;
  const link = (await readLinks())[sessionId];
  if (!link) return;
  if (Date.now() - link.createdAt > MAX_AGE_MS) {
    await writeLink(sessionId, null);
    return;
  }
  inFlight.add(sessionId);
  try {
    // Solange das Training noch in der Outbox liegt, ist ein Versuch zwecklos.
    const pendingCreate = await db.outbox.where('sessionId').equals(sessionId).filter((o) => o.type === 'session.create').count().catch(() => 0);
    if (pendingCreate > 0) throw new ApiError(404, 'SESSION_NOT_SYNCED', 'noch nicht synchronisiert');
    await api(`/invites/${link.inviteId}/link`, { method: 'POST', body: { sessionId } });
    await writeLink(sessionId, null);
    void queryClient.invalidateQueries({ queryKey: socialKeys.invite(link.inviteId) });
    void queryClient.invalidateQueries({ queryKey: socialKeys.live(link.inviteId) });
    void queryClient.invalidateQueries({ queryKey: socialKeys.invites });
  } catch (e) {
    const retry = !(e instanceof ApiError) || e.isNetwork || e.status >= 500 || e.status === 429 || e.code === 'SESSION_NOT_SYNCED' || e.status === 401;
    if (retry) {
      const next = { ...link, attempts: link.attempts + 1 };
      await writeLink(sessionId, next);
      schedule(sessionId, backoff(next.attempts));
    } else {
      // Einladung abgesagt/gelöscht oder kein Zugriff mehr → nicht weiter versuchen
      await writeLink(sessionId, null);
    }
  } finally {
    inFlight.delete(sessionId);
  }
}

/** Ausstehende Verknüpfungen (z. B. nach Neustart) erneut anstoßen. */
export async function resumePendingInviteLinks() {
  const all = await readLinks();
  for (const id of Object.keys(all)) if (!timers.has(id)) schedule(id, 500);
}

/** Wandelt den Schnappschuss einer Einladung in einen Trainingstag für createWorkout() um. */
export function inviteDay(invite: InviteView, exercises?: Map<string, ExerciseListItem>): PlanDayView | null {
  const plan = invite.plan;
  if (!plan) return null;
  const list = exercises ? [...exercises.values()] : [];
  return {
    id: plan.planDayId ?? uuid(),
    name: plan.dayName,
    order: 0,
    weekday: null,
    notes: null,
    exercises: plan.exercises.map((e) => {
      // Bibliotheksübungen haben überall dieselbe ID; eigene Übungen des Gastgebers per Name zuordnen.
      const own = e.exerciseId ? null : list.find((x) => x.nameDe.toLowerCase() === e.name.toLowerCase());
      return {
        id: uuid(),
        exerciseId: e.exerciseId ?? own?.id ?? uuid(),
        exerciseName: e.name,
        exerciseSlug: e.slug ?? own?.slug ?? '',
        primaryMuscle: e.primaryMuscle,
        equipment: e.equipment,
        restSeconds: e.restSeconds,
        notes: e.notes,
        supersetGroup: e.supersetGroup,
        weightStepKg: e.weightStepKg,
        sets: e.sets.map((s) => ({ id: uuid(), type: s.type, repsMin: s.repsMin, repsMax: s.repsMax, targetWeightKg: null })),
      };
    }),
  };
}

export interface StartInviteContext {
  performance?: Map<string, ExercisePerformance>;
  exercises?: Map<string, ExerciseListItem>;
  /** Bereits laufendes Training (wird stattdessen verknüpft). */
  activeSessionId?: string | null;
}

/**
 * „Training starten“ aus einer Einladung: erstellt das eigene Training lokal (offline-fähig)
 * mit dem geteilten Trainingstag und verknüpft es im Hintergrund mit der Einladung.
 * Gibt die ID des Trainings zurück.
 */
export async function startInviteWorkout(inviteOrId: InviteView | string, ctx: StartInviteContext = {}): Promise<string> {
  const invite =
    typeof inviteOrId === 'string'
      ? await queryClient.fetchQuery({ queryKey: socialKeys.invite(inviteOrId), queryFn: () => api<InviteView>(`/invites/${inviteOrId}`) })
      : inviteOrId;
  if (invite.status === 'cancelled') throw new Error('Die Einladung wurde abgesagt.');
  if (invite.mySessionId) {
    const local = await db.workouts.get(invite.mySessionId).catch(() => undefined);
    if (local && local.status !== 'completed') return local.id;
  }
  if (ctx.activeSessionId) {
    await queueInviteLink(invite.id, ctx.activeSessionId);
    toast.message('Dein laufendes Training ist jetzt mit der Einladung verknüpft.');
    return ctx.activeSessionId;
  }
  const day = inviteDay(invite, ctx.exercises);
  const w = await createWorkout({
    name: invite.title,
    planId: invite.plan?.planId ?? null,
    day,
    performance: ctx.performance,
    exercises: ctx.exercises,
  });
  await queueInviteLink(invite.id, w.id);
  return w.id;
}

/**
 * Einladung, mit der das (lokale oder synchronisierte) Training verknüpft ist –
 * für die Live-Gruppenansicht auf der Trainingsseite. Liefert die Einladungs-ID oder null.
 */
export function useActiveInviteForSession(sessionId: string | null | undefined): string | null {
  useEffect(() => {
    void resumePendingInviteLinks();
  }, []);
  const q = useQuery({
    queryKey: socialKeys.forSession(sessionId ?? ''),
    enabled: !!sessionId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const map = (await kvGet<Record<string, string>>(MAP_KEY)) ?? {};
      if (map[sessionId!]) return map[sessionId!];
      try {
        const r = await api<{ inviteId: string }>(`/invites/for-session/${sessionId}`);
        await rememberSession(sessionId!, r.inviteId);
        return r.inviteId;
      } catch {
        return null;
      }
    },
  });
  return q.data ?? null;
}
