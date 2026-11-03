// Line cook rhythm game: pure, seeded core. Tickets (dishes) need a sequence of station actions, each with a timing window.
// Lanes: 0 grill (D), 1 flip (F), 2 plate (J), 3 sauce (K). Early press = undercooked, late press = burnt.
import { makeRng } from '../../engine/rng';

export const LANE_NAMES = ['Grill', 'Flip', 'Plate', 'Sauce'] as const;
export const LANE_KEYS = ['d', 'f', 'j', 'k'] as const;
export const LANES = LANE_NAMES.length;

/** Station sequences for each menu item (lane indices). */
export const RECIPES: { name: string; steps: number[] }[] = [
  { name: 'Burger', steps: [0, 1, 2] },
  { name: 'Steak', steps: [0, 1, 3, 2] },
  { name: 'Fish', steps: [0, 3, 2] },
  { name: 'Veg plate', steps: [0, 1, 1, 2] },
];

const LEAD_IN_SEC = 2;
const TAIL_SEC = 1.2;
const BASE_WINDOW_SEC = 0.24; // half-width of the hit window at difficulty 1
const MIN_WINDOW_FRAC = 0.45; // fraction of the window left at difficulty 0
const BASE_DISH_GAP_SEC = 2.5;
const BASE_STEP_GAP_SEC = 0.85;
const TEMPO_GAIN = 0.4; // extra tempo at difficulty 0
const MAX_LAG_SEC = 0.06; // input delay at difficulty 0
const MIN_LANE_GAP_SEC = 0.55;
const MIN_CREDIT = 0.2;
const STRAY_PENALTY = 0.01;
const MAX_STRAY_PENALTY = 0.15;
const ACC_WEIGHT = 0.5;

export type NoteState = 'pending' | 'hit' | 'miss';
export interface Note {
  id: number;
  dish: number;
  lane: number;
  time: number;
  state: NoteState;
  /** Signed press error in seconds (negative = early); 0 until hit. */
  err: number;
  credit: number;
}
export interface Dish {
  id: number;
  name: string;
  noteIds: number[];
}
export interface Feedback {
  lane: number;
  label: string;
  at: number;
  good: boolean;
}
export interface Game {
  seed: string;
  difficulty: number;
  durationSec: number;
  window: number;
  lag: number;
  t: number;
  notes: Note[];
  dishes: Dish[];
  strays: number;
  lastFeedback: Feedback | null;
}
export interface Input {
  /** Lane indices pressed during this step. */
  presses?: number[];
}

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function createGame(seed: string, difficulty: number, durationSec = 50): Game {
  const d = clamp01(difficulty);
  const rng = makeRng(`rhythm:${seed}`);
  const tempo = 1 + TEMPO_GAIN * (1 - d);
  const dishGap = BASE_DISH_GAP_SEC / tempo;
  const stepGap = BASE_STEP_GAP_SEC / tempo;
  const notes: Note[] = [];
  const dishes: Dish[] = [];
  const laneLast: number[] = new Array<number>(LANES).fill(-Infinity);
  const lastAllowed = durationSec - TAIL_SEC;
  for (let start = LEAD_IN_SEC + rng.uniform(0, 0.3); ; start += dishGap * rng.uniform(0.9, 1.1)) {
    const recipe = rng.pick(RECIPES);
    let time = start;
    const planned: { lane: number; time: number }[] = [];
    for (const lane of recipe.steps) {
      time = Math.max(time, laneLast[lane]! + MIN_LANE_GAP_SEC);
      planned.push({ lane, time });
      laneLast[lane] = time;
      time += stepGap * rng.uniform(0.85, 1.2);
    }
    if (planned[planned.length - 1]!.time > lastAllowed) break;
    const dish: Dish = { id: dishes.length, name: recipe.name, noteIds: [] };
    for (const p of planned) {
      const id = notes.length;
      notes.push({ id, dish: dish.id, lane: p.lane, time: p.time, state: 'pending', err: 0, credit: 0 });
      dish.noteIds.push(id);
    }
    dishes.push(dish);
  }
  return {
    seed,
    difficulty: d,
    durationSec,
    window: BASE_WINDOW_SEC * (MIN_WINDOW_FRAC + (1 - MIN_WINDOW_FRAC) * d),
    lag: MAX_LAG_SEC * (1 - d),
    t: 0,
    notes,
    dishes,
    strays: 0,
    lastFeedback: null,
  };
}

export function isDone(g: Game): boolean {
  return g.t >= g.durationSec;
}

/** Advance time by dt, expire missed notes, then apply presses at the new time (plus input lag). */
export function step(g: Game, dt: number, input: Input = {}): void {
  if (isDone(g)) return;
  g.t = Math.min(g.durationSec, g.t + dt);
  for (const n of g.notes) {
    if (n.state === 'pending' && g.t - g.window > n.time) {
      n.state = 'miss';
      g.lastFeedback = { lane: n.lane, label: 'Missed', at: g.t, good: false };
    }
  }
  for (const lane of input.presses ?? []) press(g, lane);
}

function press(g: Game, lane: number): void {
  const eff = g.t + g.lag;
  let best: Note | null = null;
  for (const n of g.notes) {
    if (n.lane !== lane || n.state !== 'pending') continue;
    const e = Math.abs(eff - n.time);
    if (e <= g.window && (!best || e < Math.abs(eff - best.time))) best = n;
  }
  if (!best) {
    g.strays++;
    g.lastFeedback = { lane, label: 'Wasted', at: g.t, good: false };
    return;
  }
  const err = eff - best.time;
  best.state = 'hit';
  best.err = err;
  best.credit = Math.max(MIN_CREDIT, 1 - Math.abs(err) / g.window);
  const ratio = Math.abs(err) / g.window;
  const label = ratio < 0.25 ? 'Perfect' : err < 0 ? 'Undercooked' : 'Burnt';
  g.lastFeedback = { lane, label, at: g.t, good: ratio < 0.25 };
}

export interface Breakdown {
  accuracy: number;
  served: number;
  dishesServed: number;
  dishesTotal: number;
}

export function breakdown(g: Game): Breakdown {
  const total = g.notes.length;
  const accuracy = total ? g.notes.reduce((s, n) => s + (n.state === 'hit' ? n.credit : 0), 0) / total : 0;
  const dishesServed = g.dishes.filter((d) => d.noteIds.every((id) => g.notes[id]!.state === 'hit')).length;
  const served = g.dishes.length ? dishesServed / g.dishes.length : 0;
  return { accuracy, served, dishesServed, dishesTotal: g.dishes.length };
}

/** Score 0..1: half timing accuracy over all actions, half tickets fully served, minus a small penalty for wasted presses. */
export function score(g: Game): number {
  const b = breakdown(g);
  const penalty = Math.min(MAX_STRAY_PENALTY, g.strays * STRAY_PENALTY);
  return clamp01(ACC_WEIGHT * b.accuracy + (1 - ACC_WEIGHT) * b.served - penalty);
}
