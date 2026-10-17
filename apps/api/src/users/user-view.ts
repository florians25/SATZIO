import { NotFoundException } from '@nestjs/common';
import type { UserView } from '@satzio/shared';
import { num } from '../common/util';
import type { PrismaService } from '../prisma/prisma.service';

export function avatarUrl(path: string | null | undefined): string | null {
  return path ? `/api/v1/uploads/${path}` : null;
}

/** Einheitliche Darstellung des angemeldeten Nutzers. */
export async function loadUserView(prisma: PrismaService, userId: string): Promise<UserView> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { profile: true, settings: true },
  });
  if (!user) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Konto nicht gefunden.' });
  const profile = user.profile ?? (await prisma.userProfile.create({ data: { userId } }));
  const settings = user.settings ?? (await prisma.userSettings.create({ data: { userId } }));
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    emailVerified: !!user.emailVerifiedAt,
    createdAt: user.createdAt.toISOString(),
    profile: {
      displayName: profile.displayName,
      avatarUrl: avatarUrl(profile.avatarPath),
      goal: profile.goal,
      level: profile.level,
      trainingDaysPerWeek: profile.trainingDaysPerWeek,
      heightCm: num(profile.heightCm),
      bodyWeightKg: num(profile.bodyWeightKg),
      targetWeightKg: num(profile.targetWeightKg),
      activePlanId: profile.activePlanId,
      onboardingCompleted: !!profile.onboardingCompletedAt,
    },
    settings: {
      unit: settings.unit,
      defaultRestSeconds: settings.defaultRestSeconds,
      autoStartRestTimer: settings.autoStartRestTimer,
      weightStepsKg: settings.weightStepsKg.map((d) => Number(d.toString())),
      motivationLevel: settings.motivationLevel,
      theme: settings.theme,
      language: settings.language === 'en' ? 'en' : 'de',
      timeZone: settings.timeZone,
      soundEnabled: settings.soundEnabled,
      vibrationEnabled: settings.vibrationEnabled,
      notificationsEnabled: settings.notificationsEnabled,
      progressionEnabled: settings.progressionEnabled,
      gamificationEnabled: settings.gamificationEnabled,
      workoutMode: settings.workoutMode,
    },
  };
}
