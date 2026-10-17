import { z } from 'zod';
import { usernameSchema } from './account-schemas';

/* ───────────────────────────── Soziales: Freunde & gemeinsames Training ───────────────────────────── */

export const INVITE_RESPONSES = ['accepted', 'declined', 'maybe'] as const;
export type InviteResponse = (typeof INVITE_RESPONSES)[number];

export const PARTICIPANT_STATUSES = ['invited', 'accepted', 'declined', 'maybe', 'requested', 'rejected'] as const;
export type ParticipantStatus = (typeof PARTICIPANT_STATUSES)[number];

/** Persönlicher Einladungscode (URL-sicher). */
export const friendCodeSchema = z.string().trim().regex(/^[A-Za-z0-9_-]{8,64}$/, 'Ungültiger Einladungscode.');

/** Freundschaftsanfrage per exaktem Benutzernamen oder per persönlichem Einladungscode. */
export const friendRequestSchema = z
  .object({
    username: usernameSchema.optional(),
    code: friendCodeSchema.optional(),
  })
  .refine((v) => !!v.username !== !!v.code, { message: 'Bitte Benutzernamen oder Einladungscode angeben.' });
export type FriendRequestInput = z.infer<typeof friendRequestSchema>;

const isoDateTime = z.string().datetime({ offset: true, message: 'Ungültiges Datum.' });

export const inviteCreateSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  startsAt: isoDateTime,
  location: z.string().trim().max(120).nullable().optional(),
  note: z.string().trim().max(1000).nullable().optional(),
  planDayId: z.string().uuid().nullable().optional(),
  friendIds: z.array(z.string().uuid()).min(1, 'Bitte mindestens eine Person einladen.').max(20, 'Höchstens 20 Personen.'),
});
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;

export const inviteUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(80),
    startsAt: isoDateTime,
    location: z.string().trim().max(120).nullable(),
    note: z.string().trim().max(1000).nullable(),
    /** Weitere Freunde einladen (bestehende bleiben). */
    addFriendIds: z.array(z.string().uuid()).max(20),
  })
  .partial();
export type InviteUpdateInput = z.infer<typeof inviteUpdateSchema>;

export const inviteRespondSchema = z.object({ status: z.enum(INVITE_RESPONSES) });
export type InviteRespondInput = z.infer<typeof inviteRespondSchema>;

export const inviteLinkSchema = z.object({ sessionId: z.string().uuid() });
export type InviteLinkInput = z.infer<typeof inviteLinkSchema>;

export const joinRequestDecisionSchema = z.object({ approve: z.boolean() });
export type JoinRequestDecisionInput = z.infer<typeof joinRequestDecisionSchema>;
