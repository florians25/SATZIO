import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { LoginInput, RegisterInput } from '@satzio/shared';
import { config } from '../config/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomToken, sha256 } from '../common/util';
import { burnTime, hashPassword, needsRehash, verifyPassword } from './password';
import { TokenService } from './token.service';

const VERIFY_TTL_MS = 48 * 3600_000;
const RESET_TTL_MS = 60 * 60_000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
  ) {}

  async register(input: RegisterInput, userAgent?: string) {
    if (!config().REGISTRATION_ENABLED) {
      throw new ForbiddenException({ code: 'REGISTRATION_DISABLED', message: 'Die Registrierung ist auf diesem Server deaktiviert.' });
    }
    const email = input.email.toLowerCase();
    const usernameTaken = await this.prisma.user.findFirst({
      where: { username: { equals: input.username, mode: 'insensitive' } },
      select: { id: true },
    });
    if (usernameTaken) {
      throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Dieser Benutzername ist bereits vergeben.' });
    }
    const emailTaken = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (emailTaken) {
      throw new ConflictException({
        code: 'ACCOUNT_EXISTS',
        message: 'Mit dieser E-Mail-Adresse ist keine Registrierung möglich. Hast du bereits ein Konto? Melde dich an oder setze dein Passwort zurück.',
      });
    }
    const passwordHash = await hashPassword(input.password);
    let user;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          username: input.username,
          passwordHash,
          profile: { create: { displayName: input.username } },
          settings: { create: {} },
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') {
        throw new ConflictException({ code: 'ACCOUNT_EXISTS', message: 'Benutzername oder E-Mail-Adresse ist bereits vergeben.' });
      }
      throw e;
    }
    await this.sendVerification(user.id, email);
    const tokens = await this.tokens.createSession(user.id, input.rememberMe ?? true, userAgent);
    return { userId: user.id, tokens };
  }

  async login(input: LoginInput, userAgent?: string) {
    const identifier = input.identifier.trim();
    const user = identifier.includes('@')
      ? await this.prisma.user.findUnique({ where: { email: identifier.toLowerCase() } })
      : await this.prisma.user.findFirst({ where: { username: { equals: identifier, mode: 'insensitive' } } });
    if (!user) {
      await burnTime(input.password);
      throw invalidCredentials();
    }
    const ok = await verifyPassword(user.passwordHash, input.password);
    if (!ok) throw invalidCredentials();
    if (needsRehash(user.passwordHash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(input.password) } });
    }
    const tokens = await this.tokens.createSession(user.id, input.rememberMe ?? false, userAgent);
    return { userId: user.id, tokens };
  }

  async sendVerification(userId: string, email: string) {
    const raw = randomToken(32);
    await this.prisma.emailVerificationToken.create({
      data: { userId, email, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + VERIFY_TTL_MS) },
    });
    const link = `${config().PUBLIC_URL}/verify-email?token=${encodeURIComponent(raw)}`;
    // Versand blockiert die Registrierung nicht
    void this.mail.sendVerification(email, link);
  }

  async resendVerification(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (user.emailVerifiedAt) return { alreadyVerified: true, mailEnabled: this.mail.enabled };
    const recent = await this.prisma.emailVerificationToken.count({
      where: { userId, createdAt: { gt: new Date(Date.now() - 60_000) } },
    });
    if (recent > 0) {
      throw new BadRequestException({ code: 'TOO_SOON', message: 'Bitte warte eine Minute, bevor du eine neue E-Mail anforderst.' });
    }
    await this.sendVerification(userId, user.email);
    return { alreadyVerified: false, mailEnabled: this.mail.enabled };
  }

  async verifyEmail(rawToken: string) {
    const token = await this.prisma.emailVerificationToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Der Bestätigungslink ist ungültig oder abgelaufen.' });
    }
    const user = await this.prisma.user.findUnique({ where: { id: token.userId } });
    if (!user || user.email !== token.email) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Der Bestätigungslink ist ungültig oder abgelaufen.' });
    }
    await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } }),
    ]);
    return { verified: true };
  }

  /** Antwortet immer gleich – verrät nicht, ob ein Konto existiert. */
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (user) {
      const recent = await this.prisma.passwordResetToken.count({
        where: { userId: user.id, createdAt: { gt: new Date(Date.now() - 60_000) } },
      });
      if (recent === 0) {
        const raw = randomToken(32);
        await this.prisma.passwordResetToken.create({
          data: { userId: user.id, tokenHash: sha256(raw), expiresAt: new Date(Date.now() + RESET_TTL_MS) },
        });
        const link = `${config().PUBLIC_URL}/reset-password?token=${encodeURIComponent(raw)}`;
        void this.mail.sendPasswordReset(user.email, link);
      }
    }
    return { ok: true, mailEnabled: this.mail.enabled };
  }

  async resetPassword(rawToken: string, password: string) {
    const token = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(rawToken) } });
    if (!token || token.usedAt || token.expiresAt < new Date()) {
      throw new BadRequestException({ code: 'TOKEN_INVALID', message: 'Der Link ist ungültig oder abgelaufen. Bitte fordere einen neuen an.' });
    }
    const passwordHash = await hashPassword(password);
    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
      // alle weiteren offenen Reset-Links verfallen
      this.prisma.passwordResetToken.updateMany({ where: { userId: token.userId, usedAt: null }, data: { usedAt: new Date() } }),
      this.prisma.user.update({ where: { id: token.userId }, data: { passwordHash } }),
    ]);
    await this.tokens.revokeAllSessions(token.userId);
    this.logger.log('Passwort über Reset-Link geändert, alle Sitzungen beendet');
    return { ok: true };
  }

  async changePassword(userId: string, sessionId: string, current: string, next: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException();
    if (!(await verifyPassword(user.passwordHash, current))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Das aktuelle Passwort ist falsch.' });
    }
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
    await this.tokens.revokeAllSessions(userId, sessionId);
    return { ok: true };
  }

  async confirmPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Das Passwort ist falsch.' });
    }
    return user;
  }

  async listSessions(userId: string, currentSessionId: string) {
    const sessions = await this.prisma.authSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
    });
    return sessions.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastUsedAt: s.lastUsedAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      rememberMe: s.rememberMe,
      current: s.id === currentSessionId,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const s = await this.prisma.authSession.findFirst({ where: { id: sessionId, userId } });
    if (!s) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Sitzung nicht gefunden.' });
    await this.tokens.revokeSession(sessionId);
  }
}

function invalidCredentials() {
  return new UnauthorizedException({
    code: 'INVALID_CREDENTIALS',
    message: 'E-Mail/Benutzername oder Passwort ist falsch.',
  });
}
