/**
 * Player appearance stages (blob → cell → creature → planet → star core → cosmic entity → fractal).
 * OWNED BY THE APPEARANCE AGENT (package g): add files to src/entities/appearances/.
 * TierConfig.playerStage selects the id; unknown ids fall back to 'blob'.
 */
import type { Container } from 'pixi.js';
import type { GameContext } from '../core/context';
import type { Player } from './Player';
import type { TierConfig } from '../scales/types';

export interface PlayerAppearanceInstance {
  /** View with body radius 1 (Player scales it by radius and applies squash/stretch). */
  view: Container;
  /** Per-frame visual update (real time). */
  update(player: Player, ctx: GameContext, realDt: number): void;
  /** Optional reaction hooks. */
  onEat?(sizeRatio: number): void;
  onHurt?(): void;
  destroy(): void;
}

export interface PlayerAppearanceDef {
  id: string;
  create(tier: TierConfig, ctx: GameContext): PlayerAppearanceInstance;
}
