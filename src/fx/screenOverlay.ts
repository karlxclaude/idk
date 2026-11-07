/** Full-screen flash, light-burst glow and vignette overlays (screen space). */
import { Container, Sprite, Texture } from 'pixi.js';
import { Tex } from '../core/textures';

/** Flashes at/above this alpha also fire the expanding light burst (scale shift mid etc). */
const BIG_FLASH = 0.6;
/** Max full-screen additive alpha, so a white flash never washes the whole frame out. */
const FLASH_CAP = 0.5;

export class ScreenOverlay {
  readonly container = new Container();
  private flashSprite = new Sprite(Texture.WHITE);
  private burst = new Sprite(Tex.glow());
  private vignette = new Sprite(Tex.vignette());
  private flashAlpha = 0;
  private flashDecay = 4;
  private burstT = 1;
  private burstDur = 0.9;
  private burstPeak = 0;
  private w = 1;
  private h = 1;
  private lastFlashAt = -10;
  private clock = 0;
  /** Base vignette strength (0..1), plus a transient boost driven by the scale shift. */
  vignetteBase = 0.35;
  vignetteBoost = 0;
  /** Accessibility multiplier applied to flashes. */
  flashScale = 1;
  /** Accessibility: no strobing; flashes are rate limited and the burst stops expanding. */
  reduceFlashing = false;

  constructor() {
    this.flashSprite.alpha = 0;
    this.flashSprite.blendMode = 'add';
    this.burst.anchor.set(0.5);
    this.burst.blendMode = 'add';
    this.burst.visible = false;
    this.vignette.anchor.set(0.5);
    this.container.addChild(this.vignette, this.burst, this.flashSprite);
  }

  resize(w: number, h: number) {
    this.w = w; this.h = h;
    this.flashSprite.width = w;
    this.flashSprite.height = h;
    this.vignette.position.set(w / 2, h / 2);
    this.burst.position.set(w / 2, h / 2);
    const d = Math.hypot(w, h) * 1.02;
    this.vignette.width = this.vignette.height = d;
  }

  flash(alpha = 0.8, color = 0xffffff, decay = 4) {
    // Anti-strobe: with reduceFlashing, ignore flashes that follow another within 0.4s.
    if (this.reduceFlashing && this.clock - this.lastFlashAt < 0.4 && this.flashAlpha > 0.03) return;
    this.lastFlashAt = this.clock;
    const a = alpha * this.flashScale;
    this.flashSprite.tint = color;
    this.flashAlpha = Math.max(this.flashAlpha, Math.min(a, this.reduceFlashing ? 0.25 : FLASH_CAP));
    this.flashDecay = decay;
    if (alpha >= BIG_FLASH) this.lightBurst(color, alpha);
  }

  /** Soft radial light that blooms outward from the centre; colourful rather than a white-out. */
  lightBurst(color: number, strength = 1) {
    this.burst.tint = color;
    this.burstT = 0;
    this.burstPeak = Math.min(1, strength) * (this.reduceFlashing ? 0.25 : 0.9);
    this.burstDur = this.reduceFlashing ? 1.4 : 0.9;
    this.burst.visible = true;
  }

  update(realDt: number) {
    this.clock += realDt;
    this.flashAlpha = Math.max(0, this.flashAlpha - realDt * this.flashDecay * Math.max(0.2, this.flashAlpha));
    this.flashSprite.alpha = this.flashAlpha;
    if (this.burstT < 1) {
      this.burstT = Math.min(1, this.burstT + realDt / this.burstDur);
      const t = this.burstT;
      const e = 1 - (1 - t) * (1 - t);
      const size = Math.hypot(this.w, this.h) * (this.reduceFlashing ? 0.8 : 0.4 + 1.6 * e);
      this.burst.width = this.burst.height = size;
      // Fast attack, long smooth tail.
      this.burst.alpha = this.burstPeak * Math.min(1, t * 12) * Math.pow(1 - t, 1.8);
      if (t >= 1) this.burst.visible = false;
    }
    this.vignette.alpha = Math.min(1, this.vignetteBase + this.vignetteBoost);
  }
}
