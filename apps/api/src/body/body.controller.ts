import { Body, Controller, Delete, Get, Injectable, Module, NotFoundException, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { bodyWeightEntrySchema, type BodyWeightEntryInput, type BodyWeightEntryView } from '@satzio/shared';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { dec, num } from '../common/util';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BodyService {
  constructor(private readonly prisma: PrismaService) {}

  private view(e: Prisma.BodyWeightEntryGetPayload<object>): BodyWeightEntryView {
    return {
      id: e.id,
      measuredAt: e.measuredAt.toISOString(),
      weightKg: num(e.weightKg),
      bodyFatPct: num(e.bodyFatPct),
      measurements: (e.measurements as Record<string, number | null> | null) ?? null,
      notes: e.notes,
    };
  }

  async list(userId: string) {
    const rows = await this.prisma.bodyWeightEntry.findMany({ where: { userId }, orderBy: { measuredAt: 'desc' }, take: 1000 });
    return rows.map((r) => this.view(r));
  }

  private data(input: BodyWeightEntryInput) {
    return {
      measuredAt: new Date(input.measuredAt),
      weightKg: dec(input.weightKg),
      bodyFatPct: dec(input.bodyFatPct ?? null),
      measurements: input.measurements ? (input.measurements as Prisma.InputJsonValue) : Prisma.DbNull,
      notes: input.notes ?? null,
    };
  }

  async create(userId: string, input: BodyWeightEntryInput) {
    const e = await this.prisma.bodyWeightEntry.create({ data: { userId, ...this.data(input) } });
    await this.syncProfile(userId);
    return this.view(e);
  }

  async update(userId: string, id: string, input: BodyWeightEntryInput) {
    const found = await this.prisma.bodyWeightEntry.findFirst({ where: { id, userId } });
    if (!found) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Eintrag nicht gefunden.' });
    const e = await this.prisma.bodyWeightEntry.update({ where: { id }, data: this.data(input) });
    await this.syncProfile(userId);
    return this.view(e);
  }

  async remove(userId: string, id: string) {
    const r = await this.prisma.bodyWeightEntry.deleteMany({ where: { id, userId } });
    if (!r.count) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Eintrag nicht gefunden.' });
    await this.syncProfile(userId);
    return { deleted: true };
  }

  /** Aktuelles Körpergewicht im Profil = jüngster Eintrag. */
  private async syncProfile(userId: string) {
    const latest = await this.prisma.bodyWeightEntry.findFirst({
      where: { userId, weightKg: { not: null } },
      orderBy: { measuredAt: 'desc' },
    });
    await this.prisma.userProfile.updateMany({ where: { userId }, data: { bodyWeightKg: latest?.weightKg ?? null } });
  }
}

@ApiTags('Body')
@ApiBearerAuth()
@Controller('body-weight')
export class BodyController {
  constructor(private readonly body: BodyService) {}

  @Get()
  @ApiOperation({ summary: 'Körpergewicht & Maße (freiwillig)' })
  list(@CurrentUser() user: AuthUser) {
    return this.body.list(user.id);
  }

  @Post()
  @ApiZodBody(bodyWeightEntrySchema)
  @ApiOperation({ summary: 'Eintrag hinzufügen' })
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(bodyWeightEntrySchema)) body: BodyWeightEntryInput) {
    return this.body.create(user.id, body);
  }

  @Put(':id')
  @ApiZodBody(bodyWeightEntrySchema)
  @ApiOperation({ summary: 'Eintrag ändern' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(bodyWeightEntrySchema)) body: BodyWeightEntryInput,
  ) {
    return this.body.update(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eintrag löschen' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.body.remove(user.id, id);
  }
}

@Module({ controllers: [BodyController], providers: [BodyService] })
export class BodyModule {}
