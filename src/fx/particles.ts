/** Pooled world-space sprite particles (bursts, trails). OWNED LATER BY THE FX AGENT (package e). */
import { Container, Sprite, type Texture } from 'pixi.js';
import { Pool } from '../core/pool';
import { Tex } from '../core/textures';

interface P {
  s: Sprite;
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; drag: number; grow: number;
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
}

export class Particles {
  readonly container = new Container();
  private live: P[] = [];
  private pool: Pool<P>;
  /** Hard cap (quality setting lowers it). */
  max = 500;

  constructor() {
    this.pool = new Pool<P>(() => {
      const s = new Sprite(Tex.spark());
      s.anchor.set(0.5);
      return { s, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, drag: 2, grow: 0.2 };
    });
  }

  burst(x: number, y: number, o: BurstOptions = {}) {
    const count = o.count ?? 12;
    const spread = o.spread ?? 1;
    const base = o.angle ?? 0;
    for (let i = 0; i < count; i++) {
      if (this.live.length >= this.max) return;
      const p = this.pool.acquire();
      const a = spread >= 1 ? Math.random() * Math.PI * 2 : base + (Math.random() - 0.5) * spread * Math.PI * 2;
      const sp = (o.speed ?? 100) * (0.35 + Math.random() * 0.75);
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.maxLife = p.life = (o.life ?? 0.6) * (0.6 + Math.random() * 0.6);
      p.size = (o.size ?? 6) * (0.6 + Math.random() * 0.8);
      p.drag = o.drag ?? 3;
      p.grow = o.grow ?? 0.2;
      const c = o.color ?? 0xffffff;
      p.s.tint = Array.isArray(c) ? c[(Math.random() * c.length) | 0] : c;
      p.s.texture = o.texture ?? Tex.spark();
      p.s.blendMode = o.additive === false ? 'normal' : 'add';
      p.s.visible = true;
      this.container.addChild(p.s);
      this.live.push(p);
    }
  }

  update(dt: number) {
    let w = 0;
    for (let i = 0; i < this.live.length; i++) {
      const p = this.live[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.container.removeChild(p.s);
        this.pool.release(p);
        continue;
      }
      const k = Math.exp(-p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      const t = 1 - p.life / p.maxLife;
      p.s.position.set(p.x, p.y);
      const sz = p.size * (1 + (p.grow - 1) * t);
      p.s.width = p.s.height = sz;
      p.s.alpha = 1 - t * t;
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
