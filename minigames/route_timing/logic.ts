// Bike delivery: pure, seeded core. Grid city, one order at a time (pickup then drop-off) with a deadline,
// traffic lights on intersections and cars patrolling roads. Lower difficulty => more cars, tighter deadlines,
// longer light cycles, a bigger red-light crash risk and a turning delay (input lag).
import { makeRng, type Rng } from '../../engine/rng';

export const GRID = 9;
export const MOVE_SEC = 0.28; // time to ride one cell
export const TARGET_SEC = 8; // one "par" delivery per this many seconds defines score 1.0
const SUB_DT = 0.025;
const RED_STALL = 1.2;
const CRASH_STALL = 2.5;
const CAR_STALL = 1.5;
const CAR_SPEED = 1.6; // cells per second

export interface Cell { x: number; y: number }
export interface Dir { dx: number; dy: number }
export interface Light { x: number; y: number; offset: number }
export interface Car { horizontal: boolean; line: number; phase: number; speed: number }
export interface Order { pickup: Cell; drop: Cell; allowed: number; startT: number; picked: boolean }
export interface GameState {
  seed: string;
  difficulty: number;
  duration: number;
  t: number;
  lightPeriod: number;
  turnLag: number;
  slack: number;
  lights: Light[];
  cars: Car[];
  player: Cell;
  move: { from: Cell; to: Cell; prog: number } | null;
  lastDir: Dir;
  lagDir: Dir | null;
  lagLeft: number;
  stall: number;
  stallReason: string;
  order: Order | null;
  orderIdx: number;
  points: number;
  delivered: number;
  missed: number;
  redRuns: number;
  crashes: number;
  moves: number;
  done: boolean;
  rng: Rng;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

export const isRoad = (x: number, y: number) =>
  x >= 0 && y >= 0 && x < GRID && y < GRID && (x % 2 === 0 || y % 2 === 0);
export const isIntersection = (x: number, y: number) => x % 2 === 0 && y % 2 === 0;
const dist = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

export function createGame(seed: string, difficulty: number, durationSec = 55): GameState {
  const d = clamp01(difficulty);
  const rng = makeRng(`${seed}|route_timing|level`);
  const lights: Light[] = [];
  for (let y = 0; y < GRID; y += 2) for (let x = 0; x < GRID; x += 2) lights.push({ x, y, offset: rng.uniform(0, 10) });
  const nCars = 3 + Math.round((1 - d) * 7);
  const cars: Car[] = [];
  for (let i = 0; i < nCars; i++) {
    cars.push({ horizontal: rng.chance(0.5), line: rng.int(0, GRID / 2 | 0) * 2, phase: rng.uniform(0, 2 * (GRID - 1)), speed: CAR_SPEED * rng.uniform(0.8, 1.2) });
  }
  const s: GameState = {
    seed, difficulty: d, duration: durationSec, t: 0,
    lightPeriod: lerp(8, 5, d), turnLag: (1 - d) * 0.6, slack: lerp(1.5, 2.4, d),
    lights, cars, player: { x: 4, y: 4 }, move: null, lastDir: { dx: 0, dy: 0 }, lagDir: null, lagLeft: 0,
    stall: 0, stallReason: '', order: null, orderIdx: 0, points: 0, delivered: 0, missed: 0, redRuns: 0, crashes: 0,
    moves: 0, done: false, rng: makeRng(`${seed}|route_timing|events`),
  };
  s.order = makeOrder(s);
  return s;
}

function makeOrder(s: GameState): Order {
  const r = makeRng(`${s.seed}|route_timing|order|${s.orderIdx}`);
  const here = s.move ? s.move.to : s.player;
  const roads: Cell[] = [];
  for (let y = 0; y < GRID; y++) for (let x = 0; x < GRID; x++) if (isRoad(x, y)) roads.push({ x, y });
  const near = roads.filter((c) => dist(c, here) >= 2 && dist(c, here) <= 7);
  const pickup = r.pick(near);
  const far = roads.filter((c) => dist(c, pickup) >= 4 && dist(c, pickup) <= 9);
  const drop = r.pick(far);
  const allowed = (dist(here, pickup) + dist(pickup, drop)) * MOVE_SEC * s.slack + 3;
  return { pickup, drop, allowed, startT: s.t, picked: false };
}

/** Light state for an entry heading along an axis at time t. */
export function isRed(s: GameState, x: number, y: number, horizontal: boolean, t: number): boolean {
  const l = s.lights.find((q) => q.x === x && q.y === y);
  if (!l) return false;
  const phase = (((t + l.offset) % s.lightPeriod) + s.lightPeriod) % s.lightPeriod / s.lightPeriod;
  const greenH = phase < 0.5;
  return horizontal ? !greenH : greenH;
}

export function carPos(c: Car, t: number): Cell {
  const span = GRID - 1;
  const u = (((t * c.speed + c.phase) % (2 * span)) + 2 * span) % (2 * span);
  const p = Math.round(u <= span ? u : 2 * span - u);
  return c.horizontal ? { x: p, y: c.line } : { x: c.line, y: p };
}

export function carNear(s: GameState, x: number, y: number, t: number, radius = 0): boolean {
  return s.cars.some((c) => { const p = carPos(c, t); return Math.abs(p.x - x) + Math.abs(p.y - y) <= radius; });
}

export type Input = Dir | null;

function arrive(s: GameState, from: Cell, to: Cell) {
  s.player = { x: to.x, y: to.y };
  const horizontal = to.x !== from.x;
  if (isIntersection(to.x, to.y) && isRed(s, to.x, to.y, horizontal, s.t)) {
    s.redRuns++;
    s.stall += RED_STALL;
    s.stallReason = 'Ran a red light';
    if (s.rng.chance(0.3 + 0.3 * (1 - s.difficulty))) {
      s.crashes++;
      s.stall += CRASH_STALL;
      s.stallReason = 'Crash!';
    }
  }
  if (carNear(s, to.x, to.y, s.t)) {
    s.crashes++;
    s.stall += CAR_STALL;
    s.stallReason = 'Hit a car';
  }
  const o = s.order;
  if (!o) return;
  if (!o.picked && to.x === o.pickup.x && to.y === o.pickup.y) o.picked = true;
  else if (o.picked && to.x === o.drop.x && to.y === o.drop.y) {
    const left = o.allowed - (s.t - o.startT);
    if (left > 0) {
      s.points += 0.5 + 0.5 * clamp01(left / o.allowed);
      s.delivered++;
    } else s.missed++;
    s.orderIdx++;
    s.order = makeOrder(s);
  }
}

function tick(s: GameState, dt: number, input: Input) {
  s.t += dt;
  const o = s.order;
  if (o && s.t - o.startT > o.allowed) {
    s.missed++;
    s.orderIdx++;
    s.order = makeOrder(s);
  }
  if (s.stall > 0) { s.stall = Math.max(0, s.stall - dt); return; }
  if (s.move) {
    s.move.prog += dt / MOVE_SEC;
    if (s.move.prog >= 1) {
      const { from, to } = s.move;
      s.move = null;
      arrive(s, from, to);
    }
    return;
  }
  const dir = input && (input.dx !== 0 || input.dy !== 0) ? { dx: Math.sign(input.dx), dy: input.dx !== 0 ? 0 : Math.sign(input.dy) } : null;
  if (!dir || !isRoad(s.player.x + dir.dx, s.player.y + dir.dy)) { s.lagDir = null; return; }
  if (!s.lagDir || s.lagDir.dx !== dir.dx || s.lagDir.dy !== dir.dy) {
    const turning = (s.lastDir.dx !== 0 || s.lastDir.dy !== 0) && (s.lastDir.dx !== dir.dx || s.lastDir.dy !== dir.dy);
    s.lagDir = dir;
    s.lagLeft = turning ? s.turnLag : 0;
  }
  s.lagLeft -= dt;
  if (s.lagLeft <= 0) {
    s.move = { from: { ...s.player }, to: { x: s.player.x + dir.dx, y: s.player.y + dir.dy }, prog: 0 };
    s.lastDir = dir;
    s.lagDir = null;
    s.moves++;
  }
}

export function step(s: GameState, dtSec: number, input: Input): void {
  let left = Math.min(dtSec, s.duration - s.t);
  while (left > 1e-9 && !s.done) {
    const dt = Math.min(SUB_DT, left);
    tick(s, dt, input);
    left -= dt;
    if (s.t >= s.duration - 1e-9) s.done = true;
  }
}

export function targetPoints(s: GameState): number { return s.duration / TARGET_SEC; }
export function score(s: GameState): number { return clamp01(s.points / targetPoints(s)); }

function bfsNext(from: Cell, to: Cell): Dir | null {
  if (from.x === to.x && from.y === to.y) return null;
  const key = (x: number, y: number) => y * GRID + x;
  const prev = new Map<number, Cell>();
  const q: Cell[] = [to];
  prev.set(key(to.x, to.y), to);
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  while (q.length) {
    const c = q.shift() as Cell;
    for (const [dx, dy] of dirs) {
      const nx = c.x + dx, ny = c.y + dy;
      if (!isRoad(nx, ny) || prev.has(key(nx, ny))) continue;
      prev.set(key(nx, ny), c);
      if (nx === from.x && ny === from.y) return { dx: -dx, dy: -dy };
      q.push({ x: nx, y: ny });
    }
  }
  return null;
}

/** Scripted bot: shortest path, waits for green lights and clear cells. Used by tests and previews. */
export function botInput(s: GameState): Input {
  if (s.move || s.stall > 0 || !s.order) return null;
  const goal = s.order.picked ? s.order.drop : s.order.pickup;
  const dir = bfsNext(s.player, goal);
  if (!dir) return null;
  const n = { x: s.player.x + dir.dx, y: s.player.y + dir.dy };
  const turning = (s.lastDir.dx !== 0 || s.lastDir.dy !== 0) && (s.lastDir.dx !== dir.dx || s.lastDir.dy !== dir.dy);
  const arrival = s.t + (s.lagDir ? Math.max(0, s.lagLeft) : turning ? s.turnLag : 0) + MOVE_SEC;
  if (isIntersection(n.x, n.y) && isRed(s, n.x, n.y, dir.dx !== 0, arrival)) return null;
  if (carNear(s, n.x, n.y, arrival, 1)) return null;
  return dir;
}
