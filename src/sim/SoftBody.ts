/**
 * Soft-body membrane: a ring of N points anchored to a lagging centre by radial springs, tied to
 * their neighbours by edge springs, and inflated by a pressure term that restores the target area.
 * Contacts are resolved positionally (points are pushed out of circles) so the body squishes against
 * obstacles and other cells. Extra per-point forces (`bulge`) let the membrane reach toward food.
 * All state lives in typed arrays and nothing is allocated after construction.
 */
import { TAU } from '../core/math';

export const MAX_POINTS = 32;

export class SoftBody {
  n = 24;
  readonly px = new Float32Array(MAX_POINTS);
  readonly py = new Float32Array(MAX_POINTS);
  readonly vx = new Float32Array(MAX_POINTS);
  readonly vy = new Float32Array(MAX_POINTS);
  /** Per-point extra force accumulated by callers this step (cleared each step). */
  readonly fx = new Float32Array(MAX_POINTS);
  readonly fy = new Float32Array(MAX_POINTS);
  /** Per-point rest radius multiplier (mitosis pinch / elongation). */
  readonly restMul = new Float32Array(MAX_POINTS);
  /** Lagging anchor the ring is attached to. */
  ax = 0; ay = 0;
  radius = 20;
  phase = Math.random() * TAU;
  /** Spring tuning (per second units). */
  kRest = 42; kEdge = 110; kPressure = 22; damping = 5.5; anchorRate = 11;
  wobble = 1;

  reset(x: number, y: number, radius: number, n = 24) {
    this.n = Math.min(MAX_POINTS, Math.max(8, n | 0));
    this.radius = radius;
    this.ax = x; this.ay = y;
    for (let i = 0; i < this.n; i++) {
      const a = (i / this.n) * TAU;
      this.px[i] = x + Math.cos(a) * radius;
      this.py[i] = y + Math.sin(a) * radius;
      this.vx[i] = this.vy[i] = 0;
      this.fx[i] = this.fy[i] = 0;
      this.restMul[i] = 1;
    }
  }

  /** Teleport the whole body by a delta without disturbing its shape. */
  translate(dx: number, dy: number) {
    this.ax += dx; this.ay += dy;
    for (let i = 0; i < this.n; i++) { this.px[i] += dx; this.py[i] += dy; }
  }

  /** Signed polygon area (shoelace); positive for counter-clockwise rings. */
  area(): number {
    let a = 0;
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      a += this.px[i] * this.py[j] - this.px[j] * this.py[i];
    }
    return a * 0.5;
  }

  /** Add a force on points within `arc` radians of direction (dx,dy), falling off with angle. */
  bulge(dirX: number, dirY: number, strength: number, arc = 0.9) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const ox = this.px[i] - this.ax, oy = this.py[i] - this.ay;
      const l = Math.hypot(ox, oy) || 1;
      const cosA = (ox * dirX + oy * dirY) / l;
      const ang = Math.acos(cosA > 1 ? 1 : cosA < -1 ? -1 : cosA);
      if (ang > arc) continue;
      const w = 1 - ang / arc;
      this.fx[i] += dirX * strength * w * w;
      this.fy[i] += dirY * strength * w * w;
    }
  }

  /** Push every point out of a circle (positional). Returns true if any point touched it. */
  pushOutOfCircle(cx: number, cy: number, r: number, softness = 0.85): boolean {
    let hit = false;
    const r2 = r * r;
    for (let i = 0; i < this.n; i++) {
      const dx = this.px[i] - cx, dy = this.py[i] - cy;
      const d2 = dx * dx + dy * dy;
      if (d2 >= r2) continue;
      const d = Math.sqrt(d2) || 0.001;
      const push = (r - d) * softness;
      const nx = dx / d, ny = dy / d;
      this.px[i] += nx * push; this.py[i] += ny * push;
      // Remove inward velocity.
      const vn = this.vx[i] * nx + this.vy[i] * ny;
      if (vn < 0) { this.vx[i] -= nx * vn; this.vy[i] -= ny * vn; }
      hit = true;
    }
    return hit;
  }

  /** Keep every point inside a circle (used while being engulfed). */
  keepInsideCircle(cx: number, cy: number, r: number, softness = 0.5) {
    for (let i = 0; i < this.n; i++) {
      const dx = this.px[i] - cx, dy = this.py[i] - cy;
      const d = Math.hypot(dx, dy);
      if (d <= r) continue;
      const k = ((d - r) / d) * softness;
      this.px[i] -= dx * k; this.py[i] -= dy * k;
    }
  }

  /** One fixed step. (cx,cy) is the owner's true centre; the anchor eases toward it. */
  step(cx: number, cy: number, dt: number, time: number) {
    const n = this.n;
    const R = this.radius;
    // Anchor lags behind the real centre: the jelly catches up a beat late.
    const ka = 1 - Math.exp(-this.anchorRate * dt);
    this.ax += (cx - this.ax) * ka;
    this.ay += (cy - this.ay) * ka;

    const area = this.area();
    const targetArea = Math.PI * R * R;
    const pressure = this.kPressure * ((targetArea - area) / targetArea) * R;
    const edgeRest = (TAU * R) / n;
    const dampF = Math.exp(-this.damping * dt);
    const w = this.wobble;
    const t1 = time * 1.3 + this.phase, t2 = time * 0.9 - this.phase;

    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      // Organic breathing ripple on the rest radius.
      const ripple = 1 + w * (0.028 * Math.sin(2 * a + t1) + 0.018 * Math.sin(3 * a - t2) + 0.012 * Math.sin(5 * a + t1 * 0.7));
      const rr = R * ripple * this.restMul[i];
      const restX = this.ax + Math.cos(a) * rr, restY = this.ay + Math.sin(a) * rr;
      let fx = (restX - this.px[i]) * this.kRest + this.fx[i];
      let fy = (restY - this.py[i]) * this.kRest + this.fy[i];
      // Edge springs.
      const ip = (i + n - 1) % n, inx = (i + 1) % n;
      for (let k = 0; k < 2; k++) {
        const j = k === 0 ? ip : inx;
        const dx = this.px[j] - this.px[i], dy = this.py[j] - this.py[i];
        const d = Math.hypot(dx, dy) || 0.001;
        const s = (d - edgeRest) * this.kEdge;
        fx += (dx / d) * s; fy += (dy / d) * s;
      }
      // Pressure along the outward normal of the chord between neighbours.
      const tx = this.px[inx] - this.px[ip], ty = this.py[inx] - this.py[ip];
      const tl = Math.hypot(tx, ty) || 0.001;
      fx += (ty / tl) * pressure; fy += (-tx / tl) * pressure;

      this.vx[i] = (this.vx[i] + fx * dt) * dampF;
      this.vy[i] = (this.vy[i] + fy * dt) * dampF;
      this.fx[i] = 0; this.fy[i] = 0;
    }
    for (let i = 0; i < n; i++) {
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
    }
  }
}
