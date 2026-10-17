import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type InviteParticipantStatus } from '@prisma/client';
import {
  totalReps,
  totalVolume,
  workoutDurationMinutes,
  type InviteCreateInput,
  type InviteJoinPreview,
  type InviteListItem,
  type InviteLiveParticipant,
  type InviteLiveView,
  type InvitePlanSnapshot,
  type InviteResponse,
  type InviteUpdateInput,
  type InviteView,
} from '@satzio/shared';
import { num, randomToken } from '../common/util';
import { config } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { FriendsService } from './friends.service';
import { displayName, forbidden, notFound, publicUser, publicUserSelect } from './social-util';

/** Status, mit denen eine Person die Einladung sehen darf. */
const VISIBLE: InviteParticipantStatus[] = ['invited', 'accepted', 'declined', 'maybe'];
/** Beitritt über Teilen-Link nur bis kurz nach Beginn. */
const JOIN_GRACE_MS = 6 * 3600_000;
/** Liste: vergangene Einladungen der letzten 30 Tage. */
const PAST_WINDOW_MS = 30 * 86_400_000;

const inviteInclude = {
  host: { select: publicUserSelect },
  participants: { include: { user: { select: publicUserSelect } }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TrainingInviteInclude;
type FullInvite = Prisma.TrainingInviteGetPayload<{ include: typeof inviteInclude }>;

const liveSessionInclude = {
  exercises: { orderBy: { order: 'asc' }, include: { sets: { orderBy: { order: 'asc' } } } },
} satisfies Prisma.WorkoutSessionInclude;

@Injectable()
export class InvitesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly friends: FriendsService,
  ) {}

  /* ------------------------------- Hilfsfunktionen ------------------------------- */

  /** Lädt eine Einladung, sofern der Nutzer Gastgeber oder sichtbarer Teilnehmer ist – sonst 404. */
  private async loadVisible(userId: string, id: string): Promise<FullInvite> {
    const inv = await this.prisma.trainingInvite.findFirst({
      where: { id, participants: { some: { userId, status: { in: VISIBLE } } } },
      include: inviteInclude,
    });
    if (!inv) throw notFound();
    return inv;
  }

  private async loadAsHost(userId: string, id: string): Promise<FullInvite> {
    const inv = await this.loadVisible(userId, id);
    if (inv.hostId !== userId) throw forbidden('Nur die einladende Person kann das ändern.', 'NOT_HOST');
    return inv;
  }

  private shareUrl(token: string) {
    return `${config().PUBLIC_URL.replace(/\/$/, '')}/invites/join/${token}`;
  }

  private listItem(inv: FullInvite, userId: string): InviteListItem {
    const me = inv.participants.find((p) => p.userId === userId);
    const isHost = inv.hostId === userId;
    const counts = { accepted: 0, invited: 0, maybe: 0, declined: 0, requested: 0 };
    for (const p of inv.participants) {
      if (p.status === 'rejected') continue;
      if (p.status === 'requested' && !isHost) continue;
      counts[p.status]++;
    }
    return {
      id: inv.id,
      title: inv.title,
      startsAt: inv.startsAt.toISOString(),
      location: inv.location,
      status: inv.status,
      host: publicUser(inv.host),
      isHost,
      myStatus: me?.status ?? 'invited',
      mySessionId: me?.sessionId ?? null,
      hasPlan: !!inv.planSnapshot,
      counts,
      acceptedNames: inv.participants
        .filter((p) => p.status === 'accepted' && p.userId !== userId)
        .slice(0, 4)
        .map((p) => displayName(publicUser(p.user))),
    };
  }

  private view(inv: FullInvite, userId: string): InviteView {
    const isHost = inv.hostId === userId;
    const snapshot = inv.planSnapshot as unknown as InvitePlanSnapshot | null;
    return {
      ...this.listItem(inv, userId),
      note: inv.note,
      plan: snapshot
        ? { ...snapshot, planId: isHost ? inv.planId : null, planDayId: isHost ? inv.planDayId : null }
        : null,
      participants: inv.participants
        .filter((p) => p.status !== 'rejected' && (isHost || p.status !== 'requested'))
        .map((p) => ({
          ...publicUser(p.user),
          status: p.status,
          isHost: p.userId === inv.hostId,
          respondedAt: p.respondedAt?.toISOString() ?? null,
          started: !!p.sessionId,
        })),
      shareUrl: isHost ? this.shareUrl(inv.shareToken) : null,
      createdAt: inv.createdAt.toISOString(),
      updatedAt: inv.updatedAt.toISOString(),
    };
  }

  /** Nur bestätigte Freunde dürfen eingeladen werden. */
  private async assertFriends(userId: string, ids: string[]): Promise<string[]> {
    const unique = [...new Set(ids)].filter((id) => id !== userId);
    const friends = await this.friends.friendIds(userId);
    if (unique.some((id) => !friends.has(id))) {
      throw new BadRequestException({ code: 'NOT_FRIENDS', message: 'Du kannst nur bestätigte Freunde einladen.' });
    }
    return unique;
  }

  /** Schnappschuss eines eigenen Trainingstags – ohne persönliche Zielgewichte, eigene Übungen ohne Verknüpfung. */
  private async snapshot(userId: string, planDayId: string) {
    const day = await this.prisma.workoutPlanDay.findFirst({
      where: { id: planDayId, plan: { userId } },
      include: {
        plan: { select: { id: true, name: true } },
        exercises: { orderBy: { order: 'asc' }, include: { exercise: true, sets: { orderBy: { order: 'asc' } } } },
      },
    });
    if (!day) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Trainingstag nicht gefunden.' });
    const snap: InvitePlanSnapshot = {
      planName: day.plan.name,
      dayName: day.name,
      exercises: day.exercises.map((pe) => ({
        exerciseId: pe.exercise.ownerId ? null : pe.exerciseId,
        name: pe.exercise.nameDe,
        slug: pe.exercise.ownerId ? null : pe.exercise.slug,
        primaryMuscle: pe.exercise.primaryMuscle,
        equipment: pe.exercise.equipment,
        restSeconds: pe.restSeconds,
        notes: pe.notes,
        supersetGroup: pe.supersetGroup,
        weightStepKg: num(pe.weightStepKg) ?? num(pe.exercise.weightStepKg),
        sets: pe.sets.map((s) => ({ type: s.type, repsMin: s.repsMin, repsMax: s.repsMax })),
      })),
    };
    return { snap, planId: day.plan.id, dayId: day.id, dayName: day.name };
  }

  /* ---------------------------------- Lesen ---------------------------------- */

  async list(userId: string): Promise<InviteListItem[]> {
    const rows = await this.prisma.trainingInvite.findMany({
      where: {
        participants: { some: { userId, status: { in: VISIBLE } } },
        startsAt: { gte: new Date(Date.now() - PAST_WINDOW_MS) },
      },
      include: inviteInclude,
      orderBy: { startsAt: 'asc' },
      take: 200,
    });
    return rows.map((r) => this.listItem(r, userId));
  }

  async get(userId: string, id: string): Promise<InviteView> {
    return this.view(await this.loadVisible(userId, id), userId);
  }

  /** Einladung, mit der ein eigenes Training verknüpft ist (für die Live-Ansicht im Training). */
  async forSession(userId: string, sessionId: string) {
    const p = await this.prisma.trainingInviteParticipant.findFirst({
      where: { userId, sessionId, status: 'accepted', invite: { status: 'scheduled' } },
      select: { inviteId: true },
    });
    if (!p) throw notFound();
    return { inviteId: p.inviteId };
  }

  /* --------------------------------- Schreiben -------------------------------- */

  async create(userId: string, input: InviteCreateInput): Promise<InviteView> {
    const friendIds = await this.assertFriends(userId, input.friendIds);
    if (!friendIds.length) throw new BadRequestException({ code: 'NOT_FRIENDS', message: 'Bitte mindestens eine Person einladen.' });
    const plan = input.planDayId ? await this.snapshot(userId, input.planDayId) : null;
    const now = new Date();
    const inv = await this.prisma.trainingInvite.create({
      data: {
        hostId: userId,
        title: input.title || plan?.dayName || 'Gemeinsames Training',
        startsAt: new Date(input.startsAt),
        location: input.location || null,
        note: input.note || null,
        planSnapshot: plan ? (plan.snap as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
        planId: plan?.planId ?? null,
        planDayId: plan?.dayId ?? null,
        shareToken: randomToken(18),
        participants: {
          create: [
            { userId, status: 'accepted', respondedAt: now },
            ...friendIds.map((id) => ({ userId: id, status: 'invited' as const })),
          ],
        },
      },
      include: inviteInclude,
    });
    return this.view(inv, userId);
  }

  async update(userId: string, id: string, input: InviteUpdateInput): Promise<InviteView> {
    const inv = await this.loadAsHost(userId, id);
    if (inv.status === 'cancelled') throw new ConflictException({ code: 'INVITE_CANCELLED', message: 'Die Einladung wurde abgesagt.' });
    const add = input.addFriendIds?.length ? await this.assertFriends(userId, input.addFriendIds) : [];
    await this.prisma.$transaction([
      this.prisma.trainingInvite.update({
        where: { id },
        data: {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
          ...(input.location !== undefined ? { location: input.location || null } : {}),
          ...(input.note !== undefined ? { note: input.note || null } : {}),
        },
      }),
      this.prisma.trainingInviteParticipant.createMany({
        data: add.map((uid) => ({ inviteId: id, userId: uid, status: 'invited' as const })),
        skipDuplicates: true,
      }),
    ]);
    return this.get(userId, id);
  }

  async cancel(userId: string, id: string): Promise<InviteView> {
    await this.loadAsHost(userId, id);
    await this.prisma.trainingInvite.update({ where: { id }, data: { status: 'cancelled' } });
    return this.get(userId, id);
  }

  async respond(userId: string, id: string, status: InviteResponse): Promise<InviteView> {
    const inv = await this.loadVisible(userId, id);
    if (inv.hostId === userId) throw new BadRequestException({ code: 'HOST_CANNOT_RESPOND', message: 'Als einladende Person nimmst du automatisch teil.' });
    if (inv.status === 'cancelled') throw new ConflictException({ code: 'INVITE_CANCELLED', message: 'Die Einladung wurde abgesagt.' });
    await this.prisma.trainingInviteParticipant.update({
      where: { inviteId_userId: { inviteId: id, userId } },
      data: { status, respondedAt: new Date(), ...(status === 'declined' ? { sessionId: null } : {}) },
    });
    return this.get(userId, id);
  }

  /**
   * Verknüpft ein eigenes Training mit der Einladung. Da Trainings offline erstellt
   * und asynchron synchronisiert werden, antwortet der Server mit 404 SESSION_NOT_SYNCED,
   * bis das Training auf dem Server existiert – die App wiederholt den Aufruf.
   */
  async link(userId: string, id: string, sessionId: string) {
    const inv = await this.loadVisible(userId, id);
    if (inv.status === 'cancelled') throw new ConflictException({ code: 'INVITE_CANCELLED', message: 'Die Einladung wurde abgesagt.' });
    const session = await this.prisma.workoutSession.findFirst({ where: { id: sessionId, userId }, select: { id: true } });
    if (!session) {
      throw new NotFoundException({ code: 'SESSION_NOT_SYNCED', message: 'Das Training ist noch nicht synchronisiert.' });
    }
    const me = inv.participants.find((p) => p.userId === userId)!;
    await this.prisma.trainingInviteParticipant.update({
      where: { id: me.id },
      data: { sessionId, status: 'accepted', respondedAt: me.status === 'accepted' ? me.respondedAt : new Date() },
    });
    return { linked: true, inviteId: id, sessionId };
  }

  /* ----------------------------------- Live ----------------------------------- */

  /** Minimaler Live-Fortschritt aller Zusagen mit verknüpftem Training – nur für zugesagte Teilnehmende. */
  async live(userId: string, id: string): Promise<InviteLiveView> {
    const inv = await this.loadVisible(userId, id);
    const me = inv.participants.find((p) => p.userId === userId)!;
    if (me.status !== 'accepted') {
      throw forbidden('Die Live-Ansicht ist nur für Teilnehmende sichtbar, die zugesagt haben.', 'NOT_ACCEPTED');
    }
    const accepted = inv.participants.filter((p) => p.status === 'accepted');
    const sessionIds = accepted.map((p) => p.sessionId).filter((x): x is string => !!x);
    const sessions = sessionIds.length
      ? await this.prisma.workoutSession.findMany({ where: { id: { in: sessionIds } }, include: liveSessionInclude })
      : [];
    const byId = new Map(sessions.map((s) => [s.id, s]));
    const participants: InviteLiveParticipant[] = [];
    const waiting = [];
    for (const p of accepted) {
      const s = p.sessionId ? byId.get(p.sessionId) : undefined;
      // Sicherheitsnetz: nur eigene Trainings der Person
      if (!s || s.userId !== p.userId) {
        waiting.push(publicUser(p.user));
        continue;
      }
      const sets = s.exercises.flatMap((e) => e.sets.map((x) => ({ ...x, exerciseName: e.exerciseName })));
      const done = sets.filter((x) => x.completed);
      const last = [...done].sort((a, b) => (a.completedAt?.getTime() ?? a.updatedAt.getTime()) - (b.completedAt?.getTime() ?? b.updatedAt.getTime())).at(-1);
      const current = s.status === 'completed' ? null : s.exercises.find((e) => e.sets.some((x) => !x.completed)) ?? s.exercises.at(-1) ?? null;
      const updatedAt = new Date(Math.max(s.updatedAt.getTime(), ...sets.map((x) => x.updatedAt.getTime())));
      const flat = sets.map((x) => ({ type: x.type, weightKg: num(x.weightKg), reps: x.reps, completed: x.completed }));
      participants.push({
        ...publicUser(p.user),
        isHost: p.userId === inv.hostId,
        isMe: p.userId === userId,
        sessionStatus: s.status,
        currentExercise: current?.exerciseName ?? null,
        setsDone: done.length,
        setsTotal: sets.length,
        lastSet: last ? { exerciseName: last.exerciseName, weightKg: num(last.weightKg), reps: last.reps } : null,
        startedAt: s.startedAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        summary:
          s.status === 'completed'
            ? {
                completedSets: done.length,
                volumeKg: totalVolume(flat),
                totalReps: totalReps(flat),
                durationMinutes: workoutDurationMinutes(s.startedAt, s.endedAt, s.pausedSeconds),
              }
            : null,
      });
    }
    return { inviteId: inv.id, serverTime: new Date().toISOString(), participants, waiting };
  }

  /* ------------------------------ Teilen-Link / Beitritt ------------------------------ */

  private async byToken(token: string) {
    const inv = await this.prisma.trainingInvite.findUnique({ where: { shareToken: token }, include: inviteInclude });
    if (!inv) throw notFound();
    return inv;
  }

  private preview(inv: FullInvite, userId: string): InviteJoinPreview {
    const me = inv.participants.find((p) => p.userId === userId) ?? null;
    const open = inv.status === 'scheduled' && inv.startsAt.getTime() > Date.now() - JOIN_GRACE_MS;
    const visible = me && (VISIBLE.includes(me.status) || inv.hostId === userId);
    return {
      title: inv.title,
      startsAt: inv.startsAt.toISOString(),
      location: inv.location,
      status: inv.status,
      host: publicUser(inv.host),
      participantCount: inv.participants.filter((p) => p.status === 'accepted').length,
      myStatus: me?.status ?? null,
      inviteId: visible ? inv.id : null,
      joinable: open && !me,
    };
  }

  async joinPreview(userId: string, token: string): Promise<InviteJoinPreview> {
    return this.preview(await this.byToken(token), userId);
  }

  /** Beitrittsanfrage über den Teilen-Link – die einladende Person muss bestätigen. */
  async join(userId: string, token: string): Promise<InviteJoinPreview> {
    const inv = await this.byToken(token);
    const pv = this.preview(inv, userId);
    if (pv.myStatus === 'rejected') throw forbidden('Die Teilnahme ist nicht möglich.', 'JOIN_REJECTED');
    if (pv.myStatus) return pv;
    if (!pv.joinable) throw new ConflictException({ code: 'JOIN_CLOSED', message: 'Dieser Einladung kann nicht mehr beigetreten werden.' });
    await this.prisma.trainingInviteParticipant.createMany({
      data: [{ inviteId: inv.id, userId, status: 'requested' }],
      skipDuplicates: true,
    });
    return this.joinPreview(userId, token);
  }

  async decideJoin(userId: string, id: string, participantUserId: string, approve: boolean): Promise<InviteView> {
    await this.loadAsHost(userId, id);
    const r = await this.prisma.trainingInviteParticipant.updateMany({
      where: { inviteId: id, userId: participantUserId, status: 'requested' },
      data: { status: approve ? 'accepted' : 'rejected', respondedAt: new Date() },
    });
    if (!r.count) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Beitrittsanfrage nicht gefunden.' });
    return this.get(userId, id);
  }
}
