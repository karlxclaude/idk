/**
 * The player: a glowing blob. mass → radius via radius = 20 * sqrt(mass) (mass 1 at tier start).
 * Movement is floaty with momentum; dash is built in. Split / other abilities are hooks.
 */
import { Container } from 'pixi.js';
import { REFERENCE_RADIUS } from '../core/camera';
import type { GameContext } from '../core/context';
import { clamp, damp } from '../core/math';
import type { PlayerAppearanceInstance } from './appearance';
import { appearanceRegistry } from './registries';
import type { TierConfig } from '../scales/types';

export class Player {
  x = 0;
  y = 0;
  prevX = 0;
  prevY = 0;
  vx = 0;
  vy = 0;
  mass = 1;
  radius = REFERENCE_RADIUS;
  /** Visual radius (eases toward radius so growth looks smooth). */
  displayRadius = REFERENCE_RADIUS;
  heading = 0;
  invuln = 0;
  dashCooldown = 0;
  dashTime = 0;
  alive = true;
  /** Squash/stretch state. */
  stretch = 0;
  gulp = 0;
  gulpV = 0;
  /** Visual hit flash 0..1. */
  hurtFlash = 0;
  readonly view = new Container();
  appearance: PlayerAppearanceInstance | null = null;
  appearanceId = '';

  /** Max speed in local units/s for the current radius and stats. */
  maxSpeed(ctx: GameContext): number {
    return REFERENCE_RADIUS * 4.2 * Math.pow(this.radius / REFERENCE_RADIUS, 0.9) * ctx.stats.speed;
  }

  setMass(m: number) {
    this.mass = Math.max(0.05, m);
    this.radius = REFERENCE_RADIUS * Math.sqrt(this.mass);
  }

  /** Add mass; triggers the gulp squash. */
  grow(dm: number, sizeRatio = 0.3) {
    this.setMass(this.mass + dm);
    this.gulpV += 1.5 + sizeRatio * 4;
    this.appearance?.onEat?.(sizeRatio);
  }

  reset(x: number, y: number, mass: number) {
    this.x = this.prevX = x;
    this.y = this.prevY = y;
    this.vx = this.vy = 0;
    this.setMass(mass);
    this.displayRadius = this.radius;
    this.invuln = 0;
    this.dashCooldown = 0;
    this.dashTime = 0;
    this.alive = true;
    this.gulp = this.gulpV = 0;
  }

  setAppearance(tier: TierConfig, ctx: GameContext) {
    const id = appearanceRegistry.has(tier.playerStage) ? tier.playerStage : 'blob';
    this.appearance?.destroy();
    this.view.removeChildren();
    const def = appearanceRegistry.require(id);
    this.appearance = def.create(tier, ctx);
    this.appearanceId = id;
    this.view.addChild(this.appearance.view);
  }

  update(dt: number, ctx: GameContext) {
    this.prevX = this.x;
    this.prevY = this.y;
    if (!this.alive) return;
    const input = ctx.input;
    const cam = ctx.camera;
    const stats = ctx.stats;

    // Steering relative to the player's on-screen position.
    const sx = (this.x - cam.x) * cam.zoom + cam.width / 2;
    const sy = (this.y - cam.y) * cam.zoom + cam.height / 2;
    const minDim = Math.min(cam.width, cam.height);
    input.updateSteer(sx, sy, minDim * 0.3, this.radius * cam.zoom * 0.35);

    const maxV = this.maxSpeed(ctx);
    if (input.steering) {
      const accel = this.dashTime > 0 ? stats.accel * 0.12 : stats.accel;
      const k = damp(accel, dt);
      this.vx += (input.steerX * maxV - this.vx) * k;
      this.vy += (input.steerY * maxV - this.vy) * k;
    } else {
      const k = Math.exp(-(this.dashTime > 0 ? 0.3 : 1.1) * dt);
      this.vx *= k;
      this.vy *= k;
    }

    // Dash
    this.dashCooldown = Math.max(0, this.dashCooldown - dt);
    this.dashTime = Math.max(0, this.dashTime - dt);
    if (input.consume('dash')) this.tryDash(ctx);

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const sp = Math.hypot(this.vx, this.vy);
    if (sp > maxV * 0.05) this.heading = Math.atan2(this.vy, this.vx);
    this.invuln = Math.max(0, this.invuln - dt);

    // Squash & stretch springs
    const targetStretch = clamp(sp / maxV, 0, 2.5) * 0.09 + (this.dashTime > 0 ? 0.22 : 0);
    this.stretch += (targetStretch - this.stretch) * damp(10, dt);
    this.gulpV += (-180 * this.gulp - 11 * this.gulpV) * dt;
    this.gulp += this.gulpV * dt;
    this.gulp = clamp(this.gulp, -0.35, 0.5);
    this.displayRadius += (this.radius - this.displayRadius) * damp(9, dt);
  }

  tryDash(ctx: GameContext): boolean {
    if (this.dashCooldown > 0 || !this.alive) return false;
    const input = ctx.input;
    let dx = input.steerX, dy = input.steerY;
    let l = Math.hypot(dx, dy);
    if (l < 0.1) {
      dx = this.vx;
      dy = this.vy;
      l = Math.hypot(dx, dy);
    }
    if (l < 1e-3) {
      dx = Math.cos(this.heading);
      dy = Math.sin(this.heading);
      l = 1;
    }
    const v = this.maxSpeed(ctx) * ctx.stats.dashPower;
    this.vx += (dx / l) * v;
    this.vy += (dy / l) * v;
    this.dashTime = 0.28;
    this.dashCooldown = ctx.stats.dashCooldown;
    this.gulpV -= 2;
    ctx.fx.burst(this.x, this.y, { count: 14, color: ctx.tier.palette.playerGlow, speed: this.radius * 3, size: this.radius * 0.25, life: 0.45, spread: 0.9, angle: Math.atan2(-dy, -dx) });
    ctx.events.emit('abilityUsed', { id: 'dash', action: 'dash', x: this.x, y: this.y });
    return true;
  }

  /** HOOK (upgrade agent, package f): split into stats.splitCount pieces. Not implemented yet. */
  trySplit(ctx: GameContext): boolean {
    if (ctx.stats.splitCount <= 0) return false;
    ctx.events.emit('abilityUsed', { id: 'split', action: 'split', x: this.x, y: this.y });
    return false;
  }

  render(alpha: number, realDt: number, ctx: GameContext) {
    const x = this.prevX + (this.x - this.prevX) * alpha;
    const y = this.prevY + (this.y - this.prevY) * alpha;
    this.view.position.set(x, y);
    this.view.rotation = this.heading;
    const r = this.displayRadius;
    this.view.scale.set(r * (1 + this.stretch + this.gulp), r * (1 - this.stretch * 0.55 + this.gulp));
    this.hurtFlash = Math.max(0, this.hurtFlash - realDt * 3);
    this.view.alpha = !this.alive ? 0 : this.invuln > 0 ? 0.55 + 0.45 * Math.round((Math.sin(ctx.loop.realTime * 30) + 1) / 2) : 1;
    this.appearance?.update(this, ctx, realDt);
  }
}
