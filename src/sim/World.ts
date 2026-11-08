/**
 * The pond. Owns every organism, food particle and sediment grain, spawns/despawns them in a ring
 * around the player, runs the simple AI, resolves soft contacts, and handles phagocytosis
 * (capture -> vacuole -> dissolve) and mitosis. Everything is pooled.
 */
import { Pool } from '../core/pool';
import { SpatialHash, type Circle } from '../core/spatialHash';
import { TAU, clamp, damp, lerp, rng } from '../core/math';
import { CAPTURE_TIME, DIGEST_TIME, Food, type FoodKind } from './Food';
import { DIVIDE_TIME, ENGULF_TIME, Organism, type OrganismKind } from './Organism';
import { flowAt } from './flow';

export interface Grain extends Circle { variant: number; seed: number; alive: boolean; }

export interface WorldEvents {
  onEat(kind: FoodKind | OrganismKind, byPlayer: boolean, size: number): void;
  onPlayerEngulfed(by: Organism): void;
  onDivide(player: Organism, daughter: Organism): void;
}

const EAT_RATIO = 1.18;
const BIRTH_RADIUS = 24;

export class World {
  readonly organisms: Organism[] = [];
  readonly food: Food[] = [];
  readonly grains: Grain[] = [];
  player: Organism | null = null;
  time = 0;
  /** Settled view radius for the player (set by the game each step). */
  viewRadius = 600;
  density = 1;
  generation = 0;
  /** Radius at which the player divides (grows ~9% per generation). */
  divideRadius = BIRTH_RADIUS * 1.55;
  foodEaten = 0;
  cellsEaten = 0;
  stats = { kin: 0 };

  private orgPool = new Pool<Organism>(() => new Organism(), (o) => { o.state = 'dead'; o.captor = null; o.target = null; o.foodTarget = null; }, 24);
  private foodPool = new Pool<Food>(() => new Food(), (f) => { f.state = 'dead'; f.captor = null; }, 160);
  private grainPool = new Pool<Grain>(() => ({ x: 0, y: 0, radius: 10, _qstamp: 0, variant: 0, seed: 0, alive: false }), undefined, 12);
  private foodHash = new SpatialHash<Food>(48);
  private solidHash = new SpatialHash<Circle>(120);
  private qFood: Food[] = [];
  private qSolid: Circle[] = [];
  private spawnTimer = 0;
  private nextId = 1;
  /** Newly spawned things get a few seconds of invulnerability from predators (and the player at start). */
  graceTimer = 0;

  constructor(private events: WorldEvents) {}

  // ───────────────────────── lifecycle ─────────────────────────
  reset() {
    for (const o of this.organisms) this.orgPool.release(o);
    for (const f of this.food) this.foodPool.release(f);
    for (const g of this.grains) { g.alive = false; this.grainPool.release(g); }
    this.organisms.length = 0; this.food.length = 0; this.grains.length = 0;
    this.player = null;
    this.generation = 0;
    this.divideRadius = BIRTH_RADIUS * 1.55;
    this.foodEaten = 0; this.cellsEaten = 0; this.stats.kin = 0;
    this.spawnTimer = 0;
    this.graceTimer = 4;
  }

  start() {
    this.reset();
    const p = this.spawnOrganism('player', 0, 0, BIRTH_RADIUS);
    this.player = p;
    // Seed the surroundings: food everywhere, grains and harmless cells nearby, predators far away.
    const V = this.viewRadius;
    for (let i = 0; i < 70 * this.density; i++) this.spawnFoodAt(rng.angle(), rng.range(V * 0.25, V * 1.6));
    for (let i = 0; i < 5; i++) this.spawnGrainAt(rng.angle(), rng.range(V * 0.6, V * 1.9));
    for (let i = 0; i < 4; i++) this.spawnNpc(rng.pick(['amoeba', 'paramecium', 'paramecium', 'amoeba'] as const), rng.angle(), rng.range(V * 0.7, V * 1.6));
    for (let i = 0; i < 3; i++) this.spawnNpc('predator', rng.angle(), rng.range(V * 1.6, V * 2.2));
  }

  spawnOrganism(kind: OrganismKind, x: number, y: number, radius: number): Organism {
    const o = this.orgPool.acquire();
    o.init(kind, x, y, radius);
    o.id = this.nextId++;
    this.organisms.push(o);
    if (kind === 'kin') this.stats.kin++;
    return o;
  }

  private spawnNpc(kind: OrganismKind, ang: number, dist: number) {
    const p = this.player!;
    const R = p.radius;
    let r: number;
    if (kind === 'amoeba') r = R * rng.range(0.55, 1.5);
    else if (kind === 'paramecium') r = R * rng.range(0.45, 0.9);
    else r = R * rng.range(1.3, 2.0);
    return this.spawnOrganism(kind, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, r);
  }

  private spawnFoodAt(ang: number, dist: number) {
    const p = this.player!;
    const R = p.radius;
    const roll = rng.next();
    const kind: FoodKind = roll < 0.5 ? 'bacteria' : roll < 0.8 ? 'algae' : 'debris';
    const r = kind === 'bacteria' ? R * rng.range(0.15, 0.22) : kind === 'algae' ? R * rng.range(0.24, 0.36) : R * rng.range(0.12, 0.28);
    const tints: Record<FoodKind, number[]> = {
      bacteria: [0xd9c7ff, 0xffd1dc, 0xc9f0ff, 0xf5e6c8],
      algae: [0x7fd36b, 0x5fbf5a, 0x9ad64f, 0x6fc97e],
      debris: [0x9c7b4f, 0x7d6a4a, 0xb08a5a, 0x6b5a3e],
    };
    const f = this.foodPool.acquire();
    f.init(kind, p.x + Math.cos(ang) * dist, p.y + Math.sin(ang) * dist, r, rng.int(0, 2), rng.pick(tints[kind]));
    this.food.push(f);
    return f;
  }

  private spawnGrainAt(ang: number, dist: number) {
    const p = this.player!;
    const g = this.grainPool.acquire();
    g.x = p.x + Math.cos(ang) * dist; g.y = p.y + Math.sin(ang) * dist;
    g.radius = p.radius * rng.range(0.6, 1.5);
    g.variant = rng.int(0, 2); g.seed = rng.next() * 1000; g.alive = true;
    this.grains.push(g);
  }

  private maintainPopulation() {
    const p = this.player;
    if (!p) return;
    const V = this.viewRadius;
    const far2 = (V * 2.9) ** 2;
    // Despawn far things.
    for (let i = this.organisms.length - 1; i >= 0; i--) {
      const o = this.organisms[i];
      if (o === p || o.state === 'engulfed' || o.state === 'dead') continue;
      if (o.kind === 'kin') continue; // kin stay with the colony count; they are culled by distance below
      const d2 = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d2 > far2) this.killOrganism(o);
    }
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      if (f.state !== 'free') continue;
      if ((f.x - p.x) ** 2 + (f.y - p.y) ** 2 > far2) { this.food.splice(i, 1); this.foodPool.release(f); }
    }
    for (let i = this.grains.length - 1; i >= 0; i--) {
      const g = this.grains[i];
      if ((g.x - p.x) ** 2 + (g.y - p.y) ** 2 > far2) { this.grains.splice(i, 1); g.alive = false; this.grainPool.release(g); }
    }
    // Count what is alive.
    let amoebas = 0, paras = 0, preds = 0, kin = 0;
    for (const o of this.organisms) {
      if (o.state === 'engulfed' || o.state === 'dead') continue;
      if (o.kind === 'amoeba') amoebas++; else if (o.kind === 'paramecium') paras++; else if (o.kind === 'predator') preds++; else if (o.kind === 'kin') kin++;
    }
    this.stats.kin = kin;
    const freeFood = this.food.length;
    const want = Math.round(95 * this.density);
    // Spawn a few per tick so population builds gradually and never spikes the frame.
    let budget = 6;
    while (freeFood + (6 - budget) < want && budget-- > 0) this.spawnFoodAt(rng.angle(), rng.range(V * 1.2, V * 2.4));
    const ring = () => rng.range(V * 1.3, V * 2.3);
    if (amoebas < 4) this.spawnNpc('amoeba', rng.angle(), ring());
    else if (paras < 4) this.spawnNpc('paramecium', rng.angle(), ring());
    else if (preds < 3 + Math.min(2, Math.floor(this.generation / 3))) this.spawnNpc('predator', rng.angle(), rng.range(V * 1.6, V * 2.4));
    if (this.grains.length < 7) this.spawnGrainAt(rng.angle(), ring());
  }

  private killOrganism(o: Organism) {
    const i = this.organisms.indexOf(o);
    if (i >= 0) this.organisms.splice(i, 1);
    // Release anything it was digesting.
    for (let j = this.food.length - 1; j >= 0; j--) {
      const f = this.food[j];
      if (f.captor === o) { this.food.splice(j, 1); this.foodPool.release(f); }
    }
    for (const other of this.organisms) if (other.captor === o) { other.captor = null; other.state = 'dead'; }
    o.state = 'dead';
    this.orgPool.release(o);
  }

  // ───────────────────────── stepping ─────────────────────────
  step(dt: number) {
    this.time += dt;
    const p = this.player;
    if (!p) return;
    this.graceTimer = Math.max(0, this.graceTimer - dt);
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) { this.spawnTimer = 0.3; this.maintainPopulation(); }

    const R = p.radius;
    this.foodHash.cellSize = Math.max(16, R * 1.5);
    this.solidHash.cellSize = Math.max(40, R * 4);
    this.foodHash.clear(); this.solidHash.clear();
    for (const f of this.food) if (f.state === 'free') this.foodHash.insert(f);
    for (const o of this.organisms) if (o.state === 'alive' || o.state === 'dividing') this.solidHash.insert(o);
    for (const g of this.grains) this.solidHash.insert(g);

    // AI + movement.
    for (const o of this.organisms) {
      if (o.state === 'engulfed' || o.state === 'dead') continue;
      if (o.kind !== 'player') this.think(o, dt);
      const fl = flowAt(o.x, o.y, this.time, R / 24);
      const fk = o.kind === 'paramecium' ? 2 : 4;
      o.integrate(dt, fl.x * fk * R * 0.1, fl.y * fk * R * 0.1);
    }

    // Interactions.
    for (let i = 0; i < this.organisms.length; i++) {
      const o = this.organisms[i];
      if (o.state === 'engulfed' || o.state === 'dead') continue;
      this.interactFood(o, dt);
      this.interactSolids(o, dt);
    }

    // Shapes, digestion, division.
    for (let i = this.organisms.length - 1; i >= 0; i--) {
      const o = this.organisms[i];
      if (o.state === 'dead') continue;
      if (o.state === 'engulfed') this.updateEngulfed(o, dt);
      else if (o.state === 'dividing') {
        o.divT += dt;
        if (o.divT >= DIVIDE_TIME) this.finishDivision(o);
      } else if (o === p && p.radius >= this.divideRadius && p.state === 'alive') this.beginDivision(p);
      o.updateShape(dt, this.time);
    }
    for (let i = this.food.length - 1; i >= 0; i--) {
      const f = this.food[i];
      if (f.state === 'free') this.driftFood(f, dt, R);
      else if (f.state === 'captured' || f.state === 'digesting') this.digestFood(f, dt);
      if (f.state === 'dead') { this.food.splice(i, 1); this.foodPool.release(f); }
    }
  }

  private driftFood(f: Food, dt: number, R: number) {
    const fl = flowAt(f.x, f.y, this.time, R / 24);
    const drag = Math.exp(-1.5 * dt);
    if (f.kind === 'bacteria') {
      // Run-and-tumble swimming with a wiggle.
      f.angle += Math.sin(this.time * 2.1 + f.phase) * dt * 1.4 + (Math.random() - 0.5) * dt * 3;
      const sp = f.radius * 5;
      f.vx += Math.cos(f.angle) * sp * 3 * dt + fl.x * R * 0.25 * dt;
      f.vy += Math.sin(f.angle) * sp * 3 * dt + fl.y * R * 0.25 * dt;
    } else if (f.kind === 'algae') {
      f.vx += fl.x * R * 0.4 * dt;
      f.vy += (fl.y * R * 0.4 + f.radius * 0.35) * dt; // slow sink
      f.angle += f.spin * dt;
    } else {
      f.vx += fl.x * R * 0.6 * dt;
      f.vy += (fl.y * R * 0.6 + f.radius * 0.2) * dt;
      f.angle += f.spin * dt;
    }
    f.vx *= drag; f.vy *= drag;
    f.x += f.vx * dt; f.y += f.vy * dt;
  }

  private digestFood(f: Food, dt: number) {
    const c = f.captor!;
    if (c.state === 'dead') { f.state = 'dead'; return; }
    const cx = c.body ? c.body.ax : c.x, cy = c.body ? c.body.ay : c.y;
    if (f.state === 'captured') {
      f.progress = Math.min(1, f.progress + dt / CAPTURE_TIME);
      const e = 1 - Math.pow(1 - f.progress, 3);
      const tx = cx + f.localX * c.radius, ty = cy + f.localY * c.radius;
      // Follow the captor while gliding in.
      f.x = lerp(f.fromX, tx, e); f.y = lerp(f.fromY, ty, e);
      f.fromX += (tx - f.fromX) * damp(6, dt); f.fromY += (ty - f.fromY) * damp(6, dt);
      // The membrane keeps bulging toward the food as it is wrapped.
      if (c.body) {
        const dx = f.x - cx, dy = f.y - cy, d = Math.hypot(dx, dy) || 1;
        c.body.bulge(dx / d, dy / d, c.radius * 14 * (1 - e), 0.8);
      }
      if (f.progress >= 1) { f.state = 'digesting'; f.progress = 0; }
    } else {
      f.progress = Math.min(1, f.progress + dt / DIGEST_TIME);
      const tx = cx + f.localX * c.radius, ty = cy + f.localY * c.radius;
      f.x += (tx - f.x) * damp(8, dt); f.y += (ty - f.y) * damp(8, dt);
      const give = f.mass * (dt / DIGEST_TIME);
      c.addMass(give);
      f.alpha = 1 - f.progress * f.progress;
      f.scale = 1 - 0.75 * f.progress;
      if (f.progress >= 1) f.state = 'dead';
    }
  }

  private interactFood(o: Organism, dt: number) {
    if (!o.cfg.eatsFood && o.kind !== 'predator') return;
    const reach = o.radius * 1.7;
    const list = this.foodHash.query(o.x, o.y, reach, this.qFood);
    let bulges = 0;
    const eating = o.state === 'alive' || o.state === 'dividing';
    for (const f of list) {
      if (f.state !== 'free') continue;
      if (o.kind === 'paramecium' && f.kind !== 'bacteria') continue;
      if (o.kind === 'predator') continue;
      const dx = f.x - o.x, dy = f.y - o.y;
      const d = Math.hypot(dx, dy);
      if (d < o.radius * 0.9 + f.radius * 0.3 && eating) {
        // Phagocytosis begins: the food becomes part of the cell.
        f.state = 'captured';
        f.captor = o;
        f.fromX = f.x; f.fromY = f.y;
        f.progress = 0;
        const a = rng.angle(), rr = Math.sqrt(rng.next()) * 0.45;
        f.localX = Math.cos(a) * rr; f.localY = Math.sin(a) * rr;
        f.vx = f.vy = 0;
        const byPlayer = o === this.player;
        if (byPlayer) this.foodEaten++;
        this.events.onEat(f.kind, byPlayer, f.radius / o.radius);
      } else if (o.body && bulges < 3 && d < reach) {
        // Pseudopod: reach toward nearby food.
        const w = 1 - d / reach;
        o.body.bulge(dx / d, dy / d, o.radius * 22 * w * w, 0.7);
        bulges++;
      }
    }
    void dt;
  }

  private canEat(a: Organism, b: Organism): boolean {
    if (!a.cfg.eatsCells) return false;
    if ((a.kind === 'player' || a.kind === 'kin') && (b.kind === 'player' || b.kind === 'kin')) return false;
    if (b.state !== 'alive' && b.state !== 'dividing') return false;
    if (this.graceTimer > 0 && (b.kind === 'player' || b.kind === 'kin') && a.kind !== 'player') return false;
    return a.radius >= b.radius * EAT_RATIO;
  }

  private interactSolids(o: Organism, dt: number) {
    const list = this.solidHash.query(o.x, o.y, o.radius * 2.2, this.qSolid);
    for (const s of list) {
      if (s === o) continue;
      const other = s as Organism;
      const isOrg = (other as Organism).cfg !== undefined;
      const dx = s.x - o.x, dy = s.y - o.y;
      const d = Math.hypot(dx, dy) || 0.001;
      if (!isOrg) {
        // Sediment grain: rigid. Centre is kept out, membrane flattens against it.
        const minD = s.radius + o.radius * 0.45;
        if (d < minD) {
          const k = (minD - d) * 0.35;
          o.x -= (dx / d) * k; o.y -= (dy / d) * k;
          const vn = o.vx * (dx / d) + o.vy * (dy / d);
          if (vn > 0) { o.vx -= (dx / d) * vn * 0.9; o.vy -= (dy / d) * vn * 0.9; }
        }
        if (o.body && d < s.radius + o.radius * 1.3) o.body.pushOutOfCircle(s.x, s.y, s.radius, 0.9);
        continue;
      }
      if (other.state === 'engulfed' || other.state === 'dead') continue;
      // Eating: the smaller cell's centre has entered the bigger one's body.
      if (this.canEat(o, other) && d < o.radius * 0.72) { this.engulf(o, other); continue; }
      if (this.canEat(other, o)) continue; // the other will handle eating us; don't shove it away
      // Soft separation of two cells that cannot eat each other.
      const minD = (o.radius + other.radius) * 0.88;
      if (d < minD) {
        const k = ((minD - d) / minD) * 7 * o.radius * dt;
        o.x -= (dx / d) * k; o.y -= (dy / d) * k;
        o.vx -= (dx / d) * k * 6; o.vy -= (dy / d) * k * 6;
      }
      if (o.body && d < o.radius + other.radius) o.body.pushOutOfCircle(other.x, other.y, other.radius * 0.88, 0.5);
    }
  }

  private engulf(eater: Organism, prey: Organism) {
    prey.state = 'engulfed';
    prey.captor = eater;
    prey.engulfT = 0;
    prey.clearPinch();
    const a = rng.angle(), rr = Math.sqrt(rng.next()) * 0.35;
    prey.localX = Math.cos(a) * rr; prey.localY = Math.sin(a) * rr;
    prey.massToGive = prey.mass * 0.7;
    prey.steerX = prey.steerY = 0;
    eater.eatenCount++;
    if (prey.kind === 'kin') this.stats.kin--;
    const byPlayer = eater === this.player;
    if (byPlayer) this.cellsEaten++;
    if (prey === this.player) this.events.onPlayerEngulfed(eater);
    else this.events.onEat(prey.kind, byPlayer, prey.radius / eater.radius);
  }

  private updateEngulfed(o: Organism, dt: number) {
    const c = o.captor;
    if (!c || c.state === 'dead') { o.state = 'dead'; this.killOrganism(o); return; }
    o.engulfT += dt;
    const t = o.engulfT / ENGULF_TIME;
    const cx = c.body ? c.body.ax : c.x, cy = c.body ? c.body.ay : c.y;
    const tx = cx + o.localX * c.radius, ty = cy + o.localY * c.radius;
    const k = damp(5, dt);
    o.vx = o.vy = 0;
    o.x += (tx - o.x) * k; o.y += (ty - o.y) * k;
    const shrink = clamp((t - 0.25) / 0.75, 0, 1);
    o.targetRadius = o.spawnRadius * (1 - shrink);
    o.radius += (o.targetRadius - o.radius) * damp(3, dt);
    o.alpha = 1 - shrink * shrink;
    if (o.body) o.body.keepInsideCircle(cx, cy, c.radius * 0.92, 0.6);
    if (o.massToGive > 0) {
      const give = Math.min(o.massToGive, (o.mass * 0.7) * (dt / ENGULF_TIME) * 1.1);
      o.massToGive -= give;
      c.addMass(give);
    }
    if (t >= 1 && o !== this.player) { c.eatenCount--; this.killOrganism(o); }
  }

  // ───────────────────────── mitosis ─────────────────────────
  private beginDivision(p: Organism) {
    p.state = 'dividing';
    p.divT = 0;
    // Divide across the direction of travel (perpendicular axis gives a sideways sister cell).
    p.divX = -p.faceY; p.divY = p.faceX;
  }

  private finishDivision(p: Organism) {
    const R = p.radius;
    const r2 = R / Math.SQRT2;
    const dx = p.divX * R * 0.7, dy = p.divY * R * 0.7;
    const daughter = this.spawnOrganism('kin', p.x + dx, p.y + dy, r2);
    daughter.vx = p.vx + p.divX * 20; daughter.vy = p.vy + p.divY * 20;
    daughter.nucleus.x = p.nucleus2.x; daughter.nucleus.y = p.nucleus2.y;
    daughter.wanderAng = Math.atan2(p.divY, p.divX);
    // The player keeps the other half.
    p.state = 'alive';
    p.clearPinch();
    p.x -= dx; p.y -= dy;
    p.vx -= p.divX * 20; p.vy -= p.divY * 20;
    p.mass = r2 * r2;
    p.radius = p.targetRadius = p.spawnRadius = r2;
    p.body!.reset(p.x, p.y, r2, p.cfg.points);
    p.body!.wobble = p.cfg.wobble;
    p.nucleus2.x = p.nucleus.x; p.nucleus2.y = p.nucleus.y;
    this.generation++;
    this.divideRadius = r2 * 1.55;
    this.events.onDivide(p, daughter);
  }

  // ───────────────────────── AI ─────────────────────────
  private think(o: Organism, dt: number) {
    o.aiTimer -= dt;
    const sense = o.radius * o.cfg.sense;
    if (o.aiTimer <= 0) {
      o.aiTimer = 0.35 + Math.random() * 0.3;
      o.mode = 'wander';
      o.target = null; o.foodTarget = null;
      // Threats and prey.
      let bestPrey: Organism | null = null, bestPreyD = Infinity;
      let threat: Organism | null = null, threatD = Infinity;
      const list = this.solidHash.query(o.x, o.y, sense, this.qSolid);
      for (const s of list) {
        if (s === o || (s as Organism).cfg === undefined) continue;
        const other = s as Organism;
        if (other.state !== 'alive' && other.state !== 'dividing') continue;
        const d = Math.hypot(other.x - o.x, other.y - o.y);
        if (this.canEat(other, o) && d < sense && d < threatD) { threat = other; threatD = d; }
        else if (this.canEat(o, other) && d < bestPreyD && d < sense) { bestPrey = other; bestPreyD = d; }
      }
      if (threat) { o.mode = 'flee'; o.target = threat; }
      else if (bestPrey && o.cfg.eatsCells) { o.mode = 'chase'; o.target = bestPrey; }
      else if (o.cfg.eatsFood) {
        let best: Food | null = null, bd = Infinity;
        const fl = this.foodHash.query(o.x, o.y, sense, this.qFood);
        for (const f of fl) {
          if (f.state !== 'free') continue;
          if (o.kind === 'paramecium' && f.kind !== 'bacteria') continue;
          const d = (f.x - o.x) ** 2 + (f.y - o.y) ** 2;
          if (d < bd) { bd = d; best = f; }
        }
        if (best) { o.mode = 'seek'; o.foodTarget = best; }
      }
      if (o.mode === 'wander') o.wanderTurn = (Math.random() - 0.5) * 2.2;
    }
    let sx = 0, sy = 0;
    switch (o.mode) {
      case 'flee': {
        const t = o.target!;
        const dx = o.x - t.x, dy = o.y - t.y, d = Math.hypot(dx, dy) || 1;
        sx = dx / d; sy = dy / d;
        o.speedMul = o.kind === 'paramecium' ? 1.35 : 1.15;
        break;
      }
      case 'chase': {
        const t = o.target!;
        const dx = t.x - o.x, dy = t.y - o.y, d = Math.hypot(dx, dy) || 1;
        // Lead the target a little.
        const lead = clamp(d / (o.maxSpeed + 1), 0, 0.6);
        const px = t.x + t.vx * lead - o.x, py = t.y + t.vy * lead - o.y, pd = Math.hypot(px, py) || 1;
        sx = px / pd; sy = py / pd;
        o.speedMul = o.kind === 'predator' ? 1.12 : 1.05;
        if (t.state !== 'alive' && t.state !== 'dividing') o.aiTimer = 0;
        break;
      }
      case 'seek': {
        const f = o.foodTarget!;
        if (f.state !== 'free') { o.aiTimer = 0; break; }
        const dx = f.x - o.x, dy = f.y - o.y, d = Math.hypot(dx, dy) || 1;
        sx = (dx / d) * 0.8; sy = (dy / d) * 0.8;
        o.speedMul = 1;
        break;
      }
      default: {
        o.wanderAng += o.wanderTurn * dt;
        const amp = o.kind === 'paramecium' ? 0.75 : o.kind === 'amoeba' ? 0.5 : 0.6;
        sx = Math.cos(o.wanderAng) * amp; sy = Math.sin(o.wanderAng) * amp;
        o.speedMul = 1;
        // Kin loosely stay near the player.
        if (o.kind === 'kin' && this.player) {
          const dx = this.player.x - o.x, dy = this.player.y - o.y, d = Math.hypot(dx, dy);
          if (d > this.viewRadius * 0.9) { sx = (dx / d) * 0.7; sy = (dy / d) * 0.7; }
        }
      }
    }
    // Smooth the steering so turns look biological.
    const k = damp(o.kind === 'paramecium' ? 6 : 3, dt);
    o.steerX += (sx - o.steerX) * k;
    o.steerY += (sy - o.steerY) * k;
  }
}

export { TAU };
