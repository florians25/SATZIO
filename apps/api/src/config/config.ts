import { z } from 'zod';

/**
 * Zentrale, validierte Konfiguration aus Umgebungsvariablen.
 * Fehlende Pflichtwerte führen zu einem verständlichen Startfehler.
 */
const bool = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? def : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL fehlt'),
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET muss mindestens 32 Zeichen lang sein'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().min(1).default(30),
  REFRESH_TTL_SHORT_HOURS: z.coerce.number().int().min(1).default(24),
  PUBLIC_URL: z.string().url().default('http://localhost:8080'),
  CORS_ORIGINS: z.string().default(''),
  COOKIE_SECURE: z.string().optional(),
  REGISTRATION_ENABLED: bool(true),
  REQUIRE_EMAIL_VERIFICATION_FOR_SENSITIVE: bool(false),
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: bool(false),
  SMTP_USER: z.string().default(''),
  SMTP_PASSWORD: z.string().default(''),
  MAIL_FROM: z.string().default('SATZIO <no-reply@satzio.local>'),
  MAIL_LOG_LINKS: bool(false),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_UPLOAD_MB: z.coerce.number().default(5),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().default(300),
  AUTH_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().default(10),
  TRUST_PROXY: bool(true),
  SWAGGER_ENABLED: bool(true),
  LOG_LEVEL: z.enum(['error', 'warn', 'log', 'debug', 'verbose']).default('log'),
});

export type AppConfig = z.infer<typeof schema> & {
  corsOrigins: string[];
  cookieSecure: boolean;
  mailEnabled: boolean;
};

let cached: AppConfig | null = null;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Ungültige Konfiguration:\n${msg}`);
  }
  const c = parsed.data;
  const publicOrigin = new URL(c.PUBLIC_URL).origin;
  const corsOrigins = [publicOrigin, ...c.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean)];
  return {
    ...c,
    corsOrigins: [...new Set(corsOrigins)],
    cookieSecure: c.COOKIE_SECURE ? c.COOKIE_SECURE === 'true' : c.PUBLIC_URL.startsWith('https://'),
    mailEnabled: c.SMTP_HOST.length > 0,
  };
}

export function config(): AppConfig {
  if (!cached) cached = loadConfig();
  return cached;
}

/** Nur für Tests. */
export function resetConfigCache() {
  cached = null;
}
