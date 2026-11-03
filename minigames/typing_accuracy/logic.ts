// Data-entry mini-game core: invoice records are shown and the player types name, SKU, quantity and price.
// Pure, seeded, no DOM. Every key goes through a lag queue; low difficulty (fatigue) drops or delays keystrokes,
// lengthens records and fills SKUs with look-alike characters (O/0, l/1, I, S/5, B/8).
import { makeRng } from '../../engine/rng';

export const FIELDS = ['name', 'sku', 'qty', 'price'] as const;
export type FieldName = (typeof FIELDS)[number];
export type InvoiceRecord = Record<FieldName, string>;

export const TA = {
  defaultDurationSec: 50,
  /** Characters per minute that count as full marks (40 WPM x 5 chars). */
  targetCpm: 200,
  /** Keystroke drop probability at difficulty 0 (scaled by 1 - difficulty). */
  maxDropProb: 0.08,
  /** Probability a keystroke is delayed at difficulty 0 (scaled by 1 - difficulty). */
  maxDelayProb: 0.3,
  delayMinSec: 0.08,
  delayMaxSec: 0.4,
  /** Look-alike share of SKU characters at difficulty 1 and 0. */
  lookalikeAt1: 0.1,
  lookalikeAt0: 0.7,
  skuLenAt1: 6,
  skuLenExtra: 6,
  companyChanceAt1: 0.1,
  companyChanceAt0: 0.8,
} as const;

const FIRST = ['Ada', 'Ben', 'Cora', 'Dev', 'Elio', 'Faye', 'Gus', 'Hana', 'Ivan', 'June', 'Kofi', 'Lena', 'Milo', 'Nora', 'Omar', 'Pia'];
const LAST = ['Stone', 'Okafor', 'Lindqvist', 'Moreau', 'Ibarra', 'Tanaka', 'Quill', 'Bellamy', 'Oyelaran', 'Silva', 'Brandt', 'Illescu'];
const COMPANY = ['Holdings', 'Logistics', 'Industrial Supply', 'Bolt & Sons', 'Global Trading Co'];
const PLAIN = 'ACDEFGHJKMNPQRTUVWXYZ2346794';
const LOOKALIKE = 'O0l1IS5B8';

export function makeRecord(seed: string, difficulty: number, index: number): InvoiceRecord {
  const r = makeRng(`${seed}|rec|${index}`);
  const hard = 1 - clamp01(difficulty);
  let name = `${r.pick(FIRST)} ${r.pick(LAST)}`;
  if (r.chance(TA.companyChanceAt1 + (TA.companyChanceAt0 - TA.companyChanceAt1) * hard)) name += ` ${r.pick(COMPANY)}`;
  const look = TA.lookalikeAt1 + (TA.lookalikeAt0 - TA.lookalikeAt1) * hard;
  const len = TA.skuLenAt1 + Math.round(TA.skuLenExtra * hard);
  let sku = '';
  for (let i = 0; i < len; i++) {
    sku += r.chance(look) ? r.pick([...LOOKALIKE]) : r.pick([...PLAIN]);
    if (i === 2 && len > 8) sku += '-';
  }
  const qty = String(r.int(1, 9 + Math.round(90 * hard)));
  const price = `${r.int(1, 99 + Math.round(900 * hard))}.${String(r.int(0, 99)).padStart(2, '0')}`;
  return { name, sku, qty, price };
}

export interface Keystroke {
  key: string; // single char, 'Backspace' or 'Enter' (commit field)
  due: number;
}

export interface GameState {
  seed: string;
  difficulty: number;
  durationSec: number;
  t: number;
  rng: ReturnType<typeof makeRng>;
  records: InvoiceRecord[];
  /** Committed entries per record index, per field. */
  entries: Partial<Record<FieldName, string>>[];
  recordIdx: number;
  fieldIdx: number;
  buffer: string;
  queue: Keystroke[];
  lastDue: number;
  dropped: number;
  delayed: number;
  done: boolean;
}

export function createGame(seed: string, difficulty: number, durationSec: number = TA.defaultDurationSec): GameState {
  const d = clamp01(difficulty);
  return {
    seed,
    difficulty: d,
    durationSec,
    t: 0,
    rng: makeRng(`${seed}|keys`),
    records: [makeRecord(seed, d, 0)],
    entries: [{}],
    recordIdx: 0,
    fieldIdx: 0,
    buffer: '',
    queue: [],
    lastDue: 0,
    dropped: 0,
    delayed: 0,
    done: false,
  };
}

export const currentRecord = (s: GameState): InvoiceRecord => s.records[s.recordIdx] as InvoiceRecord;
export const currentField = (s: GameState): FieldName => FIELDS[s.fieldIdx] as FieldName;
export const currentTarget = (s: GameState): string => currentRecord(s)[currentField(s)];

/** Player presses a key. May be dropped or delayed by fatigue. Enter/Backspace are never dropped. */
export function pressKey(s: GameState, key: string): void {
  if (s.done) return;
  const hard = 1 - s.difficulty;
  const isChar = key.length === 1;
  if (isChar && s.rng.chance(TA.maxDropProb * hard)) {
    s.dropped++;
    return;
  }
  let due = s.t;
  if (s.rng.chance(TA.maxDelayProb * hard)) {
    due += s.rng.uniform(TA.delayMinSec, TA.delayMaxSec);
    s.delayed++;
  }
  due = Math.max(due, s.lastDue); // keep order
  s.lastDue = due;
  s.queue.push({ key, due });
}

function apply(s: GameState, key: string): void {
  if (key === 'Backspace') s.buffer = s.buffer.slice(0, -1);
  else if (key === 'Enter') {
    (s.entries[s.recordIdx] as Partial<Record<FieldName, string>>)[currentField(s)] = s.buffer;
    s.buffer = '';
    s.fieldIdx++;
    if (s.fieldIdx >= FIELDS.length) {
      s.fieldIdx = 0;
      s.recordIdx++;
      s.records.push(makeRecord(s.seed, s.difficulty, s.recordIdx));
      s.entries.push({});
    }
  } else if (s.buffer.length < currentTarget(s).length + 4) s.buffer += key;
}

export function step(s: GameState, dtSec: number): void {
  if (s.done) return;
  s.t = Math.min(s.durationSec, s.t + dtSec);
  while (s.queue.length > 0 && (s.queue[0] as Keystroke).due <= s.t) apply(s, (s.queue.shift() as Keystroke).key);
  if (s.t >= s.durationSec) s.done = true;
}

export interface Tally {
  correct: number;
  attempted: number;
}

/** Position-wise matching; attempted counts the longer of typed/target so omissions and extras both cost. */
export function tally(s: GameState): Tally {
  let correct = 0;
  let attempted = 0;
  const add = (typed: string, target: string) => {
    for (let i = 0; i < Math.max(typed.length, target.length); i++) if (typed[i] === target[i]) correct++;
    attempted += Math.max(typed.length, target.length);
  };
  for (let i = 0; i <= s.recordIdx; i++) {
    const rec = s.records[i] as InvoiceRecord;
    for (const f of FIELDS) {
      const e = (s.entries[i] as Partial<Record<FieldName, string>>)[f];
      if (e !== undefined) add(e, rec[f]);
    }
  }
  // Partially typed current field: only count what has been typed (no penalty for the untyped remainder).
  const target = currentTarget(s);
  for (let k = 0; k < s.buffer.length; k++) if (s.buffer[k] === target[k]) correct++;
  attempted += s.buffer.length;
  return { correct, attempted };
}

export function accuracy(s: GameState): number {
  const { correct, attempted } = tally(s);
  return attempted === 0 ? 0 : correct / attempted;
}

export function cpm(s: GameState): number {
  const minutes = Math.max(s.t, 1) / 60;
  return tally(s).correct / minutes;
}

/** Score 0..1 = min(1, correct chars per minute / target) x accuracy. */
export function score(s: GameState): number {
  const sc = Math.min(1, cpm(s) / TA.targetCpm) * accuracy(s);
  return clamp01(sc);
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}
