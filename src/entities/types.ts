/**
 * Entity data model: archetypes (pure data) + pluggable behaviors and renderers (keyed by id).
 *
 * UNITS
 *  - Radii/positions are tier-local units (player starts each tier at radius 20).
 *  - Behavior speeds are in "own radii per second" unless a param says otherwise, so the same
 *    archetype feels right at any size.
 */
import type { Container } from 'pixi.js';
import type { GameContext } from '../core/context';
import type { Entity } from './Entity';

/**
 * How the player may eat this entity (ratio = entity.radius / player.radius):
 *  - 'normal':          ratio < eatRatio → eaten. ratio > dangerRatio → hurts (if damage > 0).
 *                       In between → `closeBehavior`.
 *  - 'closeInSizeOnly': like 'normal', but the close-in-size band is ALSO edible, at a risk:
 *                       the player takes `closeDamage` while eating it ("edible-with-risk").
 *  - 'never':           cannot be eaten (hazards, walls). Hurts if damage > 0, else bumps.
 */
export type EdibleRule = 'normal' | 'closeInSizeOnly' | 'never';
/** What happens in the close-in-size band for 'normal' entities. */
export type CloseBehavior = 'bump' | 'hurt' | 'none';

export interface BehaviorRef {
  id: string;
  params?: Record<string, unknown>;
}
export interface RendererRef {
  id: string;
  params?: Record<string, unknown>;
}

export interface EntityArchetype {
  /** Globally unique id, e.g. 't02_upQuark' or 'generic_food'. */
  id: string;
  name?: string;
  renderer: RendererRef;
  behaviors?: BehaviorRef[];
  /** Fallback radius range in local units when the spawn entry gives no size. */
  radius?: [number, number];
  /** Colour choices; one is picked per entity (`entity.color`). Spawn entries can override. */
  colors?: number[];
  /** Secondary colours (`entity.color2`). */
  colors2?: number[];
  /** Nutrition multiplier (default 1). Mass gained = (r/20)^2 * massValue * tier.nutrition * stats.nutrition. */
  massValue?: number;
  /** Essence gained when eaten (default 0). */
  essence?: number;
  edible?: EdibleRule;
  closeBehavior?: CloseBehavior;
  /** Fraction of player mass lost when this hurts the player (default 0.15). */
  damage?: number;
  /** Fraction of mass lost when eating a closeInSizeOnly entity in the risky band (default 0.05). */
  closeDamage?: number;
  /** Velocity damping per second (default 1.2). */
  drag?: number;
  /** Speed cap in own radii per second (default 6). */
  maxSpeed?: number;
  /** Random spin range rad/s. */
  spin?: [number, number];
  /** Lifetime range in seconds; entity fades out and despawns at the end. Default: infinite. */
  lifetime?: [number, number];
  /** Free-form tags used by mechanics / behaviors (e.g. 'quark', 'proton'). */
  tags?: string[];
  /** Spawner never culls it for distance. */
  persistent?: boolean;
  /** Collision radius multiplier (default 1). */
  hitScale?: number;
  /** Bounce strength when bumped (default 1). */
  bounce?: number;
  /** View cull padding as a multiple of radius (default 2.2). Raise for long visuals (comet tails, beams, jets). */
  cullScale?: number;
}

export interface BehaviorDef<P = any> {
  id: string;
  /** Default params merged under archetype params. */
  defaults?: P;
  /** Called when the entity spawns (incl. reuse from pool). Put per-entity state in e.data. */
  init?(e: Entity, p: P, ctx: GameContext): void;
  /** Called each sim step (60 Hz). Modify e.vx/e.vy (accelerations * dt), e.alpha, etc. */
  update(e: Entity, p: P, ctx: GameContext, dt: number): void;
}

export interface RendererDef<P = any> {
  id: string;
  defaults?: P;
  /**
   * Build a view whose BODY RADIUS IS 1 unit (the world scales it by entity.radius).
   * Called once per pooled view - bake textures here (via core/textures), never per frame.
   */
  create(arch: EntityArchetype, p: P, ctx: GameContext): Container;
  /** Apply per-entity variation (tint from e.color etc.) when an entity (re)uses a view. */
  reset?(view: Container, e: Entity, p: P, ctx: GameContext): void;
  /** Optional per-frame update, only called while visible. Keep it cheap. */
  update?(view: Container, e: Entity, p: P, ctx: GameContext, realDt: number): void;
}

/** Options for World.spawn(). */
export interface SpawnOptions {
  radius?: number;
  vx?: number;
  vy?: number;
  color?: number;
  color2?: number;
  data?: Record<string, unknown>;
  /** Spawner bookkeeping id (spawn entry index); -1 for manual spawns. */
  spawnTag?: number;
  lifetime?: number;
  /** Extra nutrition multiplier for this instance. */
  nutritionMul?: number;
  /** Extra essence for this instance. */
  essenceBonus?: number;
  /** Animate scale from 0 (default true). */
  popIn?: boolean;
}
