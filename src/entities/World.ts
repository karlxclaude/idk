/**
 * World: owns all active entities, pooling (entities + views), behavior updates, integration,
 * culling, spatial hash and render interpolation. Collision rules live in Collision.ts.
 */
import type { Container } from 'pixi.js';
import { Pool } from '../core/pool';
import { SpatialHash } from '../core/spatialHash';
import type { GameContext } from '../core/context';
import { Entity } from './Entity';
import { archetypeRegistry, resolveBehaviors, resolveRenderer } from './registries';
import type { EntityArchetype, SpawnOptions } from './types';

export type DespawnReason = 'eaten' | 'culled' | 'expired' | 'killed' | 'clear';

export class World {
  readonly entities: Entity[] = [];
  readonly hash = new SpatialHash<Entity>(64);
  private pool = new Pool(() => new Entity());
  private viewPools = new Map<string, Container[]>();
  private ctx!: GameContext;
  /** Max entities alive (spawner respects this; manual spawns beyond it are refused). */
  maxEntities = 260;
  /** Observers (mechanics) can watch despawns. */
  onDespawn: ((e: Entity, reason: DespawnReason) => void)[] = [];

  constructor(private layer: Container) {}

  bind(ctx: GameContext) {
    this.ctx = ctx;
  }

  get count() {
    return this.entities.length;
  }

  /** Spawn an archetype by id at local coords. Returns null if unknown or at capacity. */
  spawn(archId: string | EntityArchetype, x: number, y: number, opts: SpawnOptions = {}): Entity | null {
    const arch = typeof archId === 'string' ? archetypeRegistry.get(archId) : archId;
    if (!arch) {
      console.warn(`[world] unknown archetype '${String(archId)}'`);
      return null;
    }
    if (this.entities.length >= this.maxEntities) return null;
    const rng = this.ctx.rng;
    const radius = opts.radius ?? (arch.radius ? rng.range(arch.radius[0], arch.radius[1]) : 10);
    const e = this.pool.acquire();
    e.activate(arch, x, y, radius);
    e.vx = opts.vx ?? 0;
    e.vy = opts.vy ?? 0;
    e.color = opts.color ?? (arch.colors?.length ? rng.pick(arch.colors) : 0xffffff);
    e.color2 = opts.color2 ?? (arch.colors2?.length ? rng.pick(arch.colors2) : e.color);
    if (arch.spin) e.spin = rng.range(arch.spin[0], arch.spin[1]) * rng.sign();
    if (opts.lifetime !== undefined) e.lifetime = opts.lifetime;
    else if (arch.lifetime) e.lifetime = rng.range(arch.lifetime[0], arch.lifetime[1]);
    e.nutritionMul = opts.nutritionMul ?? 1;
    e.essenceBonus = opts.essenceBonus ?? 0;
    e.spawnTag = opts.spawnTag ?? -1;
    if (opts.data) Object.assign(e.data, opts.data);
    e.popScale = opts.popIn === false ? 1 : 0;

    // View (pooled per archetype)
    const { def, params } = resolveRenderer(arch);
    const vp = this.viewPools.get(arch.id);
    const view = vp?.pop() ?? def.create(arch, params, this.ctx);
    def.reset?.(view, e, params, this.ctx);
    view.visible = true;
    e.view = view;
    this.layer.addChild(view);

    for (const b of resolveBehaviors(arch)) b.def.init?.(e, b.params, this.ctx);
    this.entities.push(e);
    return e;
  }

  /** Mark for removal; it is released at the end of the current update (or immediately if outside update). */
  despawn(e: Entity, reason: DespawnReason = 'killed') {
    if (!e.active || e.dead) return;
    e.dead = true;
    for (const fn of this.onDespawn) fn(e, reason);
  }

  private release(e: Entity) {
    e.active = false;
    if (e.view) {
      this.layer.removeChild(e.view);
      let vp = this.viewPools.get(e.arch.id);
      if (!vp) this.viewPools.set(e.arch.id, (vp = []));
      if (vp.length < 64) vp.push(e.view);
      else e.view.destroy({ children: true });
      e.view = null;
    }
    this.pool.release(e);
  }

  /** Sim step: behaviors, integration, lifetime, compaction, spatial hash rebuild. */
  update(dt: number) {
    const ctx = this.ctx;
    const cam = ctx.camera;
    const farR = Math.max(cam.viewRadius, cam.gameplayViewRadius(ctx.player.radius)) * 1.6;
    const farR2 = farR * farR;
    for (const e of this.entities) {
      if (e.dead) continue;
      e.prevX = e.x;
      e.prevY = e.y;
      e.prevRotation = e.rotation;
      e.age += dt;
      if (e.popScale < 1) e.popScale = Math.min(1, e.popScale + dt * 5);
      const dx = e.x - cam.x, dy = e.y - cam.y;
      const far = dx * dx + dy * dy > farR2 + e.radius * e.radius;
      e.offscreen = far;
      // Cheap sim when far: behaviors every 4th step only.
      if (!far || (e.uid + Math.floor(ctx.loop.simTime * 60)) % 4 === 0) {
        const bdt = far ? dt * 4 : dt;
        for (const b of resolveBehaviors(e.arch)) b.def.update(e, b.params, ctx, bdt);
      }
      // Integrate
      const arch = e.arch;
      const drag = arch.drag ?? 1.2;
      const k = Math.exp(-drag * dt);
      e.vx *= k;
      e.vy *= k;
      const maxV = (arch.maxSpeed ?? 6) * e.radius;
      const sp2 = e.vx * e.vx + e.vy * e.vy;
      if (sp2 > maxV * maxV) {
        const s = maxV / Math.sqrt(sp2);
        e.vx *= s;
        e.vy *= s;
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      e.rotation += e.spin * dt;
      if (e.age >= e.lifetime) {
        e.alpha *= Math.exp(-8 * dt);
        if (e.age >= e.lifetime + 0.5) this.despawn(e, 'expired');
      }
    }
    this.compact();
    // Rebuild broadphase. Cell size tracks the player so cells hold a handful of entities.
    this.hash.cellSize = Math.max(8, ctx.player.radius * 2);
    this.hash.clear();
    for (const e of this.entities) this.hash.insert(e);
  }

  /** Remove dead entities (swap-free, order preserving). */
  compact() {
    let w = 0;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.dead) this.release(e);
      else this.entities[w++] = e;
    }
    this.entities.length = w;
  }

  /** Interpolate & cull views. */
  render(alpha: number, realDt: number) {
    const ctx = this.ctx;
    const cam = ctx.camera;
    const hw = cam.width / 2 / cam.rzoom, hh = cam.height / 2 / cam.rzoom;
    const minPx = 0.35 / cam.rzoom; // cull sub-pixel entities
    for (const e of this.entities) {
      const v = e.view;
      if (!v) continue;
      const x = e.prevX + (e.x - e.prevX) * alpha;
      const y = e.prevY + (e.y - e.prevY) * alpha;
      const r = e.radius * 2.2; // allow for glow
      const visible = Math.abs(x - cam.rx) < hw + r && Math.abs(y - cam.ry) < hh + r && e.radius > minPx && e.alpha > 0.01;
      v.visible = visible;
      if (!visible) continue;
      v.position.set(x, y);
      v.rotation = e.prevRotation + (e.rotation - e.prevRotation) * alpha;
      const s = e.radius * e.popScale;
      v.scale.set(s * e.scaleX, s * e.scaleY);
      v.alpha = e.alpha;
      const { def, params } = resolveRenderer(e.arch);
      def.update?.(v, e, params, ctx, realDt);
    }
  }

  /** Broadphase query (entities whose cells overlap the circle). Narrowphase is up to the caller. */
  query(x: number, y: number, r: number, out: Entity[] = []): Entity[] {
    return this.hash.query(x, y, r, out);
  }

  /** Entities within distance r (narrowphase on centres + radius). */
  within(x: number, y: number, r: number, out: Entity[] = []): Entity[] {
    this.hash.query(x, y, r, out);
    let w = 0;
    for (let i = 0; i < out.length; i++) {
      const e = out[i];
      const dx = e.x - x, dy = e.y - y, rr = r + e.radius;
      if (!e.dead && dx * dx + dy * dy < rr * rr) out[w++] = e;
    }
    out.length = w;
    return out;
  }

  countWhere(pred: (e: Entity) => boolean): number {
    let n = 0;
    for (const e of this.entities) if (!e.dead && pred(e)) n++;
    return n;
  }

  /** Floating-origin rebase. */
  rebase(dx: number, dy: number) {
    for (const e of this.entities) {
      e.x -= dx;
      e.y -= dy;
      e.prevX -= dx;
      e.prevY -= dy;
      if (typeof e.data.anchorX === 'number') {
        e.data.anchorX -= dx;
        e.data.anchorY -= dy;
      }
    }
  }

  /** Despawn everything (tier change). Views are destroyed since the next tier uses other archetypes. */
  clear() {
    for (const e of this.entities) {
      if (!e.dead) this.despawn(e, 'clear');
    }
    this.compact();
    this.hash.clear();
    for (const vp of this.viewPools.values()) for (const v of vp) v.destroy({ children: true });
    this.viewPools.clear();
  }
}
