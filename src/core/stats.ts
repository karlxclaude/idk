/**
 * PlayerStats: every tunable the upgrade system can modify. computeStats() starts from
 * BASE_STATS and lets each owned upgrade (src/upgrades/defs/*) apply its modifier.
 * Call game.refreshStats() after buying an upgrade.
 */
import { getUpgrade } from '../upgrades/registry';
import type { GameState } from './state';

export interface PlayerStats {
  /** Max speed multiplier (1 = base). */
  speed: number;
  /** Steering responsiveness (higher = snappier, lower = floatier). */
  accel: number;
  /** Magnet radius as multiple of player radius (0 = off). Pulls edible entities in. */
  magnetRadius: number;
  /** Magnet pull strength (player-radii per second). */
  magnetStrength: number;
  /** Damage reduction 0..0.9. */
  armor: number;
  /** Seconds between dashes. */
  dashCooldown: number;
  /** Dash impulse (multiples of max speed). */
  dashPower: number;
  /** HOOK (upgrade agent): number of split pieces; 0 = split disabled. */
  splitCount: number;
  /** HOOK: glow-lure radius (player radii) - small entities drift toward player. 0 = off. */
  glowLure: number;
  /** HOOK: gravity-well strength pulling everything edible (player radii / s). 0 = off. */
  gravityWell: number;
  /** Mass gain multiplier on every eat. */
  nutrition: number;
  /** Essence gain multiplier. */
  essenceGain: number;
  /** Eat if target.radius < player.radius * eatRatio. */
  eatRatio: number;
  /** Hurt if target.radius > player.radius * dangerRatio. */
  dangerRatio: number;
  /** Seconds of invulnerability after a hit. */
  invulnTime: number;
}

export const BASE_STATS: Readonly<PlayerStats> = Object.freeze({
  speed: 1,
  accel: 4.5,
  magnetRadius: 0,
  magnetStrength: 2,
  armor: 0,
  dashCooldown: 2.2,
  dashPower: 2.4,
  splitCount: 0,
  glowLure: 0,
  gravityWell: 0,
  nutrition: 1,
  essenceGain: 1,
  eatRatio: 0.9,
  dangerRatio: 1.1,
  invulnTime: 1.3,
});

export function computeStats(state: GameState): PlayerStats {
  const s: PlayerStats = { ...BASE_STATS };
  for (const [id, level] of Object.entries(state.ownedUpgrades)) {
    const def = getUpgrade(id);
    if (def && level > 0) def.apply(s, level);
  }
  s.armor = Math.min(0.9, Math.max(0, s.armor));
  return s;
}
