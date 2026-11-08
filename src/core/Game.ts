/**
 * Game: the engine orchestrator. Owns the Pixi app, loop, camera, world, player, FX, tier
 * lifecycle and the scale shift. Implements GameContext (the facade every plugin receives).
 *
 * Other systems (UI, audio, save, shop) should talk to the game through:
 *   - the event bus (src/core/events.ts)          ← preferred
 *   - the input action API (src/core/input.ts)
 *   - the small public methods below (setPaused, refreshStats, getHudSnapshot, applySettings...)
 */
import { Application, Container, Rectangle, type Texture } from 'pixi.js';
import { Camera, formatScale, REFERENCE_RADIUS } from './camera';
import type { GameContext, GameLayers } from './context';
import { events } from './events';
import { input } from './input';
import { GameLoop } from './loop';
import { clamp, Rng } from './math';
import { computeStats, type PlayerStats } from './stats';
import type { GameState, Settings } from './state';
import { AbilitySystem, type AbilitySlotInfo } from '../abilities/AbilitySystem';
import { bumpApart, resolvePlayerCollisions } from '../entities/Collision';
import type { Entity } from '../entities/Entity';
import { Player } from '../entities/Player';
import { Spawner } from '../entities/Spawner';
import { World } from '../entities/World';
import { FX } from '../fx/FX';
import { TierBackground } from '../scales/Background';
import { mechanicRegistry, type MechanicInstance } from '../scales/mechanicRegistry';
import { getTier, nextTierIndex, TIER_COUNT } from '../scales/registry';
import { ScaleShift } from '../scales/ScaleShift';
import type { TierConfig } from '../scales/types';

/** Fraction of in-tier progress kept after death (the "small mass penalty"). */
export const RESPAWN_PROGRESS_KEEP = 0.5;
/** Player mass below which the player dies. */
export const DEATH_MASS = 0.5;
/** Rebase the floating origin when the player is this many player-radii from (0,0). */
export const REBASE_DISTANCE_RADII = 250;

/** Display units for mass in UI/float text (mass 1 = 100). */
export const massToDisplay = (m: number) => Math.round(m * 100);

export interface HudSnapshot {
  tierIndex: number;
  tierName: string;
  tierCount: number;
  scaleLabel: string;
  scaleExponent: number;
  progress: number;
  mass: number;
  essence: number;
  fps: number;
  paused: boolean;
  shifting: boolean;
  ngPlus: number;
  dashReady: number;
  abilities: AbilitySlotInfo[];
  accent: number;
}

export class Game implements GameContext {
  readonly events = events;
  readonly input = input;
  readonly camera = new Camera();
  readonly loop: GameLoop;
  readonly world: World;
  readonly player = new Player();
  readonly fx: FX;
  readonly rng: Rng;
  readonly layers: GameLayers;
  readonly spawner: Spawner;
  readonly abilities: AbilitySystem;
  readonly shift: ScaleShift;
  stats: PlayerStats;
  tier!: TierConfig;
  tierTime = 0;
  lastWorldTexture: Texture | null = null;
  background: TierBackground | null = null;
  mechanics: MechanicInstance[] = [];
  /** When true the player ignores steering input (scale shift reveal). */
  controlLocked = false;
  private respawnTimer = -1;
  private peakMass = 1;
  private lastProgressSent = -1;

  constructor(readonly app: Application, readonly state: GameState, seed?: number) {
    this.rng = new Rng(seed);
    const scene = new Container({ label: 'scene' });
    const world = new Container({ label: 'world' });
    this.layers = {
      scene,
      background: new Container({ label: 'background' }),
      world,
      worldUnder: new Container({ label: 'worldUnder' }),
      entities: new Container({ label: 'entities' }),
      particles: new Container({ label: 'particles' }),
      player: new Container({ label: 'player' }),
      foreground: new Container({ label: 'foreground' }),
      screenFx: new Container({ label: 'screenFx' }),
    };
    const L = this.layers;
    world.addChild(L.worldUnder, L.entities, L.particles, L.player);
    scene.addChild(L.background, world, L.foreground, L.screenFx);
    app.stage.addChild(scene);
    L.player.addChild(this.player.view);

    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      realUpdate: (dt) => this.realUpdate(dt),
      render: (a, dt) => this.render(a, dt),
    });
    this.world = new World(L.entities);
    this.world.bind(this);
    this.fx = new FX(this.camera, this.loop, state.settings, L.particles, L.screenFx);
    this.stats = computeStats(state);
    this.spawner = new Spawner(this);
    this.abilities = new AbilitySystem(this);
    this.shift = new ScaleShift(this);

    input.touchMode = state.settings.touchMode;
    input.onAction('pause', () => {
      if (!this.shift.active) this.setPaused(!this.loop.paused);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && !this.loop.paused) this.setPaused(true);
    });

    this.resize(app.screen.width, app.screen.height);
    app.renderer.on('resize', (w: number, h: number) => this.resize(w, h));
    app.ticker.add((t) => this.loop.tick(t.deltaMS));
  }

  // ---------------------------------------------------------------- GameContext getters
  get shifting() {
    return this.shift.active;
  }
  get progress(): number {
    return clamp((this.player.mass - 1) / Math.max(0.001, this.tier.growthTarget - 1), 0, 1);
  }

  // ---------------------------------------------------------------- lifecycle
  start(tierIndex = this.state.tierIndex) {
    this.enterTier(clamp(tierIndex, 1, TIER_COUNT), { viaShift: false });
  }

  /** Build everything for a tier. Called on start, at the scale-shift midpoint and by debug jumps. */
  enterTier(index: number, opts: { viaShift: boolean; mass?: number }) {
    this.teardownTier();
    const tier = getTier(index);
    this.tier = tier;
    const st = this.state;
    st.tierIndex = index;
    st.maxTierReached = Math.max(st.maxTierReached, index);
    if (!st.unlockedTiers.includes(index)) st.unlockedTiers.push(index);
    this.tierTime = 0;
    this.peakMass = 1;
    this.lastProgressSent = -1;
    this.respawnTimer = -1;

    this.world.maxEntities = tier.maxEntities ?? 260;
    this.player.reset(0, 0, opts.mass ?? 1);
    st.mass = this.player.mass;
    this.player.setAppearance(tier, this);
    this.camera.originX = this.camera.originY = 0;
    this.camera.snap(0, 0, this.camera.zoomFor(this.player.radius));
    this.camera.displayExponent = tier.scaleExponent;

    this.background = new TierBackground(tier, this);
    this.background.baseZoom = this.camera.zoom;
    this.layers.background.addChild(this.background.back);
    this.layers.foreground.addChild(this.background.front);

    for (const ref of tier.mechanics ?? []) {
      const def = mechanicRegistry.get(ref.id);
      if (!def) {
        console.warn(`[tier ${tier.id}] unknown mechanic '${ref.id}'`);
        continue;
      }
      this.mechanics.push(def.create({ ...(def.defaults ?? {}), ...(ref.params ?? {}) }, this));
    }

    const q = st.settings.quality;
    this.spawner.densityScale = (q === 'low' ? 0.7 : 1) * (1 + 0.1 * st.ngPlus);
    this.spawner.setTier(tier);
    this.spawner.fillInitial();
    this.world.update(0); // build spatial hash
    this.abilities.reset();
    this.events.emit('tierEnter', { tier, viaShift: opts.viaShift, ngPlus: st.ngPlus });
    this.emitProgress(true);
  }

  teardownTier() {
    for (const m of this.mechanics) m.destroy();
    this.mechanics = [];
    if (this.background) {
      this.background.destroy();
      this.background = null;
    }
    this.world.clear();
    this.fx.clearWorld();
  }

  /** Begin the scale shift to the next tier (no-op if already shifting). */
  triggerScaleShift() {
    if (this.shift.active) return;
    this.shift.start(nextTierIndex(this.tier.index));
  }

  /** Instantly jump to a tier (debug / Scale Map). */
  jumpToTier(index: number) {
    if (this.shift.active) return;
    this.enterTier(clamp(index, 1, TIER_COUNT), { viaShift: false });
  }

  setPaused(p: boolean) {
    if (this.loop.paused === p) return;
    this.loop.setPaused(p);
    this.events.emit('pause', { paused: p });
  }

  /** Re-run computeStats() after upgrades change. */
  refreshStats() {
    this.stats = computeStats(this.state);
  }

  /** Apply a modified settings object (UI calls this, then the save agent persists). */
  applySettings(s: Settings) {
    this.state.settings = s;
    this.input.touchMode = s.touchMode;
    this.fx.applySettings(s);
    this.events.emit('settingsChanged', { settings: s });
  }

  addEssence(n: number) {
    if (!n) return;
    this.state.essence += n;
    if (n > 0) this.state.totalEssence += n;
    this.events.emit('essenceChanged', { essence: this.state.essence, delta: n });
  }

  resize(w: number, h: number) {
    this.camera.resize(w, h);
    this.layers.scene.filterArea = new Rectangle(0, 0, w, h);
    this.fx.resize(w, h);
    this.background?.resize(w, h);
  }

  // ---------------------------------------------------------------- loop hooks
  private update(dt: number) {
    this.tierTime += dt;
    this.state.stats.playTimeSec += dt;
    this.camera.savePrev();
    const p = this.player;

    if (this.controlLocked) {
      this.input.enabled = false;
      p.update(dt, this);
      this.input.enabled = true;
    } else {
      p.update(dt, this);
    }
    if (this.input.consume('split')) p.trySplit(this);
    this.abilities.update(dt);
    this.events.emit('simStep', { dt });
    this.world.update(dt);
    for (const m of this.mechanics) m.update?.(dt);

    resolvePlayerCollisions(this, {
      eat: (e, r) => this.eat(e, r),
      hurt: (e, r, f) => this.hurtInternal(e, r, f, true),
      bump: (e, r) => {
        bumpApart(this, e);
        if (Math.hypot(p.vx - e.vx, p.vy - e.vy) > p.radius * 1.5) this.events.emit('bump', { entity: e, x: e.x, y: e.y, sizeRatio: r });
      },
    });
    this.world.compact();
    this.spawner.update(dt);

    // Death / respawn
    if (this.respawnTimer >= 0) {
      this.respawnTimer -= dt;
      if (this.respawnTimer < 0) this.respawn();
    }

    // Camera
    this.camera.follow(p.x, p.y, this.camera.zoomFor(p.displayRadius), dt, p.vx, p.vy);
    if (!this.shift.active) this.camera.displayExponent = this.tier.scaleExponent + Math.log10(p.displayRadius / REFERENCE_RADIUS);

    // Floating origin
    if (Math.abs(p.x) > p.radius * REBASE_DISTANCE_RADII || Math.abs(p.y) > p.radius * REBASE_DISTANCE_RADII) this.rebase(p.x, p.y);

    // Progress / scale shift
    this.peakMass = Math.max(this.peakMass, p.mass);
    this.state.mass = p.mass;
    this.emitProgress(false);
    if (!this.shift.active && p.alive && p.mass >= this.tier.growthTarget) this.triggerScaleShift();
  }

  private realUpdate(realDt: number) {
    this.shift.update(realDt);
    this.camera.updateShake(realDt);
    const simRunning = !this.loop.paused && !this.loop.frozen;
    this.fx.update(simRunning ? realDt * this.loop.timeScale : 0, realDt);
  }

  private render(alpha: number, realDt: number) {
    const cam = this.camera;
    cam.interpolate(alpha);
    const w = this.layers.world;
    w.scale.set(cam.rzoom);
    w.position.set(cam.width / 2 - cam.rx * cam.rzoom + cam.shakeX, cam.height / 2 - cam.ry * cam.rzoom + cam.shakeY);
    this.world.render(alpha, realDt);
    this.player.render(alpha, realDt, this);
    for (const m of this.mechanics) m.render?.(alpha, realDt);
    this.background?.update(realDt);
  }

  private emitProgress(force: boolean) {
    const pr = this.progress;
    if (!force && Math.abs(pr - this.lastProgressSent) < 0.002) return;
    this.lastProgressSent = pr;
    this.events.emit('tierProgress', { tierIndex: this.tier.index, progress: pr, mass: this.player.mass, target: this.tier.growthTarget });
  }

  private rebase(dx: number, dy: number) {
    const p = this.player;
    p.x -= dx; p.y -= dy; p.prevX -= dx; p.prevY -= dy;
    const c = this.camera;
    c.x -= dx; c.y -= dy; c.prevX -= dx; c.prevY -= dy; c.rx -= dx; c.ry -= dy;
    c.originX += dx; c.originY += dy;
    this.world.rebase(dx, dy);
    this.fx.rebase(dx, dy);
    for (const m of this.mechanics) m.rebase?.(dx, dy);
    this.events.emit('originRebased', { dx, dy });
  }

  // ---------------------------------------------------------------- gameplay rules
  eat(e: Entity, ratio: number) {
    if (e.dead) return;
    const p = this.player;
    const arch = e.arch;
    let mult = 1;
    for (const m of this.mechanics) {
      const r = m.onEat?.(e, ratio);
      if (typeof r === 'number') mult *= r;
    }
    const rr = e.radius / REFERENCE_RADIUS;
    const gain = rr * rr * (arch.massValue ?? 1) * e.nutritionMul * (this.tier.nutrition ?? 0.5) * this.stats.nutrition * mult;
    const essence = Math.round(((arch.essence ?? 0) + e.essenceBonus) * this.stats.essenceGain);
    p.grow(gain, ratio);
    this.world.despawn(e, 'eaten');

    const pal = this.tier.palette;
    this.fx.burst(e.x, e.y, {
      count: Math.round(6 + ratio * 22),
      color: [e.color, pal.glow, ...(pal.particles ?? [])],
      speed: p.radius * (2 + ratio * 5),
      size: Math.max(e.radius * 0.5, p.radius * 0.12),
      life: 0.45 + ratio * 0.3,
    });
    this.fx.floatText(e.x, e.y, `+${Math.max(1, massToDisplay(gain))}`, { color: pal.accent, size: 16 + ratio * 14 });
    if (typeof e.data.label === 'string') this.fx.floatText(e.x, e.y - e.radius * 2, e.data.label, { color: 0xffffff, size: 15, life: 1.4 });
    if (ratio > 0.5) {
      this.fx.hitStop(30 + ratio * 70);
      this.fx.shake(0.12 + ratio * 0.25);
      this.fx.vibrate(15);
    } else this.fx.shake(0.03);
    if (essence) this.addEssence(essence);
    const st = this.state.stats;
    st.eaten++;
    st.biggestEatRatio = Math.max(st.biggestEatRatio, ratio);
    this.events.emit('eat', { entity: e, archetypeId: arch.id, massGained: gain, essenceGained: essence, x: e.x, y: e.y, sizeRatio: ratio, playerMass: p.mass });
  }

  /** Public damage hook for mechanics (beams, jets): no separation bump, knockback only if a source is given. */
  hurt(source: Entity | null, fraction: number) {
    const p = this.player;
    this.hurtInternal(source, source ? source.radius / Math.max(1e-6, p.radius) : 0, fraction, false);
  }

  private hurtInternal(e: Entity | null, ratio: number, fraction: number, bump: boolean) {
    const p = this.player;
    if (!p.alive) return;
    if (e && bump) bumpApart(this, e);
    if (p.invuln > 0) return;
    const lost = p.mass * fraction * (1 - this.stats.armor);
    p.setMass(p.mass - lost);
    if (e) {
      const dx = p.x - e.x, dy = p.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const kb = p.maxSpeed(this) * 1.6;
      p.vx = (dx / d) * kb;
      p.vy = (dy / d) * kb;
    }
    p.invuln = this.stats.invulnTime;
    p.hurtFlash = 1;
    p.appearance?.onHurt?.();
    this.fx.shake(0.4 + Math.min(0.4, ratio * 0.1));
    this.fx.hitStop(80);
    this.fx.flash(0.22, 0xff2244, 3);
    this.fx.vibrate(40);
    this.fx.burst(p.x, p.y, { count: 18, color: [0xff3355, 0xffffff], speed: p.radius * 5, size: p.radius * 0.3, life: 0.5 });
    this.fx.floatText(p.x, p.y - p.radius, `-${massToDisplay(lost)}`, { color: 0xff5566, size: 22 });
    this.events.emit('hurt', { source: e, massLost: lost, x: p.x, y: p.y, sizeRatio: ratio });
    if (p.mass < DEATH_MASS) this.die();
  }

  die() {
    const p = this.player;
    if (!p.alive) return;
    p.alive = false;
    p.vx = p.vy = 0;
    this.state.stats.deaths++;
    this.fx.burst(p.x, p.y, { count: 50, color: [this.tier.palette.player, this.tier.palette.playerGlow, 0xffffff], speed: p.radius * 8, size: p.radius * 0.5, life: 1 });
    this.fx.shake(0.7);
    this.fx.flash(0.35, 0xff2244, 2);
    this.events.emit('death', { tierIndex: this.tier.index, x: p.x, y: p.y });
    this.respawnTimer = 1.4;
  }

  respawn() {
    const p = this.player;
    const mass = 1 + Math.max(0, this.peakMass - 1) * RESPAWN_PROGRESS_KEEP;
    // Clear threats around the respawn point.
    for (const e of this.world.within(p.x, p.y, this.camera.gameplayViewRadius(p.radius) * 0.8)) {
      if (e.radius > p.radius * this.stats.eatRatio) this.world.despawn(e, 'killed');
    }
    p.reset(p.x, p.y, mass);
    this.peakMass = mass;
    p.invuln = 2.5;
    this.fx.burst(p.x, p.y, { count: 30, color: this.tier.palette.playerGlow, speed: p.radius * 4, size: p.radius * 0.4, life: 0.8 });
    this.events.emit('respawn', { tierIndex: this.tier.index, mass });
    this.emitProgress(true);
  }

  // ---------------------------------------------------------------- UI helpers
  getHudSnapshot(): HudSnapshot {
    return {
      tierIndex: this.tier.index,
      tierName: this.tier.name,
      tierCount: TIER_COUNT,
      scaleLabel: formatScale(this.camera.displayExponent),
      scaleExponent: this.camera.displayExponent,
      progress: this.progress,
      mass: this.player.mass,
      essence: this.state.essence,
      fps: this.loop.fps,
      paused: this.loop.paused,
      shifting: this.shift.active,
      ngPlus: this.state.ngPlus,
      dashReady: 1 - this.player.dashCooldown / Math.max(0.01, this.stats.dashCooldown),
      abilities: this.abilities.slots(),
      accent: this.tier.palette.accent,
    };
  }

  /** Create the Pixi application (WebGL, DPR capped at 2). */
  static async createApp(parent: HTMLElement): Promise<Application> {
    const app = new Application();
    await app.init({
      resizeTo: window,
      preference: 'webgl',
      antialias: false,
      backgroundColor: 0x05010d,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
      powerPreference: 'high-performance',
    });
    parent.appendChild(app.canvas);
    return app;
  }
}
