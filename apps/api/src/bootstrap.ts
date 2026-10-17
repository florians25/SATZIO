import { INestApplication, LogLevel } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { mkdirSync } from 'node:fs';
import { AppModule } from './app.module';
import { config } from './config/config';
import { APP_VERSION } from './meta/meta.controller';
import { uploadRoot } from './users/uploads';

const LEVELS: LogLevel[] = ['error', 'warn', 'log', 'debug', 'verbose'];

export async function createApp(opts: { logger?: boolean } = {}): Promise<INestApplication> {
  const c = config();
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
    logger: opts.logger === false ? false : LEVELS.slice(0, LEVELS.indexOf(c.LOG_LEVEL) + 1),
  });
  if (c.TRUST_PROXY) app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: false, // API liefert kein HTML (außer Swagger)
      crossOriginResourcePolicy: { policy: 'same-site' },
    }),
  );
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));
  app.use(cookieParser());
  app.enableCors({
    origin: (origin, cb) => cb(null, !origin || c.corsOrigins.includes(origin) || origin === 'capacitor://localhost' || origin === 'https://localhost'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id', 'X-Satzio-Client'],
    maxAge: 600,
  });
  app.setGlobalPrefix('api/v1');

  // Hochgeladene Bilder (zufällige Dateinamen, bereits neu kodiert)
  mkdirSync(uploadRoot(), { recursive: true });
  app.use(
    '/api/v1/uploads',
    express.static(uploadRoot(), {
      index: false,
      dotfiles: 'deny',
      maxAge: '30d',
      immutable: true,
      setHeaders: (res) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Security-Policy', "default-src 'none'");
      },
    }),
  );

  if (c.SWAGGER_ENABLED) {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('SATZIO API')
        .setDescription('REST API für SATZIO – Trainieren. Abhaken. Stärker werden. Alle Endpunkte unter /api/v1.')
        .setVersion(APP_VERSION)
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('api/docs', app, doc, { jsonDocumentUrl: 'api/docs/openapi.json' });
  }
  app.enableShutdownHooks();
  return app;
}
