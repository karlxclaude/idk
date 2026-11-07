/**
 * Procedural texture cache. Textures are baked ONCE on a 2D canvas and reused by Sprites
 * (tint them per entity - most built-ins are white so `sprite.tint` colours them).
 *
 *   const tex = bakeTexture('myRenderer:shell', 128, (ctx, s) => { ...draw... });
 *
 * Real sprite art can later replace a baked texture by registering the same key with
 * `registerTexture(key, Texture.from(url))` before first use.
 */
import { Texture } from 'pixi.js';

const cache = new Map<string, Texture>();

export type DrawFn = (ctx: CanvasRenderingContext2D, size: number) => void;

export function bakeTexture(key: string, size: number, draw: DrawFn): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, size);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'linear';
  cache.set(key, tex);
  return tex;
}

export function registerTexture(key: string, tex: Texture) {
  cache.set(key, tex);
}
export function getCachedTexture(key: string): Texture | undefined {
  return cache.get(key);
}

function radial(ctx: CanvasRenderingContext2D, s: number, stops: [number, string][]) {
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
}

/** Built-in white textures. Body radius = half the texture size unless noted. */
export const Tex = {
  /** Soft additive glow, falls off to 0 at the edge. Use with blendMode 'add'. */
  glow: () =>
    bakeTexture('core:glow', 128, (c, s) =>
      radial(c, s, [[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.16)'], [1, 'rgba(255,255,255,0)']]),
    ),
  /** Solid anti-aliased disc. */
  disc: () =>
    bakeTexture('core:disc', 128, (c, s) => {
      c.fillStyle = '#fff';
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 1.5, 0, Math.PI * 2);
      c.fill();
    }),
  /** Disc with a bright core and slightly darker rim (reads as a lit sphere when tinted). */
  orb: () =>
    bakeTexture('core:orb', 128, (c, s) => {
      c.save();
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - 1.5, 0, Math.PI * 2);
      c.clip();
      const g = c.createRadialGradient(s * 0.4, s * 0.38, 0, s / 2, s / 2, s / 2);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#d8d8d8');
      g.addColorStop(1, '#8a8a8a');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.restore();
    }),
  /** Thin ring. */
  ring: () =>
    bakeTexture('core:ring', 128, (c, s) => {
      c.strokeStyle = '#fff';
      c.lineWidth = s * 0.06;
      c.beginPath();
      c.arc(s / 2, s / 2, s / 2 - s * 0.05, 0, Math.PI * 2);
      c.stroke();
    }),
  /** 4-point sparkle for particles. */
  spark: () =>
    bakeTexture('core:spark', 64, (c, s) => {
      radial(c, s, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
      c.fillStyle = 'rgba(255,255,255,0.9)';
      c.beginPath();
      const h = s / 2, w = s * 0.05;
      c.moveTo(h, 0); c.lineTo(h + w, h); c.lineTo(h, s); c.lineTo(h - w, h); c.closePath();
      c.moveTo(0, h); c.lineTo(h, h - w); c.lineTo(s, h); c.lineTo(h, h + w); c.closePath();
      c.fill();
    }),
  /** Small soft dot for ambient particles. */
  dot: () =>
    bakeTexture('core:dot', 32, (c, s) =>
      radial(c, s, [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]),
    ),
  /** Screen vignette: transparent centre, black edges. */
  vignette: () =>
    bakeTexture('core:vignette', 256, (c, s) =>
      radial(c, s, [[0, 'rgba(0,0,0,0)'], [0.62, 'rgba(0,0,0,0)'], [0.8, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,1)']]),
    ),
  white: () => Texture.WHITE,
};
