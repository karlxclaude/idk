/**
 * GameContext: the read-mostly facade handed to behaviors, renderers, mechanics, abilities,
 * background layers and UI. Game implements it. Import TYPES only from here to avoid cycles.
 */
import type { Application, Container, Texture } from 'pixi.js';
import type { EventBus, GameEvents } from './events';
import type { Input } from './input';
import type { Camera } from './camera';
import type { GameLoop } from './loop';
import type { GameState } from './state';
import type { PlayerStats } from './stats';
import type { Rng } from './math';
import type { World } from '../entities/World';
import type { Player } from '../entities/Player';
import type { Entity } from '../entities/Entity';
import type { FX } from '../fx/FX';
import type { TierConfig } from '../scales/types';

export interface GameLayers {
  /** Root of everything rendered (post-processing filters attach here during shifts). */
  scene: Container;
  /** Screen-space background parallax layers. */
  background: Container;
  /** World-space root: camera transform applied. */
  world: Container;
  /** World-space, below entities (tier mechanics such as gluon strings draw here). */
  worldUnder: Container;
  /** World-space entity views. */
  entities: Container;
  /** World-space particles. */
  particles: Container;
  /** World-space player. */
  player: Container;
  /** Screen-space foreground ambient layers (in front of world). */
  foreground: Container;
  /** Screen-space FX (floating text, flash, vignette). */
  screenFx: Container;
}

export interface GameContext {
  readonly app: Application;
  readonly events: EventBus<GameEvents>;
  readonly input: Input;
  readonly camera: Camera;
  readonly loop: GameLoop;
  readonly world: World;
  readonly player: Player;
  readonly fx: FX;
  readonly state: GameState;
  readonly stats: PlayerStats;
  readonly rng: Rng;
  readonly layers: GameLayers;
  /** Active tier config. */
  readonly tier: TierConfig;
  /** Sim seconds since the current tier started. */
  readonly tierTime: number;
  /** Snapshot texture of the previously conquered world (null on a fresh start). */
  readonly lastWorldTexture: Texture | null;
  /** True while a scale shift transition is running. */
  readonly shifting: boolean;
  /** Current size-meter progress 0..1. */
  readonly progress: number;
  /** Damage the player for `fraction` of their mass (respects invulnerability, armor, shake, hurt event). Source may be null. */
  hurt(source: Entity | null, fraction: number): void;
}
