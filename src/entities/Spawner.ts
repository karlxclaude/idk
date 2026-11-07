/**
 * Spawner: keeps the population of each spawn entry near its target count around the player,
 * spawning just outside the view and culling entities that drift far away.
 */
import type { GameContext } from '../core/context';
import type { SpawnEntry, TierConfig } from '../scales/types';
import type { Entity } from './Entity';

export const PREV_SPECK_ARCHETYPE = 'prevSpeck';

export class Spawner {
  private entries: SpawnEntry[] = [];
  private alive: number[] = [];
  private timer = 0;
  enabled = true;
  /** Global density multiplier (quality, NG+). */
  densityScale = 1;

  constructor(private ctx: GameContext) {}

  setTier(tier: TierConfig) {
    this.entries = [...tier.spawns, ...tier.hazards];
    const ps = tier.previousSpeck;
    if (ps && ps.count > 0 && tier.index > 1) {
      this.entries.push({
        archetype: PREV_SPECK_ARCHETYPE,
        count: ps.count,
        size: ps.size,
        colors: ps.colors,
        nutritionMul: ps.nutritionMul,
        essenceBonus: ps.essence,
        data: { label: ps.label },
      });
    }
    this.alive = this.entries.map(() => 0);
  }

  private active(entry: SpawnEntry): boolean {
    const p = this.ctx.progress;
    return !entry.progress || (p >= entry.progress[0] && p <= entry.progress[1]);
  }

  private target(entry: SpawnEntry): number {
    return Math.max(0, Math.round(entry.count * this.densityScale));
  }

  /** Populate the visible area at tier start. */
  fillInitial() {
    const { player, camera, rng } = this.ctx;
    const viewR = camera.gameplayViewRadius(player.radius);
    this.entries.forEach((entry, i) => {
      if (!this.active(entry)) return;
      const n = this.target(entry);
      for (let k = 0; k < n; k++) {
        const a = rng.angle();
        const d = rng.range(player.radius * 4, viewR * 1.4);
        this.spawnEntry(i, player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      }
    });
  }

  update(dt: number) {
    if (!this.enabled) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.15;
    const { world, player, camera, rng } = this.ctx;
    const viewR = camera.gameplayViewRadius(player.radius);
    const cullR = viewR * 2.6;
    const cullR2 = cullR * cullR;

    this.alive.fill(0);
    for (const e of world.entities) {
      if (e.dead) continue;
      const dx = e.x - player.x, dy = e.y - player.y;
      if (!e.arch.persistent && dx * dx + dy * dy > cullR2 + e.radius * e.radius * 4) {
        world.despawn(e, 'culled');
        continue;
      }
      if (e.spawnTag >= 0 && e.spawnTag < this.alive.length) this.alive[e.spawnTag]++;
    }

    // Spawn deficits on a ring just outside the view, biased toward the movement direction.
    const sp = Math.hypot(player.vx, player.vy);
    const moveA = Math.atan2(player.vy, player.vx);
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (!this.active(entry)) continue;
      const deficit = this.target(entry) - this.alive[i];
      for (let k = 0; k < Math.min(deficit, 2); k++) {
        const a = sp > player.radius && rng.chance(0.6) ? moveA + rng.range(-1.2, 1.2) : rng.angle();
        const d = rng.range(viewR * 1.1, viewR * 1.7);
        this.spawnEntry(i, player.x + Math.cos(a) * d, player.y + Math.sin(a) * d);
      }
    }
  }

  /** Spawn one entry (or its group) at a position. */
  spawnEntry(i: number, x: number, y: number): Entity[] {
    const entry = this.entries[i];
    const { world, player, rng } = this.ctx;
    const out: Entity[] = [];
    const n = entry.group ? rng.int(entry.group.size[0], entry.group.size[1]) : 1;
    const relBase = entry.sizeMode === 'absolute' ? 1 : player.radius;
    for (let k = 0; k < n; k++) {
      const r = rng.range(entry.size[0], entry.size[1]) * relBase;
      const spread = entry.group ? entry.group.spread * r : 0;
      const e = world.spawn(entry.archetype, x + rng.range(-spread, spread), y + rng.range(-spread, spread), {
        radius: r,
        spawnTag: i,
        color: entry.colors?.length ? rng.pick(entry.colors) : undefined,
        color2: entry.colors2?.length ? rng.pick(entry.colors2) : undefined,
        nutritionMul: entry.nutritionMul,
        essenceBonus: entry.essenceBonus,
        data: entry.data ? { ...entry.data } : undefined,
      });
      if (e) out.push(e);
    }
    return out;
  }
}
