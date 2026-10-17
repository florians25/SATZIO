import { expect, test } from '@playwright/test';
import { onboarding, register, uniqueUser } from './helpers';

/** Screenshots der Schnelleingabe (Zahlentastatur, Scheibenrechner, Wischen). Nur mit SCREENSHOTS=1. */
test.skip(!process.env.SCREENSHOTS, 'Nur zur Doku-Erstellung');

const out = (n: string) => `../../docs/screenshots/${n}.png`;

test('Screenshots der Satz-Eingabe', async ({ page }) => {
  const user = uniqueUser('inp');
  await register(page, user);
  await onboarding(page, 'template');
  await page.getByRole('button', { name: /Push \/ Pull \/ Legs/ }).click();
  await page.getByRole('button', { name: 'Vorlage übernehmen' }).click();
  await page.getByRole('button', { name: 'Training starten' }).click();
  const block = page.locator('section').first();
  const keypad = page.getByRole('group', { name: 'Zahlentastatur' });

  // Satz 1 schnell erledigen, damit "Wie Satz 1" erscheint
  await block.getByLabel('Gewicht Satz 1 in kg').tap();
  await expect(keypad).toBeVisible();
  for (const k of ['6', '0']) await keypad.getByRole('button', { name: k, exact: true }).tap();
  await keypad.getByRole('button', { name: 'Weiter' }).tap();
  await keypad.getByRole('button', { name: '10 Wiederholungen' }).tap();
  await keypad.getByRole('button', { name: 'Satz fertig' }).tap();
  await expect(block.getByRole('button', { name: 'Satz 1 als offen markieren' })).toBeVisible();
  // jetzt aktiv: Gewicht Satz 2
  await keypad.getByRole('button', { name: '7', exact: true }).tap();
  await keypad.getByRole('button', { name: '2', exact: true }).tap();
  await keypad.getByRole('button', { name: 'Komma' }).tap();
  await keypad.getByRole('button', { name: '5', exact: true }).tap();
  await page.waitForTimeout(450);
  await page.screenshot({ path: out('input-keypad-gewicht') });

  await keypad.getByRole('button', { name: 'Weiter' }).tap();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('input-wdh-chips') });

  await block.getByLabel('Gewicht Satz 2 in kg').tap();
  await keypad.getByRole('button', { name: 'Scheibenrechner' }).tap();
  await page.waitForTimeout(450);
  await page.screenshot({ path: out('input-scheibenrechner') });

  await keypad.getByRole('button', { name: /Tastatur schließen/ }).tap();
  await expect(keypad).toBeHidden();
  await page.waitForTimeout(400);

  // Wischen: Satz 3 nach rechts (gehalten) …
  const row3 = block.locator('[data-set-row]').nth(2);
  const b3 = (await row3.boundingBox())!;
  await page.mouse.move(b3.x + 70, b3.y + b3.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b3.x + 70 + i * 12, b3.y + b3.height / 2);
  await page.waitForTimeout(150);
  await page.screenshot({ path: out('input-wischen-rechts') });
  await page.mouse.move(b3.x + 70, b3.y + b3.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(300);

  // … und Satz 4 nach links → Aktionen
  const row4 = block.locator('[data-set-row]').nth(3);
  const b4 = (await row4.boundingBox())!;
  await page.mouse.move(b4.x + 290, b4.y + b4.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(b4.x + 290 - i * 16, b4.y + b4.height / 2);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.screenshot({ path: out('input-wischen-aktionen') });

  // Geführter Modus mit Tastatur
  await page.mouse.click(5, 300);
  await page.getByRole('radio', { name: 'Geführt' }).click();
  await page.getByLabel('Gewicht in kg').tap();
  await page.waitForTimeout(450);
  await page.screenshot({ path: out('input-gefuehrt') });
});
