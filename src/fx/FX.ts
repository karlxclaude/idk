/**
 * FX facade. Gameplay calls these; the FX agent (package e) polishes implementations without
 * changing signatures. All amounts respect accessibility settings.
 */
import type { Container } from 'pixi.js';
import type { Camera } from '../core/camera';
import type { GameLoop } from '../core/loop';
import type { Settings } from '../core/state';
import { FloatingText, type FloatTextOptions } from './floatingText';
import { Particles, type BurstOptions } from './particles';
import { ScreenOverlay } from './screenOverlay';

export class FX {
  readonly particles = new Particles();
  readonly text = new FloatingText();
  readonly overlay = new ScreenOverlay();

  constructor(
    private camera: Camera,
    private loop: GameLoop,
    private settings: Settings,
    particleLayer: Container,
    screenLayer: Container,
  ) {
    particleLayer.addChild(this.particles.container);
    screenLayer.addChild(this.text.container, this.overlay.container);
    this.applySettings(settings);
  }

  applySettings(s: Settings) {
    this.settings = s;
    this.camera.shakeScale = s.reduceShake ? 0 : 1;
    this.overlay.flashScale = s.reduceFlashing ? 0.25 : 1;
    this.particles.max = s.quality === 'low' ? 200 : s.quality === 'medium' ? 350 : 500;
  }

  get reduceFlashing() {
    return this.settings.reduceFlashing;
  }

  /** World-space particle burst. */
  burst(x: number, y: number, o?: BurstOptions) {
    this.particles.burst(x, y, o);
  }
  /** Floating text anchored at a world position. */
  floatText(x: number, y: number, text: string, o?: FloatTextOptions) {
    this.text.spawn(x, y, text, o);
  }
  /** Screen shake; amount is trauma 0..1. */
  shake(amount: number) {
    this.camera.addShake(amount);
  }
  /** Freeze the simulation briefly for impact. */
  hitStop(ms: number) {
    this.loop.hitStop(ms);
  }
  /** Full-screen additive flash. */
  flash(alpha = 0.6, color = 0xffffff, decay = 4) {
    this.overlay.flash(alpha, color, decay);
  }
  /** Optional haptic pulse (mobile). */
  vibrate(ms: number) {
    if (this.settings.haptics && 'vibrate' in navigator) {
      try {
        navigator.vibrate(ms);
      } catch {
        /* ignore */
      }
    }
  }

  update(simDt: number, realDt: number) {
    this.particles.update(simDt > 0 ? simDt : realDt * 0.25);
    const cam = this.camera;
    this.text.update(realDt, (x, y) => [cam.worldToScreenX(x), cam.worldToScreenY(y)]);
    this.overlay.update(realDt);
  }

  resize(w: number, h: number) {
    this.overlay.resize(w, h);
  }

  rebase(dx: number, dy: number) {
    this.particles.rebase(dx, dy);
    this.text.rebase(dx, dy);
  }

  clearWorld() {
    this.particles.clear();
    this.text.clear();
  }
}
