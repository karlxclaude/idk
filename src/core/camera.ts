/** Eased follow camera. zoom = screen px per world unit. Interpolated at render time. */
import { clamp, damp } from './math';

export class Camera {
  x = 0; y = 0; zoom = 1;
  prevX = 0; prevY = 0; prevZoom = 1;
  rx = 0; ry = 0; rzoom = 1;
  width = 800; height = 600;
  /** Multiplier applied to the follow zoom (start / death transitions). */
  zoomBias = 1;
  followRate = 4;
  zoomRate = 1.1;

  resize(w: number, h: number) { this.width = w; this.height = h; }

  /** Zoom that shows a cell of `radius` at a comfortable size; shrinks slowly as the cell grows. */
  zoomFor(radius: number): number {
    const ref = Math.min(this.width, this.height);
    const screenR = clamp(ref * 0.11, 34, 110);
    return (screenR / radius) * this.zoomBias;
  }

  savePrev() { this.prevX = this.x; this.prevY = this.y; this.prevZoom = this.zoom; }

  follow(tx: number, ty: number, targetZoom: number, dt: number, vx = 0, vy = 0) {
    const lead = 0.22;
    const k = damp(this.followRate, dt);
    this.x += (tx + vx * lead - this.x) * k;
    this.y += (ty + vy * lead - this.y) * k;
    const kz = damp(this.zoomRate, dt);
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(targetZoom) - Math.log(this.zoom)) * kz);
  }

  snap(x: number, y: number, zoom: number) {
    this.x = this.prevX = this.rx = x;
    this.y = this.prevY = this.ry = y;
    this.zoom = this.prevZoom = this.rzoom = zoom;
  }

  interpolate(alpha: number) {
    this.rx = this.prevX + (this.x - this.prevX) * alpha;
    this.ry = this.prevY + (this.y - this.prevY) * alpha;
    this.rzoom = Math.exp(Math.log(this.prevZoom) + (Math.log(this.zoom) - Math.log(this.prevZoom)) * alpha);
  }

  /** World-space radius of the circle covering the screen at the current zoom. */
  get viewRadius(): number { return (0.5 * Math.hypot(this.width, this.height)) / this.zoom; }

  worldToScreenX(x: number) { return (x - this.rx) * this.rzoom + this.width / 2; }
  worldToScreenY(y: number) { return (y - this.ry) * this.rzoom + this.height / 2; }
}
