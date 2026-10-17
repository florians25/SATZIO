import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MailService } from '../src/mail/mail.service';
import { api, cookieValue, makeApp, registerUser } from './helpers';

let app: INestApplication;
beforeAll(async () => {
  app = await makeApp();
});
afterAll(async () => {
  await app.close();
});

describe('Registrierung & Login', () => {
  it('registriert direkt in der App und meldet automatisch an', async () => {
    const u = await registerUser(app, 'reg');
    expect(u.token).toBeTruthy();
    expect(cookieValue(u.cookies, 'satzio_rt')).toBeTruthy();
    const me = await api(app, u).get('/users/me').expect(200);
    expect(me.body.username).toBe(u.username);
    expect(me.body.emailVerified).toBe(false);
    expect(me.body.profile.onboardingCompleted).toBe(false);
    expect(me.body.settings.unit).toBe('kg');
  });

  it('validiert Eingaben mit deutschen Fehlermeldungen', async () => {
    const res = await api(app).post('/auth/register', { username: 'a', email: 'kaputt', password: 'kurz' }).expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
    expect(JSON.stringify(res.body.details)).toContain('E-Mail');
  });

  it('verhindert doppelte Benutzernamen', async () => {
    const u = await registerUser(app, 'dup');
    const res = await api(app).post('/auth/register', { username: u.username.toUpperCase(), email: 'other@example.com', password: 'Sicher123' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('USERNAME_TAKEN');
  });

  it('Login mit E-Mail und Benutzername, generischer Fehler bei falschen Daten', async () => {
    const u = await registerUser(app, 'login');
    await api(app).post('/auth/login', { identifier: u.email, password: u.password }).expect(200);
    await api(app).post('/auth/login', { identifier: u.username, password: u.password }).expect(200);
    const wrong = await api(app).post('/auth/login', { identifier: u.email, password: 'Falsch1234' }).expect(401);
    const unknown = await api(app).post('/auth/login', { identifier: 'niemand@example.com', password: 'Falsch1234' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('lehnt Anfragen ohne Token ab', async () => {
    await api(app).get('/users/me').expect(401);
    await request(app.getHttpServer()).get('/api/v1/users/me').set('Authorization', 'Bearer kaputt').expect(401);
  });
});

describe('Sitzungen & Refresh-Token-Rotation', () => {
  const refresh = (cookies: string[], csrf?: string) => {
    const r = request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookies.map((c) => c.split(';')[0]));
    return csrf ? r.set('X-CSRF-Token', csrf) : r;
  };

  it('rotiert Refresh-Tokens und erkennt Wiederverwendung', async () => {
    const u = await registerUser(app, 'rot');
    const r1 = await refresh(u.cookies, u.csrf).expect(200);
    expect(r1.body.accessToken).toBeTruthy();
    const cookies2 = ([] as string[]).concat(r1.headers['set-cookie']);
    expect(cookieValue(cookies2, 'satzio_rt')).not.toBe(cookieValue(u.cookies, 'satzio_rt'));
    const r2 = await refresh(cookies2, r1.body.csrfToken).expect(200);
    expect(r2.body.user.id).toBe(u.id);
    // Wiederverwendung eines alten Tokens nach der Gnadenfrist → Sitzung widerrufen
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    await prisma.refreshToken.updateMany({ where: { usedAt: { not: null } }, data: { usedAt: new Date(Date.now() - 60_000) } });
    const reuse = await refresh(u.cookies, u.csrf).expect(401);
    expect(reuse.body.code).toBe('SESSION_REVOKED');
    // Auch das neueste Token ist nun ungültig
    await refresh(([] as string[]).concat(r2.headers['set-cookie']), r2.body.csrfToken).expect(401);
    await api(app, { ...u, token: r2.body.accessToken }).get('/users/me').expect(401);
  });

  it('verlangt CSRF-Token für Cookie-Refresh', async () => {
    const u = await registerUser(app, 'csrf');
    const r = await refresh(u.cookies).expect(403);
    expect(r.body.code).toBe('CSRF_FAILED');
    await refresh(u.cookies, 'falsch').expect(403);
  });

  it('Logout widerruft die Sitzung sofort', async () => {
    const u = await registerUser(app, 'logout');
    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .set('Cookie', u.cookies.map((c) => c.split(';')[0]))
      .set('X-CSRF-Token', u.csrf)
      .expect(200);
    await api(app, u).get('/users/me').expect(401);
    await refresh(u.cookies, u.csrf).expect(401);
  });

  it('native Clients erhalten das Refresh-Token im Body', async () => {
    const u = await registerUser(app, 'native');
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Satzio-Client', 'native')
      .send({ identifier: u.email, password: u.password })
      .expect(200);
    expect(login.body.refreshToken).toBeTruthy();
    expect(login.headers['set-cookie']).toBeUndefined();
    const r = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('X-Satzio-Client', 'native')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(r.body.refreshToken).not.toBe(login.body.refreshToken);
  });

  it('listet und widerruft Sitzungen', async () => {
    const u = await registerUser(app, 'sess');
    const second = await api(app).post('/auth/login', { identifier: u.email, password: u.password }).expect(200);
    const list = await api(app, u).get('/auth/sessions').expect(200);
    expect(list.body).toHaveLength(2);
    const other = list.body.find((s: { current: boolean }) => !s.current);
    await api(app, u).delete(`/auth/sessions/${other.id}`).expect(200);
    await api(app, { ...u, token: second.body.accessToken }).get('/users/me').expect(401);
  });
});

describe('Passwort & E-Mail', () => {
  it('Passwort vergessen → zurücksetzen mit Einmal-Token', async () => {
    const mail = app.get(MailService);
    const links: string[] = [];
    const orig = mail.sendPasswordReset.bind(mail);
    mail.sendPasswordReset = async (_to: string, link: string) => {
      links.push(link);
      return true;
    };
    const u = await registerUser(app, 'reset');
    const res = await api(app).post('/auth/password/forgot', { email: u.email }).expect(202);
    // Gleiche Antwort für unbekannte Adressen (keine Account-Enumeration)
    const res2 = await api(app).post('/auth/password/forgot', { email: 'gibtsnicht@example.com' }).expect(202);
    expect(res.body).toEqual(res2.body);
    await new Promise((r) => setTimeout(r, 50));
    expect(links).toHaveLength(1);
    const token = new URL(links[0]).searchParams.get('token')!;
    await api(app).post('/auth/password/reset', { token, password: 'NeuesPasswort9' }).expect(200);
    // Token ist nur einmal gültig
    await api(app).post('/auth/password/reset', { token, password: 'NochEinsNeu9' }).expect(400);
    // Alte Sitzungen sind beendet, neues Passwort funktioniert
    await api(app, u).get('/users/me').expect(401);
    await api(app).post('/auth/login', { identifier: u.email, password: 'NeuesPasswort9' }).expect(200);
    await api(app).post('/auth/login', { identifier: u.email, password: u.password }).expect(401);
    mail.sendPasswordReset = orig;
  });

  it('E-Mail-Verifizierung', async () => {
    const mail = app.get(MailService);
    const links: string[] = [];
    const orig = mail.sendVerification.bind(mail);
    mail.sendVerification = async (_to: string, link: string) => {
      links.push(link);
      return true;
    };
    const u = await registerUser(app, 'verify');
    await new Promise((r) => setTimeout(r, 50));
    const token = new URL(links[0]).searchParams.get('token')!;
    await api(app).post('/auth/verify-email', { token }).expect(200);
    const me = await api(app, u).get('/users/me').expect(200);
    expect(me.body.emailVerified).toBe(true);
    await api(app).post('/auth/verify-email', { token }).expect(400);
    mail.sendVerification = orig;
  });

  it('Passwort ändern beendet andere Sitzungen', async () => {
    const u = await registerUser(app, 'chg');
    const other = await api(app).post('/auth/login', { identifier: u.email, password: u.password }).expect(200);
    await api(app, u).post('/auth/password/change', { currentPassword: 'falsch', newPassword: 'Anders12345' }).expect(400);
    await api(app, u).post('/auth/password/change', { currentPassword: u.password, newPassword: 'Anders12345' }).expect(200);
    await api(app, u).get('/users/me').expect(200);
    await api(app, { ...u, token: other.body.accessToken }).get('/users/me').expect(401);
  });
});

describe('Profil, Einstellungen, Konto', () => {
  it('Onboarding, Profil und Einstellungen speichern', async () => {
    const u = await registerUser(app, 'prof');
    const ob = await api(app, u).post('/users/me/onboarding', { goal: 'muscle_gain', level: 'beginner', trainingDaysPerWeek: 3 }).expect(200);
    expect(ob.body.profile.onboardingCompleted).toBe(true);
    const s = await api(app, u).patch('/users/me/settings', { unit: 'lbs', weightStepsKg: [5, 2.5], motivationLevel: 'off' }).expect(200);
    expect(s.body.settings.unit).toBe('lbs');
    expect(s.body.settings.weightStepsKg).toEqual([2.5, 5]);
    const p = await api(app, u).patch('/users/me/profile', { displayName: 'Flo', heightCm: 182 }).expect(200);
    expect(p.body.profile.displayName).toBe('Flo');
    expect(p.body.profile.heightCm).toBe(182);
  });

  it('Konto löschen entfernt alle Daten', async () => {
    const u = await registerUser(app, 'del');
    await api(app, u).post('/plans/from-template', { templateId: 'full-body-2' }).expect(201);
    await api(app, u).post('/users/me/delete', { password: u.password, confirm: 'falsch' }).expect(400);
    await api(app, u).post('/users/me/delete', { password: 'falsch', confirm: 'LÖSCHEN' }).expect(400);
    await api(app, u).post('/users/me/delete', { password: u.password, confirm: 'LÖSCHEN' }).expect(200);
    await api(app).post('/auth/login', { identifier: u.email, password: u.password }).expect(401);
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    expect(await prisma.workoutPlan.count({ where: { userId: u.id } })).toBe(0);
  });
});
