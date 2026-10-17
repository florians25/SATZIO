import type { MuscleGroup } from '@satzio/shared';
import { memo, useId } from 'react';
import { cn } from '@/lib/cn';
import { BACK, FRONT, SILHOUETTE, type MusclePath } from './muscle-paths';

/**
 * Anatomische Muskelkarte (Vorder- & Rückseite) – eigene Zeichnung, keine
 * fremden Bildrechte. Hebt die trainierten Muskelgruppen hervor und dient als
 * Übungsillustration, solange kein eigenes Foto existiert.
 */

const ALL_GROUPS: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'abs', 'core', 'quads', 'hamstrings', 'glutes', 'calves',
];
const BACK_GROUPS: MuscleGroup[] = ['back', 'triceps', 'glutes', 'hamstrings'];
const FRONT_GROUPS: MuscleGroup[] = ['chest', 'abs', 'quads', 'biceps'];
const LOWER_GROUPS: MuscleGroup[] = ['quads', 'hamstrings', 'glutes', 'calves'];

const BODY = 'color-mix(in srgb, var(--text) 5%, var(--surface-3))';
const INACTIVE = 'color-mix(in srgb, var(--text) 15%, var(--surface-3))';
// deckend gemischt, damit überlappende Muskelkanten nicht durchscheinen
const SECONDARY = 'color-mix(in srgb, var(--primary) 45%, var(--surface-3))';

function toSet(list: readonly (MuscleGroup | null | undefined)[]): Set<MuscleGroup> {
  const set = new Set<MuscleGroup>();
  for (const m of list) if (m) set.add(m);
  if (set.has('full_body')) ALL_GROUPS.forEach((m) => set.add(m));
  return set;
}

function Figure({
  muscles,
  primary,
  secondary,
  uid,
  x = 0,
}: {
  muscles: MusclePath[];
  primary: Set<MuscleGroup>;
  secondary: Set<MuscleGroup>;
  uid: string;
  x?: number;
}) {
  return (
    <g transform={x ? `translate(${x} 0)` : undefined}>
      <g fill={BODY}>
        {SILHOUETTE.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g stroke="var(--bg)" strokeWidth="0.42" strokeLinejoin="round">
        {muscles.map((m, i) => (
          <path
            key={i}
            d={m.d}
            fill={!m.muscle ? INACTIVE : primary.has(m.muscle) ? `url(#${uid}-p)` : secondary.has(m.muscle) ? SECONDARY : INACTIVE}
          />
        ))}
      </g>
      {/* Muskelvolumen: Licht oben links, Schatten zum Rand */}
      <g fill={`url(#${uid}-vol)`} style={{ pointerEvents: 'none' }}>
        {muscles.map((m, i) => (
          <path key={i} d={m.d} />
        ))}
      </g>
      {/* weiche Volumen-Schattierung über der ganzen Figur */}
      <g fill={`url(#${uid}-shade)`} style={{ pointerEvents: 'none' }}>
        {SILHOUETTE.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </g>
  );
}

function Defs({ uid }: { uid: string }) {
  return (
    <defs>
      <linearGradient id={`${uid}-p`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--primary) 88%, #fff)' }} />
        <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--primary) 82%, #000)' }} />
      </linearGradient>
      <radialGradient id={`${uid}-vol`} cx="0.42" cy="0.36" r="0.78">
        <stop offset="0" style={{ stopColor: '#fff', stopOpacity: 0.12 }} />
        <stop offset="0.5" style={{ stopColor: '#fff', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: '#000', stopOpacity: 0.22 }} />
      </radialGradient>
      <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="1" y2="0" gradientUnits="userSpaceOnUse" gradientTransform="scale(100 1)">
        <stop offset="0" style={{ stopColor: '#000', stopOpacity: 0.16 }} />
        <stop offset="0.3" style={{ stopColor: '#000', stopOpacity: 0 }} />
        <stop offset="0.7" style={{ stopColor: '#000', stopOpacity: 0 }} />
        <stop offset="1" style={{ stopColor: '#000', stopOpacity: 0.16 }} />
      </linearGradient>
    </defs>
  );
}

export const MuscleMap = memo(function MuscleMap({
  primary,
  secondary = [],
  className,
  compact,
}: {
  primary: MuscleGroup | MuscleGroup[] | null | undefined;
  secondary?: MuscleGroup[];
  className?: string;
  compact?: boolean;
}) {
  const uid = 'mm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  const primList = Array.isArray(primary) ? primary : primary ? [primary] : [];
  const p = toSet(primList);
  const s = toSet(secondary);
  const label = 'Anatomische Darstellung der beanspruchten Muskulatur';

  if (compact) {
    // Kompakt: nur die Körperseite mit dem Hauptmuskel, Ausschnitt formatfüllend
    const side: 'front' | 'back' =
      primList.some((m) => FRONT_GROUPS.includes(m)) || !primList.some((m) => BACK_GROUPS.includes(m)) ? 'front' : 'back';
    const full = primList.length === 0 || primList.includes('full_body');
    const lower = !full && primList.every((m) => LOWER_GROUPS.includes(m));
    const viewBox = full ? '6 1 88 208' : lower ? '21 100 58 108' : '9 20 82 92';
    return (
      <svg viewBox={viewBox} className={cn('h-full w-full', className)} role="img" aria-label={label}>
        <Defs uid={uid} />
        <Figure muscles={side === 'front' ? FRONT : BACK} primary={p} secondary={s} uid={uid} />
      </svg>
    );
  }
  return (
    <svg viewBox="4 0 196 210" className={cn('h-full w-full', className)} role="img" aria-label={`${label} (Vorder- und Rückseite)`}>
      <Defs uid={uid} />
      <Figure muscles={FRONT} primary={p} secondary={s} uid={uid} />
      <Figure muscles={BACK} primary={p} secondary={s} uid={uid} x={104} />
    </svg>
  );
});

/** Übungsbild: eigenes Foto falls vorhanden, sonst Muskel-Illustration. */
export function ExerciseImage({
  imageUrl,
  primary,
  secondary,
  className,
  compact = true,
}: {
  imageUrl?: string | null;
  primary: MuscleGroup | null | undefined;
  secondary?: MuscleGroup[];
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cn('overflow-hidden rounded-2xl bg-surface-2', className)}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
      ) : (
        <div className="h-full w-full p-1.5">
          <MuscleMap primary={primary} secondary={secondary} compact={compact} />
        </div>
      )}
    </div>
  );
}
