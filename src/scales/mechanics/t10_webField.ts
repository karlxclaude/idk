/**
 * Shared deterministic cosmic-web geometry for tier 10 (helper module: no default export, so no
 * registry picks it up). The web is a jittered lattice of hub nodes joined by curved filaments,
 * defined in ABSOLUTE coordinates (world position + camera.originX/Y) so it never drifts when
 * the floating origin rebases. Each filament flows from the lighter hub to the heavier hub.
 */
export interface WebLevel {
  cell: number;
  thick: number;
  seed: number;
  /** Chance an axis edge is missing (makes voids). */
  drop: number;
  /** Chance of a diagonal edge. */
  diag: number;
  alpha: number;
  boost: number;
  curved: boolean;
}

export function h2(ix: number, iy: number, seed: number): number {
  let n = Math.imul(ix | 0, 374761393) ^ Math.imul(iy | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}

export interface Hub { x: number; y: number; w: number }
export function hub(L: WebLevel, ix: number, iy: number, out: Hub): Hub {
  out.x = (ix + 0.5 + (h2(ix, iy, L.seed) - 0.5) * 0.7) * L.cell;
  out.y = (iy + 0.5 + (h2(ix, iy, L.seed + 1) - 0.5) * 0.7) * L.cell;
  out.w = h2(ix, iy, L.seed + 99);
  return out;
}

const NB: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [1, 1, 1], [1, -1, 1]];
const ha: Hub = { x: 0, y: 0, w: 0 };
const hb: Hub = { x: 0, y: 0, w: 0 };

/** Callback gets the filament polyline a -> m -> b, oriented along the flow, plus the hub weight of its target. */
export type EdgeCb = (ax: number, ay: number, mx: number, my: number, bx: number, by: number, w: number) => void;

export function cellEdges(L: WebLevel, ix: number, iy: number, cb: EdgeCb) {
  for (let k = 0; k < NB.length; k++) {
    const [dx, dy, diag] = NB[k];
    const r = h2(ix, iy, L.seed + 10 + k);
    if (diag ? r > L.diag : r < L.drop) continue;
    hub(L, ix, iy, ha);
    hub(L, ix + dx, iy + dy, hb);
    let ax = ha.x, ay = ha.y, bx = hb.x, by = hb.y, w = hb.w;
    if (ha.w > hb.w) { ax = hb.x; ay = hb.y; bx = ha.x; by = ha.y; w = ha.w; }
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const bend = L.curved ? (h2(ix, iy, L.seed + 30 + k) - 0.5) * 0.3 * len : 0;
    const mx = (ax + bx) / 2 - ((by - ay) / len) * bend;
    const my = (ay + by) / 2 + ((bx - ax) / len) * bend;
    cb(ax, ay, mx, my, bx, by, w);
  }
}

export interface Near { px: number; py: number; tx: number; ty: number; d: number; w: number }
const best: Near = { px: 0, py: 0, tx: 1, ty: 0, d: Infinity, w: 0 };

function seg(x: number, y: number, ax: number, ay: number, bx: number, by: number, w: number) {
  const vx = bx - ax, vy = by - ay;
  const l2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * vx + (y - ay) * vy) / l2));
  const px = ax + vx * t, py = ay + vy * t;
  const d = Math.hypot(x - px, y - py);
  if (d < best.d) {
    const l = Math.sqrt(l2);
    best.d = d; best.px = px; best.py = py; best.tx = vx / l; best.ty = vy / l; best.w = w;
  }
}

/** Nearest filament to an ABSOLUTE point. Returns a shared object (copy what you need). */
export function nearest(L: WebLevel, x: number, y: number): Near {
  best.d = Infinity;
  const cx = Math.floor(x / L.cell), cy = Math.floor(y / L.cell);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    cellEdges(L, cx + i, cy + j, (ax, ay, mx, my, bx, by, w) => {
      seg(x, y, ax, ay, mx, my, w);
      seg(x, y, mx, my, bx, by, w);
    });
  }
  return best;
}
