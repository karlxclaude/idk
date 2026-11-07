/** Pooled world-space sprite particles (bursts, rings, streaks, implosions). All additive by default. */
import { Container, Sprite, type Texture } from 'pixi.js';
import { Pool } from '../core/pool';
import { Tex } from '../core/textures';

type Kind = 0 | 1 | 2; // 0 free-flying, 1 ring shockwave, 2 homing (pulled to a target)

interface P {
  s: Sprite;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; drag: number; grow: number;
  kind: Kind;
  /** Homing: target getter index (0 = none). */
  pull: number;
  stretch: number;
  fade: number;
}

export interface BurstOptions {
  count?: number;
  color?: number | number[];
  /** Initial speed in local units/s. */
  speed?: number;
  /** Particle diameter in local units. */
  size?: number;
  life?: number;
  /** 0..1 fraction of a full circle (1 = omni). */
  spread?: number;
  /** Centre angle when spread < 1. */
  angle?: number;
  drag?: number;
  /** Size multiplier over life (end size = size * grow). */
  grow?: number;
  texture?: Texture;
  additive?: boolean;
  /** Skip the automatic glow puffs and ring shockwave (raw sparks only). */
  plain?: boolean;
  /** Skip only the ring shockwave. */
  noRing?: boolean;
}

export type TargetFn = () => [number, number];

const pick = (c: number | number[]) => (Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c);

export class Particles {
  readonly container = new Container();
  private live: P[] = [];
  private pool: Pool<P>;
  /** Hard cap (quality setting lowers it). */
  max = 500;
  /** 0.4..1 multiplier on counts (quality). */
  density = 1;
  /** Where homing particles fly to (the player, local coords). */
  target: TargetFn | null = null;

  constructor() {
    this.pool = new Pool<P>(() => {
      const s = new Sprite(Tex.spark());
      s.anchor.set(0.5);
      return { s, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, drag: 2, grow: 0.2, kind: 0, pull: 0, stretch: 0, fade: 2 };
    });
  }

  private spawn(tex: Texture, tint: number, add: boolean): P | null {
    if (this.live.length >= this.max) return null;
    const p = this.pool.acquire();
    p.s.texture = tex;
    p.s.tint = tint;
    p.s.blendMode = add ? 'add' : 'normal';
    p.s.visible = true;
    p.s.rotation = 0;
    p.kind = 0; p.pull = 0; p.stretch = 0; p.fade = 2;
    this.container.addChild(p.s);
    this.live.push(p);
    return p;
  }

  burst(x: number, y: number, o: BurstOptions = {}) {
    const base0 = o.count ?? 12;
    const count = Math.max(1, Math.round(base0 * this.density));
    const spread = o.spread ?? 1;
    const base = o.angle ?? 0;
    const col = o.color ?? 0xffffff;
    const speed = o.speed ?? 100;
    const size = o.size ?? 6;
    const life = o.life ?? 0.6;
    const add = o.additive !== false;
    const tex = o.texture ?? Tex.spark();
    for (let i = 0; i < count; i++) {
      const p = this.spawn(tex, pick(col), add);
      if (!p) break;
      const a = spread >= 1 ? Math.random() * Math.PI * 2 : base + (Math.random() - 0.5) * spread * Math.PI * 2;
      const sp = speed * (0.35 + Math.random() * 0.75);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = p.life = life * (0.6 + Math.random() * 0.6);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.drag = o.drag ?? 3;
      p.grow = o.grow ?? 0.2;
      p.stretch = o.texture ? 0 : 0.5;
      p.s.rotation = a;
    }
    if (o.plain || base0 < 5) return;
    // Soft glow puffs: fewer, bigger, slower and longer lived than the sparks.
    const puffs = Math.max(1, Math.round(base0 * 0.22 * this.density));
    for (let i = 0; i < puffs; i++) {
      const p = this.spawn(Tex.glow(), pick(col), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const sp = speed * 0.25 * Math.random();
      p.x = x + Math.cos(a) * size * 0.5; p.y = y + Math.sin(a) * size * 0.5;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.maxLife = p.life = life * (0.9 + Math.random() * 0.5);
      p.size = size * (2.6 + Math.random() * 1.8);
      p.drag = 3; p.grow = 1.6; p.fade = 1.6;
    }
    if (!o.noRing) {
      // Short ring shockwave sized by how far the sparks travel.
      const reach = (speed * life * 0.22) || size * 4;
      const r = this.spawn(Tex.ring(), pick(col), true);
      if (r) {
        r.x = x; r.y = y; r.vx = r.vy = 0;
        r.kind = 1;
        r.maxLife = r.life = Math.min(0.55, 0.22 + life * 0.35);
        r.size = Math.max(size * 1.2, reach * 0.25);
        r.grow = Math.max(3, (reach * 2) / r.size);
        r.fade = 1.5;
      }
    }
  }

  /** Sparks that fly into the player (absorb streaks). */
  absorb(x: number, y: number, count: number, color: number | number[], size: number, speed: number) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const p = this.spawn(Tex.spark(), pick(color), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      p.x = x + Math.cos(a) * size; p.y = y + Math.sin(a) * size;
      p.vx = Math.cos(a) * speed * 0.3; p.vy = Math.sin(a) * speed * 0.3;
      p.maxLife = p.life = 0.28 + Math.random() * 0.22;
      p.size = size * (0.5 + Math.random() * 0.6);
      p.drag = 0; p.grow = 0.3;
      p.kind = 2; p.pull = speed * 6; p.stretch = 1.4;
    }
  }

  /** Particles spawned on a ring that collapse into (x, y). */
  implode(x: number, y: number, count: number, radius: number, color: number | number[], size: number, life = 0.7) {
    const n = Math.round(count * this.density);
    for (let i = 0; i < n; i++) {
      const p = this.spawn(Tex.spark(), pick(color), true);
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const d = radius * (0.7 + Math.random() * 0.6);
      p.x = x + Math.cos(a) * d; p.y = y + Math.sin(a) * d;
      p.vx = -Math.cos(a) * d / life * 0.9; p.vy = -Math.sin(a) * d / life * 0.9;
      p.maxLife = p.life = life * (0.7 + Math.random() * 0.4);
      p.size = size * (0.6 + Math.random() * 0.8);
      p.drag = -0.8; p.grow = 0.2; p.stretch = 1.0;
      p.s.rotation = a;
    }
    const g = this.spawn(Tex.glow(), pick(color), true);
    if (g) {
      g.x = x; g.y = y; g.vx = g.vy = 0;
      g.maxLife = g.life = life;
      g.size = radius * 2.4; g.grow = 0.05; g.drag = 0; g.fade = 1;
    }
  }

  /** Expanding ring + glow, used for respawn bloom. */
  bloom(x: number, y: number, radius: number, color: number) {
    for (let k = 0; k < 2; k++) {
      const r = this.spawn(Tex.ring(), color, true);
      if (!r) break;
      r.x = x; r.y = y; r.vx = r.vy = 0; r.kind = 1;
      r.maxLife = r.life = 0.7 + k * 0.25;
      r.size = radius * 0.6; r.grow = 4 + k * 2.5; r.fade = 1.4;
    }
    const g = this.spawn(Tex.glow(), color, true);
    if (g) {
      g.x = x; g.y = y; g.vx = g.vy = 0;
      g.maxLife = g.life = 0.9; g.size = radius * 1.5; g.grow = 3.2; g.drag = 0; g.fade = 1.5;
    }
  }

  update(dt: number) {
    let w = 0;
    const tgt = this.target ? this.target() : null;
    for (let i = 0; i < this.live.length; i++) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.container.removeChild(p.s);
        this.pool.release(p);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      if (p.kind === 2 && tgt) {
        const dx = tgt[0] - p.x, dy = tgt[1] - p.y;
        const d = Math.hypot(dx, dy) || 1;
        p.vx += (dx / d) * p.pull * dt * (0.5 + t * 2);
        p.vy += (dy / d) * p.pull * dt * (0.5 + t * 2);
        p.vx *= 0.94; p.vy *= 0.94;
        if (d < 4 + p.size) { p.life = 0; }
      } else if (p.drag !== 0) {
        const k = Math.exp(-p.drag * dt);
        p.vx *= k; p.vy *= k;
      }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.s.position.set(p.x, p.y);
      let sz: number;
      if (p.kind === 1) {
        const e = 1 - (1 - t) * (1 - t) * (1 - t); // ease-out expansion
        sz = p.size * (1 + (p.grow - 1) * e);
        p.s.width = p.s.height = sz;
        p.s.alpha = Math.pow(1 - t, p.fade);
        this.live[w++] = p;
        continue;
      }
      const sp = p.stretch > 0 ? Math.hypot(p.vx, p.vy) : 0;
      sz = p.size * (1 + (p.grow - 1) * t);
      if (p.stretch > 0 && sp > 1) {
        p.s.rotation = Math.atan2(p.vy, p.vx);
        p.s.width = sz * (1 + Math.min(2.5, (sp * 0.02 * p.stretch) / Math.max(1, sz * 0.05)));
        p.s.height = sz;
      } else {
        p.s.width = p.s.height = sz;
      }
      p.s.alpha = p.kind === 2 ? Math.min(1, t * 6, (1 - t) * 2 + 0.3) : Math.pow(1 - t, p.fade);
      this.live[w++] = p;
    }
    this.live.length = w;
  }

  rebase(dx: number, dy: number) {
    for (const p of this.live) { p.x -= dx; p.y -= dy; }
  }

  clear() {
    for (const p of this.live) {
      this.container.removeChild(p.s);
      this.pool.release(p);
    }
    this.live.length = 0;
  }
}
