import { expect, test } from '@playwright/test';
import { onboarding, register, uniqueUser, waitForSync } from './helpers';

/** Erzeugt Screenshots für die Dokumentation (docs/screenshots). Nur mit SCREENSHOTS=1. */
test.skip(!process.env.SCREENSHOTS, 'Nur zur Doku-Erstellung');

const out = (n: string) => `../../docs/screenshots/${n}.png`;

test('Screenshots der Kernbildschirme', async ({ page }) => {
  await page.goto('/');
  await page.screenshot({ path: out('01-willkommen') });
  const user = uniqueUser('shot');
  await register(page, user);
  await page.screenshot({ path: out('02-onboarding') });
  await onboarding(page, 'template');
  await page.getByRole('button', { name: /Push \/ Pull \/ Legs/ }).click();
  await page.getByRole('button', { name: 'Vorlage übernehmen' }).click();
  await expect(page.getByRole('button', { name: 'Training starten' })).toBeVisible();
  await page.screenshot({ path: out('03-heute') });
  await page.getByRole('button', { name: 'Training starten' }).click();
  const block = page.locator('section').first();
  for (const [i, w, r] of [[1, '40', '10'], [2, '60', '12'], [3, '70', '10']] as const) {
    await block.getByLabel(`Gewicht Satz ${i} in kg`).fill(w);
    await block.getByLabel(`Wiederholungen Satz ${i}`).fill(r);
    await block.getByLabel(`Wiederholungen Satz ${i}`).press('Enter');
    await block.getByRole('button', { name: `Satz ${i} abhaken` }).click();
  }
  await block.getByLabel('Gewicht Satz 4 in kg').click();
  await page.screenshot({ path: out('04-workout-liste') });
  await page.getByRole('radio', { name: 'Geführt' }).click();
  await page.screenshot({ path: out('05-workout-gefuehrt') });
  await page.getByRole('radio', { name: 'Liste' }).click();
  await page.getByRole('button', { name: 'Training abschließen' }).click();
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
  await waitForSync(page);
  await expect(page.getByText('Neue Rekorde')).toBeVisible();
  await page.screenshot({ path: out('06-zusammenfassung') });
  await page.goto('/plans/import');
  await page.getByRole('button', { name: 'Beispiel einfügen' }).click();
  await page.getByRole('button', { name: 'Erkennen' }).click();
  await page.screenshot({ path: out('07-notizen-import') });
  await page.goto('/progress');
  await page.getByRole('tab', { name: 'Übungen' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: out('08-fortschritt') });
  await page.goto('/exercises');
  await page.screenshot({ path: out('09-uebungen') });
});
