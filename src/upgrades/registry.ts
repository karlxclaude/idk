/**
 * Upgrade definitions (Essence shop). OWNED BY THE UPGRADE AGENT (package f).
 * Drop files in src/upgrades/defs/ exporting default UpgradeDef | UpgradeDef[].
 * computeStats() (core/stats.ts) applies every owned upgrade to a fresh PlayerStats.
 */
import { Registry } from '../core/registry';
import type { PlayerStats } from '../core/stats';

export interface UpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  /** Essence cost to go from `level` to `level + 1`. */
  cost(level: number): number;
  /** Mutate stats for the owned level (>= 1). */
  apply(stats: PlayerStats, level: number): void;
  /** Glyph shown on the shop card. */
  icon?: string;
  /** Hidden/locked until state.maxTierReached >= this. */
  unlockTier?: number;
  /** Short human text of the effect at `level` (0 = none), e.g. '+24% speed'. */
  effect?(level: number): string;
  /** Optional: grants an ability id (added to state.ownedAbilities by the shop). */
  grantsAbility?: string;
}

export const upgradeRegistry = new Registry<UpgradeDef>('upgrade');
upgradeRegistry.addModules(import.meta.glob('./defs/**/*.ts', { eager: true }));

export function getUpgrade(id: string): UpgradeDef | undefined {
  return upgradeRegistry.get(id);
}
