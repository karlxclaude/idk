// Tote-packing puzzle core (warehouse picker). Pure, seeded, no DOM.
// Items (polyominoes) arrive in a queue. Real items are on the order and must be packed into the tote;
// distractors are NOT on the order and must be rejected (placing one is a wrong pick).
// Score = 0.5 * throughput (items packed vs target) + 0.5 * fill efficiency - wrong-pick penalty.
import { makeRng } from '../../engine/rng';
import type { Rng } from '../../engine/rng';

export type Cell = readonly [number, number]; // [x, y]

export const TOTE_W = 6;
export const TOTE_H = 5;
export const DEFAULT_DURATION = 50;
const QUEUE_LEN = 220;
const SECONDS_PER_ITEM = 2.6; // pace needed for full throughput credit
const GOOD_FILL = 0.85; // fill ratio that earns full efficiency credit
const WRONG_PENALTY = 0.08;
const SKIP_PENALTY = 0.03;
const MIN_TIME_FACTOR = 0.55; // time-limit multiplier at difficulty 0
const BASE_DISTRACTOR = 0.08;
const EXTRA_DISTRACTOR = 0.32; // added at difficulty 0

const SHAPES: readonly (readonly Cell[])[] = [
  [[0, 0], [1, 0]], // domino
  [[0, 0], [1, 0], [2, 0]], // I3
  [[0, 0], [1, 0], [0, 1]], // L3
  [[0, 0], [1, 0], [2, 0], [3, 0]], // I4
  [[0, 0], [1, 0], [0, 1], [1, 1]], // O
  [[0, 0], [1, 0], [2, 0], [1, 1]], // T
  [[1, 0], [2, 0], [0, 1], [1, 1]], // S
  [[0, 0], [1, 0], [2, 0], [0, 1]], // L
];
const SHAPE_WEIGHTS = [1, 2, 3, 1, 3, 3, 2, 3];

export interface Item {
  id: number;
  cells: readonly Cell[]; // normalized (min x = min y = 0)
  distractor: boolean;
}

export interface Piece {
  cells: readonly Cell[];
  x: number;
  y: number;
}

export interface PackState {
  seed: string;
  difficulty: number;
  timeLeft: number;
  totalTime: number;
  queue: readonly Item[];
  index: number; // front-of-queue item
  piece: Piece | null;
  grid: number[][]; // [y][x]: 0 empty, else item id
  sealedFilled: number;
  sealedTotes: number;
  packed: number;
  wrong: number;
  skipped: number;
  targetItems: number;
  finished: boolean;
}

export type PackAction = 'left' | 'right' | 'up' | 'down' | 'rotate' | 'place' | 'reject' | 'seal';

export function normalize(cells: readonly Cell[]): Cell[] {
  const mx = Math.min(...cells.map((c) => c[0]));
  const my = Math.min(...cells.map((c) => c[1]));
  return cells.map(([x, y]) => [x - mx, y - my] as Cell);
}

export function rotateCells(cells: readonly Cell[]): Cell[] {
  return normalize(cells.map(([x, y]) => [-y, x] as Cell));
}

function weightedShape(rng: Rng): readonly Cell[] {
  const total = SHAPE_WEIGHTS.reduce((a, b) => a + b, 0);
  let r = rng.next() * total;
  for (let i = 0; i < SHAPES.length; i++) {
    r -= SHAPE_WEIGHTS[i] ?? 0;
    if (r < 0) return SHAPES[i] ?? SHAPES[0]!;
  }
  return SHAPES[0]!;
}

export function distractorRate(difficulty: number): number {
  return BASE_DISTRACTOR + EXTRA_DISTRACTOR * (1 - clamp01(difficulty));
}

export function timeLimit(difficulty: number, baseSec = DEFAULT_DURATION): number {
  return baseSec * (MIN_TIME_FACTOR + (1 - MIN_TIME_FACTOR) * clamp01(difficulty));
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export function emptyGrid(): number[][] {
  return Array.from({ length: TOTE_H }, () => new Array<number>(TOTE_W).fill(0));
}

export function createGame(seed: string, difficulty: number, durationSec: number = DEFAULT_DURATION): PackState {
  const rng = makeRng(`spatial_packing|${seed}`);
  const rate = distractorRate(difficulty);
  const queue: Item[] = [];
  for (let i = 0; i < QUEUE_LEN; i++) {
    let cells = normalize(weightedShape(rng));
    for (let r = rng.int(0, 3); r > 0; r--) cells = rotateCells(cells);
    // never start with a distractor, so the first action is always a real pick
    queue.push({ id: i + 1, cells, distractor: i > 0 && rng.chance(rate) });
  }
  const total = timeLimit(difficulty, durationSec);
  const s: PackState = {
    seed, difficulty, timeLeft: total, totalTime: total, queue, index: 0, piece: null, grid: emptyGrid(),
    sealedFilled: 0, sealedTotes: 0, packed: 0, wrong: 0, skipped: 0,
    targetItems: Math.max(1, Math.round(durationSec / SECONDS_PER_ITEM)), finished: false,
  };
  spawn(s);
  return s;
}

export function frontItem(s: PackState): Item | null {
  return s.queue[s.index] ?? null;
}

function spawn(s: PackState): void {
  const item = frontItem(s);
  if (!item) { s.piece = null; return; }
  const w = Math.max(...item.cells.map((c) => c[0])) + 1;
  s.piece = { cells: item.cells, x: Math.floor((TOTE_W - w) / 2), y: 0 };
  // a real item that fits nowhere forces the tote to be sealed
  if (!item.distractor && !findPlacement(s.grid, item.cells)) sealTote(s);
}

export function fits(grid: number[][], cells: readonly Cell[], x: number, y: number): boolean {
  return cells.every(([cx, cy]) => {
    const gx = x + cx;
    const gy = y + cy;
    return gx >= 0 && gx < TOTE_W && gy >= 0 && gy < TOTE_H && grid[gy]?.[gx] === 0;
  });
}

/** Best (rotation, x, y) for a piece: maximises contact with walls/boxes (least wasted space). Used by bots. */
export function findPlacement(grid: number[][], cells: readonly Cell[]): { cells: Cell[]; x: number; y: number; rot: number } | null {
  let best: { cells: Cell[]; x: number; y: number; rot: number; score: number } | null = null;
  let c: Cell[] = [...cells];
  for (let rot = 0; rot < 4; rot++) {
    for (let y = 0; y < TOTE_H; y++) {
      for (let x = 0; x < TOTE_W; x++) {
        if (!fits(grid, c, x, y)) continue;
        let contact = 0;
        for (const [cx, cy] of c) {
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const nx = x + cx + dx;
            const ny = y + cy + dy;
            const inside = c.some(([ox, oy]) => x + ox === nx && y + oy === ny);
            if (inside) continue;
            if (nx < 0 || nx >= TOTE_W || ny < 0 || ny >= TOTE_H || grid[ny]?.[nx] !== 0) contact++;
          }
        }
        const score = contact * 10 - (x + y) / 100;
        if (!best || score > best.score) best = { cells: c, x, y, rot, score };
      }
    }
    c = rotateCells(c);
  }
  return best ? { cells: best.cells, x: best.x, y: best.y, rot: best.rot } : null;
}

function toteFilled(s: PackState): number {
  return s.grid.reduce((n, row) => n + row.filter((v) => v !== 0).length, 0);
}

function sealTote(s: PackState): void {
  const filled = toteFilled(s);
  if (filled === 0) return;
  s.sealedFilled += filled;
  s.sealedTotes += 1;
  s.grid = emptyGrid();
}

function advance(s: PackState): void {
  s.index += 1;
  spawn(s);
}

export function act(s: PackState, a: PackAction): boolean {
  if (s.finished || !s.piece) return false;
  const p = s.piece;
  switch (a) {
    case 'left': case 'right': case 'up': case 'down': {
      const dx = a === 'left' ? -1 : a === 'right' ? 1 : 0;
      const dy = a === 'up' ? -1 : a === 'down' ? 1 : 0;
      const w = Math.max(...p.cells.map((c) => c[0])) + 1;
      const h = Math.max(...p.cells.map((c) => c[1])) + 1;
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (nx < 0 || ny < 0 || nx + w > TOTE_W || ny + h > TOTE_H) return false;
      p.x = nx; p.y = ny;
      return true;
    }
    case 'rotate': {
      p.cells = rotateCells(p.cells);
      const w = Math.max(...p.cells.map((c) => c[0])) + 1;
      const h = Math.max(...p.cells.map((c) => c[1])) + 1;
      p.x = Math.min(p.x, TOTE_W - w);
      p.y = Math.min(p.y, TOTE_H - h);
      return true;
    }
    case 'place': {
      const item = frontItem(s);
      if (!item) return false;
      if (item.distractor) { s.wrong += 1; advance(s); return true; } // wrong pick: discarded
      if (!fits(s.grid, p.cells, p.x, p.y)) return false;
      for (const [cx, cy] of p.cells) (s.grid[p.y + cy] as number[])[p.x + cx] = item.id;
      s.packed += 1;
      if (toteFilled(s) === TOTE_W * TOTE_H) sealTote(s);
      advance(s);
      return true;
    }
    case 'reject': {
      const item = frontItem(s);
      if (!item) return false;
      if (!item.distractor) s.skipped += 1;
      advance(s);
      return true;
    }
    case 'seal': {
      sealTote(s);
      const item = frontItem(s);
      if (item) spawn(s);
      return true;
    }
  }
}

export function step(s: PackState, dt: number): void {
  if (s.finished) return;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft <= 0) s.finished = true;
}

export interface Breakdown { throughput: number; fill: number; penalty: number }

export function breakdown(s: PackState): Breakdown {
  const throughput = Math.min(1, s.packed / s.targetItems);
  // judge sealed totes; before any is sealed, judge the one in progress
  const filled = s.sealedTotes > 0 ? s.sealedFilled : toteFilled(s);
  const totes = s.sealedTotes > 0 ? s.sealedTotes : filled > 0 ? 1 : 0;
  const ratio = totes > 0 ? filled / (totes * TOTE_W * TOTE_H) : 0;
  const fill = Math.min(1, ratio / GOOD_FILL);
  return { throughput, fill, penalty: s.wrong * WRONG_PENALTY + s.skipped * SKIP_PENALTY };
}

export function score(s: PackState): number {
  const b = breakdown(s);
  return clamp01(0.5 * b.throughput + 0.5 * b.fill - b.penalty);
}
