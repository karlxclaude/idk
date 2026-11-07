/**
 * Tier registry. Tiers are auto-discovered from ./tiers/*.ts (each `export default defineTier({...})`).
 * Adding a tier = adding a file with a unique `index`.
 */
import { archetypeRegistry } from '../entities/registries';
import type { TierConfig } from './types';

const mods = import.meta.glob<{ default: TierConfig }>('./tiers/*.ts', { eager: true });

export const TIERS: TierConfig[] = Object.values(mods)
  .map((m) => m.default)
  .filter((t): t is TierConfig => !!t && typeof t.index === 'number')
  .sort((a, b) => a.index - b.index);

// Register tier-local archetypes.
for (const t of TIERS) for (const a of t.archetypes ?? []) archetypeRegistry.register(a, `tier ${t.id}`);

TIERS.forEach((t, i) => {
  if (t.index !== i + 1) console.warn(`[tiers] tier indexes must be contiguous from 1; '${t.id}' has index ${t.index}`);
});

export const TIER_COUNT = TIERS.length;

export function getTier(index: number): TierConfig {
  const t = TIERS[index - 1];
  if (!t) throw new Error(`[tiers] no tier with index ${index}`);
  return t;
}

/** Next tier index; wraps from the last tier back to 1 (New Game+). */
export function nextTierIndex(index: number): number {
  return index >= TIER_COUNT ? 1 : index + 1;
}
