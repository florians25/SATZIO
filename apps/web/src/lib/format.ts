import { fromKg, type WeightUnit } from '@satzio/shared';

export function fmtWeight(kg: number | null | undefined, unit: WeightUnit): string {
  if (kg === null || kg === undefined) return '–';
  return fromKg(kg, unit).toLocaleString('de-DE', { maximumFractionDigits: unit === 'kg' ? 2 : 1 });
}

export function fmtNumber(n: number, digits = 0): string {
  return n.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

/** Volumen kompakt: 8.420 kg, 12,4 t */
export function fmtVolume(kg: number, unit: WeightUnit): string {
  const v = fromKg(kg, unit);
  if (unit === 'kg' && v >= 100_000) return `${(v / 1000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} t`;
  return `${Math.round(v).toLocaleString('de-DE')} ${unit}`;
}

export function fmtDuration(min: number): string {
  if (min < 60) return `${min} Min.`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} Std. ${m} Min.` : `${h} Std.`;
}

export function fmtClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0');
  return h ? `${h}:${mm}:${String(sec).padStart(2, '0')}` : `${mm}:${String(sec).padStart(2, '0')}`;
}

export function fmtDate(iso: string | Date, opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  return new Date(iso).toLocaleDateString('de-DE', opts);
}

export function fmtDateLong(iso: string | Date) {
  return new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export function fmtTime(iso: string | Date) {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function fmtRelativeDay(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff < 7) return `vor ${diff} Tagen`;
  return fmtDate(iso);
}

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Gute Nacht';
  if (h < 11) return 'Guten Morgen';
  if (h < 17) return 'Hallo';
  if (h < 22) return 'Guten Abend';
  return 'Gute Nacht';
}
