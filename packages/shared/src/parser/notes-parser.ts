import type { SetType, WeightUnit } from '../enums';
import { round, toKg } from '../units';
import { ExerciseMatcher, type ExerciseMatch, type MatchableExercise } from './matcher';
import { normalizeName } from './normalize';

/**
 * SATZIO NOTES-PARSER
 *
 * Lokaler, regelbasierter Parser für freie Trainingsnotizen – ohne KI.
 * Grundsätze:
 *  - Es werden niemals Gewichte erfunden. Fehlt ein Gewicht, bleibt es leer.
 *  - Mehrdeutige Angaben werden markiert ("uncertain") statt geraten.
 *  - Der Originaltext bleibt vollständig erhalten.
 *
 * Unterstützte Schreibweisen (Auswahl):
 *   Bankdrücken 3x10 80kg          → 3 Sätze × 10 Wdh. mit 80 kg
 *   Bankdrücken 80kg 3x10          → dito
 *   Kniebeugen 4x8-10 100 kg       → 4 Sätze, 8–10 Wdh., 100 kg
 *   Latziehen 12x55, 10x60, 8x65   → 3 Sätze (Wdh. × Gewicht, per Heuristik)
 *   Bizeps 3 Sätze je 12 mit 14kg  → 3 Sätze × 12 Wdh. mit 14 kg
 *   3x10x80                        → Sätze × Wdh. × Gewicht
 *   Klimmzüge 10, 8, 6             → 3 Sätze ohne Zusatzgewicht
 *   Dips +10kg 3x8                 → Zusatzgewicht 10 kg
 *   Blockformat:
 *     Montag Push
 *     Bankdrücken
 *     60x12
 *     ✓ 70 kg × 10
 */

export interface ParsedSet {
  type: SetType;
  weightKg: number | null;
  reps: number | null;
  /** Obere Grenze, falls ein Wiederholungsbereich angegeben wurde (z. B. 8–10). */
  repsMax: number | null;
  /** true/false bei Häkchen ✓/☐, sonst null. */
  completed: boolean | null;
  /** Reihenfolge Gewicht/Wdh. war nicht eindeutig und wurde geschätzt. */
  uncertain: boolean;
}

export interface ParsedExercise<T extends MatchableExercise = MatchableExercise> {
  /** Name wie im Text geschrieben. */
  rawName: string;
  match: ExerciseMatch<T> | null;
  candidates: ExerciseMatch<T>[];
  sets: ParsedSet[];
  notes: string | null;
  /** Zeilennummern (0-basiert) im Originaltext. */
  lines: number[];
  warnings: string[];
}

export interface ParsedDay<T extends MatchableExercise = MatchableExercise> {
  name: string | null;
  /** Erkanntes Datum (YYYY-MM-DD), falls im Titel enthalten. */
  date: string | null;
  exercises: ParsedExercise<T>[];
  notes: string | null;
}

export interface ParseResult<T extends MatchableExercise = MatchableExercise> {
  original: string;
  days: ParsedDay<T>[];
  unparsedLines: { line: number; text: string }[];
  warnings: string[];
}

export interface ParseOptions {
  /** Einheit für Zahlen ohne explizite Einheit. */
  defaultUnit?: WeightUnit;
  /** Mindestähnlichkeit für automatische Zuordnung. */
  matchThreshold?: number;
  /** Bezugsjahr für Datumsangaben ohne Jahr. */
  referenceYear?: number;
}

/* -------------------------------- Tokenizer -------------------------------- */

type Tok =
  | { t: 'num'; v: number; max: number | null; unit: WeightUnit | null; plus: boolean; decimal: boolean }
  | { t: 'x' }
  | { t: 'sets' }
  | { t: 'reps' }
  | { t: 'at' }
  | { t: 'sep' }
  | { t: 'bw' }
  | { t: 'word'; w: string };

const SETS_WORDS = new Set(['sätze', 'saetze', 'satz', 'sets', 'set', 'serien', 'serie', 'durchgänge', 'runden']);
const REPS_WORDS = new Set(['wdh', 'wdh.', 'wh', 'wdhl', 'wiederholungen', 'wiederholung', 'reps', 'rep', 'mal', 'w']);
const AT_WORDS = new Set(['@', 'mit', 'à', 'a', 'bei', 'je', 'zu', 'von', 'auf', 'with', 'at', 'each', 'á']);
const BW_WORDS = new Set(['körpergewicht', 'koerpergewicht', 'bw', 'bodyweight', 'eigengewicht']);

const NUM_RE = /^(\+)?(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|—|bis)\s*(\d+(?:[.,]\d+)?))?\s*(kg|kilo|kilogramm|lbs|lb|pfund)?$/i;

function toNumber(s: string): number {
  return Number.parseFloat(s.replace(',', '.'));
}

function tokenize(input: string): Tok[] {
  // Trenner zwischen "55,10x60" erkennen (Komma vor neuem Paar ist kein Dezimalkomma)
  let s = input.replace(/(\d),(\d+\s*[x×*])/gi, '$1; $2');
  s = s
    .replace(/[×✕✖*]/g, ' x ')
    .replace(/(\d)\s*x\s*(?=\d)/gi, '$1 x ')
    .replace(/(\d)x\b/gi, '$1 x ')
    .replace(/\bx(\d)/gi, 'x $1')
    .replace(/(\d)\s*(kg|kilo|lbs|lb)\b/gi, '$1$2')
    .replace(/(\d)\s*(?:-|–|—)\s*(\d)/g, '$1-$2')
    .replace(/[;|/]/g, ' ; ')
    .replace(/,(?!\d)/g, ' ; ')
    .replace(/,\s+/g, ' ; ')
    .replace(/[():]/g, ' ');
  const parts = s.split(/\s+/).filter(Boolean);
  const toks: Tok[] = [];
  for (const raw of parts) {
    const p = raw.toLowerCase();
    if (p === 'x') {
      toks.push({ t: 'x' });
      continue;
    }
    if (p === ';') {
      toks.push({ t: 'sep' });
      continue;
    }
    const m = NUM_RE.exec(p);
    if (m) {
      const unitRaw = m[4]?.toLowerCase();
      const unit: WeightUnit | null = unitRaw ? (unitRaw.startsWith('l') || unitRaw === 'pfund' ? 'lbs' : 'kg') : null;
      toks.push({
        t: 'num',
        v: toNumber(m[2]),
        max: m[3] ? toNumber(m[3]) : null,
        unit,
        plus: !!m[1],
        decimal: /[.,]/.test(m[2]),
      });
      continue;
    }
    // "12kg" mit nachgestelltem Satzzeichen
    const stripped = p.replace(/[.!?]+$/, '');
    if (SETS_WORDS.has(stripped)) toks.push({ t: 'sets' });
    else if (REPS_WORDS.has(stripped) || REPS_WORDS.has(p)) toks.push({ t: 'reps' });
    else if (AT_WORDS.has(stripped)) toks.push({ t: 'at' });
    else if (BW_WORDS.has(stripped)) toks.push({ t: 'bw' });
    else if (stripped === 'kg' || stripped === 'kilo') {
      // alleinstehende Einheit hinter Zahl: an vorherige Zahl hängen
      const prev = toks[toks.length - 1];
      if (prev && prev.t === 'num' && !prev.unit) prev.unit = 'kg';
    } else if (stripped === 'lbs' || stripped === 'lb') {
      const prev = toks[toks.length - 1];
      if (prev && prev.t === 'num' && !prev.unit) prev.unit = 'lbs';
    } else toks.push({ t: 'word', w: stripped });
  }
  return toks;
}

/* ----------------------------- Satz-Interpretation ----------------------------- */

interface RawPair {
  a: Extract<Tok, { t: 'num' }>;
  b: Extract<Tok, { t: 'num' }>;
}

interface LineSets {
  /** Fertig interpretierte Sätze. */
  sets: ParsedSet[];
  /** Mehrdeutige Paare A×B, deren Reihenfolge später bestimmt wird. */
  pairs: RawPair[];
  /** Index in sets, an dem die Paare eingefügt werden. */
  ok: boolean;
}

const isRepLike = (n: Extract<Tok, { t: 'num' }>) => !n.unit && !n.decimal && n.v >= 1 && n.v <= 30;
const isWeightLike = (n: Extract<Tok, { t: 'num' }>) => n.unit !== null || n.decimal || n.v > 30;

function weightOf(n: Extract<Tok, { t: 'num' }>, defaultUnit: WeightUnit): number {
  return round(toKg(n.v, n.unit ?? defaultUnit), 3);
}

function mkSet(weightKg: number | null, reps: number | null, repsMax: number | null, completed: boolean | null, uncertain = false): ParsedSet {
  return {
    type: 'working',
    weightKg,
    reps: reps === null ? null : Math.round(reps),
    repsMax: repsMax !== null && reps !== null && repsMax !== reps ? Math.round(repsMax) : null,
    completed,
    uncertain,
  };
}

function interpretSetTokens(toks: Tok[], hasName: boolean, completed: boolean | null, unit: WeightUnit): LineSets {
  const nums = toks.filter((t): t is Extract<Tok, { t: 'num' }> => t.t === 'num');
  const out: LineSets = { sets: [], pairs: [], ok: false };
  if (!nums.length) return out;
  const bodyweight = toks.some((t) => t.t === 'bw');

  // 1) "3 Sätze (je) 12 (Wdh) (mit) 14kg"
  const setsIdx = toks.findIndex((t) => t.t === 'sets');
  if (setsIdx > 0 && toks[setsIdx - 1].t === 'num') {
    const count = toks[setsIdx - 1] as Extract<Tok, { t: 'num' }>;
    const after = toks.slice(setsIdx + 1).filter((t): t is Extract<Tok, { t: 'num' }> => t.t === 'num');
    const before = toks.slice(0, setsIdx - 1).filter((t): t is Extract<Tok, { t: 'num' }> => t.t === 'num');
    const repsTok = after.find((n) => !n.unit) ?? null;
    const weightTok = [...after, ...before].find((n) => n.unit || (n !== repsTok && n.v > 0)) ?? null;
    const w = weightTok && weightTok !== repsTok ? weightOf(weightTok, unit) : null;
    const n = Math.min(Math.round(count.v), 20);
    for (let i = 0; i < n; i++) out.sets.push(mkSet(w, repsTok?.v ?? null, repsTok?.max ?? null, completed));
    out.ok = true;
    return out;
  }

  // 2) x-Ketten sammeln
  const chains: Extract<Tok, { t: 'num' }>[][] = [];
  const loose: { tok: Extract<Tok, { t: 'num' }>; afterAt: boolean; afterReps: boolean }[] = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.t !== 'num') continue;
    if (toks[i + 1]?.t === 'x' && toks[i + 2]?.t === 'num') {
      const chain = [t];
      let j = i + 1;
      while (toks[j]?.t === 'x' && toks[j + 1]?.t === 'num') {
        chain.push(toks[j + 1] as Extract<Tok, { t: 'num' }>);
        j += 2;
      }
      chains.push(chain);
      i = j - 1;
    } else {
      loose.push({ tok: t, afterAt: toks[i - 1]?.t === 'at', afterReps: toks[i + 1]?.t === 'reps' });
    }
  }

  if (chains.length) {
    const extraWeight = loose.find((l) => l.tok.unit || l.afterAt || l.tok.plus) ?? (loose.length === 1 && isWeightLike(loose[0].tok) ? loose[0] : undefined);
    if (chains.length === 1) {
      const c = chains[0];
      if (c.length >= 3) {
        // Sätze × Wdh × Gewicht (oder Gewicht ausgewiesen)
        const wTok = c.find((n) => n.unit) ?? c[2];
        const rest = c.filter((n) => n !== wTok);
        const [setsTok, repsTok] = rest;
        const count = Math.min(Math.round(setsTok.v), 20);
        for (let i = 0; i < count; i++) out.sets.push(mkSet(weightOf(wTok, unit), repsTok.v, repsTok.max, completed));
        out.ok = true;
        return out;
      }
      const [a, b] = c;
      if (extraWeight && !a.unit && !b.unit && a.v <= 20 && !a.decimal) {
        // "3x10 80kg" / "80kg 3x10" / "3x10 @80"
        const count = Math.min(Math.round(a.v), 20);
        for (let i = 0; i < count; i++) out.sets.push(mkSet(weightOf(extraWeight.tok, unit), b.v, b.max, completed));
        out.ok = true;
        return out;
      }
      if (!a.unit && !b.unit && !isWeightLike(a) && !isWeightLike(b) && a.v <= 6 && hasName) {
        // "Klimmzüge 3x10" → Sätze × Wdh. ohne Gewicht
        const count = Math.round(a.v);
        for (let i = 0; i < count; i++) out.sets.push(mkSet(bodyweight ? 0 : null, b.v, b.max, completed));
        out.ok = true;
        return out;
      }
    }
    for (const c of chains) {
      if (c.length >= 2) out.pairs.push({ a: c[0], b: c[1] });
    }
    out.ok = true;
    return out;
  }

  // 3) Keine x-Notation: Gewicht(e) mit Einheit und Wiederholungslisten
  let currentWeight: number | null = bodyweight ? 0 : null;
  let sawUnit = false;
  for (const l of loose) {
    const n = l.tok;
    if (n.unit || n.plus || (l.afterAt && !l.afterReps)) {
      currentWeight = weightOf(n, unit);
      sawUnit = true;
      continue;
    }
    if (l.afterReps || isRepLike(n)) {
      out.sets.push(mkSet(currentWeight, n.v, n.max, completed));
      continue;
    }
    // Große Zahl ohne Einheit: Gewicht ohne Wiederholungen
    currentWeight = weightOf(n, unit);
    sawUnit = true;
  }
  if (!out.sets.length && sawUnit && currentWeight !== null) out.sets.push(mkSet(currentWeight, null, null, completed));
  out.ok = out.sets.length > 0;
  return out;
}

/* --------------------------------- Zeilen ---------------------------------- */

const DAY_KEYWORDS =
  /\b(montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|monday|tuesday|wednesday|thursday|friday|saturday|sunday|tag\s*\d+|day\s*\d*|push|pull|legs|beine|beintag|oberkörper|oberkoerper|unterkörper|unterkoerper|ganzkörper|ganzkoerper|upper|lower|full\s*body|training|workout|einheit|woche\s*\d*|plan\s*[a-z0-9]?|brust\s*(?:&|und|\+|\/)|rücken\s*(?:&|und|\+|\/))\b/i;
const DATE_RE = /\b(\d{1,2})\.(\d{1,2})\.(\d{2,4})?/;
const CHECK_DONE = /^(?:\[[xX✓]\]|✓|✔|☑|✅|\(x\))\s*|\s*(?:✓|✔|☑|✅)\s*$/;
const CHECK_OPEN = /^(?:\[\s?\]|☐|□|⬜|\(\s?\))\s*|\s*(?:☐|□|⬜)\s*$/;

interface LineInfo {
  index: number;
  raw: string;
  text: string;
  completed: boolean | null;
  heading: boolean;
  name: string;
  rest: string;
  hasDigits: boolean;
  isNote: boolean;
}

function analyzeLine(raw: string, index: number): LineInfo | null {
  let text = raw.trim();
  if (!text) return null;
  let heading = false;
  if (/^#{1,6}\s+/.test(text)) {
    heading = true;
    text = text.replace(/^#{1,6}\s+/, '');
  }
  let completed: boolean | null = null;
  // Häkchen erkennen (vorne oder hinten)
  for (let k = 0; k < 2; k++) {
    if (CHECK_DONE.test(text)) {
      completed = true;
      text = text.replace(CHECK_DONE, '').trim();
    }
    if (CHECK_OPEN.test(text)) {
      completed = false;
      text = text.replace(CHECK_OPEN, '').trim();
    }
  }
  text = text.replace(/^[-•*–·>]+\s*/, '').replace(/^\d+[.)]\s+(?=\D)/, '').trim();
  if (!text) return null;
  const isNote = /^(\/\/|notiz:|note:|anmerkung:|\(.*\)$)/i.test(text);
  const hasDigits = /\d/.test(text);
  // Name = Text bis zur ersten Zahl / "+Zahl" / Satzangabe
  const m = /^(.*?)(?=(?:\+?\d)|$)/.exec(text);
  let name = (m?.[1] ?? '').replace(/[:\-–—,]+\s*$/, '').trim();
  let rest = text.slice(m?.[1]?.length ?? 0).trim();
  // Namen mit Zahl am Ende wie "21er Curls" nicht zerreißen: nur, wenn der Rest keinen Satzinhalt hat
  if (name.length === 0 && /^\d+er\s+\D/i.test(text)) {
    name = text;
    rest = '';
  }
  return { index, raw, text, completed, heading, name, rest, hasDigits, isNote };
}

function parseDate(text: string, referenceYear: number): string | null {
  const m = DATE_RE.exec(text);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = m[3] ? Number(m[3]) : referenceYear;
  if (y < 100) y += 2000;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* ------------------------------ Hauptfunktion ------------------------------ */

interface WorkingExercise<T extends MatchableExercise> extends ParsedExercise<T> {
  pairs: { pair: RawPair; completed: boolean | null; position: number }[];
}

export function parseWorkoutNotes<T extends MatchableExercise>(
  text: string,
  exercises: T[] | ExerciseMatcher<T>,
  options: ParseOptions = {},
): ParseResult<T> {
  const unit = options.defaultUnit ?? 'kg';
  const threshold = options.matchThreshold ?? 0.62;
  const refYear = options.referenceYear ?? new Date().getFullYear();
  const matcher = exercises instanceof ExerciseMatcher ? exercises : new ExerciseMatcher(exercises);

  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  const lines = rawLines.map((l, i) => analyzeLine(l, i)).filter((l): l is LineInfo => l !== null);

  type WorkingDay = Omit<ParsedDay<T>, 'exercises'> & { exercises: WorkingExercise<T>[] };
  const days: WorkingDay[] = [];
  const unparsedLines: { line: number; text: string }[] = [];
  const warnings: string[] = [];
  let day = null as WorkingDay | null;
  let current = null as WorkingExercise<T> | null;

  const ensureDay = () => {
    if (!day) {
      day = { name: null, date: null, exercises: [], notes: null };
      days.push(day);
    }
    return day as WorkingDay;
  };

  const startExercise = (name: string, line: number) => {
    const candidates = matcher.match(name, 5);
    const best = candidates[0] && candidates[0].score >= threshold ? candidates[0] : null;
    const ex: WorkingExercise<T> = {
      rawName: name,
      match: best,
      candidates,
      sets: [],
      notes: null,
      lines: [line],
      warnings: best ? [] : [`„${name}“ wurde keiner Übung zugeordnet – als eigene Übung übernehmen oder auswählen.`],
      pairs: [],
    };
    ensureDay().exercises.push(ex);
    current = ex;
    return ex;
  };

  const addSets = (ex: WorkingExercise<T>, info: LineInfo, tokens: Tok[], hasName: boolean): boolean => {
    const r = interpretSetTokens(tokens, hasName, info.completed, unit);
    if (!r.ok) return false;
    for (const s of r.sets) ex.sets.push(s);
    for (const p of r.pairs) {
      ex.pairs.push({ pair: p, completed: info.completed, position: ex.sets.length });
      // Platzhalter, wird nach Bestimmung der Reihenfolge ersetzt
      ex.sets.push(mkSet(null, null, null, info.completed, true));
    }
    if (!ex.lines.includes(info.index)) ex.lines.push(info.index);
    return true;
  };

  for (let i = 0; i < lines.length; i++) {
    const info = lines[i];
    const next = lines[i + 1];

    if (info.isNote) {
      const note = info.text.replace(/^(\/\/|notiz:|note:|anmerkung:)\s*/i, '').replace(/^\((.*)\)$/, '$1');
      if (current) current.notes = current.notes ? `${current.notes}\n${note}` : note;
      else {
        const d = ensureDay();
        d.notes = d.notes ? `${d.notes}\n${note}` : note;
      }
      continue;
    }

    const tokens = tokenize(info.rest);
    const hasSetData = tokens.some((t) => t.t === 'num');
    const nameKey = normalizeName(info.name);
    const dateInLine = parseDate(info.text, refYear);

    // Datumszeile oder Überschrift → Trainingstag
    const looksLikeDateHeader = dateInLine !== null && !/\d\s*[x×*]\s*\d|kg|lbs/i.test(info.text);
    const textOnly = !hasSetData;
    if (looksLikeDateHeader || (info.heading && textOnly)) {
      day = { name: info.text, date: dateInLine, exercises: [], notes: null };
      days.push(day);
      current = null;
      continue;
    }

    if (textOnly && nameKey) {
      const exact = matcher.best(info.name, 0.999);
      // Folgt eine reine Satzzeile ("60x12"), ist diese Zeile eine Übungsüberschrift
      const nextIsSetLine = !!next && !next.isNote && next.name.length === 0 && next.hasDigits;
      const isDayKeyword = DAY_KEYWORDS.test(info.text);
      const wordCount = info.text.split(/\s+/).length;
      if (!exact && !nextIsSetLine && (isDayKeyword || !matcher.best(info.name, 0.8))) {
        if (wordCount > 7 && current) {
          current.notes = current.notes ? `${current.notes}\n${info.text}` : info.text;
          continue;
        }
        day = { name: info.text, date: null, exercises: [], notes: null };
        days.push(day);
        current = null;
        continue;
      }
      if (wordCount > 7 && !exact && !matcher.best(info.name, 0.8)) {
        if (current) current.notes = current.notes ? `${current.notes}\n${info.text}` : info.text;
        else unparsedLines.push({ line: info.index, text: info.raw });
        continue;
      }
      startExercise(info.name, info.index);
      continue;
    }

    if (info.name && hasSetData) {
      const ex = startExercise(info.name, info.index);
      if (!addSets(ex, info, tokens, true)) {
        ex.warnings.push(`Satzangaben in Zeile ${info.index + 1} nicht erkannt: „${info.rest}“`);
      }
      continue;
    }

    // Reine Satzzeile
    if (hasSetData) {
      if (!current) {
        unparsedLines.push({ line: info.index, text: info.raw });
        continue;
      }
      if (!addSets(current, info, tokens, false)) unparsedLines.push({ line: info.index, text: info.raw });
      continue;
    }
    unparsedLines.push({ line: info.index, text: info.raw });
  }

  // Reihenfolge Gewicht × Wdh. bestimmen: erst je Übung, dann für das Dokument
  const allPairs = days.flatMap((d) => d.exercises.flatMap((e) => e.pairs.map((p) => p.pair)));
  const docOrientation = orientationOf(allPairs);
  for (const d of days) {
    for (const ex of d.exercises) {
      if (!ex.pairs.length) continue;
      const own = orientationOf(ex.pairs.map((p) => p.pair));
      const orientation = own.decided ? own : docOrientation;
      let anyUncertain = false;
      for (const { pair, completed, position } of ex.pairs) {
        const resolved = resolvePair(pair, orientation.weightFirst, unit);
        const uncertain = !resolved.explicit && !own.decided;
        anyUncertain ||= uncertain;
        ex.sets[position] = mkSet(resolved.weightKg, resolved.reps, resolved.repsMax, completed, uncertain);
      }
      if (anyUncertain) {
        ex.warnings.push('Gewicht und Wiederholungen sind nicht eindeutig – bitte die Reihenfolge prüfen.');
      }
    }
  }

  const cleanDays: ParsedDay<T>[] = days
    .map((d) => ({
      name: d.name,
      date: d.date,
      notes: d.notes,
      exercises: d.exercises.map(({ pairs: _pairs, ...rest }) => rest),
    }))
    .filter((d) => d.exercises.length > 0 || d.name);

  if (!cleanDays.some((d) => d.exercises.length)) warnings.push('Keine Übungen erkannt.');
  if (unparsedLines.length) warnings.push(`${unparsedLines.length} Zeile(n) konnten nicht zugeordnet werden.`);

  return { original: text, days: cleanDays, unparsedLines, warnings };
}

function orientationOf(pairs: RawPair[]): { decided: boolean; weightFirst: boolean } {
  let wr = 0;
  let rw = 0;
  for (const { a, b } of pairs) {
    if (a.unit && !b.unit) {
      wr += 2;
      continue;
    }
    if (b.unit && !a.unit) {
      rw += 2;
      continue;
    }
    const aW = isWeightLike(a);
    const bW = isWeightLike(b);
    if (aW && !bW) wr++;
    else if (bW && !aW) rw++;
  }
  if (wr === rw) return { decided: false, weightFirst: true };
  return { decided: true, weightFirst: wr > rw };
}

function resolvePair(
  { a, b }: RawPair,
  weightFirst: boolean,
  unit: WeightUnit,
): { weightKg: number; reps: number; repsMax: number | null; explicit: boolean } {
  if (a.unit && !b.unit) return { weightKg: weightOf(a, unit), reps: b.v, repsMax: b.max, explicit: true };
  if (b.unit && !a.unit) return { weightKg: weightOf(b, unit), reps: a.v, repsMax: a.max, explicit: true };
  return weightFirst
    ? { weightKg: weightOf(a, unit), reps: b.v, repsMax: b.max, explicit: false }
    : { weightKg: weightOf(b, unit), reps: a.v, repsMax: a.max, explicit: false };
}

/** Kompakte Textdarstellung eines Satzes für Vorschau/Export ("80 kg × 10"). */
export function formatParsedSet(s: ParsedSet): string {
  const w = s.weightKg === null ? '–' : `${s.weightKg.toLocaleString('de-DE', { maximumFractionDigits: 2 })} kg`;
  const r = s.reps === null ? '–' : s.repsMax ? `${s.reps}–${s.repsMax}` : String(s.reps);
  return `${w} × ${r}`;
}
