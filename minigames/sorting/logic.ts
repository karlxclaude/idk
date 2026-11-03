// Retail stocking: pure, seeded sorting game core. No DOM, no React.
// Products ride a conveyor. The lead product must be shelved by category (FRONT if older than the shelf's front
// item, otherwise BACK), or binned if expired. Score = sort accuracy x throughput.
import { makeRng } from '../../engine/rng';

export const TODAY = 300; // day-of-year the shift happens on
export const MAX_SHELF = 6;
const EXPIRED_SHARE = 0.22;
const SALE_EVERY = 1.3;

export interface Product { id: number; cat: number; expiry: number; t: number }
export interface Params { cats: number; interval: number; travel: number; spread: number }
export type Action = { kind: 'shelf'; shelf: number; front: boolean } | { kind: 'bin' };

export interface GameState {
  seed: string;
  difficulty: number;
  duration: number;
  params: Params;
  schedule: Product[]; // pregenerated arrivals (the "level")
  sales: { t: number; shelf: number }[];
  time: number;
  nextSpawn: number;
  nextSale: number;
  belt: Product[]; // oldest arrival first = lead product
  shelves: number[][]; // expiry days, front first
  handled: number;
  correct: number;
  missed: number;
  lastResult: 'ok' | 'bad' | 'miss' | null;
  streak: number;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function paramsFor(difficulty: number): Params {
  const d = clamp01(difficulty);
  return {
    cats: Math.round(4 - d), // 3 rested .. 4 tired
    interval: lerp(0.6, 1.5, d), // seconds between arrivals
    travel: lerp(2.6, 6, d), // seconds before an item rolls off the end
    spread: Math.round(lerp(1, 6, d)), // days of date spread; small = dates look alike
  };
}

export function createGame(seed: string, difficulty: number, durationSec = 50): GameState {
  const params = paramsFor(difficulty);
  const rng = makeRng(`sorting|${seed}`);
  const schedule: Product[] = [];
  let t = 0.5;
  for (let id = 0; t < durationSec; id++) {
    const expired = rng.chance(EXPIRED_SHARE);
    const expiry = expired ? TODAY - rng.int(1, Math.max(1, Math.min(3, params.spread))) : TODAY + rng.int(0, params.spread);
    schedule.push({ id, cat: rng.int(0, params.cats - 1), expiry, t });
    t += params.interval * rng.uniform(0.8, 1.2);
  }
  const sales: { t: number; shelf: number }[] = [];
  for (let s = SALE_EVERY; s < durationSec; s += SALE_EVERY) sales.push({ t: s, shelf: rng.int(0, params.cats - 1) });
  return {
    seed, difficulty, duration: durationSec, params, schedule, sales, time: 0, nextSpawn: 0, nextSale: 0,
    belt: [], shelves: Array.from({ length: params.cats }, () => []),
    handled: 0, correct: 0, missed: 0, lastResult: null, streak: 0,
  };
}

export const isExpired = (p: Product) => p.expiry < TODAY;

/** Best action for the lead product (used by the bot and by tests). */
export function idealAction(s: GameState): Action | null {
  const p = s.belt[0];
  if (!p) return null;
  if (isExpired(p)) return { kind: 'bin' };
  const front = s.shelves[p.cat]?.[0];
  return { kind: 'shelf', shelf: p.cat, front: front !== undefined && p.expiry < front };
}

function judge(s: GameState, p: Product, a: Action): boolean {
  if (isExpired(p)) return a.kind === 'bin';
  if (a.kind === 'bin' || a.shelf !== p.cat) return false;
  const front = s.shelves[a.shelf]?.[0];
  if (front === undefined) return true; // empty shelf: either end is fine
  return a.front ? p.expiry <= front : p.expiry >= front;
}

/** Apply one action to the lead product. Returns false if nothing to act on. */
export function act(s: GameState, a: Action): boolean {
  const p = s.belt.shift();
  if (!p) return false;
  const ok = judge(s, p, a);
  s.handled++;
  if (ok) { s.correct++; s.streak++; } else s.streak = 0;
  s.lastResult = ok ? 'ok' : 'bad';
  if (a.kind === 'shelf') {
    const shelf = s.shelves[a.shelf];
    if (shelf) {
      if (a.front) shelf.unshift(p.expiry); else shelf.push(p.expiry);
      while (shelf.length > MAX_SHELF) shelf.pop();
    }
  }
  return true;
}

export function isOver(s: GameState): boolean {
  return s.time >= s.duration;
}

export function step(s: GameState, dt: number, actions: Action[] = []): void {
  if (isOver(s)) return;
  s.time = Math.min(s.duration, s.time + dt);
  while (s.nextSpawn < s.schedule.length && (s.schedule[s.nextSpawn] as Product).t <= s.time) {
    s.belt.push(s.schedule[s.nextSpawn++] as Product);
  }
  while (s.nextSale < s.sales.length && (s.sales[s.nextSale] as { t: number }).t <= s.time) {
    s.shelves[(s.sales[s.nextSale++] as { shelf: number }).shelf]?.shift();
  }
  for (const a of actions) act(s, a);
  while (s.belt.length > 0 && s.time - (s.belt[0] as Product).t >= s.params.travel) {
    s.belt.shift();
    s.missed++;
    s.streak = 0;
    s.lastResult = 'miss';
  }
}

export const accuracy = (s: GameState) => (s.handled > 0 ? s.correct / s.handled : 0);
export const throughput = (s: GameState) => {
  const resolved = s.handled + s.missed;
  return resolved > 0 ? s.handled / resolved : 0;
};
/** Running/final score 0..1 = accuracy x throughput. */
export function score(s: GameState): number {
  return clamp01(accuracy(s) * throughput(s));
}

/** Presentation: labels get more alike (similar names, close hues) as difficulty drops. */
const DISTINCT = [['Dairy', '🥛'], ['Produce', '🥦'], ['Canned', '🥫'], ['Snacks', '🍪']] as const;
const ALIKE = [['Milk', '🥛'], ['Cream', '🍦'], ['Yogurt', '🥣'], ['Butter', '🧈']] as const;
export function categoryLook(difficulty: number, cat: number, cats: number): { name: string; icon: string; hue: number } {
  const d = clamp01(difficulty);
  const [name, icon] = (d >= 0.5 ? DISTINCT : ALIKE)[cat % 4] as readonly [string, string];
  const gap = lerp(30, 360 / Math.max(cats, 1), d);
  return { name, icon, hue: (200 + cat * gap) % 360 };
}
