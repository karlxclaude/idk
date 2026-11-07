/** Shared helpers for player appearances (helper module: no default export, not registered). */
import { Container, Sprite, type Texture } from 'pixi.js';
import { bakeTexture, Tex } from '../../core/textures';
import type { GameContext } from '../../core/context';
import type { Player } from '../Player';
import { sprite } from '../renderers/core';

export { sprite };
export const TAU = Math.PI * 2;

export function lerpColor(a: number, b: number, t: number): number {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return ((ar + (br - ar) * t) << 16) | ((ag + (bg - ag) * t) << 8) | (ab + (bb - ab) * t) | 0;
}

/** Deterministic RNG for baked textures. */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Bake a texture drawn in VIEW UNITS: the canvas covers [-span/2, span/2] on both axes,
 * so draw with body radius 1 coordinates and size the sprite with `span`.
 */
export function bakeUnits(key: string, px: number, span: number, draw: (c: CanvasRenderingContext2D) => void): Texture {
  return bakeTexture(key, px, (c, s) => {
    c.setTransform(s / span, 0, 0, s / span, s / 2, s / 2);
    draw(c);
    c.setTransform(1, 0, 0, 1, 0, 0);
  });
}

/** Bright edge, transparent centre (rim light / atmosphere). Radius = texture half-size. */
export const rimTex = () =>
  bakeTexture('app:rim', 256, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.62, 'rgba(255,255,255,0)');
    g.addColorStop(0.86, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.95, 'rgba(255,255,255,0.9)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

/** Soft round disc with feathered edge (inner body fill). */
export const softDisc = () =>
  bakeTexture('app:softdisc', 256, (c, s) => {
    const g = c.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.85, 'rgba(255,255,255,0.92)');
    g.addColorStop(0.97, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

/** Black shading for a lit sphere (light from upper-left). Use with normal blend, counter-rotate. */
export const shadeTex = () =>
  bakeTexture('app:shade', 256, (c, s) => {
    c.save();
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 1, 0, TAU);
    c.clip();
    const g = c.createRadialGradient(s * 0.36, s * 0.34, s * 0.05, s * 0.42, s * 0.42, s * 0.78);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.5, 'rgba(0,0,10,0.12)');
    g.addColorStop(1, 'rgba(0,0,12,0.8)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
    c.restore();
  });

/** Disc of soft blotches (cytoplasm / plasma / clouds). */
export function blotchTex(key: string, seed: number, count: number, minR: number, maxR: number, alpha = 0.5) {
  return bakeTexture(key, 256, (c, s) => {
    const r = rng(seed);
    c.save();
    c.beginPath();
    c.arc(s / 2, s / 2, s / 2 - 1, 0, TAU);
    c.clip();
    for (let i = 0; i < count; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * s * 0.5;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d, rad = (minR + r() * (maxR - minR)) * s;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,255,255,${alpha * (0.4 + r() * 0.6)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    c.restore();
  });
}

/**
 * Shared reactive state + generic overlays (eat ripple, invulnerability shield, hurt tint).
 * Call step() every frame; attach() adds the overlay sprites on top of `view`.
 */
export class Reactor {
  t = Math.random() * 20;
  flash = 0; // bright flash after eating (0..1)
  eat = 0; // 1 right after eating, decays
  speed = 0; // 0..~2 relative to max speed
  dash = 0;
  private ripple!: Sprite;
  private shield!: Sprite;
  private tints: [Sprite, number][] = [];
  private rippleBase = 2;

  attach(view: Container, glow: number, size = 2) {
    this.rippleBase = size;
    this.ripple = sprite(Tex.ring(), size, { add: true, alpha: 0, tint: glow });
    this.shield = sprite(rimTex(), size * 1.25, { add: true, alpha: 0, tint: 0xffffff });
    view.addChild(this.ripple, this.shield);
  }

  /** Register a sprite whose tint is `base`; it turns red while hurt. */
  tinted(s: Sprite, base: number): Sprite {
    s.tint = base;
    this.tints.push([s, base]);
    return s;
  }

  step(p: Player, ctx: GameContext, dt: number) {
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 3.5);
    this.eat = Math.max(0, this.eat - dt * 2.4);
    this.speed = Math.hypot(p.vx, p.vy) / Math.max(1, p.maxSpeed(ctx));
    this.dash = p.dashTime > 0 ? 1 : 0;
    const h = Math.min(1, p.hurtFlash * 1.5);
    for (const [s, base] of this.tints) s.tint = h > 0.02 ? lerpColor(base, 0xff3040, h) : base;
    const k = 1 - this.eat;
    this.ripple.width = this.ripple.height = this.rippleBase * (1.05 + k * 0.9);
    this.ripple.alpha = this.eat * 0.8;
    this.shield.alpha = p.invuln > 0 ? 0.55 + Math.sin(this.t * 14) * 0.25 : 0;
  }

  onEat(r: number) {
    this.flash = Math.min(1, this.flash + 0.3 + r);
    this.eat = 1;
  }
}
