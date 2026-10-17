import type { WeightUnit } from '@satzio/shared';
import { cn } from '@/lib/cn';
import { calcPlates, groupPlates, PLATE_CONFIG } from './plates';

/** Farben nach Wettkampfnorm (kg) bzw. üblichen lbs-Sätzen. */
const COLORS: Record<WeightUnit, Record<string, string>> = {
  kg: { '25': '#e5484d', '20': '#3e63dd', '15': '#f1c21b', '10': '#30a46c', '5': '#eceeec', '2.5': '#2b2f2d', '1.25': '#a7b0ab' },
  lbs: { '45': '#3e63dd', '35': '#f1c21b', '25': '#30a46c', '10': '#eceeec', '5': '#e5484d', '2.5': '#a7b0ab' },
};
const LIGHT = new Set(['#eceeec', '#f1c21b', '#a7b0ab']);

const fmt = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 2 });

/** Visualisierter Scheibenstapel pro Seite + Antippen = 2 × Scheibe dazu. */
export function PlateCalculator({ weight, unit, onAdd }: { weight: number | null; unit: WeightUnit; onAdd: (plate: number) => void }) {
  const cfg = PLATE_CONFIG[unit];
  const res = calcPlates(weight ?? cfg.bar, cfg);
  const maxPlate = cfg.plates[0];
  const groups = groupPlates(res.perSide);

  return (
    <div className="mx-3 mb-2 rounded-2xl bg-surface-2 p-3" aria-label="Scheibenrechner">
      <div className="flex items-center gap-3">
        {/* Stange mit Scheiben einer Seite */}
        <div className="relative flex h-[72px] flex-1 items-center overflow-hidden" role="img" aria-label={res.perSide.length ? `Pro Seite: ${res.perSide.map(fmt).join(', ')} ${unit}` : 'Nur die Stange'}>
          <div className="absolute inset-x-0 top-1/2 h-2.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-[#c9cfcb] to-[#7d8682]" />
          <div className="relative z-10 h-7 w-2.5 rounded-sm bg-[#8d9692]" />
          <div className="relative z-10 ml-0.5 flex items-center gap-[2px]">
            {res.perSide.map((p, i) => {
              const c = COLORS[unit][String(p)] ?? '#888';
              const h = 22 + (Math.sqrt(p / maxPlate) * 46);
              return (
                <span
                  key={i}
                  className="block rounded-[3px] shadow-[inset_-2px_0_0_rgb(0_0_0/0.18)] animate-pop"
                  style={{ height: h, width: p >= maxPlate * 0.5 ? 13 : p >= 5 ? 10 : 8, background: c, outline: c === '#eceeec' || c === '#2b2f2d' ? '1px solid rgb(255 255 255 / 0.22)' : undefined }}
                />
              );
            })}
            <span className="ml-0.5 block h-5 w-1.5 rounded-sm bg-[#5f6864]" />
          </div>
        </div>
        <div className="w-[44%] shrink-0 text-right">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Pro Seite</p>
          <p className="text-base font-extrabold leading-tight tabular">{groups.length ? groups.map((g) => (g.count > 1 ? `${g.count}×${fmt(g.plate)}` : fmt(g.plate))).join(' + ') : '–'}</p>
          <p className="mt-0.5 text-[11px] text-muted">
            Stange {fmt(cfg.bar)} {unit}
            {res.belowBar && ' · unter Stangengewicht'}
            {res.remainder > 0 && !res.belowBar && <span className="text-warning"> · Rest {fmt(res.remainder)}</span>}
          </p>
        </div>
      </div>
      <div className="mt-2 flex gap-1.5">
        {cfg.plates.map((p) => {
          const c = COLORS[unit][String(p)] ?? '#888';
          return (
            <button
              key={p}
              type="button"
              onClick={() => onAdd(p)}
              aria-label={`2 × ${fmt(p)} ${unit} auflegen`}
              className={cn('h-10 min-w-0 flex-1 rounded-xl text-[13px] font-bold tabular shadow-[inset_0_-2px_0_rgb(0_0_0/0.18)] active:scale-95 transition-transform', LIGHT.has(c) ? 'text-[#111]' : 'text-white')}
              style={{ background: c, outline: c === '#2b2f2d' ? '1px solid rgb(255 255 255 / 0.18)' : undefined, outlineOffset: -1 }}
            >
              {fmt(p)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
