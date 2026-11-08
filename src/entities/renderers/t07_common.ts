/** Shared helpers for the space-tier renderers (tiers 7-9). Helper module: no default export. */
import { Sprite, type Texture } from 'pixi.js';
import { bakeTexture } from '../../core/textures';
import { Rng } from '../../core/math';

/** Centred sprite sized w x h (view units); h defaults to w. */
export function box(tex: Texture, w: number, h = w, o: { add?: boolean; alpha?: number; tint?: number } = {}): Sprite {
  const s = new Sprite(tex);
  s.anchor.set(0.5);
  s.width = w;
  s.height = h;
  if (o.add) s.blendMode = 'add';
  if (o.alpha !== undefined) s.alpha = o.alpha;
  if (o.tint !== undefined) s.tint = o.tint;
  return s;
}

export type PlanetKind = 'rocky' | 'gas' | 'ice' | 'lava' | 'moon';

/** Grayscale planet surface (tinted by entity.color). */
export const planetBodyTex = (kind: PlanetKind, seed: number) =>
  bakeTexture(`sp:planet:body:${kind}:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 97 + 5);
    const m = s / 2;
    c.save();
    c.beginPath();
    c.arc(m, m, m - 1.5, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#d8d8d8';
    c.fillRect(0, 0, s, s);
    if (kind === 'gas') {
      let y = 0;
      while (y < s) {
        const h = r.range(6, 22);
        const v = Math.floor(r.range(150, 255));
        c.fillStyle = `rgba(${v},${v},${v},${r.range(0.5, 0.95)})`;
        c.fillRect(0, y, s, h);
        y += h * r.range(0.6, 1);
      }
      c.globalAlpha = 0.35;
      for (let i = 0; i < 40; i++) {
        c.strokeStyle = r.chance(0.5) ? '#fff' : '#777';
        c.lineWidth = r.range(1, 3);
        c.beginPath();
        const yy = r.range(0, s);
        c.moveTo(0, yy);
        for (let x = 0; x <= s; x += 16) c.lineTo(x, yy + Math.sin(x * 0.05 + i) * 4);
        c.stroke();
      }
    } else if (kind === 'moon') {
      for (let i = 0; i < 90; i++) {
        const x = r.range(0, s), y = r.range(0, s), rad = r.range(2, 20) * (r.chance(0.15) ? 1.6 : 1);
        c.fillStyle = `rgba(60,60,60,${r.range(0.15, 0.4)})`;
        c.beginPath(); c.arc(x, y, rad, 0, 6.3); c.fill();
        c.strokeStyle = `rgba(255,255,255,${r.range(0.2, 0.5)})`;
        c.lineWidth = 1.4;
        c.beginPath(); c.arc(x - rad * 0.12, y - rad * 0.12, rad, Math.PI * 0.9, Math.PI * 1.9); c.stroke();
      }
    } else if (kind === 'ice') {
      for (let i = 0; i < 26; i++) {
        c.strokeStyle = `rgba(90,110,140,${r.range(0.2, 0.5)})`;
        c.lineWidth = r.range(1, 3);
        c.beginPath();
        let x = r.range(0, s), y = r.range(0, s);
        c.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += r.range(-40, 40); y += r.range(-40, 40); c.lineTo(x, y); }
        c.stroke();
      }
    } else {
      for (let i = 0; i < 70; i++) {
        const x = r.range(0, s), y = r.range(0, s), rad = r.range(8, 40);
        const v = Math.floor(r.range(110, 255));
        c.fillStyle = kind === 'lava' ? `rgba(40,40,40,${r.range(0.3, 0.7)})` : `rgba(${v},${v},${v},0.5)`;
        c.beginPath(); c.ellipse(x, y, rad, rad * r.range(0.5, 1), r.range(0, 3), 0, 6.3); c.fill();
      }
    }
    c.restore();
  });

/** Transparent overlay (white) tinted by entity.color2: continents/clouds/storm/lava cracks. */
export const planetDetailTex = (kind: PlanetKind, seed: number) =>
  bakeTexture(`sp:planet:detail:${kind}:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 131 + 9);
    const m = s / 2;
    c.save();
    c.beginPath();
    c.arc(m, m, m - 1.5, 0, Math.PI * 2);
    c.clip();
    c.fillStyle = '#fff';
    if (kind === 'rocky') {
      for (let i = 0; i < 9; i++) {
        const cx = r.range(30, s - 30), cy = r.range(30, s - 30);
        c.globalAlpha = 0.85;
        c.beginPath();
        for (let k = 0; k < 26; k++) {
          const a = (k / 26) * 6.283;
          const rr = r.range(14, 34) + Math.sin(a * 3 + i) * 10;
          c.lineTo(cx + Math.cos(a) * rr * 1.2, cy + Math.sin(a) * rr * 0.8);
        }
        c.fill();
      }
      c.globalAlpha = 0.35; // wispy clouds
      for (let i = 0; i < 30; i++) { c.beginPath(); c.ellipse(r.range(0, s), r.range(0, s), r.range(14, 44), r.range(3, 7), r.range(-0.3, 0.3), 0, 6.3); c.fill(); }
    } else if (kind === 'gas') {
      c.globalAlpha = 0.5;
      for (let i = 0; i < 8; i++) c.fillRect(0, r.range(0, s), s, r.range(3, 14));
      c.globalAlpha = 0.9;
      c.beginPath(); c.ellipse(s * 0.62, s * 0.6, 26, 15, 0, 0, 6.3); c.fill(); // great storm
      c.globalCompositeOperation = 'destination-out';
      c.beginPath(); c.ellipse(s * 0.62, s * 0.6, 12, 6, 0, 0, 6.3); c.fill();
    } else if (kind === 'lava') {
      c.strokeStyle = '#fff';
      c.lineCap = 'round';
      for (let i = 0; i < 20; i++) {
        c.lineWidth = r.range(1.5, 5);
        c.globalAlpha = r.range(0.6, 1);
        c.beginPath();
        let x = r.range(0, s), y = r.range(0, s);
        c.moveTo(x, y);
        for (let k = 0; k < 7; k++) { x += r.range(-36, 36); y += r.range(-36, 36); c.lineTo(x, y); }
        c.stroke();
      }
    } else if (kind === 'ice') {
      c.globalAlpha = 0.5;
      c.beginPath(); c.ellipse(m, 20, 70, 30, 0, 0, 6.3); c.fill();
      c.beginPath(); c.ellipse(m, s - 20, 70, 30, 0, 0, 6.3); c.fill();
    }
    c.restore();
  });

/** Terminator shading (black, untinted) lit from the upper-left; counter-rotated by the renderer. */
export const planetShadeTex = () =>
  bakeTexture('sp:planet:shade', 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(s * 0.36, s * 0.32, s * 0.08, s * 0.42, s * 0.4, s * 0.72);
    g.addColorStop(0, 'rgba(0,0,12,0)');
    g.addColorStop(0.45, 'rgba(0,0,12,0.12)');
    g.addColorStop(0.8, 'rgba(0,0,12,0.78)');
    g.addColorStop(1, 'rgba(0,0,12,0.93)');
    c.fillStyle = g;
    c.beginPath(); c.arc(m, m, m - 1.5, 0, 6.3); c.fill();
  });

/** Thin atmospheric rim (additive, tint). */
export const rimTex = () =>
  bakeTexture('sp:rim', 256, (c, s) => {
    const m = s / 2;
    const g = c.createRadialGradient(m, m, m * 0.78, m, m, m);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.78, 'rgba(255,255,255,0.35)');
    g.addColorStop(0.93, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, s, s);
  });

/** Planetary ring ellipse (aspect 0.3). front=true draws only the lower half. */
export const ringTex = (front: boolean) =>
  bakeTexture(`sp:ring:${front}`, 512, (c, s) => {
    const m = s / 2;
    c.save();
    if (front) { c.beginPath(); c.rect(0, m, s, m); c.clip(); }
    const r = new Rng(321);
    const bands = [[0.58, 0.64, 0.5], [0.65, 0.78, 0.85], [0.8, 0.84, 0.35], [0.86, 0.97, 0.7]];
    for (const [a, b, al] of bands) {
      for (let k = 0; k < 14; k++) {
        const rr = a + ((b - a) * k) / 14;
        c.strokeStyle = `rgba(255,255,255,${al * r.range(0.55, 1)})`;
        c.lineWidth = Math.max(1.5, ((b - a) * m) / 12);
        c.beginPath();
        c.ellipse(m, m, rr * m, rr * m * 0.3, 0, 0, 6.2832);
        c.stroke();
      }
    }
    c.restore();
  });

/** Soft round "puff" used by nebula/cloud renderers. */
export const puffTex = (seed: number) =>
  bakeTexture(`sp:puff:${seed}`, 256, (c, s) => {
    const r = new Rng(seed * 17 + 3);
    for (let i = 0; i < 26; i++) {
      const x = s / 2 + r.range(-0.28, 0.28) * s, y = s / 2 + r.range(-0.28, 0.28) * s, rad = r.range(0.1, 0.3) * s;
      const g = c.createRadialGradient(x, y, 0, x, y, rad);
      g.addColorStop(0, `rgba(255,255,255,${r.range(0.1, 0.3)})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }
  });
