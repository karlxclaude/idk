/** Draws every organism with one pooled Graphics: membrane spline, cytoplasm, organelles, flagella/cilia. */
import { Container, Graphics } from 'pixi.js';
import type { Camera } from '../core/camera';
import { TAU, lerpColor } from '../core/math';
import { MAX_RIBO, MAX_VAC, type Organism } from '../sim/Organism';
import type { World } from '../sim/World';

const MITO_COLOR = 0xffa66b;
const MITO_DARK = 0x9a4a2a;

export class OrganismView {
  readonly container = new Container();
  private views = new Map<number, Graphics>();
  private free: Graphics[] = [];
  private seen = new Set<number>();

  update(world: World, cam: Camera, time: number) {
    const zoom = cam.rzoom;
    const cullR = cam.viewRadius * 1.25;
    this.seen.clear();
    for (const o of world.organisms) {
      if (o.state === 'dead') continue;
      const d = Math.hypot(o.x - cam.rx, o.y - cam.ry);
      if (d > cullR + o.radius * 2.5) continue;
      let g = this.views.get(o.id);
      if (!g) {
        g = this.free.pop() ?? new Graphics();
        g.visible = true;
        this.container.addChild(g);
        this.views.set(o.id, g);
      }
      this.seen.add(o.id);
      g.clear();
      if (o.cfg.soft) this.drawSoft(g, o, zoom, time);
      else this.drawParamecium(g, o, zoom);
    }
    for (const [id, g] of this.views) {
      if (this.seen.has(id)) continue;
      this.views.delete(id);
      g.clear();
      g.visible = false;
      this.container.removeChild(g);
      this.free.push(g);
    }
  }

  private drawSoft(g: Graphics, o: Organism, zoom: number, time: number) {
    const b = o.body!;
    const n = b.n;
    const px = b.px, py = b.py;
    const R = o.radius;
    const a = o.alpha;
    const cfg = o.cfg;
    const screenR = R * zoom;
    const detail = screenR > 14;
    const fine = screenR > 30;
    const lw = Math.max(1.2 / zoom, R * 0.055);

    // Membrane outline as a closed quadratic spline through the midpoints.
    const path = (scale: number) => {
      const ax = b.ax, ay = b.ay;
      const P = (i: number) => { const k = i % n; return [ax + (px[k] - ax) * scale, ay + (py[k] - ay) * scale]; };
      let [x0, y0] = P(n - 1), [x1, y1] = P(0);
      g.moveTo((x0 + x1) / 2, (y0 + y1) / 2);
      for (let i = 0; i < n; i++) {
        const [cx, cy] = P(i);
        const [nx, ny] = P(i + 1);
        g.quadraticCurveTo(cx, cy, (cx + nx) / 2, (cy + ny) / 2);
      }
      g.closePath();
    };

    // Outer halo (membrane glow in the water).
    if (detail) {
      path(1.06);
      g.fill({ color: cfg.membrane, alpha: 0.07 * a });
    }
    // Cytoplasm.
    path(1);
    g.fill({ color: cfg.cytoplasm, alpha: 0.34 * a });
    g.stroke({ width: lw, color: cfg.membrane, alpha: 0.85 * a, join: 'round' });
    // Inner, denser cytoplasm for depth.
    if (detail) {
      path(0.82);
      g.fill({ color: lerpColor(cfg.cytoplasm, 0xffffff, 0.15), alpha: 0.12 * a });
    }

    // Flagella trail behind.
    const nf = cfg.flagella;
    if (nf > 0 && detail) {
      const fw = Math.max(0.9 / zoom, R * 0.03);
      for (let f = 0; f < nf; f++) {
        const off = o.flagOff[f];
        const ca = Math.cos(off), sa = Math.sin(off);
        // Direction pointing away from the cell at the rear, fanned out slightly.
        const dx = -(o.faceX * ca - o.faceY * sa), dy = -(o.faceX * sa + o.faceY * ca);
        const bx = b.ax + dx * R * 0.96, by = b.ay + dy * R * 0.96;
        const nx = -dy, ny = dx;
        const L = R * (1.35 + 0.25 * o.effort);
        const amp = R * (0.09 + 0.14 * o.effort);
        const ph = o.flagPhase[f];
        g.moveTo(bx, by);
        const segs = fine ? 14 : 8;
        for (let s = 1; s <= segs; s++) {
          const t = s / segs;
          const w = Math.sin(t * 6.5 - ph) * amp * t;
          g.lineTo(bx + dx * L * t + nx * w, by + dy * L * t + ny * w);
        }
        g.stroke({ width: fw, color: cfg.membrane, alpha: 0.55 * a, cap: 'round', join: 'round' });
      }
    }

    if (!detail) return;
    // Ribosome specks.
    if (fine) {
      const cs = Math.cos(o.riboSpin), sn = Math.sin(o.riboSpin);
      const rr = R * 0.022;
      const count = Math.min(MAX_RIBO, Math.round(MAX_RIBO * Math.min(1, screenR / 60)));
      for (let i = 0; i < count; i++) {
        const lx = o.riboX[i], ly = o.riboY[i];
        g.circle(b.ax + (lx * cs - ly * sn) * R, b.ay + (lx * sn + ly * cs) * R, rr);
      }
      g.fill({ color: cfg.membrane, alpha: 0.35 * a });
    }
    // Vacuoles (water-filled).
    for (let i = 0; i < MAX_VAC; i++) {
      const v = o.vac[i];
      const pulse = 1 + 0.08 * Math.sin(time * 1.7 + v.phase);
      g.circle(v.x, v.y, v.r * R * pulse);
    }
    g.fill({ color: 0xffffff, alpha: 0.09 * a });
    g.stroke({ width: lw * 0.5, color: cfg.membrane, alpha: 0.25 * a });
    // Mitochondria: short capsules with cristae.
    const nm = cfg.mitochondria;
    const mw = R * 0.075;
    for (let i = 0; i < nm; i++) {
      const m = o.mito[i];
      const len = m.r * R * 1.4;
      const cx = Math.cos(m.ang) * len, cy = Math.sin(m.ang) * len;
      g.moveTo(m.x - cx, m.y - cy);
      g.lineTo(m.x + cx, m.y + cy);
    }
    g.stroke({ width: mw * 1.1, color: MITO_COLOR, alpha: 0.42 * a, cap: 'round' });
    if (fine) {
      for (let i = 0; i < nm; i++) {
        const m = o.mito[i];
        const len = m.r * R * 1.4;
        const cx = Math.cos(m.ang), cy = Math.sin(m.ang);
        for (let k = -1; k <= 1; k++) {
          const ox = m.x + cx * len * 0.45 * k, oy = m.y + cy * len * 0.45 * k;
          g.moveTo(ox - cy * mw * 0.4, oy + cx * mw * 0.4);
          g.lineTo(ox + cy * mw * 0.4, oy - cx * mw * 0.4);
        }
      }
      g.stroke({ width: Math.max(0.7 / zoom, R * 0.012), color: MITO_DARK, alpha: 0.5 * a });
    }
    // Nucleus (two during mitosis).
    const nucleusAt = (x: number, y: number, r: number) => {
      g.circle(x, y, r);
      g.fill({ color: cfg.nucleus, alpha: 0.58 * a });
      g.stroke({ width: lw * 0.6, color: lerpColor(cfg.nucleus, 0xffffff, 0.35), alpha: 0.4 * a });
      if (fine) {
        g.circle(x + r * 0.25, y - r * 0.15, r * 0.32);
        g.fill({ color: lerpColor(cfg.nucleus, 0x000000, 0.35), alpha: 0.6 * a });
      }
    };
    if (o.state === 'dividing') {
      nucleusAt(o.nucleus.x, o.nucleus.y, o.nucleus.r * R);
      nucleusAt(o.nucleus2.x, o.nucleus2.y, o.nucleus2.r * R);
    } else nucleusAt(o.nucleus.x, o.nucleus.y, o.nucleus.r * R);
  }

  private drawParamecium(g: Graphics, o: Organism, zoom: number) {
    const R = o.radius;
    const a = o.alpha;
    const cfg = o.cfg;
    const screenR = R * zoom;
    const detail = screenR > 10;
    const lw = Math.max(1.1 / zoom, R * 0.05);
    const fx = o.faceX, fy = o.faceY;
    const squash = 1 - 0.06 * o.effort;
    const N = 28;
    // Slipper outline in local coords: long axis along the facing direction, narrower at the front.
    const lx = new Array<number>(N), ly = new Array<number>(N);
    for (let i = 0; i < N; i++) {
      const t = (i / N) * TAU;
      const c = Math.cos(t), s = Math.sin(t);
      const u = c * R * 1.55 * squash;
      const v = s * R * 0.72 * (1 - 0.2 * c) * (1 + 0.08 * Math.sin(3 * t + o.phase)) / squash;
      lx[i] = o.x + u * fx - v * fy;
      ly[i] = o.y + u * fy + v * fx;
    }
    const mid = (i: number, j: number) => [(lx[i % N] + lx[j % N]) / 2, (ly[i % N] + ly[j % N]) / 2];
    const path = () => {
      const [mx, my] = mid(N - 1, 0);
      g.moveTo(mx, my);
      for (let i = 0; i < N; i++) { const [nx, ny] = mid(i, i + 1); g.quadraticCurveTo(lx[i], ly[i], nx, ny); }
      g.closePath();
    };
    // Cilia: short beating hairs around the outline.
    if (detail) {
      const cl = R * 0.16;
      for (let i = 0; i < N; i++) {
        const t = (i / N) * TAU;
        const nxl = Math.cos(t) * 0.72, nyl = Math.sin(t) * 1.55; // approx outward normal of the ellipse
        const nl = Math.hypot(nxl, nyl) || 1;
        let nx = (nxl / nl) * fx - (nyl / nl) * fy, ny = (nxl / nl) * fy + (nyl / nl) * fx;
        const beat = Math.sin(o.ciliaPhase + i * 0.7) * 0.7;
        const cb = Math.cos(beat), sb = Math.sin(beat);
        const bx = nx * cb - ny * sb, by = nx * sb + ny * cb;
        nx = bx; ny = by;
        g.moveTo(lx[i], ly[i]);
        g.lineTo(lx[i] + nx * cl, ly[i] + ny * cl);
      }
      g.stroke({ width: Math.max(0.8 / zoom, R * 0.025), color: cfg.membrane, alpha: 0.5 * a, cap: 'round' });
    }
    path();
    g.fill({ color: cfg.cytoplasm, alpha: 0.36 * a });
    g.stroke({ width: lw, color: cfg.membrane, alpha: 0.85 * a });
    if (!detail) return;
    // Oral groove: a dark notch on one flank near the front.
    const gx = o.x + fx * R * 0.5 - fy * R * 0.45, gy = o.y + fy * R * 0.5 + fx * R * 0.45;
    g.ellipse(gx, gy, R * 0.35, R * 0.14);
    g.fill({ color: cfg.nucleus, alpha: 0.35 * a });
    // Food vacuoles.
    for (let i = 0; i < MAX_VAC; i++) { const v = o.vac[i]; g.circle(v.x, v.y, v.r * R * 0.9); }
    g.fill({ color: 0xffffff, alpha: 0.1 * a });
    // Macronucleus (kidney-shaped: two overlapping circles).
    const nr = o.nucleus.r * R * 0.9;
    g.circle(o.nucleus.x - fx * nr * 0.5, o.nucleus.y - fy * nr * 0.5, nr * 0.8);
    g.circle(o.nucleus.x + fx * nr * 0.5, o.nucleus.y + fy * nr * 0.5, nr * 0.7);
    g.fill({ color: cfg.nucleus, alpha: 0.55 * a });
    // Contractile vacuoles at both ends.
    const pulse = 0.5 + 0.5 * Math.sin(o.age * 2.2 + o.phase);
    g.circle(o.x + fx * R * 1.0, o.y + fy * R * 1.0, R * (0.1 + 0.08 * pulse));
    g.circle(o.x - fx * R * 1.05, o.y - fy * R * 1.05, R * (0.1 + 0.08 * (1 - pulse)));
    g.fill({ color: 0xffffff, alpha: 0.18 * a });
    g.stroke({ width: lw * 0.5, color: cfg.membrane, alpha: 0.4 * a });
  }
}
