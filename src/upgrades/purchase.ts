/** Buying mutations + equipping abilities. UI-agnostic. */
import type { Game } from '../core/Game';
import { getUpgrade, upgradeRegistry, type UpgradeDef } from './registry';

export function upgradeLevel(game: Game, id: string): number {
  return game.state.ownedUpgrades[id] ?? 0;
}
export function isUnlocked(game: Game, def: UpgradeDef): boolean {
  return game.state.maxTierReached >= (def.unlockTier ?? 0);
}
export function nextCost(game: Game, def: UpgradeDef): number | null {
  const l = upgradeLevel(game, def.id);
  return l >= def.maxLevel ? null : def.cost(l);
}
export function canBuy(game: Game, def: UpgradeDef): boolean {
  const c = nextCost(game, def);
  return c !== null && isUnlocked(game, def) && game.state.essence >= c;
}
export function allUpgrades(): UpgradeDef[] {
  return upgradeRegistry.all();
}

export function buyUpgrade(game: Game, id: string): boolean {
  const def = getUpgrade(id);
  if (!def || !canBuy(game, def)) return false;
  const cost = nextCost(game, def)!;
  const level = upgradeLevel(game, id) + 1;
  game.addEssence(-cost);
  game.state.ownedUpgrades[id] = level;
  if (def.grantsAbility && !game.state.ownedAbilities.includes(def.grantsAbility)) game.state.ownedAbilities.push(def.grantsAbility);
  game.refreshStats();
  window.dispatchEvent(new CustomEvent('everhunger:upgradePurchased', { detail: { id, level, cost } }));
  return true;
}

/** Put `abilityId` (or nothing) into ability slot `slot` (0..2 = ability2..4). */
export function equipAbility(game: Game, slot: number, abilityId: string | null) {
  const arr = game.state.ownedAbilities;
  if (abilityId === null) {
    const cur = arr[slot];
    if (cur !== undefined) { arr.splice(slot, 1); arr.push(cur); }
  } else {
    const from = arr.indexOf(abilityId);
    if (from < 0) return;
    arr.splice(from, 1);
    arr.splice(Math.min(slot, arr.length), 0, abilityId);
  }
  window.dispatchEvent(new CustomEvent('everhunger:abilityEquipped', { detail: { slot, id: abilityId } }));
}
