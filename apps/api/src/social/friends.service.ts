import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  computeWeeklyStreak,
  localDateKey,
  type FriendCodePreview,
  type FriendCodeView,
  type FriendRelation,
  type FriendRequestInput,
  type FriendRequestResult,
  type FriendSearchResult,
  type FriendsOverview,
  type FriendView,
} from '@satzio/shared';
import { randomToken } from '../common/util';
import { config } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { forbidden, publicUser, publicUserSelect } from './social-util';

const ACTIVITY_WINDOW_DAYS = 400;

@Injectable()
export class FriendsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Eigene Freundschaftszeile zwischen zwei Nutzern (beide Richtungen). */
  private pair(a: string, b: string) {
    return this.prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: a, addresseeId: b },
          { requesterId: b, addresseeId: a },
        ],
      },
    });
  }

  async areFriends(a: string, b: string): Promise<boolean> {
    const row = await this.pair(a, b);
    return row?.status === 'accepted';
  }

  /** IDs aller bestätigten Freunde. */
  async friendIds(userId: string): Promise<Set<string>> {
    const rows = await this.prisma.friendship.findMany({
      where: { status: 'accepted', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return new Set(rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId)));
  }

  private async relation(userId: string, otherId: string): Promise<FriendRelation> {
    if (userId === otherId) return 'self';
    const row = await this.pair(userId, otherId);
    if (!row) return 'none';
    if (row.status === 'accepted') return 'friend';
    if (row.requesterId === userId) return 'outgoing'; // abgelehnte Anfragen bleiben für den Absender "ausstehend"
    return row.status === 'pending' ? 'incoming' : 'none';
  }

  async overview(userId: string): Promise<FriendsOverview> {
    const rows = await this.prisma.friendship.findMany({
      where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: { ...publicUserSelect, settings: { select: { shareActivityWithFriends: true, timeZone: true } } } },
        addressee: { select: { ...publicUserSelect, settings: { select: { shareActivityWithFriends: true, timeZone: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const friends: FriendView[] = [];
    const incoming: FriendsOverview['incoming'] = [];
    const outgoing: FriendsOverview['outgoing'] = [];
    const sharing: { id: string; tz: string }[] = [];
    for (const r of rows) {
      const mine = r.requesterId === userId;
      const other = mine ? r.addressee : r.requester;
      if (r.status === 'accepted') {
        friends.push({ ...publicUser(other), since: (r.respondedAt ?? r.createdAt).toISOString(), activity: null });
        if (other.settings?.shareActivityWithFriends) sharing.push({ id: other.id, tz: other.settings.timeZone });
      } else if (mine) {
        outgoing.push({ id: r.id, user: publicUser(other), createdAt: r.createdAt.toISOString() });
      } else if (r.status === 'pending') {
        incoming.push({ id: r.id, user: publicUser(other), createdAt: r.createdAt.toISOString() });
      }
    }
    if (sharing.length) {
      const since = new Date(Date.now() - ACTIVITY_WINDOW_DAYS * 86_400_000);
      const [sessions, profiles] = await Promise.all([
        this.prisma.workoutSession.findMany({
          where: { userId: { in: sharing.map((s) => s.id) }, status: 'completed', startedAt: { gte: since } },
          select: { userId: true, startedAt: true },
          orderBy: { startedAt: 'desc' },
        }),
        this.prisma.userProfile.findMany({
          where: { userId: { in: sharing.map((s) => s.id) } },
          select: { userId: true, trainingDaysPerWeek: true },
        }),
      ]);
      const goal = new Map(profiles.map((p) => [p.userId, p.trainingDaysPerWeek ?? 0]));
      for (const s of sharing) {
        const own = sessions.filter((x) => x.userId === s.id);
        const keys = own.map((x) => localDateKey(x.startedAt, s.tz));
        const streak = computeWeeklyStreak(keys, goal.get(s.id) ?? 0, localDateKey(new Date(), s.tz));
        const f = friends.find((x) => x.id === s.id);
        if (f) f.activity = { lastWorkoutAt: own[0]?.startedAt.toISOString() ?? null, streakWeeks: streak.current };
      }
    }
    friends.sort((a, b) => (a.displayName || a.username).localeCompare(b.displayName || b.username, 'de'));
    return { friends, incoming, outgoing };
  }

  /** Suche nur per exaktem Benutzernamen (Groß-/Kleinschreibung egal) – keine Teiltreffer, keine Aufzählung. */
  async search(userId: string, username: string): Promise<FriendSearchResult> {
    const q = username.trim();
    if (q.length < 3 || q.length > 30) return { user: null, relation: null, canRequest: false };
    const u = await this.prisma.user.findFirst({
      where: { username: { equals: q, mode: 'insensitive' } },
      select: { ...publicUserSelect, settings: { select: { allowFriendRequests: true } } },
    });
    if (!u) return { user: null, relation: null, canRequest: false };
    const relation = await this.relation(userId, u.id);
    const allows = u.settings?.allowFriendRequests ?? true;
    return { user: publicUser(u), relation, canRequest: relation === 'incoming' || (relation === 'none' && allows) };
  }

  async request(userId: string, input: FriendRequestInput): Promise<FriendRequestResult> {
    let targetId: string;
    if (input.code) {
      const c = await this.prisma.userInviteCode.findUnique({ where: { code: input.code }, select: { userId: true } });
      if (!c) throw new NotFoundException({ code: 'INVALID_CODE', message: 'Dieser Einladungslink ist ungültig oder wurde zurückgesetzt.' });
      targetId = c.userId;
    } else {
      const u = await this.prisma.user.findFirst({
        where: { username: { equals: input.username!, mode: 'insensitive' } },
        select: { id: true, settings: { select: { allowFriendRequests: true } } },
      });
      if (!u) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Kein Konto mit diesem Benutzernamen gefunden.' });
      targetId = u.id;
      const existing = await this.pair(userId, targetId);
      const isIncoming = existing && existing.requesterId === targetId && existing.status === 'pending';
      if (!(u.settings?.allowFriendRequests ?? true) && !isIncoming && existing?.status !== 'accepted') {
        throw forbidden('Diese Person nimmt keine Freundschaftsanfragen über den Benutzernamen an.', 'FRIEND_REQUESTS_DISABLED');
      }
    }
    if (targetId === userId) throw new BadRequestException({ code: 'SELF_REQUEST', message: 'Du kannst dich nicht selbst hinzufügen.' });

    const target = await this.prisma.user.findUniqueOrThrow({ where: { id: targetId }, select: publicUserSelect });
    const existing = await this.pair(userId, targetId);
    if (existing) {
      if (existing.status === 'accepted') return { status: 'accepted', user: publicUser(target) };
      if (existing.requesterId === userId) return { status: 'pending', user: publicUser(target) };
      // Gegenseitiger Wunsch: Anfrage der anderen Person wird angenommen
      await this.prisma.friendship.update({ where: { id: existing.id }, data: { status: 'accepted', respondedAt: new Date() } });
      return { status: 'accepted', user: publicUser(target) };
    }
    try {
      await this.prisma.friendship.create({ data: { requesterId: userId, addresseeId: targetId } });
    } catch {
      /* paralleler Request: Zeile existiert bereits */
    }
    return { status: 'pending', user: publicUser(target) };
  }

  private async incomingRow(userId: string, id: string) {
    const row = await this.prisma.friendship.findFirst({ where: { id, addresseeId: userId, status: 'pending' } });
    if (!row) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Anfrage nicht gefunden.' });
    return row;
  }

  async accept(userId: string, id: string) {
    await this.incomingRow(userId, id);
    await this.prisma.friendship.update({ where: { id }, data: { status: 'accepted', respondedAt: new Date() } });
    return { status: 'accepted' as const };
  }

  /** Ablehnen: Zeile bleibt (für den Absender weiterhin „ausstehend“), damit keine erneuten Anfragen entstehen. */
  async decline(userId: string, id: string) {
    await this.incomingRow(userId, id);
    await this.prisma.friendship.update({ where: { id }, data: { status: 'declined', respondedAt: new Date() } });
    return { status: 'declined' as const };
  }

  async cancel(userId: string, id: string) {
    const r = await this.prisma.friendship.deleteMany({ where: { id, requesterId: userId, status: { in: ['pending', 'declined'] } } });
    if (!r.count) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Anfrage nicht gefunden.' });
    return { deleted: true };
  }

  async remove(userId: string, friendId: string) {
    const r = await this.prisma.friendship.deleteMany({
      where: {
        status: 'accepted',
        OR: [
          { requesterId: userId, addresseeId: friendId },
          { requesterId: friendId, addresseeId: userId },
        ],
      },
    });
    if (!r.count) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Freund nicht gefunden.' });
    return { deleted: true };
  }

  private codeView(code: string): FriendCodeView {
    return { code, url: `${config().PUBLIC_URL.replace(/\/$/, '')}/friends/add/${code}` };
  }

  async getCode(userId: string): Promise<FriendCodeView> {
    const existing = await this.prisma.userInviteCode.findUnique({ where: { userId } });
    if (existing) return this.codeView(existing.code);
    const created = await this.prisma.userInviteCode.upsert({ where: { userId }, create: { userId, code: randomToken(12) }, update: {} });
    return this.codeView(created.code);
  }

  /** Neuer Code – der alte Link funktioniert danach nicht mehr. */
  async regenerateCode(userId: string): Promise<FriendCodeView> {
    const code = randomToken(12);
    await this.prisma.userInviteCode.upsert({ where: { userId }, create: { userId, code }, update: { code, createdAt: new Date() } });
    return this.codeView(code);
  }

  async previewCode(userId: string, code: string): Promise<FriendCodePreview> {
    const c = await this.prisma.userInviteCode.findUnique({ where: { code }, include: { user: { select: publicUserSelect } } });
    if (!c) throw new NotFoundException({ code: 'INVALID_CODE', message: 'Dieser Einladungslink ist ungültig oder wurde zurückgesetzt.' });
    return { user: publicUser(c.user), relation: await this.relation(userId, c.userId) };
  }
}
