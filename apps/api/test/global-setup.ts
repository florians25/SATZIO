import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

/**
 * Integrationstests laufen gegen eine echte PostgreSQL-Datenbank
 * (TEST_DATABASE_URL, Standard: lokale DB "satzio_test").
 * Es wird nichts gelöscht: Migrationen werden nicht-destruktiv angewendet,
 * der Seed ist idempotent und jeder Test legt eigene, zufällig benannte
 * Nutzer an. Dadurch sind Tests wiederholbar, ohne die DB zurückzusetzen.
 */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://satzio:satzio@localhost:5432/satzio_test?schema=public';
  const cwd = resolve(__dirname, '..');
  const env = { ...process.env, DATABASE_URL: url };
  for (const cmd of ['npx prisma migrate deploy', 'npx tsx prisma/seed.ts']) {
    try {
      execSync(cmd, { cwd, env, stdio: 'pipe' });
    } catch (e) {
      const err = e as { stderr?: Buffer; stdout?: Buffer };
      throw new Error(`${cmd} fehlgeschlagen:\n${err.stderr?.toString() ?? ''}${err.stdout?.toString() ?? ''}`.slice(0, 2000));
    }
  }
}
