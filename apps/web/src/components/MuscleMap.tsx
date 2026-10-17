import type { MuscleGroup } from '@satzio/shared';
import { memo } from 'react';
import { cn } from '@/lib/cn';

/**
 * Eigene, schematische Körpergrafik (Vorder- & Rückseite) – hebt die
 * trainierten Muskelgruppen hervor. Keine fremden Bildrechte.
 * Dient als neutrale Übungsillustration, solange kein eigenes Bild existiert.
 */
type Region = { id: string; muscle: MuscleGroup; d: string };

const FRONT: Region[] = [
  { id: 'f-chest-l', muscle: 'chest', d: 'M31 33c4-3 9-3 13-1v9c-4 2-9 2-13-1z' },
  { id: 'f-chest-r', muscle: 'chest', d: 'M57 33c-4-3-9-3-13-1v9c4 2 9 2 13-1z' },
  { id: 'f-sh-l', muscle: 'shoulders', d: 'M24 32c2-4 5-5 8-5l-1 9c-3 0-6 1-7 3z' },
  { id: 'f-sh-r', muscle: 'shoulders', d: 'M64 32c-2-4-5-5-8-5l1 9c3 0 6 1 7 3z' },
  { id: 'f-bi-l', muscle: 'biceps', d: 'M23 40c2-2 5-3 7-2l-1 11c-2 1-5 0-7-1z' },
  { id: 'f-bi-r', muscle: 'biceps', d: 'M65 40c-2-2-5-3-7-2l1 11c2 1 5 0 7-1z' },
  { id: 'f-fa-l', muscle: 'forearms', d: 'M21 51c2 0 5 1 7 0l-2 13c-2 0-4 0-6-1z' },
  { id: 'f-fa-r', muscle: 'forearms', d: 'M67 51c-2 0-5 1-7 0l2 13c2 0 4 0 6-1z' },
  { id: 'f-abs', muscle: 'abs', d: 'M38 43h12v19c-4 2-8 2-12 0z' },
  { id: 'f-core-l', muscle: 'core', d: 'M32 44l5-1v19l-5-3z' },
  { id: 'f-core-r', muscle: 'core', d: 'M56 44l-5-1v19l5-3z' },
  { id: 'f-q-l', muscle: 'quads', d: 'M33 66c3-1 7-1 10 1l-1 20c-3 1-6 1-8 0z' },
  { id: 'f-q-r', muscle: 'quads', d: 'M55 66c-3-1-7-1-10 1l1 20c3 1 6 1 8 0z' },
  { id: 'f-c-l', muscle: 'calves', d: 'M34 91h7l-1 15h-5z' },
  { id: 'f-c-r', muscle: 'calves', d: 'M54 91h-7l1 15h5z' },
];

const BACK: Region[] = [
  { id: 'b-tr', muscle: 'back', d: 'M36 28h16l-2 6H38z' },
  { id: 'b-lat-l', muscle: 'back', d: 'M31 35l12-1v16l-9 4z' },
  { id: 'b-lat-r', muscle: 'back', d: 'M57 35l-12-1v16l9 4z' },
  { id: 'b-low', muscle: 'core', d: 'M38 51h12v9H38z' },
  { id: 'b-sh-l', muscle: 'shoulders', d: 'M24 32c2-4 5-5 8-5l-1 9c-3 0-6 1-7 3z' },
  { id: 'b-sh-r', muscle: 'shoulders', d: 'M64 32c-2-4-5-5-8-5l1 9c3 0 6 1 7 3z' },
  { id: 'b-tri-l', muscle: 'triceps', d: 'M23 40c2-2 5-3 7-2l-1 11c-2 1-5 0-7-1z' },
  { id: 'b-tri-r', muscle: 'triceps', d: 'M65 40c-2-2-5-3-7-2l1 11c2 1 5 0 7-1z' },
  { id: 'b-fa-l', muscle: 'forearms', d: 'M21 51c2 0 5 1 7 0l-2 13c-2 0-4 0-6-1z' },
  { id: 'b-fa-r', muscle: 'forearms', d: 'M67 51c-2 0-5 1-7 0l2 13c2 0 4 0 6-1z' },
  { id: 'b-gl-l', muscle: 'glutes', d: 'M33 61c3-1 7-1 10 1v8c-3 1-7 1-10-1z' },
  { id: 'b-gl-r', muscle: 'glutes', d: 'M55 61c-3-1-7-1-10 1v8c3 1 7 1 10-1z' },
  { id: 'b-h-l', muscle: 'hamstrings', d: 'M33 72c3 1 7 1 10 0l-1 15c-3 1-6 1-8 0z' },
  { id: 'b-h-r', muscle: 'hamstrings', d: 'M55 72c-3 1-7 1-10 0l1 15c3 1 6 1 8 0z' },
  { id: 'b-c-l', muscle: 'calves', d: 'M34 91h7l-1 15h-5z' },
  { id: 'b-c-r', muscle: 'calves', d: 'M54 91h-7l1 15h5z' },
];

const SILHOUETTE =
  'M44 6c5 0 8 4 8 9s-3 9-8 9-8-4-8-9 3-9 8-9zM30 26h28c5 0 9 3 10 8l4 20-2 12h-5l-3-13-1 9v4l3 22-2 24h-8l-3-22-2-14h-2l-2 14-3 22h-8l-2-24 3-22v-4l-1-9-3 13h-5l-2-12 4-20c1-5 5-8 10-8z';

function Body({ regions, primary, secondary }: { regions: Region[]; primary: Set<MuscleGroup>; secondary: Set<MuscleGroup> }) {
  return (
    <>
      <path d={SILHOUETTE} fill="var(--surface-3)" />
      {regions.map((r) => (
        <path
          key={r.id}
          d={r.d}
          fill={primary.has(r.muscle) ? 'var(--primary)' : secondary.has(r.muscle) ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--surface-2)'}
          stroke="var(--bg)"
          strokeWidth="0.6"
        />
      ))}
    </>
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
  const p = new Set<MuscleGroup>(Array.isArray(primary) ? primary : primary ? [primary] : []);
  if (p.has('full_body')) ['chest', 'back', 'shoulders', 'quads', 'glutes', 'hamstrings', 'core', 'abs'].forEach((m) => p.add(m as MuscleGroup));
  const s = new Set<MuscleGroup>(secondary);
  const backOnly: MuscleGroup[] = ['back', 'triceps', 'glutes', 'hamstrings'];
  const frontOnly: MuscleGroup[] = ['chest', 'abs', 'quads', 'biceps'];
  const prim = [...p];
  // Kompakt: nur die Körperseite mit dem Hauptmuskel, formatfüllend
  const compactSide: 'front' | 'back' = prim.some((m) => frontOnly.includes(m)) || !prim.some((m) => backOnly.includes(m)) ? 'front' : 'back';
  if (compact) {
    return (
      <svg viewBox="16 3 56 106" className={cn('h-full w-full', className)} role="img" aria-label="Schematische Darstellung der beanspruchten Muskulatur (Platzhaltergrafik)">
        <Body regions={compactSide === 'front' ? FRONT : BACK} primary={p} secondary={s} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 176 112" className={cn('h-full w-full', className)} role="img" aria-label="Schematische Darstellung der beanspruchten Muskulatur (Platzhaltergrafik)">
      <Body regions={FRONT} primary={p} secondary={s} />
      <g transform="translate(88 0)">
        <Body regions={BACK} primary={p} secondary={s} />
      </g>
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
