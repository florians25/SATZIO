import { BadRequestException } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { config } from '../config/config';
import { randomToken } from '../common/util';

const ALLOWED = new Set(['jpeg', 'png', 'webp', 'gif', 'heif', 'avif']);

export function uploadRoot(): string {
  return resolve(config().UPLOAD_DIR);
}

/**
 * Sichere Bildverarbeitung: Inhalt wird per sharp dekodiert (nicht der
 * Dateiendung/dem MIME-Typ vertraut), Metadaten (EXIF/GPS) entfernt und
 * als WebP mit begrenzter Größe neu kodiert. Dateinamen sind zufällig.
 */
export async function storeImage(buffer: Buffer, folder: 'avatars' | 'exercises', maxSize: number): Promise<string> {
  if (!buffer?.length) throw new BadRequestException({ code: 'NO_FILE', message: 'Keine Datei empfangen.' });
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    throw new BadRequestException({ code: 'INVALID_IMAGE', message: 'Die Datei ist kein unterstütztes Bild.' });
  }
  if (!meta.format || !ALLOWED.has(meta.format)) {
    throw new BadRequestException({ code: 'INVALID_IMAGE', message: 'Erlaubt sind JPEG, PNG, WebP, GIF, HEIF und AVIF.' });
  }
  const out = await sharp(buffer, { limitInputPixels: 40_000_000 })
    .rotate()
    .resize(maxSize, maxSize, { fit: folder === 'avatars' ? 'cover' : 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const dir = join(uploadRoot(), folder);
  await mkdir(dir, { recursive: true });
  const name = `${randomToken(18)}.webp`;
  await writeFile(join(dir, name), out);
  return `${folder}/${name}`;
}

export async function removeUpload(relPath: string | null | undefined) {
  if (!relPath || relPath.includes('..')) return;
  try {
    await unlink(join(uploadRoot(), relPath));
  } catch {
    /* Datei existiert nicht mehr */
  }
}
