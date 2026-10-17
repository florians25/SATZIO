import { expect, test } from '@playwright/test';
import { onboarding, register, uniqueUser, waitForSync } from './helpers';

/**
 * Schnelleingabe über die App-eigene Zahlentastatur:
 * Gewicht antippen → per Tastatur tippen → Weiter → Wdh.-Chip → Satz fertig
 * → Satz ist abgehakt, nächster Satz ist aktiv.
 */
test('Satz per Zahlentastatur erfassen und abschließen', async ({ page }) => {
  const user = uniqueUser('kp');
  await register(page, user);
  await onboarding(page, 'template');
  await page.getByRole('button', { name: /Push \/ Pull \/ Legs/ }).click();
  await page.getByRole('button', { name: 'Vorlage übernehmen' }).click();
  await page.getByRole('button', { name: 'Training starten' }).click();

  const block = page.locator('section').first();
  const keypad = page.getByRole('group', { name: 'Zahlentastatur' });
  const weight = block.getByLabel('Gewicht Satz 2 in kg');

  await weight.tap();
  await expect(keypad).toBeVisible();
  // System-Tastatur bleibt zu
  await expect(weight).toHaveAttribute('inputmode', 'none');
  for (const k of ['8', '2', 'Komma', '5']) await keypad.getByRole('button', { name: k, exact: true }).tap();
  await expect(weight).toHaveValue('82,5');

  await keypad.getByRole('button', { name: 'Weiter' }).tap();
  const reps = block.getByLabel('Wiederholungen Satz 2');
  await expect(reps).toBeFocused();
  await keypad.getByRole('button', { name: '7 Wiederholungen' }).tap();
  await expect(reps).toHaveValue('7');

  await keypad.getByRole('button', { name: 'Satz fertig' }).tap();
  await expect(block.getByRole('button', { name: 'Satz 2 als offen markieren' })).toBeVisible();
  // Nächster offener Satz ist aktiv; Gewicht wurde aus Satz 2 vorbelegt
  const next = block.getByLabel('Gewicht Satz 3 in kg');
  await expect(next).toBeFocused();
  await expect(next).toHaveValue('82,5');
  await expect(page.getByRole('timer')).toBeVisible();

  // Erster Tastendruck ersetzt den Wert
  await keypad.getByRole('button', { name: '9', exact: true }).tap();
  await keypad.getByRole('button', { name: '0', exact: true }).tap();
  await expect(next).toHaveValue('90');

  // Schließen speichert sofort
  await keypad.getByRole('button', { name: /Tastatur schließen/ }).tap();
  await expect(keypad).toBeHidden();
  await waitForSync(page);
  await page.reload();
  await expect(page.locator('section').first().getByLabel('Gewicht Satz 3 in kg')).toHaveValue('90');
  await expect(page.locator('section').first().getByLabel('Wiederholungen Satz 2')).toHaveValue('7');
});
