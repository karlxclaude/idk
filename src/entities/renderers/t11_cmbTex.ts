/**
 * Shared CMB-mottled sphere texture (helper module: no default export, so not registered).
 * A Planck-style temperature map (deep blue -> cyan -> cream -> orange -> red) wrapped on a
 * lit sphere with limb darkening, baked once per (seed, warm) pair.
 */
import { bakeTexture } from '../../core/textures';

function hash(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, seed: number): number {
  const ix = Math.floor(x), iy = Math.floor(y);
  const fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, seed), b = hash(ix + 1, iy, seed), c = hash(ix, iy + 1, seed), d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
export function fbm(x: number, y: number, seed: number, oct = 5): number {
  let v = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) {
    v += a * vnoise(x * f, y * f, seed + i * 17);
    f *= 2.07;
    a *= 0.5;
  }
  return v;
}

const RAMP: [number, number, number, number][] = [
  [0, 14, 24, 100],
  [0.26, 44, 108, 214],
  [0.44, 120, 160, 200],
  [0.56, 236, 222, 190],
  [0.74, 255, 150, 60],
  [1, 190, 40, 28],
];
export function cmbColor(t: number, out: number[]) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 1; i < RAMP.length; i++) {
    if (t <= RAMP[i][0]) {
      const a = RAMP[i - 1], b = RAMP[i];
      const k = (t - a[0]) / (b[0] - a[0]);
      out[0] = a[1] + (b[1] - a[1]) * k;
      out[1] = a[2] + (b[2] - a[2]) * k;
      out[2] = a[3] + (b[3] - a[3]) * k;
      return;
    }
  }
}

/** Mottled lit sphere (not tintable meaningfully; colours are baked). warm in 0..1 biases to orange. */
export function cmbSphereTex(seed: number, warm: number, size = 192) {
  return bakeTexture(`t11:cmb:${seed}:${warm}`, size, (c, s) => {
    const img = c.createImageData(s, s);
    const col = [0, 0, 0];
    const m = s / 2;
    for (let py = 0; py < s; py++) {
      for (let px = 0; px < s; px++) {
        const nx = (px + 0.5 - m) / m, ny = (py + 0.5 - m) / m;
        const r2 = nx * nx + ny * ny;
        const i = (py * s + px) * 4;
        if (r2 >= 1) continue;
        const z = Math.sqrt(1 - r2);
        // wrap the map on the sphere
        const u = Math.asin(nx) * 1.6, v = Math.asin(ny) * 1.6;
        let t = fbm(u * 2.6 + seed * 9.1, v * 2.6 + seed * 3.7, seed, 5);
        t = (t - 0.5) * 2.4 + 0.5 + (warm - 0.5) * 0.7;
        t += (vnoise(u * 22, v * 22, seed + 5) - 0.5) * 0.1;
        cmbColor(t, col);
        const lit = 0.38 + 0.62 * Math.pow(z, 0.55);
        const edge = Math.min(1, (1 - Math.sqrt(r2)) * m * 0.7);
        img.data[i] = Math.min(255, col[0] * lit);
        img.data[i + 1] = Math.min(255, col[1] * lit);
        img.data[i + 2] = Math.min(255, col[2] * lit);
        img.data[i + 3] = 255 * edge;
      }
    }
    c.putImageData(img, 0, 0);
  });
}
