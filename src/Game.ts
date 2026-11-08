/** Orchestrator: Pixi app, world, camera, renderers, phases and transitions. */
import { Application, Container } from 'pixi.js';
import { Camera } from './core/camera';
import { input } from './core/input';
import { GameLoop } from './core/loop';
import { clamp, damp } from './core/math';
import { World } from './sim/World';
import type { Organism } from './sim/Organism';
import { OrganismView } from './render/OrganismView';
import { FoodView } from './render/FoodView';
import { GrainView } from './render/GrainView';
import { Background } from './render/Background';
import { Audio } from './audio';
import { UI } from './ui/ui';

export type Phase = 'title' | 'playing' | 'dying' | 'dead';
const UM_PER_UNIT = 20 / 48; // the starting cell is 20 µm across

export class Game {
  readonly camera = new Camera();
  readonly loop: GameLoop;
  readonly world: World;
  readonly audio = new Audio();
  readonly worldLayer = new Container();
  private bg = new Background();
  private organisms = new OrganismView();
  private foodView = new FoodView();
  private grains = new GrainView();
  ui!: UI;
  phase: Phase = 'title';
  paused = false;
  private phaseT = 0;
  private targetTimeScale = 1;
  private targetZoomBias = 1.7;
  private hudTimer = 0;
  private deathBy: Organism | null = null;
  private restarting = false;

  constructor(readonly app: Application) {
    this.world = new World({
      onEat: (kind, byPlayer, size) => {
        if (!byPlayer) return;
        if (kind === 'amoeba' || kind === 'paramecium' || kind === 'predator') this.audio.gulp();
        else this.audio.eat(size);
      },
      onPlayerEngulfed: (by) => this.onEngulfed(by),
      onDivide: () => { this.audio.divide(); this.ui.showToast(`generation ${this.world.generation}`); },
    });
    this.loop = new GameLoop({
      update: (dt) => this.update(dt),
      realUpdate: (dt) => this.realUpdate(dt),
      render: (alpha) => this.render(alpha),
    });
    app.stage.addChild(this.bg.back, this.worldLayer, this.bg.front);
    this.worldLayer.addChild(this.grains.container, this.organisms.container, this.foodView.container);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    app.ticker.add((t) => this.loop.tick(t.deltaMS));
    input.onPause(() => { if (this.phase === 'playing') this.togglePause(!this.paused); });
  }

  static async createApp(parent: HTMLElement): Promise<Application> {
    const app = new Application();
    const mobile = Math.min(window.innerWidth, window.innerHeight) < 700;
    await app.init({
      preference: 'webgl',
      antialias: true,
      resizeTo: parent,
      resolution: Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2),
      autoDensity: true,
      powerPreference: 'high-performance',
      backgroundColor: 0x0a221f,
    });
    parent.appendChild(app.canvas);
    return app;
  }

  private resize() {
    const w = this.app.screen.width, h = this.app.screen.height;
    this.camera.resize(w, h);
    this.bg.resize(w, h);
  }

  /** Boot into the title: the pond is alive behind the menu. */
  boot() {
    this.world.viewRadius = this.settledViewRadius(24);
    this.world.start();
    this.world.graceTimer = Infinity;
    const p = this.world.player!;
    this.camera.zoomBias = this.targetZoomBias = 1.7;
    this.camera.snap(p.x, p.y, this.camera.zoomFor(p.radius));
    this.phase = 'title';
    this.ui.showTitle(true);
    requestAnimationFrame(() => this.ui.setFade(false));
  }

  play() {
    if (this.phase !== 'title') return;
    this.phase = 'playing';
    this.phaseT = 0;
    this.world.graceTimer = 5;
    this.targetZoomBias = 1;
    this.ui.showTitle(false);
    this.ui.showHud(true);
    this.audio.unlock();
  }

  togglePause(on: boolean) {
    if (this.phase !== 'playing') return;
    this.paused = on;
    this.loop.setPaused(on);
    this.ui.showPause(on);
    input.enabled = !on;
  }

  /** Fade to black, rebuild the pond, fade back in. */
  restart() {
    if (this.restarting) return;
    this.restarting = true;
    this.ui.setFade(true, true);
    this.ui.showPause(false);
    this.ui.showDeath(false);
    this.ui.showHud(false);
    setTimeout(() => {
      this.loop.setPaused(false);
      this.paused = false;
      input.enabled = true;
      this.loop.timeScale = this.targetTimeScale = 1;
      this.world.viewRadius = this.settledViewRadius(24);
      this.world.start();
      this.world.graceTimer = 5;
      const p = this.world.player!;
      this.camera.zoomBias = 1.5;
      this.targetZoomBias = 1;
      this.camera.snap(p.x, p.y, this.camera.zoomFor(p.radius));
      this.phase = 'playing';
      this.phaseT = 0;
      this.deathBy = null;
      this.render(1);
      this.ui.showHud(true);
      requestAnimationFrame(() => { this.ui.setFade(false); this.restarting = false; });
    }, 600);
  }

  private onEngulfed(by: Organism) {
    if (this.phase !== 'playing') return;
    this.phase = 'dying';
    this.phaseT = 0;
    this.deathBy = by;
    this.targetTimeScale = 0.3;
    this.targetZoomBias = 1.6;
    input.enabled = false;
    this.ui.showHud(false);
    this.audio.death();
  }

  private settledViewRadius(radius: number) {
    return (0.5 * Math.hypot(this.camera.width, this.camera.height)) / (this.camera.zoomFor(radius) / this.camera.zoomBias);
  }

  // ───────────────────────── loop hooks ─────────────────────────
  private update(dt: number) {
    const w = this.world;
    const p = w.player;
    if (!p) return;
    this.camera.savePrev();
    if (this.phase === 'playing' && p.state !== 'engulfed') {
      const cam = this.camera;
      const sx = cam.worldToScreenX(p.x), sy = cam.worldToScreenY(p.y);
      input.updateSteer(sx, sy, Math.min(cam.width, cam.height) * 0.3, p.radius * cam.rzoom * 0.35);
      p.steerX = input.steerX; p.steerY = input.steerY;
    } else { p.steerX = p.steerY = 0; }
    w.viewRadius = this.settledViewRadius(p.radius);
    w.step(dt);
    // Camera follow: on the player, or on the predator that swallowed it.
    const focus = this.phase === 'dying' && this.deathBy && this.deathBy.state !== 'dead' ? this.deathBy : p;
    const zoomTarget = this.camera.zoomFor(this.phase === 'dying' ? Math.max(p.radius, focus.radius * 0.8) : p.radius);
    this.camera.follow(focus.x, focus.y, zoomTarget, dt, focus.vx, focus.vy);
  }

  private realUpdate(dt: number) {
    this.phaseT += dt;
    this.loop.timeScale += (this.targetTimeScale - this.loop.timeScale) * damp(2.5, dt);
    this.camera.zoomBias += (this.targetZoomBias - this.camera.zoomBias) * damp(1.6, dt);
    if (this.phase === 'dying') {
      if (this.phaseT > 1.7 && this.phaseT - dt <= 1.7) this.ui.setFade(true);
      if (this.phaseT > 2.9) {
        this.phase = 'dead';
        const w = this.world;
        const um = w.player!.spawnRadius * 2 * UM_PER_UNIT;
        this.ui.showDeath(true, `generation ${w.generation} · ${w.foodEaten} meals · ${w.cellsEaten} cells engulfed · ${Math.round(um)} µm`);
        this.ui.setFade(false);
        this.targetZoomBias = 1.2;
        this.targetTimeScale = 0.6;
      }
    }
    this.hudTimer -= dt;
    if (this.hudTimer <= 0 && this.phase === 'playing') {
      this.hudTimer = 0.12;
      const w = this.world, p = w.player!;
      const lo = p.spawnRadius * p.spawnRadius, hi = w.divideRadius * w.divideRadius;
      this.ui.updateHud(p.radius * 2 * UM_PER_UNIT, w.generation, w.stats.kin, clamp((p.mass - lo) / (hi - lo), 0, 1));
    }
  }

  private render(alpha: number) {
    const cam = this.camera;
    cam.interpolate(alpha);
    this.worldLayer.scale.set(cam.rzoom);
    this.worldLayer.position.set(cam.width / 2 - cam.rx * cam.rzoom, cam.height / 2 - cam.ry * cam.rzoom);
    const t = this.world.time;
    const pr = this.world.player?.radius ?? 24;
    this.bg.update(cam, t, pr);
    this.grains.update(this.world);
    this.organisms.update(this.world, cam, t);
    this.foodView.update(this.world, cam, t);
  }
}
