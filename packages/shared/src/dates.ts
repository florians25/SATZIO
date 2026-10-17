/** Datums-Hilfsfunktionen ohne externe Abhängigkeiten. Datumsschlüssel: "YYYY-MM-DD". */

export function localDateKey(date: Date | string, timeZone?: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(d);
}

function keyToUtc(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function utcToKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(key: string, days: number): string {
  const d = keyToUtc(key);
  d.setUTCDate(d.getUTCDate() + days);
  return utcToKey(d);
}

/** ISO-Wochentag 1 (Mo) … 7 (So). */
export function isoWeekday(key: string): 1 | 2 | 3 | 4 | 5 | 6 | 7 {
  const wd = keyToUtc(key).getUTCDay();
  return (wd === 0 ? 7 : wd) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
}

/** Montag der Woche des Datums. */
export function startOfIsoWeek(key: string): string {
  return addDays(key, -(isoWeekday(key) - 1));
}

/** ISO-Kalenderwoche als "YYYY-Www". */
export function isoWeekKey(key: string): string {
  const d = keyToUtc(key);
  const day = isoWeekday(key);
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function diffDays(a: string, b: string): number {
  return Math.round((keyToUtc(a).getTime() - keyToUtc(b).getTime()) / 86400000);
}
