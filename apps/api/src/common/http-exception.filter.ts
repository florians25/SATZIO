import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';

/**
 * Einheitliches Fehlerformat:
 * { statusCode, code, message, details?, requestId }
 * Interne Fehlerdetails werden nie an den Client ausgeliefert.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = req.requestId;

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Ein unerwarteter Fehler ist aufgetreten.';
    let details: unknown;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      code = defaultCode(status);
      if (typeof body === 'string') message = body;
      else if (body && typeof body === 'object') {
        const b = body as Record<string, unknown>;
        if (typeof b.code === 'string') code = b.code;
        if (typeof b.message === 'string') message = b.message;
        else if (Array.isArray(b.message)) {
          code = 'VALIDATION_FAILED';
          message = 'Die Eingaben sind ungültig.';
          details = b.message;
        }
        if (b.details) details = b.details;
      }
      if (status === HttpStatus.TOO_MANY_REQUESTS) {
        code = 'RATE_LIMITED';
        message = 'Zu viele Anfragen. Bitte warte einen Moment.';
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        code = 'NOT_FOUND';
        message = 'Nicht gefunden.';
      } else if (exception.code === 'P2002') {
        status = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'Der Eintrag existiert bereits.';
      } else {
        this.logger.error(`Prisma ${exception.code} [${requestId}]`, exception.stack);
      }
    } else if (exception instanceof SyntaxError && 'body' in (exception as object)) {
      status = HttpStatus.BAD_REQUEST;
      code = 'INVALID_JSON';
      message = 'Ungültiges JSON.';
    } else {
      const err = exception as Error;
      this.logger.error(`Unbehandelter Fehler [${requestId}]: ${err?.message}`, err?.stack);
    }

    if (status >= 500 && exception instanceof HttpException) {
      this.logger.error(`HTTP ${status} [${requestId}]: ${message}`);
    }

    res.status(status).json({ statusCode: status, code, message, ...(details ? { details } : {}), requestId });
  }
}

function defaultCode(status: number): string {
  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return status >= 500 ? 'INTERNAL_ERROR' : 'ERROR';
  }
}
