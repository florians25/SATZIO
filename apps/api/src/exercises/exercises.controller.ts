import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  customExerciseSchema,
  userExerciseSettingsSchema,
  type CustomExerciseInput,
  type UserExerciseSettingsInput,
} from '@satzio/shared';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { ExercisesService } from './exercises.service';

@ApiTags('Exercises')
@ApiBearerAuth()
@Controller('exercises')
export class ExercisesController {
  constructor(private readonly exercises: ExercisesService) {}

  @Get()
  @ApiOperation({ summary: 'Alle verfügbaren Übungen (Bibliothek + eigene). Suche/Filter: q, muscle, equipment, favorites' })
  async list(
    @CurrentUser() user: AuthUser,
    @Query('q') q?: string,
    @Query('muscle') muscle?: string,
    @Query('equipment') equipment?: string,
    @Query('favorites') favorites?: string,
  ) {
    let items = await this.exercises.list(user.id);
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter(
        (e) =>
          e.nameDe.toLowerCase().includes(needle) ||
          e.nameEn?.toLowerCase().includes(needle) ||
          e.aliases.some((a) => a.toLowerCase().includes(needle)),
      );
    }
    if (muscle) items = items.filter((e) => e.primaryMuscle === muscle || e.secondaryMuscles.includes(muscle as never));
    if (equipment) items = items.filter((e) => e.equipment === equipment);
    if (favorites === 'true') items = items.filter((e) => e.isFavorite);
    return items;
  }

  @Get('performance')
  @ApiOperation({ summary: 'Letzte Leistungen & Bestwerte je Übung (für Smart Defaults/Progression)' })
  performance(@CurrentUser() user: AuthUser) {
    return this.exercises.performance(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Übungsdetails' })
  get(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.get(user.id, id);
  }

  @Get(':id/history')
  @ApiOperation({ summary: 'Trainingsverlauf dieser Übung' })
  history(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.history(user.id, id);
  }

  @Post()
  @ApiOperation({ summary: 'Eigene Übung erstellen' })
  @ApiZodBody(customExerciseSchema)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(customExerciseSchema)) body: CustomExerciseInput) {
    return this.exercises.create(user.id, body);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Eigene Übung bearbeiten' })
  @ApiZodBody(customExerciseSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(customExerciseSchema)) body: CustomExerciseInput,
  ) {
    return this.exercises.update(user.id, id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eigene Übung löschen (oder archivieren, falls in Plänen verwendet)' })
  remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.remove(user.id, id);
  }

  @Put(':id/favorite')
  @HttpCode(200)
  @ApiOperation({ summary: 'Als Favorit markieren' })
  fav(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.setFavorite(user.id, id, true);
  }

  @Delete(':id/favorite')
  @ApiOperation({ summary: 'Favorit entfernen' })
  unfav(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.setFavorite(user.id, id, false);
  }

  @Patch(':id/settings')
  @ApiOperation({ summary: 'Individuelle Einstellungen (Gewichtsschritt, Standardwerte, Geräteeinstellung)' })
  @ApiZodBody(userExerciseSettingsSchema)
  settings(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(userExerciseSettingsSchema)) body: UserExerciseSettingsInput,
  ) {
    return this.exercises.updateUserSettings(user.id, id, body);
  }

  @Post(':id/images')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Eigenes Bild hochladen (nur für dich sichtbar)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  image(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @UploadedFile() file?: Express.Multer.File) {
    return this.exercises.addImage(user.id, id, file?.buffer as Buffer);
  }

  @Delete(':id/images')
  @ApiOperation({ summary: 'Eigene Bilder dieser Übung entfernen' })
  removeImages(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.exercises.removeImages(user.id, id);
  }
}
