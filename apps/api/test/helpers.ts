import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'node:crypto';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'postgresql://satzio:satzio@localhost:5432/satzio_test?schema=public';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-1234567890';
process.env.PUBLIC_URL = 'http://localhost:8080';
process.env.RATE_LIMIT_PER_MINUTE = '100000';
process.env.AUTH_RATE_LIMIT_PER_MINUTE = '100000';
process.env.UPLOAD_DIR = '/tmp/satzio-test-uploads';
process.env.SWAGGER_ENABLED = 'false';

export async function makeApp(): Promise<INestApplication> {
  const { createApp } = await import('../src/bootstrap');
  const app = await createApp({ logger: false });
  await app.init();
  return app;
}

export interface TestUser {
  token: string;
  id: string;
  username: string;
  email: string;
  password: string;
  cookies: string[];
  csrf: string;
}

export async function registerUser(app: INestApplication, prefix = 'user'): Promise<TestUser> {
  const suffix = randomUUID().slice(0, 8);
  const username = `${prefix}_${suffix}`;
  const email = `${username}@example.com`;
  const password = 'Sicher123';
  const res = await request(app.getHttpServer())
    .post('/api/v1/auth/register')
    .send({ username, email, password })
    .expect(201);
  return {
    token: res.body.accessToken,
    id: res.body.user.id,
    username,
    email,
    password,
    cookies: ([] as string[]).concat(res.headers['set-cookie'] ?? []),
    csrf: res.body.csrfToken,
  };
}

export function api(app: INestApplication, user?: TestUser) {
  const server = app.getHttpServer();
  const auth = (r: request.Test) => (user ? r.set('Authorization', `Bearer ${user.token}`) : r);
  return {
    get: (url: string) => auth(request(server).get(`/api/v1${url}`)),
    post: (url: string, body?: object) => auth(request(server).post(`/api/v1${url}`)).send(body ?? {}),
    put: (url: string, body?: object) => auth(request(server).put(`/api/v1${url}`)).send(body ?? {}),
    patch: (url: string, body?: object) => auth(request(server).patch(`/api/v1${url}`)).send(body ?? {}),
    delete: (url: string) => auth(request(server).delete(`/api/v1${url}`)),
  };
}

export function cookieValue(cookies: string[], name: string): string | undefined {
  for (const c of cookies) {
    const m = new RegExp(`^${name}=([^;]*)`).exec(c);
    if (m) return m[1];
  }
  return undefined;
}

export const uuid = () => randomUUID();
