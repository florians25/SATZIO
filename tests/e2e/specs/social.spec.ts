import { expect, test } from '@playwright/test';
import { app, onboarding, register, uniqueUser } from './helpers';

/**
 * Gemeinsames Training mit zwei Nutzern (zwei Browser-Kontexte):
 * A und B registrieren sich → A fügt B per Benutzername hinzu → B nimmt an →
 * A plant ein Training für heute → B sagt zu → beide starten aus der Einladung →
 * A hakt einen Satz ab → B sieht A's Fortschritt live auf /invites/:id.
 */
test('Freunde einladen und live gemeinsam trainieren', async ({ browser }, testInfo) => {
  test.setTimeout(150_000);
  const device = testInfo.project.use;
  const ctxA = await browser.newContext({ ...device });
  const ctxB = await browser.newContext({ ...device });
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const userA = uniqueUser('soa');
  const userB = uniqueUser('sob');

  try {
    // --- Registrieren ---
    await register(pageA, userA);
    await onboarding(pageA, 'template');
    await pageA.getByRole('button', { name: /Ganzkörper 2 Tage/ }).click();
    await pageA.getByRole('button', { name: 'Vorlage übernehmen' }).click();
    await expect(pageA.getByRole('button', { name: 'Training starten' })).toBeVisible();

    await register(pageB, userB);
    await onboarding(pageB, 'none');
    await expect(pageB.getByText(/Guten|Hallo|Gute Nacht/).first()).toBeVisible();

    // --- A fügt B per exaktem Benutzernamen hinzu ---
    await pageA.goto(app('/social?tab=friends'));
    await pageA.getByRole('button', { name: 'Freund hinzufügen' }).click();
    await pageA.getByLabel('Exakter Benutzername').fill(userB.username.toUpperCase());
    await pageA.getByRole('button', { name: 'Suchen' }).click();
    await pageA.getByRole('button', { name: 'Anfrage senden' }).click();
    await expect(pageA.getByText('Anfrage gesendet.')).toBeVisible();
    await pageA.keyboard.press('Escape');

    // --- B sieht die Anfrage im Profil und nimmt an ---
    await pageB.goto(app('/profile'));
    await expect(pageB.getByLabel('1 offene Anfragen')).toBeVisible();
    await pageB.getByRole('link', { name: /Freunde/ }).click();
    await pageB.getByRole('button', { name: `Anfrage von ${userA.username} annehmen` }).click();
    await expect(pageB.getByRole('button', { name: `Optionen für ${userA.username}` })).toBeVisible();

    // --- A plant ein Training für heute und lädt B ein ---
    await pageA.goto(app('/invites/new'));
    await pageA.getByLabel('Titel').fill('Feierabend-Pump');
    // Heute, jetzige Uhrzeit (robust auch kurz vor Mitternacht)
    const nowLocal = await pageA.evaluate(() => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      return { date: `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, time: `${p(d.getHours())}:${p(d.getMinutes())}` };
    });
    await pageA.getByLabel('Datum').fill(nowLocal.date);
    await pageA.getByLabel('Uhrzeit').fill(nowLocal.time);
    await pageA.getByRole('checkbox', { name: new RegExp(userB.username) }).click();
    await pageA.getByRole('radio', { name: 'Ganzkörper A' }).click();
    await pageA.getByRole('button', { name: /Einladung senden/ }).click();
    await expect(pageA).toHaveURL(/\/invites\/[0-9a-f-]{36}$/);
    const inviteUrl = new URL(pageA.url()).pathname.replace(/^.*(\/invites\/)/, '$1');
    await expect(pageA.getByText('Feierabend-Pump').first()).toBeVisible();

    // --- B sagt auf "Heute" zu ---
    await pageB.goto(app('/'));
    const card = pageB.getByTestId('today-invites');
    await expect(card.getByText('Feierabend-Pump')).toBeVisible();
    await card.getByRole('button', { name: 'Feierabend-Pump zusagen' }).click();
    await expect(card.getByText(/Heute mit .* um/)).toBeVisible();

    // --- Beide starten aus der Einladung ---
    await pageB.goto(app(inviteUrl));
    await pageB.getByRole('button', { name: 'Training starten' }).click();
    await expect(pageB).toHaveURL(/\/workout\//);
    await expect(pageB.getByRole('button', { name: 'Satz 1 abhaken' }).first()).toBeVisible();

    await pageA.goto(app(inviteUrl));
    await pageA.getByRole('button', { name: 'Training starten' }).click();
    await expect(pageA).toHaveURL(/\/workout\//);
    await pageA.getByRole('button', { name: 'Satz 1 abhaken' }).first().click();
    await expect(pageA.getByRole('button', { name: 'Satz 1 als offen markieren' }).first()).toBeVisible();
    // Live-Gruppenansicht im Training (B ist bereits verknüpft)
    await expect(pageA.getByTestId('group-live-panel')).toBeVisible({ timeout: 30_000 });

    // --- B sieht A's Fortschritt live ---
    await pageB.goto(app(inviteUrl));
    const panel = pageB.getByTestId('group-live-panel');
    await expect(panel).toBeVisible();
    const rowA = panel.getByTestId('live-participant').filter({ hasText: userA.username });
    await expect(rowA).toBeVisible({ timeout: 30_000 });
    await expect(rowA.getByText(/^1\/\d+ Sätze$/)).toBeVisible({ timeout: 30_000 });
    await expect(rowA.getByText(/Zuletzt:/)).toBeVisible();
    // B's eigenes Training ist ebenfalls verknüpft
    await expect(panel.getByTestId('live-participant').filter({ hasText: '(du)' })).toBeVisible({ timeout: 30_000 });
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});

