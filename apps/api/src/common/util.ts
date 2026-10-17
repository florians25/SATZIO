import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';

export type Dec = Prisma.Decimal | null | undefined;

/** Decimal → number (oder null). */
export function num(d: Dec): number | null {
  if (d === null || d === undefined) return null;
  return Number(d.toString());
}

export function dec(n: number | null | undefined): Prisma.Decimal | null {
  if (n === null || n === undefined) return null;
  return new Prisma.Decimal(n);
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
