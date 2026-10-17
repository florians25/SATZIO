import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { OnboardingInput, ProfileUpdateInput, SettingsUpdateInput } from '@satzio/shared';
import { TokenService } from '../auth/token.service';
import { verifyPassword } from '../auth/password';
import { dec } from '../common/util';
import { PrismaService } from '../prisma/prisma.service';
import { loadUserView } from './user-view';
import { removeUpload, storeImage } from './uploads';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  me(userId: string) {
    return loadUserView(this.prisma, userId);
  }

  async updateProfile(userId: string, input: ProfileUpdateInput) {
    if (input.username !== undefined) {
      const taken = await this.prisma.user.findFirst({
        where: { username: { equals: input.username, mode: 'insensitive' }, id: { not: userId } },
        select: { id: true },
      });
      if (taken) throw new ConflictException({ code: 'USERNAME_TAKEN', message: 'Dieser Benutzername ist bereits vergeben.' });
      await this.prisma.user.update({ where: { id: userId }, data: { username: input.username } });
    }
    if (input.activePlanId) {
      const plan = await this.prisma.workoutPlan.findFirst({ where: { id: input.activePlanId, userId } });
      if (!plan) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Plan nicht gefunden.' });
    }
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId },
      update: {
        ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
        ...(input.goal !== undefined ? { goal: input.goal } : {}),
        ...(input.level !== undefined ? { level: input.level } : {}),
        ...(input.trainingDaysPerWeek !== undefined ? { trainingDaysPerWeek: input.trainingDaysPerWeek } : {}),
        ...(input.heightCm !== undefined ? { heightCm: dec(input.heightCm) } : {}),
        ...(input.bodyWeightKg !== undefined ? { bodyWeightKg: dec(input.bodyWeightKg) } : {}),
        ...(input.targetWeightKg !== undefined ? { targetWeightKg: dec(input.targetWeightKg) } : {}),
        ...(input.activePlanId !== undefined ? { activePlanId: input.activePlanId } : {}),
      },
    });
    return this.me(userId);
  }

  async updateSettings(userId: string, input: SettingsUpdateInput) {
    const { weightStepsKg, ...rest } = input;
    await this.prisma.userSettings.upsert({
      where: { userId },
      create: { userId },
      update: {
        ...rest,
        ...(weightStepsKg ? { weightStepsKg: [...new Set(weightStepsKg)].sort((a, b) => a - b).map((n) => dec(n)!) } : {}),
      },
    });
    return this.me(userId);
  }

  async completeOnboarding(userId: string, input: OnboardingInput) {
    await this.prisma.userProfile.upsert({
      where: { userId },
      create: { userId, ...input, onboardingCompletedAt: new Date() },
      update: { ...input, onboardingCompletedAt: new Date() },
    });
    return this.me(userId);
  }

  async setAvatar(userId: string, buffer: Buffer) {
    const path = await storeImage(buffer, 'avatars', 512);
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    await this.prisma.userProfile.update({ where: { userId }, data: { avatarPath: path } });
    await removeUpload(profile?.avatarPath);
    return this.me(userId);
  }

  async removeAvatar(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({ where: { userId } });
    await this.prisma.userProfile.update({ where: { userId }, data: { avatarPath: null } });
    await removeUpload(profile?.avatarPath);
    return this.me(userId);
  }

  async changeEmail(userId: string, email: string, password: string, sendVerification: (id: string, email: string) => Promise<void>) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !(await verifyPassword(user.passwordHash, password))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Das Passwort ist falsch.' });
    }
    const normalized = email.toLowerCase();
    if (normalized === user.email) return this.me(userId);
    const taken = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (taken) throw new ConflictException({ code: 'EMAIL_UNAVAILABLE', message: 'Diese E-Mail-Adresse kann nicht verwendet werden.' });
    await this.prisma.user.update({ where: { id: userId }, data: { email: normalized, emailVerifiedAt: null } });
    await sendVerification(userId, normalized);
    return this.me(userId);
  }

  /** Löscht das Konto inkl. aller zugehörigen Daten (Kaskade) und Uploads. */
  async deleteAccount(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, include: { profile: true } });
    if (!user) throw new NotFoundException();
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new BadRequestException({ code: 'WRONG_PASSWORD', message: 'Das Passwort ist falsch.' });
    }
    const media = await this.prisma.exerciseMedia.findMany({
      where: { exercise: { ownerId: userId } },
      select: { url: true },
    });
    await this.tokens.revokeAllSessions(userId);
    await this.prisma.user.delete({ where: { id: userId } });
    await removeUpload(user.profile?.avatarPath);
    for (const m of media) await removeUpload(m.url.replace('/api/v1/uploads/', ''));
    return { deleted: true };
  }
}
