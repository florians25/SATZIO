import { expect, type Page } from '@playwright/test';

export const PASSWORD = 'Sicher123';

export function uniqueUser(prefix = 'e2e') {
  const id = `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return { username: id, email: `${id}@example.com`, password: PASSWORD };
}

export async function register(page: Page, user: ReturnType<typeof uniqueUser>) {
  await page.goto('/');
  await expect(page.getByText('Dein nächstes Level beginnt hier.')).toBeVisible();
  await page.getByRole('link', { name: 'Kostenlos registrieren' }).click();
  await page.getByLabel('Benutzername').fill(user.username);
  await page.getByLabel('E-Mail-Adresse').fill(user.email);
  await page.getByLabel('Passwort', { exact: true }).fill(user.password);
  await page.getByLabel('Passwort bestätigen').fill(user.password);
  await page.getByRole('button', { name: 'Kostenlos registrieren' }).click();
  await expect(page.getByText('Was möchtest du erreichen?')).toBeVisible();
}

export async function onboarding(page: Page, start: 'template' | 'none' = 'template') {
  await page.getByRole('radio', { name: /Muskelaufbau/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('radio', { name: /Anfänger/ }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await page.getByRole('radio', { name: '3 Tage' }).click();
  await page.getByRole('button', { name: 'Weiter' }).click();
  await expect(page.getByText('Wie möchtest du starten?')).toBeVisible();
  if (start === 'template') await page.getByRole('radio', { name: /Vorlage auswählen/ }).click();
  else await page.getByRole('radio', { name: /ohne Plan starten/ }).click();
}

/** Wartet, bis alle lokalen Änderungen synchronisiert sind (Outbox leer). */
export async function waitForSync(page: Page) {
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const req = indexedDB.open('satzio');
              req.onsuccess = () => {
                const db = req.result;
                try {
                  const tx = db.transaction('outbox', 'readonly');
                  const c = tx.objectStore('outbox').count();
                  c.onsuccess = () => resolve(c.result);
                  c.onerror = () => resolve(-1);
                } catch {
                  resolve(0);
                }
              };
              req.onerror = () => resolve(-1);
            }),
        ),
      { timeout: 20_000 },
    )
    .toBe(0);
}
