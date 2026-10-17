import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Vergibt Request-IDs und protokolliert Anfragen ohne personenbezogene Daten
 * (keine Bodies, keine Query-Strings, keine IP-Adressen).
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request & { requestId?: string }, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    const id = incoming && /^[a-zA-Z0-9-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    req.requestId = id;
    res.setHeader('X-Request-Id', id);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      const path = (req.originalUrl || req.url).split('?')[0];
      if (path.endsWith('/health')) return;
      const line = `${req.method} ${path} ${res.statusCode} ${ms.toFixed(1)}ms [${id}]`;
      if (res.statusCode >= 500) this.logger.error(line);
      else if (res.statusCode >= 400) this.logger.warn(line);
      else this.logger.log(line);
    });
    next();
  }
}
