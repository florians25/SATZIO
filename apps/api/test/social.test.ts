import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, makeApp, registerUser, uuid, type TestUser } from './helpers';

/**
 * Freunde & gemeinsames Training: Anfragen, Privatsphäre, Einladungen,
 * Autorisierung (Nicht-Teilnehmende → 404), Live-Fortschritt, Verknüpfen
 * vor/nach dem Sync, Absagen und Kontolöschung.
 */
let app: INestApplication;
let prisma: PrismaClient;
let a: TestUser; // Gastgeber
let b: TestUser; // Freund
let c: TestUser; // Fremder
let benchId: string;

beforeAll(async () => {
  app = await makeApp();
  prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
  a = await registerUser(app, 'anna');
  b = await registerUser(app, 'ben');
  c = await registerUser(app, 'carl');
  const list = await api(app, a).get('/exercises').expect(200);
  benchId = list.body.find((e: { slug: string }) => e.slug === 'barbell-bench-press').id;
});
afterAll(async () => {
  await prisma.$disconnect();
  await app.close();
});

const now = () => new Date().toISOString();

function sessionCreate(sessionId: string, exId: string, setIds: string[]) {
  return {
    opId: uuid(),
    type: 'session.create',
    clientTs: now(),
    baseVersion: null,
    payload: {
      session: {
        id: sessionId,
        name: 'Gemeinsam',
        planId: null,
        planDayId: null,
        startedAt: now(),
        notes: null,
        exercises: [
          {
            id: exId,
            exerciseId: benchId,
            name: 'Bankdrücken',
            primaryMuscle: 'chest',
            order: 0,
            notes: null,
            restSeconds: 90,
            supersetGroup: null,
            planExerciseId: null,
            weightStepKg: null,
            sets: setIds.map((id, order) => ({
              id,
              order,
              type: 'working',
              weightKg: 80,
              reps: 8,
              completed: false,
              completedAt: null,
              targetRepsMin: null,
              targetRepsMax: null,
              targetWeightKg: null,
              weightSource: 'none',
              repsSource: 'none',
              rpe: null,
            })),
          },
        ],
      },
    },
  };
}

async function befriend(x: TestUser, y: TestUser) {
  const r = await api(app, x).post('/friends/requests', { username: y.username }).expect(201);
  if (r.body.status === 'accepted') return;
  const ov = await api(app, y).get('/friends').expect(200);
  const req = ov.body.incoming.find((i: { user: { id: string } }) => i.user.id === x.id);
  await api(app, y).post(`/friends/requests/${req.id}/accept`).expect(200);
}

describe('Freunde', () => {
  it('Suche liefert nur exakte Treffer (Groß-/Kleinschreibung egal)', async () => {
    const exact = await api(app, a).get(`/friends/search?username=${b.username.toUpperCase()}`).expect(200);
    expect(exact.body.user.id).toBe(b.id);
    expect(exact.body.user.email).toBeUndefined();
    expect(exact.body.relation).toBe('none');
    expect(exact.body.canRequest).toBe(true);
    const partial = await api(app, a).get(`/friends/search?username=${b.username.slice(0, -2)}`).expect(200);
    expect(partial.body.user).toBeNull();
    const prefix = await api(app, a).get('/friends/search?username=ben').expect(200);
    expect(prefix.body.user).toBeNull();
  });

  it('Anfrage senden, annehmen, entfernen, ablehnen, zurückziehen', async () => {
    const sent = await api(app, a).post('/friends/requests', { username: b.username }).expect(201);
    expect(sent.body.status).toBe('pending');
    // doppelte Anfrage bleibt eine Anfrage
    await api(app, a).post('/friends/requests', { username: b.username }).expect(201);
    const ovA = await api(app, a).get('/friends').expect(200);
    expect(ovA.body.outgoing).toHaveLength(1);
    const ovB = await api(app, b).get('/friends').expect(200);
    expect(ovB.body.incoming).toHaveLength(1);
    const reqId = ovB.body.incoming[0].id;
    // A kann seine eigene Anfrage nicht annehmen
    await api(app, a).post(`/friends/requests/${reqId}/accept`).expect(404);
    await api(app, b).post(`/friends/requests/${reqId}/accept`).expect(200);
    const friendsA = await api(app, a).get('/friends').expect(200);
    expect(friendsA.body.friends.map((f: { id: string }) => f.id)).toEqual([b.id]);
    expect(friendsA.body.friends[0].activity).toBeNull(); // B teilt Aktivität nicht (Standard)

    // Entfernen und erneut befreunden
    await api(app, a).delete(`/friends/${b.id}`).expect(200);
    expect((await api(app, b).get('/friends').expect(200)).body.friends).toHaveLength(0);

    // C fragt A an, A lehnt ab → C sieht weiterhin "ausstehend", keine neue Anfrage
    await api(app, c).post('/friends/requests', { username: a.username }).expect(201);
    const inc = (await api(app, a).get('/friends').expect(200)).body.incoming;
    await api(app, a).post(`/friends/requests/${inc[0].id}/decline`).expect(200);
    expect((await api(app, a).get('/friends').expect(200)).body.incoming).toHaveLength(0);
    const ovC = await api(app, c).get('/friends').expect(200);
    expect(ovC.body.outgoing).toHaveLength(1);
    expect((await api(app, c).post('/friends/requests', { username: a.username }).expect(201)).body.status).toBe('pending');
    expect((await api(app, a).get('/friends').expect(200)).body.incoming).toHaveLength(0);
    // C zieht zurück
    await api(app, c).delete(`/friends/requests/${ovC.body.outgoing[0].id}`).expect(200);
    expect((await api(app, c).get('/friends').expect(200)).body.outgoing).toHaveLength(0);

    await befriend(a, b);
    expect((await api(app, a).get('/friends').expect(200)).body.friends).toHaveLength(1);
  });

  it('Privatsphäre: keine Anfragen per Benutzername, aber per Einladungslink', async () => {
    const d = await registerUser(app, 'dora');
    const me = await api(app, d).patch('/users/me/settings', { allowFriendRequests: false }).expect(200);
    expect(me.body.settings.allowFriendRequests).toBe(false);
    expect(me.body.settings.shareActivityWithFriends).toBe(false);
    const s = await api(app, c).get(`/friends/search?username=${d.username}`).expect(200);
    expect(s.body.canRequest).toBe(false);
    const blocked = await api(app, c).post('/friends/requests', { username: d.username }).expect(403);
    expect(blocked.body.code).toBe('FRIEND_REQUESTS_DISABLED');

    const code = await api(app, d).get('/friends/code').expect(200);
    expect(code.body.url).toContain(`/friends/add/${code.body.code}`);
    const preview = await api(app, c).get(`/friends/code/${code.body.code}`).expect(200);
    expect(preview.body.user.username).toBe(d.username);
    expect((await api(app, c).post('/friends/requests', { code: code.body.code }).expect(201)).body.status).toBe('pending');
    // eigener Code → Fehler
    await api(app, d).post('/friends/requests', { code: code.body.code }).expect(400);
    // Code neu erzeugen → alter Link ungültig
    const fresh = await api(app, d).post('/friends/code/regenerate').expect(200);
    expect(fresh.body.code).not.toBe(code.body.code);
    const invalid = await api(app, c).post('/friends/requests', { code: code.body.code }).expect(404);
    expect(invalid.body.code).toBe('INVALID_CODE');
  });

  it('Aktivität nur sichtbar, wenn geteilt', async () => {
    await api(app, b).patch('/users/me/settings', { shareActivityWithFriends: true }).expect(200);
    const s = uuid();
    await api(app, b)
      .post('/sync', {
        deviceId: 'device-ben-1',
        operations: [
          sessionCreate(s, uuid(), [uuid()]),
          { opId: uuid(), type: 'session.finish', clientTs: now(), baseVersion: 1, payload: { id: s, endedAt: now() } },
        ],
      })
      .expect(200);
    const f = (await api(app, a).get('/friends').expect(200)).body.friends.find((x: { id: string }) => x.id === b.id);
    expect(f.activity.lastWorkoutAt).toBeTruthy();
    expect(f.activity.streakWeeks).toBeGreaterThanOrEqual(0);
    await api(app, b).patch('/users/me/settings', { shareActivityWithFriends: false }).expect(200);
    const g = (await api(app, a).get('/friends').expect(200)).body.friends.find((x: { id: string }) => x.id === b.id);
    expect(g.activity).toBeNull();
  });
});

describe('Gemeinsames Training', () => {
  let inviteId: string;

  it('nur Freunde können eingeladen werden; Plan-Tag wird ohne Gewichte übernommen', async () => {
    await api(app, a).post('/invites', { startsAt: now(), friendIds: [c.id] }).expect(400);
    await api(app, a).post('/invites', { startsAt: now(), friendIds: [] }).expect(400);
    const plan = await api(app, a).post('/plans/from-template', { templateId: 'full-body-2' }).expect(201);
    const day = plan.body.days[0];
    // fremder Plan-Tag → 404
    await api(app, c).post('/invites', { startsAt: now(), friendIds: [a.id], planDayId: day.id }).expect(400);
    const res = await api(app, a)
      .post('/invites', { startsAt: new Date(Date.now() + 3600_000).toISOString(), location: 'Studio Mitte', friendIds: [b.id], planDayId: day.id })
      .expect(201);
    inviteId = res.body.id;
    expect(res.body.title).toBe(day.name);
    expect(res.body.isHost).toBe(true);
    expect(res.body.plan.exercises.length).toBe(day.exercises.length);
    expect(res.body.plan.planDayId).toBe(day.id);
    expect(JSON.stringify(res.body.plan)).not.toContain('targetWeightKg');
    expect(res.body.participants.map((p: { status: string }) => p.status).sort()).toEqual(['accepted', 'invited']);
    expect(res.body.shareUrl).toContain('/invites/join/');

    const asB = await api(app, b).get(`/invites/${inviteId}`).expect(200);
    expect(asB.body.myStatus).toBe('invited');
    expect(asB.body.plan.planDayId).toBeNull();
    expect(asB.body.shareUrl).toBeNull();
    expect((await api(app, b).get('/invites').expect(200)).body.map((i: { id: string }) => i.id)).toContain(inviteId);
  });

  it('Nicht-Teilnehmende erhalten 404, Eingeladene ohne Zusage 403 auf Live', async () => {
    await api(app, c).get(`/invites/${inviteId}`).expect(404);
    await api(app, c).get(`/invites/${inviteId}/live`).expect(404);
    await api(app, c).post(`/invites/${inviteId}/respond`, { status: 'accepted' }).expect(404);
    await api(app, c).post(`/invites/${inviteId}/link`, { sessionId: uuid() }).expect(404);
    await api(app, c).patch(`/invites/${inviteId}`, { title: 'gehackt' }).expect(404);
    await api(app, c).post(`/invites/${inviteId}/cancel`).expect(404);
    expect((await api(app, c).get('/invites').expect(200)).body).toHaveLength(0);
    const live = await api(app, b).get(`/invites/${inviteId}/live`).expect(403);
    expect(live.body.code).toBe('NOT_ACCEPTED');
    // Nur Gastgeber darf ändern
    await api(app, b).patch(`/invites/${inviteId}`, { title: 'x' }).expect(403);
  });

  it('Zusagen, Training vor dem Sync verknüpfen (404) und danach (200), Live-Fortschritt', async () => {
    await api(app, b).post(`/invites/${inviteId}/respond`, { status: 'maybe' }).expect(200);
    const r = await api(app, b).post(`/invites/${inviteId}/respond`, { status: 'accepted' }).expect(200);
    expect(r.body.myStatus).toBe('accepted');

    // A startet offline: Verknüpfen schlägt fehl, bis das Training synchronisiert ist
    const sessionId = uuid();
    const exId = uuid();
    const setIds = [uuid(), uuid(), uuid()];
    const early = await api(app, a).post(`/invites/${inviteId}/link`, { sessionId }).expect(404);
    expect(early.body.code).toBe('SESSION_NOT_SYNCED');
    await api(app, a).post('/sync', { deviceId: 'device-anna-1', operations: [sessionCreate(sessionId, exId, setIds)] }).expect(200);
    await api(app, a).post(`/invites/${inviteId}/link`, { sessionId }).expect(200);
    // B kann A's Training nicht mit sich verknüpfen
    await api(app, b).post(`/invites/${inviteId}/link`, { sessionId }).expect(404);
    expect((await api(app, a).get(`/invites/for-session/${sessionId}`).expect(200)).body.inviteId).toBe(inviteId);
    await api(app, b).get(`/invites/for-session/${sessionId}`).expect(404);

    let live = await api(app, b).get(`/invites/${inviteId}/live`).expect(200);
    expect(live.body.participants).toHaveLength(1);
    expect(live.body.waiting.map((w: { id: string }) => w.id)).toEqual([b.id]);
    let pa = live.body.participants[0];
    expect(pa.id).toBe(a.id);
    expect(pa.isMe).toBe(false);
    expect(pa.setsDone).toBe(0);
    expect(pa.setsTotal).toBe(3);
    expect(pa.lastSet).toBeNull();
    expect(pa.currentExercise).toBe('Bankdrücken');
    expect(pa.email).toBeUndefined();

    // A schließt einen Satz ab
    await api(app, a)
      .post('/sync', {
        deviceId: 'device-anna-1',
        operations: [{ opId: uuid(), type: 'set.update', clientTs: now(), baseVersion: 1, payload: { id: setIds[0], patch: { completed: true, completedAt: now() } } }],
      })
      .expect(200);
    live = await api(app, b).get(`/invites/${inviteId}/live`).expect(200);
    pa = live.body.participants[0];
    expect(pa.setsDone).toBe(1);
    expect(pa.lastSet).toEqual({ exerciseName: 'Bankdrücken', weightKg: 80, reps: 8 });
    expect(pa.sessionStatus).toBe('active');
    expect(pa.summary).toBeNull();

    // A beendet → Zusammenfassung
    await api(app, a)
      .post('/sync', { deviceId: 'device-anna-1', operations: [{ opId: uuid(), type: 'session.finish', clientTs: now(), baseVersion: 1, payload: { id: sessionId, endedAt: now() } }] })
      .expect(200);
    live = await api(app, b).get(`/invites/${inviteId}/live`).expect(200);
    pa = live.body.participants[0];
    expect(pa.sessionStatus).toBe('completed');
    expect(pa.summary.completedSets).toBe(1);
    expect(pa.summary.volumeKg).toBe(640);
  });

  it('Teilen-Link: Fremde sehen Vorschau und fragen an, Gastgeber entscheidet', async () => {
    const inv = await api(app, a).get(`/invites/${inviteId}`).expect(200);
    const token = inv.body.shareUrl.split('/').pop();
    const pv = await api(app, c).get(`/invites/join/${token}`).expect(200);
    expect(pv.body.title).toBe(inv.body.title);
    expect(pv.body.inviteId).toBeNull();
    expect(pv.body.joinable).toBe(true);
    const j = await api(app, c).post(`/invites/join/${token}`).expect(200);
    expect(j.body.myStatus).toBe('requested');
    // vor Bestätigung: keine Details
    await api(app, c).get(`/invites/${inviteId}`).expect(404);
    await api(app, c).post(`/invites/${inviteId}/respond`, { status: 'accepted' }).expect(404);
    // B (kein Gastgeber) kann nicht entscheiden; B sieht Anfrage nicht
    await api(app, b).post(`/invites/${inviteId}/requests/${c.id}`, { approve: true }).expect(403);
    expect((await api(app, b).get(`/invites/${inviteId}`).expect(200)).body.participants.some((p: { id: string }) => p.id === c.id)).toBe(false);
    const host = await api(app, a).get(`/invites/${inviteId}`).expect(200);
    expect(host.body.counts.requested).toBe(1);
    await api(app, a).post(`/invites/${inviteId}/requests/${c.id}`, { approve: true }).expect(200);
    expect((await api(app, c).get(`/invites/${inviteId}`).expect(200)).body.myStatus).toBe('accepted');
    await api(app, c).get(`/invites/join/not-a-valid-token-123`).expect(404);
  });

  it('Absagen durch Gastgeber', async () => {
    const res = await api(app, a).post('/invites', { startsAt: now(), friendIds: [b.id] }).expect(201);
    expect(res.body.title).toBe('Gemeinsames Training');
    await api(app, b).post(`/invites/${res.body.id}/cancel`).expect(403);
    const cancelled = await api(app, a).post(`/invites/${res.body.id}/cancel`).expect(200);
    expect(cancelled.body.status).toBe('cancelled');
    await api(app, b).post(`/invites/${res.body.id}/respond`, { status: 'accepted' }).expect(409);
    await api(app, a).patch(`/invites/${res.body.id}`, { title: 'neu' }).expect(409);
    expect((await api(app, b).get(`/invites/${res.body.id}`).expect(200)).body.status).toBe('cancelled');
  });

  it('Export enthält Freunde und Einladungen', async () => {
    const res = await api(app, a).get('/users/me/export.json').expect(200);
    const data = typeof res.body === 'object' && Object.keys(res.body).length ? res.body : JSON.parse(res.text);
    expect(data.friends.map((f: { username: string }) => f.username)).toContain(b.username);
    expect(data.trainingInvites.length).toBeGreaterThanOrEqual(2);
  });

  it('Kontolöschung entfernt Freundschaften, Einladungen und Teilnahmen', async () => {
    const e = await registerUser(app, 'emil');
    await befriend(e, b);
    const inv = await api(app, e).post('/invites', { startsAt: now(), friendIds: [b.id] }).expect(201);
    // B lädt E ebenfalls ein
    await befriend(b, e);
    const invB = await api(app, b).post('/invites', { startsAt: now(), friendIds: [e.id] }).expect(201);
    await api(app, e).post('/friends/requests', { username: c.username }).expect(201);
    await api(app, e).get('/friends/code').expect(200);

    await api(app, e).post('/users/me/delete', { password: e.password, confirm: 'LÖSCHEN' }).expect(200);

    expect(await prisma.friendship.count({ where: { OR: [{ requesterId: e.id }, { addresseeId: e.id }] } })).toBe(0);
    expect(await prisma.userInviteCode.count({ where: { userId: e.id } })).toBe(0);
    expect(await prisma.trainingInvite.count({ where: { id: inv.body.id } })).toBe(0);
    expect(await prisma.trainingInviteParticipant.count({ where: { userId: e.id } })).toBe(0);
    await api(app, b).get(`/invites/${inv.body.id}`).expect(404);
    const stillThere = await api(app, b).get(`/invites/${invB.body.id}`).expect(200);
    expect(stillThere.body.participants.some((p: { id: string }) => p.id === e.id)).toBe(false);
    expect((await api(app, b).get('/friends').expect(200)).body.friends.some((f: { id: string }) => f.id === e.id)).toBe(false);
  });
});
