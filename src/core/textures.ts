/** Procedural textures baked once on a 2D canvas and shared by sprites. */
import { Texture } from 'pixi.js';

const cache = new Map<string, Texture>();
export type DrawFn = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function bakeTexture(key: string, w: number, draw: DrawFn, h = w): Texture {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, w, h);
  const tex = Texture.from(canvas);
  tex.source.scaleMode = 'linear';
  cache.set(key, tex);
  return tex;
}

export function radialStops(ctx: CanvasRenderingContext2D, w: number, h: number, stops: Array<[number, string]>, rScale = 0.5) {
  const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * rScale);
  for (const [o, c] of stops) g.addColorStop(o, c);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}
