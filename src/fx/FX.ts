/**
 * FX facade. Gameplay calls these; the FX agent (package e) polishes implementations without
 * changing signatures. All amounts respect accessibility settings.
 */
import type { Container } from 'pixi.js';
import { REFERENCE_RADIUS, type Camera } from '../core/camera';
import { events } from '../core/events';
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
    this.particles.target = () => [camera.rx, camera.ry];
    this.offs.push(
      // Game.eat() already bursts at the prey; here we only add the "pulled into the player" streaks.
      events.on('eat', (e) => {
        if (this.shifting || e.sizeRatio < 0.12) return;
        const z = Math.max(1e-9, camera.zoom);
        const pr = REFERENCE_RADIUS / z; // ~player radius
        const col = [e.entity.color, 0xffffff];
        this.particles.absorb(e.x, e.y, 2 + e.sizeRatio * 9, col, Math.max(e.entity.radius * 0.3, pr * 0.07), pr * 5);
      }),
      // Death implosion layered under Game's outward burst.
      events.on('death', (e) => {
        const pr = REFERENCE_RADIUS / Math.max(1e-9, camera.zoom);
        this.particles.implode(e.x, e.y, 36, pr * 3.2, [0xff3355, 0xffffff, 0xff9966], pr * 0.28, 0.75);
      }),
      events.on('respawn', () => {
        const pr = REFERENCE_RADIUS / Math.max(1e-9, camera.zoom);
        this.particles.bloom(camera.rx, camera.ry, pr * 1.6, 0x9ff0ff);
      }),
      events.on('abilityUsed', (e) => {
        const pr = REFERENCE_RADIUS / Math.max(1e-9, camera.zoom);
        this.particles.burst(e.x, e.y, { count: 8, color: [0xffffff, 0x9fe8ff], speed: pr * 5, size: pr * 0.14, life: 0.4, noRing: false });
      }),
      events.on('scaleShiftStart', () => { this.shifting = true; }),
      events.on('scaleShiftEnd', () => { this.shifting = false; }),
    );
  }

  private offs: Array<() => void> = [];
  private shifting = false;
  private lastHitStop = -1;

  destroy() {
    for (const off of this.offs) off();
    this.offs.length = 0;
  }

  applySettings(s: Settings) {
    this.settings = s;
    // reduceShake: not fully off (some feedback), but heavily attenuated.
    this.camera.shakeScale = s.reduceShake ? 0.08 : 1;
    this.overlay.flashScale = s.reduceFlashing ? 0.35 : 1;
    this.overlay.reduceFlashing = s.reduceFlashing;
    this.particles.max = s.quality === 'low' ? 200 : s.quality === 'medium' ? 350 : 520;
    this.particles.density = s.quality === 'low' ? 0.5 : s.quality === 'medium' ? 0.75 : 1;
    this.text.max = s.quality === 'low' ? 20 : 40;
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
    this.camera.addShake(Math.max(0, Math.min(1, amount)));
  }
  /** Freeze the simulation briefly for impact. */
  hitStop(ms: number) {
    // Clamp, and avoid chained freezes feeling like lag: short stops need a 220ms gap.
    const now = performance.now();
    const len = Math.min(ms, 110);
    if (len < 70 && now - this.lastHitStop < 220) return;
    this.lastHitStop = now;
    this.loop.hitStop(len);
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
