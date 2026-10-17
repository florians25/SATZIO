import { expect, test } from '@playwright/test';
import { onboarding, register, uniqueUser, waitForSync } from './helpers';
import { app } from './helpers';

/**
 * Offline-First: Training läuft ohne Netz weiter, übersteht einen Neustart
 * der App und wird nach dem Reconnect synchronisiert.
 */
test('Training offline fortsetzen, neu laden und synchronisieren', async ({ page, context }) => {
  const user = uniqueUser('off');
  await register(page, user);
  await onboarding(page, 'template');
  await page.getByRole('button', { name: /Ganzkörper 2 Tage/ }).click();
  await page.getByRole('button', { name: 'Vorlage übernehmen' }).click();
  await page.getByRole('button', { name: 'Training starten' }).click();
  await expect(page.getByLabel('Gewicht Satz 2 in kg').first()).toBeVisible();
  await waitForSync(page);
  // Service Worker muss die Seite kontrollieren (App-Shell offline)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker?.controller), { timeout: 15_000 }).toBe(true);
  const url = page.url();

  // --- Verbindung weg ---
  await context.setOffline(true);
  const block = page.locator('section').first();
  await block.getByLabel('Gewicht Satz 2 in kg').fill('82,5');
  await block.getByLabel('Wiederholungen Satz 2').fill('7');
  await block.getByLabel('Wiederholungen Satz 2').press('Enter');
  await block.getByRole('button', { name: 'Satz 2 abhaken' }).click();
  await expect(page.getByRole('button', { name: 'Synchronisationsstatus' })).toBeVisible();

  // App "schließen" und offline neu öffnen
  await page.reload();
  await expect(page.getByLabel('Gewicht Satz 2 in kg').first()).toHaveValue('82,5');
  await expect(page.getByLabel('Wiederholungen Satz 2').first()).toHaveValue('7');
  await expect(page.getByRole('button', { name: 'Satz 2 als offen markieren' }).first()).toBeVisible();
  // Weitere Änderung offline: Satz hinzufügen
  const before = await page.locator('section').first().getByRole('button', { name: /Optionen für Satz/ }).count();
  await page.locator('section').first().getByRole('button', { name: 'Satz', exact: true }).click();

  // --- Verbindung zurück ---
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await waitForSync(page);

  // Serverstand prüfen: neu laden (ohne ausstehende Änderungen lädt die App vom Server)
  await page.goto(url);
  await expect(page.getByLabel('Gewicht Satz 2 in kg').first()).toHaveValue('82,5');
  await expect(page.locator('section').first().getByRole('button', { name: /Optionen für Satz/ })).toHaveCount(before + 1);
});

test('Fehlerhafte Eingaben und Netzwerkfehler beim Login', async ({ page, context }) => {
  await page.goto(app('/login'));
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('Bitte E-Mail oder Benutzernamen eingeben.')).toBeVisible();
  await page.getByLabel('E-Mail oder Benutzername').fill('gibtsnicht');
  await page.getByLabel('Passwort', { exact: true }).fill('Falsch1234');
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('E-Mail/Benutzername oder Passwort ist falsch.')).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText('Keine Verbindung zum Server.')).toBeVisible();
  await context.setOffline(false);
  await page.goto(app('/register'));
  await page.getByLabel('E-Mail-Adresse').fill('kaputt');
  await page.getByLabel('Benutzername').click();
  await expect(page.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible();
});
