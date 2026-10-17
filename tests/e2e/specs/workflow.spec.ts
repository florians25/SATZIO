import { expect, test } from '@playwright/test';
import { onboarding, register, uniqueUser, waitForSync } from './helpers';
import { app } from './helpers';

/**
 * Vollständiger Nutzer-Workflow (Abschnitt 34 der Anforderungen):
 * Registrieren → Onboarding → Vorlage → Training → Gewicht/Wdh. ändern →
 * Satz abhaken → Satz hinzufügen → abschließen → Historie → Diagramme →
 * Logout → Login → Daten prüfen.
 */
test('kompletter Trainingsablauf mit persistierten Daten', async ({ page }) => {
  const user = uniqueUser('flow');
  await register(page, user);
  await onboarding(page, 'template');

  // Vorlage übernehmen
  await expect(page.getByRole('heading', { name: 'Vorlagen' })).toBeVisible();
  await page.getByRole('button', { name: /Push \/ Pull \/ Legs/ }).click();
  await page.getByRole('button', { name: 'Vorlage übernehmen' }).click();

  // Heute: Trainingsplan des Tages
  await expect(page.getByText('PUSH', { exact: false }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Training starten' }).click();

  // Workout-Editor
  await expect(page.getByRole('heading', { name: /push/i })).toBeVisible();
  const firstBlock = page.locator('section').first();
  const weight = firstBlock.getByLabel('Gewicht Satz 2 in kg');
  await weight.fill('60');
  await weight.press('Enter');
  const reps = firstBlock.getByLabel('Wiederholungen Satz 2');
  await reps.fill('12');
  await reps.press('Enter');
  await firstBlock.getByRole('button', { name: 'Satz 2 abhaken' }).click();
  await expect(firstBlock.getByRole('button', { name: 'Satz 2 als offen markieren' })).toBeVisible();

  // Weiteren Satz hinzufügen (übernimmt letzten Wert)
  const before = await firstBlock.getByRole('button', { name: /Optionen für Satz/ }).count();
  await firstBlock.getByRole('button', { name: 'Satz', exact: true }).click();
  await expect(firstBlock.getByRole('button', { name: /Optionen für Satz/ })).toHaveCount(before + 1);

  // Pausentimer läuft nach dem Abhaken (nicht blockierend)
  await expect(page.getByRole('timer')).toBeVisible();

  // Abschließen
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
  await expect(page.getByText('Workout complete')).toBeVisible();
  await expect(page.getByText('Push abgeschlossen!')).toBeVisible();
  await waitForSync(page);
  await expect(page.getByText('Neue Rekorde')).toBeVisible();
  await page.getByRole('button', { name: 'Fertig' }).click();

  // Historie
  await page.goto(app('/history'));
  await expect(page.getByText('Push').first()).toBeVisible();
  await expect(page.getByText(/1 Sätze/)).toBeVisible();

  // Diagramme
  await page.goto(app('/progress'));
  await expect(page.getByText('Trainings', { exact: true }).first()).toBeVisible();
  await page.getByRole('tab', { name: 'Übungen' }).click();
  await expect(page.getByRole('img', { name: 'Gewichtsentwicklung' })).toBeVisible();

  // Logout
  await page.goto(app('/profile'));
  await page.getByRole('button', { name: 'Abmelden' }).click();
  await expect(page.getByText('Dein nächstes Level beginnt hier.')).toBeVisible();

  // Login
  await page.getByRole('link', { name: 'Anmelden' }).click();
  await page.getByLabel('E-Mail oder Benutzername').fill(user.username);
  await page.getByLabel('Passwort', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Anmelden' }).click();
  await expect(page.getByText(/Guten|Hallo|Gute Nacht/).first()).toBeVisible();

  // Persistierte Daten
  await page.goto(app('/history'));
  await page.getByText('Push').first().click();
  await expect(page.getByLabel('Gewicht Satz 2 in kg').first()).toHaveValue('60');
  await expect(page.getByLabel('Wiederholungen Satz 2').first()).toHaveValue('12');

  // Smart Defaults: nächstes Training mit diesem Tag übernimmt die Werte
  await page.goto(app('/plans'));
  await page.getByText('Push / Pull / Legs').click();
  await page.getByRole('button', { name: 'Tagesoptionen' }).click();
  await page.getByText('Diesen Tag jetzt trainieren').click();
  await expect(page.getByLabel('Gewicht Satz 2 in kg').first()).toHaveValue('60');
});
