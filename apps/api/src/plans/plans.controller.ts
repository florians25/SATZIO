import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  planSaveSchema,
  scheduleUpdateSchema,
  sharedPlanSchema,
  type PlanSaveInput,
  type ScheduleUpdateInput,
  type SharedPlan,
} from '@satzio/shared';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { PlansService } from './plans.service';

const createSchema = planSaveSchema.extend({ id: z.string().uuid().optional(), activate: z.boolean().optional() });
const templateSchema = z.object({ templateId: z.string().min(1).max(60), activate: z.boolean().optional() });

@ApiTags('Workout Plans')
@ApiBearerAuth()
@Controller('plans')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Eigene Trainingspläne (archivierte mit ?archived=true)' })
  list(@CurrentUser() user: AuthUser, @Query('archived') archived?: string) {
    return this.plans.list(user.id, archived === 'true');
  }

  @Get('templates')
  @ApiOperation({ summary: 'Mitgelieferte Trainingsvorlagen' })
  templates() {
    return this.plans.templates();
  }

  @Post('from-template')
  @ApiOperation({ summary: 'Plan aus Vorlage erstellen' })
  @ApiZodBody(templateSchema)
  fromTemplate(@CurrentUser() user: AuthUser, @Body(new ZodPipe(templateSchema)) body: z.infer<typeof templateSchema>) {
    return this.plans.fromTemplate(user.id, body.templateId, body.activate ?? true);
  }

  @Post('import')
  @ApiOperation({ summary: 'Geteilten Plan (JSON, Format satzio-plan) importieren' })
  @ApiZodBody(sharedPlanSchema)
  import(@CurrentUser() user: AuthUser, @Body(new ZodPipe(sharedPlanSchema)) body: SharedPlan) {
    return this.plans.importShared(user.id, body);
  }

  @Post()
  @ApiOperation({ summary: 'Plan erstellen (vollständige Struktur, IDs vom Client)' })
  @ApiZodBody(createSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(createSchema)) body: z.infer<typeof createSchema>) {
    const { id, activate, ...input } = body;
    return this.plans.create(user.id, input, { id, activate });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Plan mit Tagen, Übungen und Sätzen' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.get(user.id, id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Plan speichern (Auto-Save, versioniert)' })
  @ApiZodBody(planSaveSchema)
  save(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(planSaveSchema)) body: PlanSaveInput) {
    return this.plans.save(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Plan löschen (Trainingshistorie bleibt erhalten)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.remove(user.id, id);
  }

  @Post(':id/duplicate')
  @ApiOperation({ summary: 'Plan duplizieren' })
  duplicate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.duplicate(user.id, id);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Als aktiven Plan festlegen' })
  activate(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.activate(user.id, id);
  }

  @Post('deactivate')
  @HttpCode(200)
  @ApiOperation({ summary: 'Keinen Plan aktiv' })
  deactivate(@CurrentUser() user: AuthUser) {
    return this.plans.activate(user.id, null);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: 'Archivieren / wiederherstellen ({ archived: boolean })' })
  archive(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { archived?: boolean }) {
    return this.plans.setArchived(user.id, id, body?.archived !== false);
  }

  @Patch(':id/favorite')
  @ApiOperation({ summary: 'Als Favorit markieren ({ favorite: boolean })' })
  favorite(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body() body: { favorite?: boolean }) {
    return this.plans.setFavorite(user.id, id, body?.favorite !== false);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Plan als JSON zum Teilen exportieren' })
  export(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.exportShared(user.id, id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: 'Versionshistorie' })
  versions(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.plans.versions(user.id, id);
  }

  @Post(':id/versions/:version/restore')
  @HttpCode(200)
  @ApiOperation({ summary: 'Version wiederherstellen' })
  restore(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('version', ParseIntPipe) version: number,
  ) {
    return this.plans.restoreVersion(user.id, id, version);
  }

  @Patch(':id/schedule')
  @ApiOperation({ summary: 'Trainingsplanung: Modus, Wochentage, Pausieren, Verschieben/Tauschen (overrides)' })
  @ApiZodBody(scheduleUpdateSchema)
  schedule(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(scheduleUpdateSchema)) body: ScheduleUpdateInput,
  ) {
    return this.plans.updateSchedule(user.id, id, body);
  }
}
