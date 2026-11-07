/** Lightweight Canvas2D background: endless zoom-out through all tiers. */
import { TIERS } from '../../scales/registry';

const hex = (n: number, a = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
const rand = (seed: number) => {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
};

interface Speck { x: number; y: number; r: number; ph: number; c: number }
interface Shape { x: number; y: number; rx: number; ry: number; rot: number }
interface TierArt { specks: Speck[]; shapes: Shape[] }

export class TitleBackground {
  private ctx: CanvasRenderingContext2D | null;
  private raf = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private z = 0;
  private last = 0;
  private art: TierArt[];
  private ro?: ResizeObserver;
  constructor(readonly canvas: HTMLCanvasElement, private reduceMotion: boolean) {
    this.ctx = canvas.getContext('2d');
    this.art = TIERS.map((t, i) => {
      const r = rand(i + 7);
      const cols = [t.palette.glow, t.palette.accent, t.palette.player];
      return {
        specks: Array.from({ length: 46 }, () => ({
          x: r() * 2 - 1, y: r() * 2 - 1, r: 0.002 + r() * r() * 0.012, ph: r() * 6.28, c: cols[Math.floor(r() * 3)],
        })),
        shapes: Array.from({ length: 5 }, () => ({
          x: (r() * 2 - 1) * 0.7, y: (r() * 2 - 1) * 0.7, rx: 0.05 + r() * 0.16, ry: 0.04 + r() * 0.12, rot: r() * 3.14,
        })),
      };
    });
  }
  start() {
    if (this.raf) return;
    this.resize();
    window.addEventListener('resize', this.onResize);
    this.last = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - this.last) / 1000);
      this.last = t;
      this.z += dt * (this.reduceMotion ? 0.06 : 0.16);
      this.draw(t / 1000);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.onResize);
  }
  private onResize = () => this.resize();
  private resize() {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr);
    this.canvas.height = Math.floor(this.h * this.dpr);
  }
  private layer(i: number, cx: number, cy: number, R: number, time: number, alpha: number) {
    const c = this.ctx!;
    const t = TIERS[i];
    const p = t.palette;
    const g = c.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, hex(p.bgCenter ?? p.bgBottom, alpha));
    g.addColorStop(0.55, hex(p.bgBottom, alpha));
    g.addColorStop(1, hex(p.bgTop, alpha));
    c.fillStyle = g;
    c.beginPath(); c.arc(cx, cy, R, 0, 6.2832); c.fill();
    const a = this.art[i];
    c.globalCompositeOperation = 'lighter';
    for (const s of a.specks) {
      const tw = 0.6 + 0.4 * Math.sin(time * 0.8 + s.ph);
      const x = cx + s.x * R, y = cy + s.y * R, rr = Math.max(0.6, s.r * R);
      if (Math.hypot(s.x, s.y) > 1) continue;
      const sg = c.createRadialGradient(x, y, 0, x, y, rr * 3);
      sg.addColorStop(0, hex(s.c, 0.9 * tw * alpha));
      sg.addColorStop(1, hex(s.c, 0));
      c.fillStyle = sg;
      c.beginPath(); c.arc(x, y, rr * 3, 0, 6.2832); c.fill();
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = hex(p.fog, 0.35 * alpha);
    for (const s of a.shapes) {
      c.beginPath();
      c.ellipse(cx + s.x * R, cy + s.y * R, s.rx * R, s.ry * R, s.rot, 0, 6.2832);
      c.fill();
    }
    // core speck glow so it reads as an object when small
    const pg = c.createRadialGradient(cx, cy, 0, cx, cy, R * 0.12);
    pg.addColorStop(0, hex(p.playerGlow, 0.5 * alpha));
    pg.addColorStop(1, hex(p.playerGlow, 0));
    c.fillStyle = pg;
    c.beginPath(); c.arc(cx, cy, R * 0.12, 0, 6.2832); c.fill();
  }
  private draw(time: number) {
    const c = this.ctx;
    if (!c || !TIERS.length) return;
    const n = TIERS.length;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const base = Math.floor(this.z);
    const f = this.z - base;
    const a = ((base % n) + n) % n;
    const b = (a + 1) % n;
    const cx = this.w / 2, cy = this.h / 2;
    const diag = Math.hypot(this.w, this.h);
    c.globalCompositeOperation = 'source-over';
    // outer tier fills the screen and grows slowly in sharpness
    c.fillStyle = hex(TIERS[b].palette.bgTop);
    c.fillRect(0, 0, this.w, this.h);
    this.layer(b, cx, cy, diag * (0.55 + 0.1 * f), time, 1);
    // inner tier shrinks to a speck
    const R = diag * 0.62 * Math.pow(1 - f, 2.4) + 3;
    c.save();
    this.layer(a, cx, cy, R, time, Math.min(1, (1 - f) * 6));
    c.restore();
    // readout
    const ea = TIERS[a].scaleExponent, eb = TIERS[b].scaleExponent;
    const e = ea + (eb - ea) * (1 - Math.pow(1 - f, 2.4));
    c.font = '13px ui-monospace, Menlo, monospace';
    c.textAlign = 'center';
    c.fillStyle = 'rgba(255,255,255,0.45)';
    c.fillText(`10^${e.toFixed(1)} m`, cx, this.h - 22);
    // vignette
    const v = c.createRadialGradient(cx, cy, diag * 0.15, cx, cy, diag * 0.6);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.55)');
    c.fillStyle = v;
    c.fillRect(0, 0, this.w, this.h);
  }
}
