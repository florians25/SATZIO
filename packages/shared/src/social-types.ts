import type { Equipment, MuscleGroup, SetType } from './enums';
import type { ParticipantStatus } from './social-schemas';

/** Öffentliche Minimaldarstellung eines Nutzers (für Freunde & Einladungen). */
export interface PublicUserView {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

export interface FriendView extends PublicUserView {
  since: string;
  /** Nur gesetzt, wenn der Freund seine Trainingsaktivität teilt. */
  activity: { lastWorkoutAt: string | null; streakWeeks: number } | null;
}

export interface FriendRequestView {
  id: string;
  user: PublicUserView;
  createdAt: string;
}

export interface FriendsOverview {
  friends: FriendView[];
  incoming: FriendRequestView[];
  outgoing: FriendRequestView[];
}

export type FriendRelation = 'self' | 'friend' | 'outgoing' | 'incoming' | 'none';

export interface FriendSearchResult {
  user: PublicUserView | null;
  relation: FriendRelation | null;
  /** false, wenn die Person keine Anfragen per Benutzernamen annimmt. */
  canRequest: boolean;
}

export interface FriendRequestResult {
  status: 'pending' | 'accepted';
  user: PublicUserView;
}

export interface FriendCodeView {
  code: string;
  url: string;
}

export interface FriendCodePreview {
  user: PublicUserView;
  relation: FriendRelation;
}

/** Schnappschuss eines Trainingstags in einer Einladung (ohne persönliche Gewichte). */
export interface InvitePlanSnapshot {
  planName: string | null;
  dayName: string;
  exercises: {
    exerciseId: string | null;
    name: string;
    slug: string | null;
    primaryMuscle: MuscleGroup;
    equipment: Equipment;
    restSeconds: number | null;
    notes: string | null;
    supersetGroup: string | null;
    weightStepKg: number | null;
    sets: { type: SetType; repsMin: number | null; repsMax: number | null }[];
  }[];
}

export interface InviteParticipantView extends PublicUserView {
  status: ParticipantStatus;
  isHost: boolean;
  respondedAt: string | null;
  /** Hat ein Training mit der Einladung verknüpft. */
  started: boolean;
}

export interface InviteListItem {
  id: string;
  title: string;
  startsAt: string;
  location: string | null;
  status: 'scheduled' | 'cancelled';
  host: PublicUserView;
  isHost: boolean;
  myStatus: ParticipantStatus;
  mySessionId: string | null;
  hasPlan: boolean;
  counts: { accepted: number; invited: number; maybe: number; declined: number; requested: number };
  /** Bis zu 4 Teilnehmende (außer mir), die zugesagt haben. */
  acceptedNames: string[];
}

export interface InviteView extends InviteListItem {
  note: string | null;
  plan: (InvitePlanSnapshot & { planId: string | null; planDayId: string | null }) | null;
  participants: InviteParticipantView[];
  /** Nur für Gastgeber: Link zum Teilen. */
  shareUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InviteLiveParticipant extends PublicUserView {
  isHost: boolean;
  isMe: boolean;
  sessionStatus: 'active' | 'paused' | 'completed';
  currentExercise: string | null;
  setsDone: number;
  setsTotal: number;
  lastSet: { exerciseName: string; weightKg: number | null; reps: number | null } | null;
  startedAt: string;
  updatedAt: string;
  /** Nur nach Abschluss (für Teilnehmende sichtbar). */
  summary: { completedSets: number; volumeKg: number; durationMinutes: number; totalReps: number } | null;
}

export interface InviteLiveView {
  inviteId: string;
  serverTime: string;
  participants: InviteLiveParticipant[];
  /** Zugesagt, aber noch nicht gestartet. */
  waiting: PublicUserView[];
}

export interface InviteJoinPreview {
  title: string;
  startsAt: string;
  location: string | null;
  status: 'scheduled' | 'cancelled';
  host: PublicUserView;
  participantCount: number;
  /** Eigener Status, falls bereits beteiligt. */
  myStatus: ParticipantStatus | null;
  inviteId: string | null;
  joinable: boolean;
}
