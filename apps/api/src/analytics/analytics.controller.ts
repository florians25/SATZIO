import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { AnalyticsService, RANGES, parseRange } from './analytics.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('overview')
  @ApiQuery({ name: 'range', enum: RANGES, required: false })
  @ApiOperation({ summary: 'Hauptkennzahlen (Workouts, Volumen, Dauer, Frequenz, Serie, Rekorde)' })
  overview(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    return this.analytics.overview(user.id, parseRange(range));
  }

  @Get('weekly')
  @ApiQuery({ name: 'range', enum: RANGES, required: false })
  @ApiOperation({ summary: 'Volumen & Frequenz pro Woche' })
  weekly(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    return this.analytics.weekly(user.id, parseRange(range));
  }

  @Get('exercises')
  @ApiOperation({ summary: 'Trainierte Übungen (für Verlaufsdiagramme)' })
  exercises(@CurrentUser() user: AuthUser) {
    return this.analytics.trainedExercises(user.id);
  }

  @Get('exercises/:id')
  @ApiQuery({ name: 'range', enum: RANGES, required: false })
  @ApiOperation({ summary: 'Kraftentwicklung einer Übung (Max-Gewicht, geschätztes 1RM, Volumen)' })
  exercise(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Query('range') range?: string) {
    return this.analytics.exerciseProgress(user.id, id, parseRange(range));
  }

  @Get('muscles')
  @ApiQuery({ name: 'range', enum: RANGES, required: false })
  @ApiOperation({ summary: 'Trainierte Muskelgruppen' })
  muscles(@CurrentUser() user: AuthUser, @Query('range') range?: string) {
    return this.analytics.muscles(user.id, parseRange(range));
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Trainingstage eines Monats (?month=YYYY-MM)' })
  calendar(@CurrentUser() user: AuthUser, @Query('month') month?: string) {
    return this.analytics.calendar(user.id, month ?? '');
  }
}
