import { Controller, Get, Module } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { MetaView } from '@satzio/shared';
import { Public } from '../common/decorators';
import { config } from '../config/config';
import { MailService } from '../mail/mail.service';
import { PrismaService } from '../prisma/prisma.service';

export const APP_VERSION = '1.0.0';

@ApiTags('Meta')
@Controller()
export class MetaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Public()
  @Get('meta')
  @ApiOperation({ summary: 'Serverinformationen (Registrierung aktiv? E-Mail-Versand aktiv?)' })
  meta(): MetaView {
    return {
      name: 'SATZIO',
      version: APP_VERSION,
      registrationEnabled: config().REGISTRATION_ENABLED,
      mailEnabled: this.mail.enabled,
      serverTime: new Date().toISOString(),
    };
  }

  @Public()
  @SkipThrottle()
  @Get('health')
  @ApiOperation({ summary: 'Healthcheck inkl. Datenbank' })
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', version: APP_VERSION };
  }
}

@Module({ controllers: [MetaController] })
export class MetaModule {}
