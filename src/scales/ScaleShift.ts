/**
 * SCALE SHIFT - the signature transition.
 *
 *  Phase OUT (real time, sim frozen):
 *    camera zooms out ~40x in log space (ease-in), chromatic aberration + radial blur + vignette ramp up.
 *  MID:
 *    the whole screen is snapshotted into a RenderTexture, baked into a circular "world speck"
 *    texture, the old tier is torn down and the new tier is built. A real edible 'prevSpeck'
 *    entity carrying that texture is placed next to the new player, and the camera is set so
 *    the speck exactly covers the circle the old world occupied on screen. Flash hides the seam.
 *  Phase IN (sim running, player control locked):
 *    camera keeps zooming out (ease-out, log space) and pans from the speck to the player:
 *    the old world visibly shrinks into ONE edible particle of the new tier. Filters fade out,
 *    new background fades in, the title card shows (UI listens to 'tierEnter').
 *
 *  Events: scaleShiftStart → (tierEnter) → scaleShiftMid → scaleShiftEnd.
 */
import { Container, Graphics, RenderTexture, Sprite } from 'pixi.js';
import { REFERENCE_RADIUS } from '../core/camera';
import { clamp, easeInCubic, easeInOutCubic, easeOutCubic, lerp, logLerp, smoothstep } from '../core/math';
import { Tex } from '../core/textures';
import type { Game } from '../core/Game';
import { ChromaticAberrationFilter } from '../fx/filters/ChromaticAberrationFilter';
import { RadialBlurFilter } from '../fx/filters/RadialBlurFilter';
import type { Entity } from '../entities/Entity';
import { getTier, TIER_COUNT } from './registry';
import type { TierConfig } from './types';

export const SHIFT_OUT_DURATION = 1.4;
export const SHIFT_IN_DURATION = 2.0;
/** log10 of the zoom-out factor during phase OUT. */
const OUT_ZOOM_DECADES = 1.6;
const SPECK_RADIUS = REFERENCE_RADIUS * 0.45;
const SPECK_TEX_SIZE = 512;

export class ScaleShift {
  active = false;
  /** Playback speed multiplier (debug: `__game.shift.speed = 0.2` for slow motion). */
  speed = 1;
  private t = 0;
  private midDone = false;
  private from!: TierConfig;
  private to!: TierConfig;
  private toIndex = 1;
  private zoomStart = 1;
  private zIn0 = 1;
  private zIn1 = 1;
  private expFrom = 0;
  private expTo = 0;
  private speck: Entity | null = null;
  private speckX = 0;
  private speckY = 0;
  private ca = new ChromaticAberrationFilter();
  private rb = new RadialBlurFilter();

  constructor(private game: Game) {}

  get duration() {
    return SHIFT_OUT_DURATION + SHIFT_IN_DURATION;
  }

  start(toIndex: number) {
    const g = this.game;
    this.active = true;
    this.t = 0;
    this.midDone = false;
    this.from = g.tier;
    this.toIndex = toIndex;
    this.to = getTier(toIndex);
    this.zoomStart = g.camera.zoom;
    this.expFrom = g.camera.displayExponent;
    this.expTo = this.to.scaleExponent;
    g.loop.frozen = true;
    g.camera.followEnabled = false;
    g.controlLocked = true;
    g.input.clearPressed();
    this.ca.amount = 0;
    this.rb.strength = 0;
    g.layers.scene.filters = [this.rb, this.ca];
    g.player.gulpV += 3;
    g.fx.flash(0.25, this.from.palette.playerGlow, 3);
    g.fx.shake(0.25);
    g.fx.vibrate(60);
    g.events.emit('scaleShiftStart', { from: this.from, to: this.to });
  }

  update(realDt: number) {
    if (!this.active) return;
    const g = this.game;
    this.t += realDt * this.speed;
    const reduce = g.state.settings.reduceFlashing;
    const caMax = reduce ? 3 : 14;
    const rbMax = reduce ? 0.08 : 0.28;
    const total = this.duration;
    g.camera.displayExponent = lerp(this.expFrom, this.expTo, easeInOutCubic(clamp(this.t / total, 0, 1)));

    if (this.t < SHIFT_OUT_DURATION) {
      const u = this.t / SHIFT_OUT_DURATION;
      const e = easeInCubic(u);
      const cam = g.camera;
      cam.snap(g.player.x, g.player.y, this.zoomStart * Math.pow(10, -OUT_ZOOM_DECADES * e));
      const s = smoothstep(u);
      this.ca.amount = caMax * s;
      this.rb.strength = rbMax * s;
      g.fx.overlay.vignetteBoost = 0.65 * s;
      if (u > 0.55) g.camera.addShake(realDt * 0.6);
      return;
    }

    if (!this.midDone) this.mid();

    const u = clamp((this.t - SHIFT_OUT_DURATION) / SHIFT_IN_DURATION, 0, 1);
    const p = g.player;
    const z = logLerp(this.zIn0, this.zIn1, easeOutCubic(u));
    const w = smoothstep(clamp((u - 0.05) / 0.75, 0, 1));
    const cx = lerp(this.speckX, p.x, w), cy = lerp(this.speckY, p.y, w);
    g.camera.snap(cx, cy, z);
    const s = 1 - smoothstep(u * 1.2);
    this.ca.amount = caMax * s;
    this.rb.strength = rbMax * s;
    g.fx.overlay.vignetteBoost = 0.65 * s;
    if (g.background) g.background.alpha = smoothstep(u / 0.4);
    if (u >= 1) this.end();
  }

  private mid() {
    const g = this.game;
    this.midDone = true;
    const renderer = g.app.renderer;
    const W = g.camera.width, H = g.camera.height;

    // 1) Snapshot the old world (without post filters for a clean image).
    g.layers.scene.filters = null;
    g.fx.overlay.vignetteBoost = 0;
    g.fx.overlay.update(0);
    const shot = RenderTexture.create({ width: W, height: H, resolution: 1 });
    renderer.render({ container: g.layers.scene, target: shot, clear: true });

    // 2) Bake it into a circular speck texture.
    const S = SPECK_TEX_SIZE;
    const c = new Container();
    const spr = new Sprite(shot);
    spr.anchor.set(0.5);
    spr.scale.set(S / Math.min(W, H));
    spr.position.set(S / 2, S / 2);
    const mask = new Graphics().circle(S / 2, S / 2, S / 2 - 2).fill(0xffffff);
    spr.mask = mask;
    const rim = new Sprite(Tex.ring());
    rim.anchor.set(0.5);
    rim.position.set(S / 2, S / 2);
    rim.width = rim.height = S;
    rim.tint = this.from.palette.playerGlow;
    rim.alpha = 0.8;
    c.addChild(spr, mask, rim);
    const speckTex = RenderTexture.create({ width: S, height: S, resolution: 1 });
    renderer.render({ container: c, target: speckTex, clear: true });
    c.destroy({ children: true });
    shot.destroy(true);

    // 3) Swap tiers.
    const oldTex = g.lastWorldTexture;
    if (this.from.index === TIER_COUNT && this.toIndex === 1) {
      g.state.ngPlus++;
      g.events.emit('ngPlus', { count: g.state.ngPlus });
    }
    g.enterTier(this.toIndex, { viaShift: true }); // tears down the old world (destroys views using oldTex)
    oldTex?.destroy(true);
    g.lastWorldTexture = speckTex;

    // 4) Place the conquered world as one edible speck next to the new player.
    const a = g.rng.range(-0.6, 0.6) - Math.PI / 4;
    const d = REFERENCE_RADIUS * 3.2;
    this.speckX = Math.cos(a) * d;
    this.speckY = Math.sin(a) * d;
    this.speck = g.world.spawn('prevSpeck', this.speckX, this.speckY, {
      radius: SPECK_RADIUS,
      popIn: false,
      color: this.from.palette.playerGlow,
      nutritionMul: 4,
      essenceBonus: 10,
      data: { texture: speckTex, label: `Consumed: ${this.from.name}`, mainSpeck: true },
    });
    if (this.speck) {
      this.speck.vx = this.speck.vy = 0;
      this.speck.spin = 0.2;
    }

    // 5) Camera: the speck exactly covers the old world's on-screen circle, then we zoom out.
    this.zIn0 = Math.min(W, H) / 2 / SPECK_RADIUS;
    this.zIn1 = g.camera.zoomFor(g.player.radius);
    g.camera.snap(this.speckX, this.speckY, this.zIn0);
    if (g.background) g.background.alpha = 0;
    g.layers.scene.filters = [this.rb, this.ca];

    // 6) Unfreeze the sim for the reveal; player is protected and input-locked.
    g.loop.frozen = false;
    g.player.invuln = SHIFT_IN_DURATION + 1;
    g.fx.flash(g.state.settings.reduceFlashing ? 0.25 : 0.95, 0xffffff, 2.2);
    g.fx.shake(0.5);
    g.events.emit('scaleShiftMid', { from: this.from, to: this.to });
  }

  private end() {
    const g = this.game;
    this.active = false;
    g.layers.scene.filters = null;
    g.fx.overlay.vignetteBoost = 0;
    g.camera.followEnabled = true;
    g.controlLocked = false;
    if (g.background) g.background.alpha = 1;
    g.events.emit('scaleShiftEnd', { from: this.from, to: this.to });
  }
}
