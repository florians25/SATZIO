import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  changeEmailSchema,
  deleteAccountSchema,
  onboardingSchema,
  profileUpdateSchema,
  settingsUpdateSchema,
  type OnboardingInput,
  type ProfileUpdateInput,
  type SettingsUpdateInput,
} from '@satzio/shared';
import type { Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { config } from '../config/config';
import { UsersService } from './users.service';

const uploadLimit = () => ({ limits: { fileSize: config().MAX_UPLOAD_MB * 1024 * 1024, files: 1 } });

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Eigenes Profil inkl. Einstellungen' })
  me(@CurrentUser() user: AuthUser) {
    return this.users.me(user.id);
  }

  @Patch('profile')
  @ApiOperation({ summary: 'Profil ändern' })
  @ApiZodBody(profileUpdateSchema)
  profile(@CurrentUser() user: AuthUser, @Body(new ZodPipe(profileUpdateSchema)) body: ProfileUpdateInput) {
    return this.users.updateProfile(user.id, body);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Einstellungen ändern' })
  @ApiZodBody(settingsUpdateSchema)
  settings(@CurrentUser() user: AuthUser, @Body(new ZodPipe(settingsUpdateSchema)) body: SettingsUpdateInput) {
    return this.users.updateSettings(user.id, body);
  }

  @Post('onboarding')
  @HttpCode(200)
  @ApiOperation({ summary: 'Onboarding abschließen (Ziel, Level, Trainingstage)' })
  @ApiZodBody(onboardingSchema)
  onboarding(@CurrentUser() user: AuthUser, @Body(new ZodPipe(onboardingSchema)) body: OnboardingInput) {
    return this.users.completeOnboarding(user.id, body);
  }

  @Post('avatar')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Profilbild hochladen (wird neu kodiert, Metadaten entfernt)' })
  @UseInterceptors(FileInterceptor('file', uploadLimit()))
  avatar(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File) {
    return this.users.setAvatar(user.id, file?.buffer as Buffer);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Profilbild entfernen' })
  removeAvatar(@CurrentUser() user: AuthUser) {
    return this.users.removeAvatar(user.id);
  }

  @Post('email')
  @HttpCode(200)
  @ApiOperation({ summary: 'E-Mail-Adresse ändern (Passwort erforderlich, neue Bestätigung)' })
  @ApiZodBody(changeEmailSchema)
  email(@CurrentUser() user: AuthUser, @Body(new ZodPipe(changeEmailSchema)) body: z.infer<typeof changeEmailSchema>) {
    return this.users.changeEmail(user.id, body.email, body.password, (id, email) => this.auth.sendVerification(id, email));
  }

  @Post('delete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Konto und alle zugehörigen Daten endgültig löschen' })
  @ApiZodBody(deleteAccountSchema)
  async remove(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(deleteAccountSchema)) body: z.infer<typeof deleteAccountSchema>,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.users.deleteAccount(user.id, body.password);
    res.clearCookie('satzio_rt', { path: '/api/v1/auth' });
    res.clearCookie('satzio_csrf', { path: '/' });
    return result;
  }
}
