import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, ParseUUIDPipe, Post, Req, Res, UnauthorizedException } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  type LoginInput,
  type RegisterInput,
} from '@satzio/shared';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { config } from '../config/config';
import { randomToken } from '../common/util';
import { PrismaService } from '../prisma/prisma.service';
import { loadUserView } from '../users/user-view';
import { AuthService } from './auth.service';
import { TokenService, type IssuedTokens } from './token.service';

export const REFRESH_COOKIE = 'satzio_rt';
export const CSRF_COOKIE = 'satzio_csrf';
const AUTH_COOKIE_PATH = '/api/v1/auth';

const authLimit = () => ({ default: { limit: config().AUTH_RATE_LIMIT_PER_MINUTE, ttl: 60_000 } });

/** Native Apps (Capacitor) erhalten das Refresh-Token im Body statt als Cookie. */
function isNative(req: Request) {
  return req.header('x-satzio-client') === 'native';
}

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  private issue(req: Request, res: Response, t: IssuedTokens) {
    const c = config();
    const csrf = randomToken(24);
    const native = isNative(req);
    if (!native) {
      res.cookie(REFRESH_COOKIE, t.refreshToken, {
        httpOnly: true,
        secure: c.cookieSecure,
        sameSite: 'strict',
        path: AUTH_COOKIE_PATH,
        ...(t.rememberMe ? { expires: t.refreshExpiresAt } : {}),
      });
      res.cookie(CSRF_COOKIE, csrf, {
        httpOnly: false,
        secure: c.cookieSecure,
        sameSite: 'strict',
        path: '/',
        ...(t.rememberMe ? { expires: t.refreshExpiresAt } : {}),
      });
    }
    return {
      accessToken: t.accessToken,
      expiresIn: t.expiresIn,
      csrfToken: native ? undefined : csrf,
      ...(native ? { refreshToken: t.refreshToken, refreshExpiresAt: t.refreshExpiresAt.toISOString() } : {}),
    };
  }

  private clear(res: Response) {
    const c = config();
    res.clearCookie(REFRESH_COOKIE, { path: AUTH_COOKIE_PATH, httpOnly: true, secure: c.cookieSecure, sameSite: 'strict' });
    res.clearCookie(CSRF_COOKIE, { path: '/', secure: c.cookieSecure, sameSite: 'strict' });
  }

  /** CSRF: Double-Submit-Cookie für Cookie-basierte Endpunkte. */
  private refreshTokenFrom(req: Request, body?: { refreshToken?: string }): string {
    if (isNative(req)) {
      if (!body?.refreshToken) throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Bitte melde dich an.' });
      return body.refreshToken;
    }
    const cookie = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!cookie) throw new UnauthorizedException({ code: 'SESSION_INVALID', message: 'Bitte melde dich an.' });
    const csrfCookie = req.cookies?.[CSRF_COOKIE] as string | undefined;
    const csrfHeader = req.header('x-csrf-token');
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      throw new ForbiddenException({ code: 'CSRF_FAILED', message: 'Sicherheitsprüfung fehlgeschlagen. Bitte lade die Seite neu.' });
    }
    return cookie;
  }

  @Public()
  @Throttle(authLimit())
  @Post('register')
  @ApiOperation({ summary: 'Neues Konto direkt in der App anlegen (meldet automatisch an)' })
  @ApiZodBody(registerSchema)
  async register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { userId, tokens } = await this.auth.register(body, req.header('user-agent'));
    return { ...this.issue(req, res, tokens), user: await loadUserView(this.prisma, userId) };
  }

  @Public()
  @Throttle(authLimit())
  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Anmelden mit E-Mail oder Benutzername' })
  @ApiZodBody(loginSchema)
  async login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { userId, tokens } = await this.auth.login(body, req.header('user-agent'));
    return { ...this.issue(req, res, tokens), user: await loadUserView(this.prisma, userId) };
  }

  @Public()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(200)
  @ApiOperation({ summary: 'Access-Token erneuern (Refresh-Token-Rotation, CSRF-geschützt)' })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: { refreshToken?: string }) {
    const raw = this.refreshTokenFrom(req, body);
    try {
      const t = await this.tokens.rotate(raw, req.header('user-agent'));
      return { ...this.issue(req, res, t), user: await loadUserView(this.prisma, t.userId) };
    } catch (e) {
      this.clear(res);
      throw e;
    }
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Abmelden (aktuelle Sitzung widerrufen)' })
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response, @Body() body: { refreshToken?: string }) {
    try {
      const raw = this.refreshTokenFrom(req, body);
      await this.tokens.revokeByRawToken(raw);
    } catch {
      // Abmelden ist immer erfolgreich aus Sicht des Clients
    }
    this.clear(res);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Post('logout-all')
  @HttpCode(200)
  @ApiOperation({ summary: 'Alle Sitzungen beenden' })
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.tokens.revokeAllSessions(user.id);
    this.clear(res);
    return { ok: true };
  }

  @ApiBearerAuth()
  @Get('sessions')
  @ApiOperation({ summary: 'Aktive Sitzungen auflisten' })
  sessions(@CurrentUser() user: AuthUser) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @ApiBearerAuth()
  @Delete('sessions/:id')
  @ApiOperation({ summary: 'Eine Sitzung widerrufen' })
  async revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.auth.revokeSession(user.id, id);
    return { ok: true };
  }

  @Public()
  @Throttle(authLimit())
  @Post('verify-email')
  @HttpCode(200)
  @ApiOperation({ summary: 'E-Mail-Adresse mit Einmal-Token bestätigen' })
  @ApiZodBody(verifyEmailSchema)
  verify(@Body(new ZodPipe(verifyEmailSchema)) body: { token: string }) {
    return this.auth.verifyEmail(body.token);
  }

  @ApiBearerAuth()
  @Throttle(authLimit())
  @Post('verify-email/resend')
  @HttpCode(200)
  @ApiOperation({ summary: 'Bestätigungs-E-Mail erneut senden' })
  resend(@CurrentUser() user: AuthUser) {
    return this.auth.resendVerification(user.id);
  }

  @Public()
  @Throttle(authLimit())
  @Post('password/forgot')
  @HttpCode(202)
  @ApiOperation({ summary: 'Link zum Zurücksetzen anfordern (antwortet immer gleich)' })
  @ApiZodBody(forgotPasswordSchema)
  forgot(@Body(new ZodPipe(forgotPasswordSchema)) body: { email: string }) {
    return this.auth.forgotPassword(body.email);
  }

  @Public()
  @Throttle(authLimit())
  @Post('password/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passwort mit zeitlich begrenztem Einmal-Token zurücksetzen' })
  @ApiZodBody(resetPasswordSchema)
  reset(@Body(new ZodPipe(resetPasswordSchema)) body: { token: string; password: string }) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @ApiBearerAuth()
  @Throttle(authLimit())
  @Post('password/change')
  @HttpCode(200)
  @ApiOperation({ summary: 'Passwort ändern (beendet alle anderen Sitzungen)' })
  @ApiZodBody(changePasswordSchema)
  change(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>,
  ) {
    return this.auth.changePassword(user.id, user.sessionId, body.currentPassword, body.newPassword);
  }
}
