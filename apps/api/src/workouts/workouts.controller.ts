import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { syncExerciseSchema, syncSetSchema, type SyncExercise, type SyncSet } from '@satzio/shared';
import { z } from 'zod';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { RecordsService } from './records.service';
import { TodayService } from './today.service';
import { WorkoutsService, type MutationContext } from './workouts.service';

const startSchema = z.object({
  planDayId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(120).optional(),
});
const setPatchSchema = syncSetSchema.omit({ id: true }).partial();
const finishSchema = z.object({
  endedAt: z.string().datetime({ offset: true }).optional(),
  notes: z.string().max(4000).nullable().optional(),
  perceivedExertion: z.number().int().min(1).max(10).nullable().optional(),
});
const sessionPatchSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    notes: z.string().max(4000).nullable(),
    perceivedExertion: z.number().int().min(1).max(10).nullable(),
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
  })
  .partial();
const exercisePatchSchema = z
  .object({
    notes: z.string().max(2000).nullable(),
    restSeconds: z.number().int().min(0).max(1800).nullable(),
    supersetGroup: z.string().max(8).nullable(),
    weightStepKg: z.number().min(0).max(50).nullable(),
  })
  .partial();

/**
 * REST-Schnittstelle für Workouts. Die App nutzt für Änderungen bevorzugt
 * /sync (offline-fähig, idempotent); beide Wege verwenden dieselbe Logik.
 */
@ApiTags('Workouts')
@ApiBearerAuth()
@Controller()
export class WorkoutsController {
  constructor(
    private readonly workouts: WorkoutsService,
    private readonly today: TodayService,
    private readonly records: RecordsService,
  ) {}

  private ctx(user: AuthUser): MutationContext {
    return { userId: user.id, deviceId: null, baseVersion: null };
  }

  @Get('today')
  @ApiOperation({ summary: 'Heutiger Trainingsplan, aktive Workouts, Woche und Serie (?date=YYYY-MM-DD)' })
  getToday(@CurrentUser() user: AuthUser, @Query('date') date?: string) {
    return this.today.today(user.id, date);
  }

  @Get('records')
  @ApiOperation({ summary: 'Persönliche Rekorde (1RM-Werte sind Schätzungen)' })
  listRecords(@CurrentUser() user: AuthUser) {
    return this.records.list(user.id);
  }

  @Get('workouts')
  @ApiOperation({ summary: 'Trainingshistorie (Suche: search, from, to, before, exerciseId, planDayId, limit)' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('before') before?: string,
    @Query('exerciseId') exerciseId?: string,
    @Query('planDayId') planDayId?: string,
    @Query('limit') limit?: string,
  ) {
    const valid = (d?: string) => (d && !Number.isNaN(Date.parse(d)) ? d : undefined);
    const uuid = (v?: string) => (v && /^[0-9a-f-]{36}$/i.test(v) ? v : undefined);
    return this.workouts.list(user.id, {
      search,
      from: valid(from),
      to: valid(to),
      before: valid(before),
      exerciseId: uuid(exerciseId),
      planDayId: uuid(planDayId),
      limit: limit ? Number(limit) || 30 : 30,
    });
  }

  @Get('workouts/active')
  @ApiOperation({ summary: 'Aktive/pausierte Workouts (mehrere = versehentlich doppelt gestartet)' })
  active(@CurrentUser() user: AuthUser) {
    return this.workouts.active(user.id);
  }

  @Post('workouts')
  @ApiOperation({ summary: 'Workout starten (aus Trainingstag mit Smart Defaults oder frei)' })
  @ApiZodBody(startSchema)
  async start(@CurrentUser() user: AuthUser, @Body(new ZodPipe(startSchema)) body: z.infer<typeof startSchema>) {
    const session = await this.workouts.buildFromPlanDay(user.id, body.planDayId ?? null, body.name);
    await this.workouts.createSession(this.ctx(user), session);
    return this.workouts.get(user.id, session.id);
  }

  @Get('workouts/:id')
  @ApiOperation({ summary: 'Workout mit Übungen und Sätzen' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.get(user.id, id);
  }

  @Get('workouts/:id/summary')
  @ApiOperation({ summary: 'Zusammenfassung inkl. Vergleich mit dem letzten vergleichbaren Workout' })
  summary(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.summary(user.id, id);
  }

  @Patch('workouts/:id')
  @ApiOperation({ summary: 'Workout bearbeiten (Name, Notiz, Belastung, Zeiten)' })
  @ApiZodBody(sessionPatchSchema)
  async patch(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(sessionPatchSchema)) body: z.infer<typeof sessionPatchSchema>,
  ) {
    await this.workouts.updateSession(this.ctx(user), id, body);
    return this.workouts.get(user.id, id);
  }

  @Post('workouts/:id/pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'Workout pausieren' })
  async pause(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.workouts.updateSession(this.ctx(user), id, { status: 'paused' });
    return this.workouts.get(user.id, id);
  }

  @Post('workouts/:id/resume')
  @HttpCode(200)
  @ApiOperation({ summary: 'Workout fortsetzen' })
  async resume(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.workouts.updateSession(this.ctx(user), id, { status: 'active' });
    return this.workouts.get(user.id, id);
  }

  @Post('workouts/:id/finish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Workout abschließen – berechnet Rekorde, Achievements, nächstes Training' })
  @ApiZodBody(finishSchema)
  async finish(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(finishSchema)) body: z.infer<typeof finishSchema>,
  ) {
    const r = await this.workouts.finishSession(this.ctx(user), { id, endedAt: body.endedAt ?? new Date().toISOString(), notes: body.notes, perceivedExertion: body.perceivedExertion });
    return r.summary;
  }

  @Delete('workouts/:id')
  @ApiOperation({ summary: 'Workout löschen / verwerfen' })
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    const r = await this.workouts.deleteSession(this.ctx(user), id);
    return { deleted: r.status === 'applied' };
  }

  @Post('workouts/:id/exercises')
  @ApiOperation({ summary: 'Übung hinzufügen (mit Sätzen)' })
  @ApiZodBody(syncExerciseSchema)
  async addExercise(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(syncExerciseSchema)) body: SyncExercise,
  ) {
    await this.workouts.addExercise(this.ctx(user), id, body);
    return this.workouts.get(user.id, id);
  }

  @Patch('workout-exercises/:id')
  @ApiOperation({ summary: 'Übung im Workout ändern (Notiz, Pause, Supersatz, Gewichtsschritt)' })
  @ApiZodBody(exercisePatchSchema)
  updateExercise(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(exercisePatchSchema)) body: z.infer<typeof exercisePatchSchema>,
  ) {
    return this.workouts.updateExercise(this.ctx(user), id, body);
  }

  @Delete('workout-exercises/:id')
  @ApiOperation({ summary: 'Übung aus Workout entfernen' })
  deleteExercise(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.deleteExercise(this.ctx(user), id);
  }

  @Post('workout-exercises/:id/sets')
  @ApiOperation({ summary: 'Satz hinzufügen' })
  @ApiZodBody(syncSetSchema)
  addSet(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(syncSetSchema)) body: SyncSet) {
    return this.workouts.addSet(this.ctx(user), id, body);
  }

  @Patch('workout-sets/:id')
  @ApiOperation({ summary: 'Satz ändern (Gewicht, Wiederholungen, abhaken)' })
  @ApiZodBody(setPatchSchema)
  updateSet(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(setPatchSchema)) body: z.infer<typeof setPatchSchema>,
  ) {
    return this.workouts.updateSet(this.ctx(user), id, body);
  }

  @Delete('workout-sets/:id')
  @ApiOperation({ summary: 'Satz löschen' })
  deleteSet(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.workouts.deleteSet(this.ctx(user), id);
  }
}
