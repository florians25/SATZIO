import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { PublicUserView } from '@satzio/shared';
import { avatarUrl } from '../users/user-view';

/** Minimale, öffentliche Nutzerfelder – nie E-Mail, Körperdaten o. Ä. */
export const publicUserSelect = {
  id: true,
  username: true,
  profile: { select: { displayName: true, avatarPath: true } },
} as const;

export type PublicUserRow = {
  id: string;
  username: string;
  profile: { displayName: string | null; avatarPath: string | null } | null;
};

export function publicUser(u: PublicUserRow): PublicUserView {
  return {
    id: u.id,
    username: u.username,
    displayName: u.profile?.displayName ?? null,
    avatarUrl: avatarUrl(u.profile?.avatarPath),
  };
}

export function displayName(u: PublicUserView): string {
  return u.displayName || u.username;
}

export const notFound = (what = 'Einladung') =>
  new NotFoundException({ code: 'NOT_FOUND', message: `${what} nicht gefunden.` });

export const forbidden = (message: string, code = 'FORBIDDEN') => new ForbiddenException({ code, message });
