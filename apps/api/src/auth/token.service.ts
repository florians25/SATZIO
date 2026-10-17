import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { config } from '../config/config';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from '../common/util';

export interface IssuedTokens {
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresAt: Date;
  sessionId: string;
  rememberMe: boolean;
}

/** Gnadenfrist für gleichzeitige Refresh-Aufrufe (z. B. zwei Tabs). */
const REUSE_GRACE_MS = 15_000;

@Injectable()
export class TokenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  private sessionTtlMs(rememberMe: boolean) {
    const c = config();
    return rememberMe ? c.REFRESH_TTL_DAYS * 86400_000 : c.REFRESH_TTL_SHORT_HOURS * 3600_000;
  }

  signAccess(userId: string, sessionId: string) {
    const ttl = config().JWT_ACCESS_TTL_SECONDS;
    const accessToken = this.jwt.sign({ sub: userId, sid: sessionId }, { expiresIn: ttl });
    return { accessToken, expiresIn: ttl };
  }

  async createSession(userId: string, rememberMe: boolean, userAgent?: string): Promise<IssuedTokens> {
    const expiresAt = new Date(Date.now() + this.sessionTtlMs(rememberMe));
    const session = await this.prisma.authSession.create({
      data: { userId, rememberMe, userAgent: userAgent?.slice(0, 255), expiresAt },
    });
    const refreshToken = randomToken(48);
    await this.prisma.refreshToken.create({
      data: { sessionId: session.id, tokenHash: sha256(refreshToken), expiresAt },
    });
    return { ...this.signAccess(userId, session.id), refreshToken, refreshExpiresAt: expiresAt, sessionId: session.id, rememberMe };
  }

  /**
   * Refresh-Token-Rotation: Jedes Token ist nur einmal gültig. Wird ein
   * bereits verwendetes Token erneut vorgelegt (außerhalb der Gnadenfrist),
   * gilt es als gestohlen und die gesamte Sitzung wird widerrufen.
   */
  async rotate(rawToken: string, userAgent?: string): Promise<IssuedTokens & { userId: string }> {
    const now = new Date();
    const token = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha256(rawToken) },
      include: { session: true },
    });
    if (!token) throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Sitzung abgelaufen. Bitte melde dich erneut an.' });
    const session = token.session;
    if (session.revokedAt || session.expiresAt < now || token.revokedAt || token.expiresAt < now) {
      throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Sitzung abgelaufen. Bitte melde dich erneut an.' });
    }
    if (token.usedAt && now.getTime() - token.usedAt.getTime() > REUSE_GRACE_MS) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException({
        code: 'SESSION_REVOKED',
        message: 'Die Sitzung wurde aus Sicherheitsgründen beendet. Bitte melde dich erneut an.',
      });
    }
    const expiresAt = session.rememberMe ? new Date(now.getTime() + this.sessionTtlMs(true)) : session.expiresAt;
    const refreshToken = randomToken(48);
    await this.prisma.$transaction([
      this.prisma.refreshToken.update({ where: { id: token.id }, data: { usedAt: token.usedAt ?? now } }),
      this.prisma.refreshToken.create({ data: { sessionId: session.id, tokenHash: sha256(refreshToken), expiresAt } }),
      this.prisma.authSession.update({
        where: { id: session.id },
        data: { lastUsedAt: now, expiresAt, userAgent: userAgent?.slice(0, 255) ?? session.userAgent },
      }),
    ]);
    // Alte, verbrauchte Tokens der Sitzung aufräumen
    await this.prisma.refreshToken.deleteMany({
      where: { sessionId: session.id, usedAt: { lt: new Date(now.getTime() - 86400_000) } },
    });
    return {
      ...this.signAccess(session.userId, session.id),
      refreshToken,
      refreshExpiresAt: expiresAt,
      sessionId: session.id,
      rememberMe: session.rememberMe,
      userId: session.userId,
    };
  }

  async revokeSession(sessionId: string) {
    const now = new Date();
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { sessionId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
  }

  async revokeAllSessions(userId: string, exceptSessionId?: string) {
    const now = new Date();
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      select: { id: true },
    });
    const ids = sessions.map((s) => s.id);
    if (!ids.length) return;
    await this.prisma.$transaction([
      this.prisma.authSession.updateMany({ where: { id: { in: ids } }, data: { revokedAt: now } }),
      this.prisma.refreshToken.updateMany({ where: { sessionId: { in: ids }, revokedAt: null }, data: { revokedAt: now } }),
    ]);
  }

  async revokeByRawToken(rawToken: string) {
    const token = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (token) await this.revokeSession(token.sessionId);
  }
}
