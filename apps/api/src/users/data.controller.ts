import { BadRequestException, Body, Controller, Get, Header, HttpCode, Post, Res, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { DataService } from './data.service';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users/me')
export class DataController {
  constructor(private readonly data: DataService) {}

  @Get('export.json')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Alle eigenen Daten als JSON exportieren (DSGVO Art. 15/20)' })
  async exportJson(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="satzio-export-${new Date().toISOString().slice(0, 10)}.json"`);
    return this.data.exportJson(user.id);
  }

  @Get('export.csv')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @ApiOperation({ summary: 'Trainingshistorie als CSV exportieren' })
  async exportCsv(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Content-Disposition', `attachment; filename="satzio-training-${new Date().toISOString().slice(0, 10)}.csv"`);
    return this.data.exportCsv(user.id);
  }

  @Post('import')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Eigene Daten importieren (SATZIO-JSON-Export oder CSV im Exportformat)' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024, files: 1 } }))
  async import(@CurrentUser() user: AuthUser, @UploadedFile() file?: Express.Multer.File, @Body() body?: unknown) {
    if (file) {
      const text = file.buffer.toString('utf8');
      if (file.originalname.toLowerCase().endsWith('.csv') || !text.trimStart().startsWith('{')) {
        return this.data.importCsv(user.id, text);
      }
      try {
        return await this.data.importJson(user.id, JSON.parse(text));
      } catch (e) {
        if (e instanceof SyntaxError) throw new BadRequestException({ code: 'INVALID_IMPORT', message: 'Die Datei ist kein gültiges JSON.' });
        throw e;
      }
    }
    if (body && typeof body === 'object' && Object.keys(body).length) return this.data.importJson(user.id, body);
    throw new BadRequestException({ code: 'NO_FILE', message: 'Keine Datei empfangen.' });
  }
}
