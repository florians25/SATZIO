import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC, type AuthedRequest } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Globaler Guard: prüft das Access-Token (Bearer) und ob die Sitzung noch
 * gültig ist. Dadurch wirkt ein Sitzungs-Widerruf sofort.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw unauthorized();
    let payload: { sub: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(header.slice(7));
    } catch {
      throw unauthorized('TOKEN_EXPIRED');
    }
    const session = await this.prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: { userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt < new Date()) {
      throw unauthorized('SESSION_INVALID');
    }
    req.user = { id: payload.sub, sessionId: payload.sid };
    return true;
  }
}

function unauthorized(code = 'UNAUTHORIZED') {
  return new UnauthorizedException({ code, message: 'Bitte melde dich an.' });
}
