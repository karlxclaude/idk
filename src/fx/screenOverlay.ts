/** Full-screen flash + vignette overlays (screen space). */
import { Container, Sprite, Texture } from 'pixi.js';
import { Tex } from '../core/textures';

export class ScreenOverlay {
  readonly container = new Container();
  private flashSprite = new Sprite(Texture.WHITE);
  private vignette = new Sprite(Tex.vignette());
  private flashAlpha = 0;
  private flashDecay = 4;
  /** Base vignette strength (0..1), plus a transient boost driven by the scale shift. */
  vignetteBase = 0.35;
  vignetteBoost = 0;
  /** Accessibility multiplier applied to flashes. */
  flashScale = 1;

  constructor() {
    this.flashSprite.alpha = 0;
    this.flashSprite.blendMode = 'add';
    this.vignette.anchor.set(0.5);
    this.container.addChild(this.vignette, this.flashSprite);
  }

  resize(w: number, h: number) {
    this.flashSprite.width = w;
    this.flashSprite.height = h;
    this.vignette.position.set(w / 2, h / 2);
    const d = Math.hypot(w, h) * 1.02;
    this.vignette.width = this.vignette.height = d;
  }

  flash(alpha = 0.8, color = 0xffffff, decay = 4) {
    this.flashSprite.tint = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha * this.flashScale);
    this.flashDecay = decay;
  }

  update(realDt: number) {
    this.flashAlpha = Math.max(0, this.flashAlpha - realDt * this.flashDecay * Math.max(0.2, this.flashAlpha));
    this.flashSprite.alpha = this.flashAlpha;
    this.vignette.alpha = Math.min(1, this.vignetteBase + this.vignetteBoost);
  }
}
