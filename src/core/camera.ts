/**
 * Log-scale camera.
 *
 * Each tier has its own LOCAL float coordinate space where the player starts with radius
 * REFERENCE_RADIUS (20 units). `zoom` = screen pixels per local unit.
 * The ABSOLUTE scale is never stored in meters; it is a log10 exponent:
 *   metersExponent(localLength) = tier.scaleExponent + log10(localLength / REFERENCE_RADIUS)
 * so tier.scaleExponent is "log10 of the player's starting radius in meters".
 * `displayExponent` is what UIs should show; the scale shift animates it across tiers.
 */
import { clamp, damp } from './math';

export const REFERENCE_RADIUS = 20;

export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  prevX = 0;
  prevY = 0;
  prevZoom = 1;
  /** Interpolated values used for the current render frame. */
  rx = 0;
  ry = 0;
  rzoom = 1;
  /** Screen size in CSS pixels. */
  width = 800;
  height = 600;
  /** Accumulated floating-origin offset (absolute position = originX + x). Used for parallax. */
  originX = 0;
  originY = 0;
  /** When false, follow() is ignored (scale shift drives the camera directly). */
  followEnabled = true;
  /** Current shake offset in px (applied at render). */
  shakeX = 0;
  shakeY = 0;
  private trauma = 0;
  private shakeTime = 0;
  /** Settings hook: 0 disables shake. */
  shakeScale = 1;
  /** Display exponent (log10 meters of the player radius), animated during shifts. */
  displayExponent = -35;

  resize(w: number, h: number) {
    this.width = w;
    this.height = h;
  }

  /** The zoom that keeps a circle of `radius` local units at a pleasant constant screen size. */
  zoomFor(radius: number): number {
    const ref = Math.sqrt(this.width * this.height);
    const screenR = clamp(ref * 0.045, 18, 60);
    return screenR / radius;
  }

  savePrev() {
    this.prevX = this.x;
    this.prevY = this.y;
    this.prevZoom = this.zoom;
  }

  /** Smoothly follow a target (sim step). Lead slightly in the direction of motion. */
  follow(tx: number, ty: number, targetZoom: number, dt: number, vx = 0, vy = 0) {
    if (!this.followEnabled) return;
    const lead = 0.18;
    const k = damp(6, dt);
    this.x += (tx + vx * lead - this.x) * k;
    this.y += (ty + vy * lead - this.y) * k;
    // Zoom in log space for smoothness.
    const kz = damp(2.2, dt);
    this.zoom = Math.exp(Math.log(this.zoom) + (Math.log(targetZoom) - Math.log(this.zoom)) * kz);
  }

  snap(x: number, y: number, zoom: number) {
    this.x = this.prevX = this.rx = x;
    this.y = this.prevY = this.ry = y;
    this.zoom = this.prevZoom = this.rzoom = zoom;
  }

  /** Compute interpolated render values. */
  interpolate(alpha: number) {
    this.rx = this.prevX + (this.x - this.prevX) * alpha;
    this.ry = this.prevY + (this.y - this.prevY) * alpha;
    this.rzoom = Math.exp(Math.log(this.prevZoom) + (Math.log(this.zoom) - Math.log(this.prevZoom)) * alpha);
  }

  /** Add trauma 0..1 (shake intensity ~ trauma^2). */
  addShake(amount: number) {
    this.trauma = clamp(this.trauma + amount, 0, 1);
  }

  updateShake(realDt: number) {
    this.shakeTime += realDt;
    this.trauma = Math.max(0, this.trauma - realDt * 1.6);
    const t = this.trauma * this.trauma * this.shakeScale;
    const maxPx = Math.min(this.width, this.height) * 0.035;
    const s = this.shakeTime * 38;
    this.shakeX = maxPx * t * (Math.sin(s * 1.1) + Math.sin(s * 2.3 + 1.7) * 0.5);
    this.shakeY = maxPx * t * (Math.sin(s * 1.3 + 0.4) + Math.sin(s * 2.9 + 3.1) * 0.5);
  }

  /**
   * View radius the camera WILL have when settled on a player of `radius` (use this for gameplay
   * decisions like spawning/culling, since the actual zoom is animated during scale shifts).
   */
  gameplayViewRadius(radius: number): number {
    return (0.5 * Math.hypot(this.width, this.height)) / this.zoomFor(radius);
  }

  /** Radius (local units) of the circle that covers the whole screen (current zoom). */
  get viewRadius(): number {
    return (0.5 * Math.hypot(this.width, this.height)) / this.zoom;
  }

  worldToScreenX(x: number) {
    return (x - this.rx) * this.rzoom + this.width / 2 + this.shakeX;
  }
  worldToScreenY(y: number) {
    return (y - this.ry) * this.rzoom + this.height / 2 + this.shakeY;
  }
  screenToWorldX(sx: number) {
    return (sx - this.width / 2) / this.zoom + this.x;
  }
  screenToWorldY(sy: number) {
    return (sy - this.height / 2) / this.zoom + this.y;
  }

  /** log10(meters) of a local length in a tier with the given scaleExponent. */
  static metersExponent(scaleExponent: number, localLength: number): number {
    return scaleExponent + Math.log10(localLength / REFERENCE_RADIUS);
  }
}

/** Format a log10 exponent as "10^-35 m" style label (with friendly units for mid scales). */
export function formatScale(exp: number): string {
  const e = Math.round(exp);
  const sup = (n: number) => String(n).split('').map((c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]).join('');
  return `10${sup(e)} m`;
}
