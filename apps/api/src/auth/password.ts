import argon2 from 'argon2';

/** Argon2id gemäß OWASP-Empfehlung (19 MiB, t=2, p=1). */
const OPTIONS = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

let dummyHash: Promise<string> | null = null;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export function needsRehash(hash: string): boolean {
  try {
    return argon2.needsRehash(hash, OPTIONS);
  } catch {
    return true;
  }
}

/** Gleicht Antwortzeiten bei unbekannten Konten an (Schutz vor Account-Enumeration). */
export async function burnTime(password: string): Promise<void> {
  if (!dummyHash) dummyHash = argon2.hash('satzio-dummy-password', OPTIONS);
  await verifyPassword(await dummyHash, password);
}
