-- CreateEnum
CREATE TYPE "public"."FriendshipStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateEnum
CREATE TYPE "public"."TrainingInviteStatus" AS ENUM ('scheduled', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."InviteParticipantStatus" AS ENUM ('invited', 'accepted', 'declined', 'maybe', 'requested', 'rejected');

-- AlterTable
ALTER TABLE "public"."UserSettings" ADD COLUMN     "allowFriendRequests" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shareActivityWithFriends" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "public"."Friendship" (
    "id" UUID NOT NULL,
    "requesterId" UUID NOT NULL,
    "addresseeId" UUID NOT NULL,
    "status" "public"."FriendshipStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserInviteCode" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserInviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingInvite" (
    "id" UUID NOT NULL,
    "hostId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "note" TEXT,
    "planSnapshot" JSONB,
    "planId" UUID,
    "planDayId" UUID,
    "status" "public"."TrainingInviteStatus" NOT NULL DEFAULT 'scheduled',
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingInviteParticipant" (
    "id" UUID NOT NULL,
    "inviteId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "public"."InviteParticipantStatus" NOT NULL DEFAULT 'invited',
    "sessionId" UUID,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingInviteParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Friendship_addresseeId_status_idx" ON "public"."Friendship"("addresseeId", "status");

-- CreateIndex
CREATE INDEX "Friendship_requesterId_status_idx" ON "public"."Friendship"("requesterId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_requesterId_addresseeId_key" ON "public"."Friendship"("requesterId", "addresseeId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInviteCode_userId_key" ON "public"."UserInviteCode"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserInviteCode_code_key" ON "public"."UserInviteCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingInvite_shareToken_key" ON "public"."TrainingInvite"("shareToken");

-- CreateIndex
CREATE INDEX "TrainingInvite_hostId_startsAt_idx" ON "public"."TrainingInvite"("hostId", "startsAt");

-- CreateIndex
CREATE INDEX "TrainingInviteParticipant_userId_status_idx" ON "public"."TrainingInviteParticipant"("userId", "status");

-- CreateIndex
CREATE INDEX "TrainingInviteParticipant_sessionId_idx" ON "public"."TrainingInviteParticipant"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingInviteParticipant_inviteId_userId_key" ON "public"."TrainingInviteParticipant"("inviteId", "userId");

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Friendship" ADD CONSTRAINT "Friendship_addresseeId_fkey" FOREIGN KEY ("addresseeId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserInviteCode" ADD CONSTRAINT "UserInviteCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingInvite" ADD CONSTRAINT "TrainingInvite_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingInviteParticipant" ADD CONSTRAINT "TrainingInviteParticipant_inviteId_fkey" FOREIGN KEY ("inviteId") REFERENCES "public"."TrainingInvite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingInviteParticipant" ADD CONSTRAINT "TrainingInviteParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingInviteParticipant" ADD CONSTRAINT "TrainingInviteParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
