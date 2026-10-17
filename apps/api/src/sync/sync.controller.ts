import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { syncRequestSchema, type SyncRequest } from '@satzio/shared';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ApiZodBody } from '../common/swagger';
import { ZodPipe } from '../common/zod.pipe';
import { SyncService } from './sync.service';

@ApiTags('Sync')
@ApiBearerAuth()
@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Offline-Mutationen synchronisieren (idempotent, geordnet, mit Konflikterkennung)',
  })
  @ApiZodBody(syncRequestSchema)
  process(@CurrentUser() user: AuthUser, @Body(new ZodPipe(syncRequestSchema)) body: SyncRequest) {
    return this.sync.process(user.id, body);
  }

  @Get('status')
  @ApiOperation({ summary: 'Serverzeit für die Synchronisationsanzeige' })
  status() {
    return { ok: true, serverTime: new Date().toISOString() };
  }
}
