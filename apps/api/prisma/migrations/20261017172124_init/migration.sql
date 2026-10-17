-- CreateEnum
CREATE TYPE "public"."MuscleGroup" AS ENUM ('chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'core', 'quads', 'hamstrings', 'glutes', 'calves', 'full_body');

-- CreateEnum
CREATE TYPE "public"."Equipment" AS ENUM ('barbell', 'dumbbell', 'cable', 'machine', 'smith_machine', 'kettlebell', 'bodyweight', 'band', 'other');

-- CreateEnum
CREATE TYPE "public"."ExerciseCategory" AS ENUM ('compound', 'isolation', 'cardio', 'mobility', 'plyometric');

-- CreateEnum
CREATE TYPE "public"."Difficulty" AS ENUM ('beginner', 'intermediate', 'advanced');

-- CreateEnum
CREATE TYPE "public"."SetType" AS ENUM ('warmup', 'working', 'drop', 'failure');

-- CreateEnum
CREATE TYPE "public"."Goal" AS ENUM ('muscle_gain', 'strength', 'fitness', 'weight_loss', 'general');

-- CreateEnum
CREATE TYPE "public"."WeightUnit" AS ENUM ('kg', 'lbs');

-- CreateEnum
CREATE TYPE "public"."MotivationLevel" AS ENUM ('off', 'subtle', 'normal', 'intense');

-- CreateEnum
CREATE TYPE "public"."ThemeMode" AS ENUM ('dark', 'light', 'system');

-- CreateEnum
CREATE TYPE "public"."WorkoutStatus" AS ENUM ('active', 'paused', 'completed');

-- CreateEnum
CREATE TYPE "public"."WorkoutMode" AS ENUM ('list', 'guided');

-- CreateEnum
CREATE TYPE "public"."ScheduleMode" AS ENUM ('flexible', 'fixed');

-- CreateEnum
CREATE TYPE "public"."PersonalRecordType" AS ENUM ('max_weight', 'max_reps_at_weight', 'max_set_volume', 'max_session_volume', 'est_1rm');

-- CreateEnum
CREATE TYPE "public"."PrefillSource" AS ENUM ('history', 'plan', 'user_default', 'manual', 'none');

-- CreateEnum
CREATE TYPE "public"."MuscleRole" AS ENUM ('primary', 'secondary');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserProfile" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "displayName" TEXT,
    "avatarPath" TEXT,
    "goal" "public"."Goal",
    "level" "public"."Difficulty",
    "trainingDaysPerWeek" INTEGER,
    "heightCm" DECIMAL(5,1),
    "bodyWeightKg" DECIMAL(9,4),
    "targetWeightKg" DECIMAL(9,4),
    "activePlanId" UUID,
    "onboardingCompletedAt" TIMESTAMP(3),
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserSettings" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "unit" "public"."WeightUnit" NOT NULL DEFAULT 'kg',
    "defaultRestSeconds" INTEGER NOT NULL DEFAULT 90,
    "autoStartRestTimer" BOOLEAN NOT NULL DEFAULT true,
    "weightStepsKg" DECIMAL(6,3)[] DEFAULT ARRAY[2.5, 5]::DECIMAL(6,3)[],
    "motivationLevel" "public"."MotivationLevel" NOT NULL DEFAULT 'subtle',
    "theme" "public"."ThemeMode" NOT NULL DEFAULT 'dark',
    "language" TEXT NOT NULL DEFAULT 'de',
    "timeZone" TEXT NOT NULL DEFAULT 'Europe/Berlin',
    "soundEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vibrationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "progressionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "gamificationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "workoutMode" "public"."WorkoutMode" NOT NULL DEFAULT 'list',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuthSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "userAgent" TEXT,
    "rememberMe" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RefreshToken" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EmailVerificationToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PasswordResetToken" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Exercise" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "nameDe" TEXT NOT NULL,
    "nameEn" TEXT,
    "aliases" TEXT[],
    "descriptionDe" TEXT,
    "descriptionEn" TEXT,
    "primaryMuscle" "public"."MuscleGroup" NOT NULL,
    "equipment" "public"."Equipment" NOT NULL,
    "category" "public"."ExerciseCategory" NOT NULL,
    "difficulty" "public"."Difficulty" NOT NULL,
    "stepsDe" TEXT[],
    "mistakesDe" TEXT[],
    "safetyDe" TEXT,
    "alternatives" TEXT[],
    "weightStepKg" DECIMAL(6,3),
    "ownerId" UUID,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Exercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExerciseMuscle" (
    "id" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "muscle" "public"."MuscleGroup" NOT NULL,
    "role" "public"."MuscleRole" NOT NULL,

    CONSTRAINT "ExerciseMuscle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExerciseMedia" (
    "id" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT,
    "license" TEXT,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExerciseFavorite" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExerciseFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserExercise" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "weightStepKg" DECIMAL(6,3),
    "defaultWeightKg" DECIMAL(9,4),
    "defaultReps" INTEGER,
    "defaultRestSeconds" INTEGER,
    "equipmentSettings" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutPlan" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "scheduleMode" "public"."ScheduleMode" NOT NULL DEFAULT 'flexible',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "sourceTemplate" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutPlanDay" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "weekday" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlanDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutPlanExercise" (
    "id" UUID NOT NULL,
    "dayId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "restSeconds" INTEGER,
    "notes" TEXT,
    "supersetGroup" TEXT,
    "weightStepKg" DECIMAL(6,3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutPlanExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlannedSet" (
    "id" UUID NOT NULL,
    "planExerciseId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "public"."SetType" NOT NULL DEFAULT 'working',
    "repsMin" INTEGER,
    "repsMax" INTEGER,
    "targetWeightKg" DECIMAL(9,4),

    CONSTRAINT "PlannedSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutPlanVersion" (
    "id" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutPlanVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrainingSchedule" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "mode" "public"."ScheduleMode" NOT NULL DEFAULT 'flexible',
    "nextDayIndex" INTEGER NOT NULL DEFAULT 0,
    "paused" BOOLEAN NOT NULL DEFAULT false,
    "overrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutSession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "planId" UUID,
    "planDayId" UUID,
    "name" TEXT NOT NULL,
    "status" "public"."WorkoutStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedSeconds" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "perceivedExertion" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutSessionExercise" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "exerciseId" UUID,
    "exerciseName" TEXT NOT NULL,
    "primaryMuscle" "public"."MuscleGroup",
    "planExerciseId" UUID,
    "order" INTEGER NOT NULL,
    "notes" TEXT,
    "restSeconds" INTEGER,
    "supersetGroup" TEXT,
    "weightStepKg" DECIMAL(6,3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSessionExercise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkoutSet" (
    "id" UUID NOT NULL,
    "sessionExerciseId" UUID NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "public"."SetType" NOT NULL DEFAULT 'working',
    "weightKg" DECIMAL(9,4),
    "reps" INTEGER,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),
    "rpe" DECIMAL(3,1),
    "targetRepsMin" INTEGER,
    "targetRepsMax" INTEGER,
    "targetWeightKg" DECIMAL(9,4),
    "weightSource" "public"."PrefillSource" NOT NULL DEFAULT 'none',
    "repsSource" "public"."PrefillSource" NOT NULL DEFAULT 'none',
    "version" INTEGER NOT NULL DEFAULT 1,
    "lastDeviceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutSet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PersonalRecord" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "exerciseId" UUID NOT NULL,
    "type" "public"."PersonalRecordType" NOT NULL,
    "recordKey" TEXT NOT NULL,
    "value" DECIMAL(12,4) NOT NULL,
    "weightKg" DECIMAL(9,4),
    "reps" INTEGER,
    "sessionId" UUID,
    "setId" UUID,
    "achievedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BodyWeightEntry" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL,
    "weightKg" DECIMAL(9,4),
    "bodyFatPct" DECIMAL(4,1),
    "measurements" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BodyWeightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Achievement" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserAchievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sessionId" UUID,

    CONSTRAINT "UserAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SyncOperation" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "opId" UUID NOT NULL,
    "deviceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "public"."User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "public"."UserProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "public"."UserSettings"("userId");

-- CreateIndex
CREATE INDEX "AuthSession_userId_idx" ON "public"."AuthSession"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "public"."RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_sessionId_idx" ON "public"."RefreshToken"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailVerificationToken_tokenHash_key" ON "public"."EmailVerificationToken"("tokenHash");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "public"."EmailVerificationToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "public"."PasswordResetToken"("tokenHash");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "public"."PasswordResetToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Exercise_slug_key" ON "public"."Exercise"("slug");

-- CreateIndex
CREATE INDEX "Exercise_ownerId_idx" ON "public"."Exercise"("ownerId");

-- CreateIndex
CREATE INDEX "Exercise_primaryMuscle_idx" ON "public"."Exercise"("primaryMuscle");

-- CreateIndex
CREATE INDEX "Exercise_equipment_idx" ON "public"."Exercise"("equipment");

-- CreateIndex
CREATE INDEX "ExerciseMuscle_muscle_idx" ON "public"."ExerciseMuscle"("muscle");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseMuscle_exerciseId_muscle_key" ON "public"."ExerciseMuscle"("exerciseId", "muscle");

-- CreateIndex
CREATE INDEX "ExerciseMedia_exerciseId_idx" ON "public"."ExerciseMedia"("exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseFavorite_userId_exerciseId_key" ON "public"."ExerciseFavorite"("userId", "exerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "UserExercise_userId_exerciseId_key" ON "public"."UserExercise"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutPlan_userId_idx" ON "public"."WorkoutPlan"("userId");

-- CreateIndex
CREATE INDEX "WorkoutPlanDay_planId_idx" ON "public"."WorkoutPlanDay"("planId");

-- CreateIndex
CREATE INDEX "WorkoutPlanExercise_dayId_idx" ON "public"."WorkoutPlanExercise"("dayId");

-- CreateIndex
CREATE INDEX "WorkoutPlanExercise_exerciseId_idx" ON "public"."WorkoutPlanExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "PlannedSet_planExerciseId_idx" ON "public"."PlannedSet"("planExerciseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutPlanVersion_planId_version_key" ON "public"."WorkoutPlanVersion"("planId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingSchedule_planId_key" ON "public"."TrainingSchedule"("planId");

-- CreateIndex
CREATE INDEX "TrainingSchedule_userId_idx" ON "public"."TrainingSchedule"("userId");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_status_idx" ON "public"."WorkoutSession"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkoutSession_userId_startedAt_idx" ON "public"."WorkoutSession"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "WorkoutSessionExercise_sessionId_idx" ON "public"."WorkoutSessionExercise"("sessionId");

-- CreateIndex
CREATE INDEX "WorkoutSessionExercise_exerciseId_idx" ON "public"."WorkoutSessionExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "WorkoutSet_sessionExerciseId_idx" ON "public"."WorkoutSet"("sessionExerciseId");

-- CreateIndex
CREATE INDEX "PersonalRecord_userId_achievedAt_idx" ON "public"."PersonalRecord"("userId", "achievedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalRecord_userId_exerciseId_recordKey_key" ON "public"."PersonalRecord"("userId", "exerciseId", "recordKey");

-- CreateIndex
CREATE INDEX "BodyWeightEntry_userId_measuredAt_idx" ON "public"."BodyWeightEntry"("userId", "measuredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Achievement_code_key" ON "public"."Achievement"("code");

-- CreateIndex
CREATE UNIQUE INDEX "UserAchievement_userId_achievementId_key" ON "public"."UserAchievement"("userId", "achievementId");

-- CreateIndex
CREATE INDEX "SyncOperation_createdAt_idx" ON "public"."SyncOperation"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SyncOperation_userId_opId_key" ON "public"."SyncOperation"("userId", "opId");

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserProfile" ADD CONSTRAINT "UserProfile_activePlanId_fkey" FOREIGN KEY ("activePlanId") REFERENCES "public"."WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserSettings" ADD CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuthSession" ADD CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RefreshToken" ADD CONSTRAINT "RefreshToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."AuthSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Exercise" ADD CONSTRAINT "Exercise_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseMuscle" ADD CONSTRAINT "ExerciseMuscle_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseMedia" ADD CONSTRAINT "ExerciseMedia_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseFavorite" ADD CONSTRAINT "ExerciseFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExerciseFavorite" ADD CONSTRAINT "ExerciseFavorite_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserExercise" ADD CONSTRAINT "UserExercise_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserExercise" ADD CONSTRAINT "UserExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutPlan" ADD CONSTRAINT "WorkoutPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutPlanDay" ADD CONSTRAINT "WorkoutPlanDay_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_dayId_fkey" FOREIGN KEY ("dayId") REFERENCES "public"."WorkoutPlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutPlanExercise" ADD CONSTRAINT "WorkoutPlanExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlannedSet" ADD CONSTRAINT "PlannedSet_planExerciseId_fkey" FOREIGN KEY ("planExerciseId") REFERENCES "public"."WorkoutPlanExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutPlanVersion" ADD CONSTRAINT "WorkoutPlanVersion_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrainingSchedule" ADD CONSTRAINT "TrainingSchedule_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."WorkoutPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "public"."WorkoutPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSession" ADD CONSTRAINT "WorkoutSession_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "public"."WorkoutPlanDay"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSessionExercise" ADD CONSTRAINT "WorkoutSessionExercise_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."WorkoutSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSessionExercise" ADD CONSTRAINT "WorkoutSessionExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkoutSet" ADD CONSTRAINT "WorkoutSet_sessionExerciseId_fkey" FOREIGN KEY ("sessionExerciseId") REFERENCES "public"."WorkoutSessionExercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PersonalRecord" ADD CONSTRAINT "PersonalRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PersonalRecord" ADD CONSTRAINT "PersonalRecord_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "public"."Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PersonalRecord" ADD CONSTRAINT "PersonalRecord_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."WorkoutSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BodyWeightEntry" ADD CONSTRAINT "BodyWeightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserAchievement" ADD CONSTRAINT "UserAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "public"."Achievement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SyncOperation" ADD CONSTRAINT "SyncOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
