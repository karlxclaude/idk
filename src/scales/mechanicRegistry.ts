/**
 * Tier mechanics: self-contained systems a tier opts into via TierConfig.mechanics
 * (gluon strings, fusion, tides, gravity...). Drop a file in src/scales/mechanics/ exporting
 * default MechanicDef | MechanicDef[] - auto-registered.
 */
import { Registry } from '../core/registry';
import type { GameContext } from '../core/context';
import type { Entity } from '../entities/Entity';

export interface MechanicInstance {
  /** Sim step (60 Hz). */
  update?(dt: number): void;
  /** Per render frame (interpolation alpha, real dt). */
  render?(alpha: number, realDt: number): void;
  /** Player is about to eat `e` (still active). Return a mass multiplier (default 1). */
  onEat?(e: Entity, ratio: number): number | void;
  /** Floating-origin rebase. */
  rebase?(dx: number, dy: number): void;
  destroy(): void;
}

export interface MechanicDef<P = any> {
  id: string;
  defaults?: P;
  create(params: P, ctx: GameContext): MechanicInstance;
}

export const mechanicRegistry = new Registry<MechanicDef>('mechanic');
mechanicRegistry.addModules(import.meta.glob('./mechanics/**/*.ts', { eager: true }));
