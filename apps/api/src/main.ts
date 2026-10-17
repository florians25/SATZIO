import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { createApp } from './bootstrap';
import { config } from './config/config';

async function main() {
  const c = config();
  const app = await createApp();
  await app.listen(c.PORT, '0.0.0.0');
  Logger.log(`SATZIO API läuft auf Port ${c.PORT} (Registrierung ${c.REGISTRATION_ENABLED ? 'aktiv' : 'deaktiviert'}, E-Mail ${c.mailEnabled ? 'aktiv' : 'nicht konfiguriert'})`, 'Bootstrap');
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
