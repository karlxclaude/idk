/**
 * A single-celled organism: the player, its kin (daughter cells), amoebas, paramecia and predators.
 * Soft-bodied kinds own a SoftBody; the paramecium is a rigid slipper shape with cilia.
 * Organelles drift inside and lag behind the cell's motion (inertia).
 */
import type { Circle } from '../core/spatialHash';
import { TAU, clamp, damp } from '../core/math';
import { SoftBody } from './SoftBody';
import type { Food } from './Food';

export type OrganismKind = 'player' | 'kin' | 'amoeba' | 'paramecium' | 'predator';
export type OrganismState = 'alive' | 'dividing' | 'engulfed' | 'dead';
export type AiMode = 'wander' | 'seek' | 'chase' | 'flee';

export interface KindConfig {
  soft: boolean;
  points: number;
  baseSpeed: number;
  eatsCells: boolean;
  eatsFood: boolean;
  membrane: number;
  cytoplasm: number;
  nucleus: number;
  flagella: number;
  mitochondria: number;
  wobble: number;
  sense: number;
}

export const KIND: Record<OrganismKind, KindConfig> = {
  player:     { soft: true, points: 28, baseSpeed: 150, eatsCells: true, eatsFood: true, membrane: 0xa8f6dc, cytoplasm: 0x37c9a0, nucleus: 0x1b5d7a, flagella: 3, mitochondria: 6, wobble: 1, sense: 0 },
  kin:        { soft: true, points: 22, baseSpeed: 70, eatsCells: false, eatsFood: true, membrane: 0xa8f6dc, cytoplasm: 0x37c9a0, nucleus: 0x1b5d7a, flagella: 3, mitochondria: 5, wobble: 1, sense: 3.5 },
  amoeba:     { soft: true, points: 20, baseSpeed: 48, eatsCells: true, eatsFood: true, membrane: 0xe2d08f, cytoplasm: 0x8e8d3c, nucleus: 0x4e4a1e, flagella: 0, mitochondria: 4, wobble: 1.8, sense: 3 },
  paramecium: { soft: false, points: 0, baseSpeed: 185, eatsCells: false, eatsFood: true, membrane: 0xb9dcff, cytoplasm: 0x5b86b8, nucleus: 0x2a4a73, flagella: 0, mitochondria: 3, wobble: 0.4, sense: 3.5 },
  predator:   { soft: true, points: 26, baseSpeed: 128, eatsCells: true, eatsFood: false, membrane: 0xff8aa6, cytoplasm: 0x8e2244, nucleus: 0x3a0d22, flagella: 4, mitochondria: 7, wobble: 0.8, sense: 4.5 },
};

export const MAX_MITO = 8;
export const MAX_VAC = 3;
export const MAX_RIBO = 26;
export const MAX_FLAGELLA = 4;
export const DIVIDE_TIME = 2.6;
export const ENGULF_TIME = 2.0;

export class Organelle {
  lx = 0; ly = 0; x = 0; y = 0; r = 1; ang = 0; phase = 0;
}

export class Organism implements Circle {
  id = 0;
  x = 0; y = 0; radius = 20; _qstamp = 0;
  vx = 0; vy = 0;
  mass = 400;
  targetRadius = 20;
  kind: OrganismKind = 'amoeba';
  cfg: KindConfig = KIND.amoeba;
  state: OrganismState = 'dead';
  body: SoftBody | null = null;
  /** Facing direction (unit), eased toward the velocity. */
  faceX = 1; faceY = 0;
  /** 0..1 how hard the cell is swimming right now (drives flagella / cilia animation). */
  effort = 0;
  speedMul = 1;
  maxRadius = Infinity;
  spawnRadius = 20;
  kRest0 = 42; kEdge0 = 110;

  // Organelles.
  readonly nucleus = new Organelle();
  readonly nucleus2 = new Organelle();
  readonly mito: Organelle[] = Array.from({ length: MAX_MITO }, () => new Organelle());
  readonly vac: Organelle[] = Array.from({ length: MAX_VAC }, () => new Organelle());
  readonly riboX = new Float32Array(MAX_RIBO);
  readonly riboY = new Float32Array(MAX_RIBO);
  readonly flagPhase = new Float32Array(MAX_FLAGELLA);
  readonly flagOff = new Float32Array(MAX_FLAGELLA);
  riboSpin = 0;
  ciliaPhase = 0;
  phase = 0;
  age = 0;

  // Division.
  divT = 0;
  divX = 1; divY = 0;

  // Being engulfed.
  captor: Organism | null = null;
  engulfT = 0;
  localX = 0; localY = 0;
  massToGive = 0;
  /** Organisms this one is currently digesting (rendered as vacuoles). */
  eatenCount = 0;

  // AI.
  mode: AiMode = 'wander';
  aiTimer = 0;
  wanderAng = 0;
  wanderTurn = 0;
  target: Organism | null = null;
  foodTarget: Food | null = null;
  steerX = 0; steerY = 0;

  /** Render helpers. */
  alpha = 1;

  init(kind: OrganismKind, x: number, y: number, radius: number) {
    this.kind = kind;
    this.cfg = KIND[kind];
    this.x = x; this.y = y;
    this.vx = this.vy = 0;
    this.radius = this.targetRadius = this.spawnRadius = radius;
    this.mass = radius * radius;
    this.maxRadius = kind === 'player' ? Infinity : radius * 1.5;
    this.state = 'alive';
    this.faceX = Math.cos(this.wanderAng = Math.random() * TAU);
    this.faceY = Math.sin(this.wanderAng);
    this.effort = 0;
    this.speedMul = 1;
    this.alpha = 1;
    this.age = 0;
    this.divT = 0;
    this.captor = null; this.engulfT = 0; this.massToGive = 0; this.eatenCount = 0;
    this.mode = 'wander'; this.aiTimer = Math.random() * 0.5; this.target = null; this.foodTarget = null;
    this.steerX = this.steerY = 0;
    this.phase = Math.random() * TAU;
    if (this.cfg.soft) {
      this.body ??= new SoftBody();
      this.body.reset(x, y, radius, this.cfg.points);
      this.body.wobble = this.cfg.wobble;
      if (kind === 'amoeba') { this.body.kRest = 26; this.body.damping = 4; this.body.anchorRate = 7; }
      else if (kind === 'predator') { this.body.kRest = 50; this.body.damping = 6; this.body.anchorRate = 12; }
      else { this.body.kRest = 42; this.body.damping = 5.5; this.body.anchorRate = 11; }
      this.body.restMul.fill(1);
      this.kRest0 = this.body.kRest; this.kEdge0 = this.body.kEdge = 110;
    } else this.body = null;
    this.initOrganelles();
  }

  private initOrganelles() {
    const R = this.radius;
    const place = (o: Organelle, maxR: number, r: number) => {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * maxR;
      o.lx = Math.cos(a) * d; o.ly = Math.sin(a) * d;
      o.x = this.x + o.lx; o.y = this.y + o.ly;
      o.r = r; o.ang = Math.random() * TAU; o.phase = Math.random() * TAU;
    };
    place(this.nucleus, 0.22, 0.30);
    this.nucleus2.lx = this.nucleus.lx; this.nucleus2.ly = this.nucleus.ly;
    this.nucleus2.x = this.nucleus.x; this.nucleus2.y = this.nucleus.y; this.nucleus2.r = 0.3;
    for (let i = 0; i < MAX_MITO; i++) place(this.mito[i], 0.62, 0.09 + Math.random() * 0.04);
    for (let i = 0; i < MAX_VAC; i++) place(this.vac[i], 0.55, 0.08 + Math.random() * 0.07);
    for (let i = 0; i < MAX_RIBO; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * 0.72;
      this.riboX[i] = Math.cos(a) * d; this.riboY[i] = Math.sin(a) * d;
    }
    for (let i = 0; i < MAX_FLAGELLA; i++) {
      this.flagPhase[i] = Math.random() * TAU;
      this.flagOff[i] = (i - (this.cfg.flagella - 1) / 2) * 0.32;
    }
    void R;
  }

  get maxSpeed() { return this.cfg.baseSpeed * Math.pow(this.radius / 24, 0.85) * this.speedMul; }

  /** Grow by `dm` mass (area units). Radius eases toward sqrt(mass) elsewhere. */
  addMass(dm: number) {
    this.mass = Math.max(16, this.mass + dm);
    const r = Math.sqrt(this.mass);
    this.targetRadius = Math.min(this.maxRadius, r);
    if (this.kind !== 'player') this.mass = Math.min(this.mass, this.maxRadius * this.maxRadius);
  }

  /** Movement integration shared by all kinds. */
  integrate(dt: number, flowX: number, flowY: number) {
    const ms = this.maxSpeed;
    const steerLen = Math.hypot(this.steerX, this.steerY);
    const slow = this.state === 'dividing' ? 0.25 : 1;
    this.vx += this.steerX * ms * 3.2 * slow * dt + flowX * dt;
    this.vy += this.steerY * ms * 3.2 * slow * dt + flowY * dt;
    const drag = Math.exp(-2.1 * dt);
    this.vx *= drag; this.vy *= drag;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > ms * 1.05) { const k = (ms * 1.05) / sp; this.vx *= k; this.vy *= k; }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.effort += (clamp(steerLen, 0, 1) - this.effort) * damp(5, dt);
    if (sp > ms * 0.08) {
      const k = damp(4, dt);
      this.faceX += (this.vx / sp - this.faceX) * k;
      this.faceY += (this.vy / sp - this.faceY) * k;
      const fl = Math.hypot(this.faceX, this.faceY) || 1;
      this.faceX /= fl; this.faceY /= fl;
    }
  }

  /** Ease radius, step the membrane, and drag the organelles along with inertia. */
  updateShape(dt: number, time: number) {
    this.age += dt;
    this.radius += (this.targetRadius - this.radius) * damp(2.4, dt);
    const R = this.radius;
    if (this.body) {
      this.body.radius = R;
      if (this.state === 'dividing') this.applyPinch();
      this.body.step(this.x, this.y, dt, time);
    }
    // Organelles: local targets random-walk, world positions lag behind.
    const walk = (o: Organelle, maxR: number, rate: number, speed: number) => {
      o.lx += (Math.sin(time * speed + o.phase) * 0.3 + (Math.random() - 0.5) * 0.4) * dt * 0.25;
      o.ly += (Math.cos(time * speed * 0.8 + o.phase * 1.7) * 0.3 + (Math.random() - 0.5) * 0.4) * dt * 0.25;
      const d = Math.hypot(o.lx, o.ly);
      if (d > maxR) { o.lx *= maxR / d; o.ly *= maxR / d; }
      const k = damp(rate, dt);
      const ax = this.body ? this.body.ax : this.x, ay = this.body ? this.body.ay : this.y;
      o.x += (ax + o.lx * R - o.x) * k;
      o.y += (ay + o.ly * R - o.y) * k;
      o.ang += Math.sin(time * 0.5 + o.phase) * dt * 0.4;
    };
    if (this.state === 'dividing') {
      const t = this.divT / DIVIDE_TIME;
      const sep = Math.pow(clamp((t - 0.15) / 0.75, 0, 1), 1.5) * 0.72;
      const nx = this.divX * sep, ny = this.divY * sep;
      const k = damp(5, dt);
      const ax = this.body ? this.body.ax : this.x, ay = this.body ? this.body.ay : this.y;
      this.nucleus.x += (ax - nx * R - this.nucleus.x) * k;
      this.nucleus.y += (ay - ny * R - this.nucleus.y) * k;
      this.nucleus2.x += (ax + nx * R - this.nucleus2.x) * k;
      this.nucleus2.y += (ay + ny * R - this.nucleus2.y) * k;
      this.nucleus.r = this.nucleus2.r = 0.30 - 0.06 * t;
    } else {
      walk(this.nucleus, 0.24, 5.5, 0.3);
      this.nucleus2.x = this.nucleus.x; this.nucleus2.y = this.nucleus.y;
      this.nucleus.r = 0.30;
    }
    const nm = Math.min(MAX_MITO, this.cfg.mitochondria);
    for (let i = 0; i < nm; i++) walk(this.mito[i], 0.62, 8, 0.9);
    for (let i = 0; i < MAX_VAC; i++) walk(this.vac[i], 0.56, 6.5, 0.5);
    this.riboSpin += dt * 0.08;
    this.ciliaPhase += dt * (6 + 22 * this.effort);
    const nf = Math.min(MAX_FLAGELLA, this.cfg.flagella);
    for (let i = 0; i < nf; i++) this.flagPhase[i] += dt * (3.5 + 11 * this.effort) * (1 + i * 0.07);
  }

  /** Mitosis: blend the rest shape from a circle into two touching lobes (radius R/√2, centres ±0.7R). */
  private applyPinch() {
    const b = this.body!;
    const t = clamp(this.divT / DIVIDE_TIME, 0, 1);
    const e = t * t * (3 - 2 * t);
    const d = 0.7, rho = 0.72;
    const n = b.n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      const c = Math.abs(Math.cos(a) * this.divX + Math.sin(a) * this.divY);
      const s2 = 1 - c * c;
      const lobe = Math.max(0.1, d * c + Math.sqrt(Math.max(0, rho * rho - d * d * s2)));
      b.restMul[i] = 1 + (lobe - 1) * e;
    }
    b.kEdge = this.kEdge0 * (1 - 0.7 * e);
    b.kRest = this.kRest0 * (1 + 1.5 * e);
  }

  clearPinch() { if (this.body) { this.body.restMul.fill(1); this.body.kEdge = this.kEdge0; this.body.kRest = this.kRest0; } }
}
