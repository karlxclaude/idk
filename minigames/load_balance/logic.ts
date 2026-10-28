// Load balance (construction labor): carry a stack of materials along a beam. The stack is an inverted pendulum:
// tilt grows on its own, gusts push it, and the player counter-steers with left/right (-1..1). Past the drop
// threshold the load falls and the carrier loses time. Score = loads delivered / target, clamped to 0..1.
import { makeRng, type Rng } from '../../engine/rng';

export interface LoadBalanceParams {
  /** Pendulum instability (1/s^2): how fast tilt runs away on its own. */
  instability: number;
  /** Control authority (rad/s^2 per unit input). */
  authority: number;
  /** Angular damping (1/s). */
  damping: number;
  /** Gust noise std (rad/s^2). Larger at low difficulty. */
  noiseSd: number;
  /** Gust correlation time (s). */
  noiseTau: number;
  /** Response lag of the correction (s). Larger at low difficulty. */
  lagTau: number;
  /** Tilt (rad) at which the load drops. Lower at low difficulty. */
  dropTilt: number;
  /** Seconds lost per drop. */
  dropPenaltySec: number;
  /** Beam length in metres, walking speed in m/s. */
  beamLength: number;
  walkSpeed: number;
  /** Loads per shift that count as a full score. */
  targetLoads: number;
}

export interface LoadBalanceState {
  params: LoadBalanceParams;
  difficulty: number;
  durationSec: number;
  time: number;
  /** Tilt (rad, + = leaning right) and angular velocity. */
  tilt: number;
  omega: number;
  /** Effective (lagged) correction in -1..1 and gust state. */
  control: number;
  gust: number;
  /** Distance walked on the current beam crossing. */
  pos: number;
  /** Seconds left of drop penalty (carrier is restacking). */
  penalty: number;
  delivered: number;
  drops: number;
  done: boolean;
  rng: Rng;
  /** Seeded slow sway (the "level"): amplitude and phases of two sinusoids. */
  sway: { amp: number; f1: number; p1: number; f2: number; p2: number };
}

export interface LoadBalanceInput {
  /** -1 (push left) .. 1 (push right). */
  dir: number;
}

export const DEFAULT_DURATION_SEC = 50;
const SUBSTEP = 1 / 120;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function paramsFor(difficulty: number): LoadBalanceParams {
  const d = clamp(difficulty, 0, 1);
  const hard = 1 - d;
  return {
    instability: 4,
    authority: 14,
    damping: 1.2,
    noiseSd: 1.6 * (1 + 1.6 * hard),
    noiseTau: 0.35,
    lagTau: 0.03 + 0.2 * hard,
    dropTilt: 0.34 + 0.2 * d,
    dropPenaltySec: 3,
    beamLength: 9,
    walkSpeed: 1.4,
    targetLoads: 6,
  };
}

export function createGame(seed: string, difficulty: number, durationSec = DEFAULT_DURATION_SEC): LoadBalanceState {
  const rng = makeRng(`load_balance|${seed}`);
  const params = paramsFor(difficulty);
  const sway = {
    amp: rng.uniform(0.8, 1.4),
    f1: rng.uniform(0.5, 0.8),
    p1: rng.uniform(0, 2 * Math.PI),
    f2: rng.uniform(1.1, 1.7),
    p2: rng.uniform(0, 2 * Math.PI),
  };
  return {
    params, difficulty: clamp(difficulty, 0, 1), durationSec, time: 0,
    tilt: rng.normal(0, 0.02), omega: 0, control: 0, gust: 0, pos: 0, penalty: 0,
    delivered: 0, drops: 0, done: false, rng, sway,
  };
}

/** Speed factor: slow down when tilted, so leaning costs time even before a drop. */
export function walkFactor(s: LoadBalanceState): number {
  return 1 - 0.5 * clamp(Math.abs(s.tilt) / s.params.dropTilt, 0, 1);
}

function substep(s: LoadBalanceState, dt: number, dir: number): void {
  const p = s.params;
  if (s.penalty > 0) {
    s.penalty = Math.max(0, s.penalty - dt);
    s.control = 0;
    if (s.penalty === 0) { s.tilt = s.rng.normal(0, 0.02); s.omega = 0; s.gust = 0; s.pos = 0; }
    return;
  }
  // Ornstein-Uhlenbeck gust plus the seeded periodic sway.
  const a = Math.exp(-dt / p.noiseTau);
  s.gust = s.gust * a + p.noiseSd * Math.sqrt(1 - a * a) * s.rng.normal();
  const w = s.sway;
  const periodic = w.amp * (Math.sin(2 * Math.PI * w.f1 * s.time + w.p1) + 0.5 * Math.sin(2 * Math.PI * w.f2 * s.time + w.p2));
  // Lagged correction.
  s.control += (clamp(dir, -1, 1) - s.control) * (1 - Math.exp(-dt / p.lagTau));
  const acc = p.instability * s.tilt + s.gust + periodic - p.authority * s.control - p.damping * s.omega;
  s.omega += acc * dt;
  s.tilt += s.omega * dt;
  s.pos += p.walkSpeed * walkFactor(s) * dt;
  if (Math.abs(s.tilt) > p.dropTilt) {
    s.drops++;
    s.penalty = p.dropPenaltySec;
    s.pos = 0;
  } else if (s.pos >= p.beamLength) {
    s.delivered++;
    s.pos = 0;
    s.tilt *= 0.5; s.omega *= 0.5; // brief pause to grab the next stack
  }
}

export function step(s: LoadBalanceState, dtSec: number, input: LoadBalanceInput): void {
  if (s.done) return;
  let left = Math.min(dtSec, s.durationSec - s.time);
  while (left > 1e-9) {
    const dt = Math.min(SUBSTEP, left);
    substep(s, dt, input.dir);
    s.time += dt;
    left -= dt;
  }
  if (s.time >= s.durationSec - 1e-9) s.done = true;
}

export function score(s: LoadBalanceState): number {
  return clamp(s.delivered / s.params.targetLoads, 0, 1);
}

/** Reference bot: PD controller on (possibly stale) tilt readings. Reaction delay is in seconds. */
export function botInput(s: LoadBalanceState, skill = { kp: 9, kd: 2.2 }): LoadBalanceInput {
  const u = (skill.kp * s.tilt + skill.kd * s.omega) / s.params.authority;
  return { dir: clamp(u * 3, -1, 1) };
}
