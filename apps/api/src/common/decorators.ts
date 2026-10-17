import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export const IS_PUBLIC = 'isPublic';
/** Endpunkt ohne Anmeldung erreichbar. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthUser {
  id: string;
  sessionId: string;
}

export type AuthedRequest = Request & { user: AuthUser; requestId?: string };

/** Angemeldeter Nutzer (aus dem geprüften Access-Token). */
export const CurrentUser = createParamDecorator((_: unknown, ctx: ExecutionContext): AuthUser => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  return req.user;
});
