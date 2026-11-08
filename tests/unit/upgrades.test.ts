import { beforeEach, describe, expect, it, vi } from 'vitest';
import { allUpgrades, buyUpgrade, canBuy, isUnlocked, nextCost, upgradeLevel } from '../../src/upgrades/purchase';
import { upgradeRegistry, type UpgradeDef } from '../../src/upgrades/registry';
import { BASE_STATS, computeStats } from '../../src/core/stats';
import { createDefaultState } from '../../src/core/state';

function fakeGame(essence = 0) {
  const state = createDefaultState();
  state.essence = essence;
  const game: any = {
    state,
    refreshStats: vi.fn(() => { game.stats = computeStats(state); }),
    addEssence(n: number) { state.essence += n; if (n > 0) state.totalEssence += n; },
  };
  return game;
}

beforeEach(() => {
  const w = (globalThis as any).window ?? ((globalThis as any).window = new EventTarget());
  if (!(globalThis as any).CustomEvent) (globalThis as any).CustomEvent = class extends Event { detail: unknown; constructor(t: string, i?: { detail?: unknown }) { super(t); this.detail = i?.detail; } };
  void w;
});

describe('upgrade defs', () => {
  it('registry has upgrades with sane costs and unique ids', () => {
    const all = allUpgrades();
    expect(all.length).toBeGreaterThan(0);
    expect(new Set(all.map((u) => u.id)).size).toBe(all.length);
    for (const u of all) {
      expect(u.maxLevel).toBeGreaterThan(0);
      let prev = 0;
      for (let l = 0; l < u.maxLevel; l++) {
        const c = u.cost(l);
        expect(Number.isFinite(c)).toBe(true);
        expect(c).toBeGreaterThan(0);
        expect(c).toBeGreaterThanOrEqual(prev);
        prev = c;
      }
    }
  });
});

describe('purchase', () => {
  const def = allUpgrades().find((u) => !u.unlockTier)!;

  it('cannot buy without essence; buying deducts and levels up', () => {
    const g = fakeGame(0);
    expect(canBuy(g, def)).toBe(false);
    expect(buyUpgrade(g, def.id)).toBe(false);
    g.state.essence = def.cost(0) + 5;
    expect(canBuy(g, def)).toBe(true);
    expect(buyUpgrade(g, def.id)).toBe(true);
    expect(g.state.essence).toBe(5);
    expect(upgradeLevel(g, def.id)).toBe(1);
    expect(g.refreshStats).toHaveBeenCalled();
  });

  it('unknown id fails', () => {
    expect(buyUpgrade(fakeGame(1e9), 'nope-nope')).toBe(false);
  });

  it('max level returns null cost and blocks buying', () => {
    const g = fakeGame(1e12);
    g.state.maxTierReached = 99;
    g.state.ownedUpgrades[def.id] = def.maxLevel;
    expect(nextCost(g, def)).toBeNull();
    expect(canBuy(g, def)).toBe(false);
    expect(buyUpgrade(g, def.id)).toBe(false);
  });

  it('respects unlockTier', () => {
    const locked: UpgradeDef = { id: 'test-locked', name: 't', description: '', maxLevel: 1, cost: () => 1, apply() {}, unlockTier: 5 };
    upgradeRegistry.register(locked, 'test');
    const g = fakeGame(100);
    expect(isUnlocked(g, locked)).toBe(false);
    expect(buyUpgrade(g, locked.id)).toBe(false);
    g.state.maxTierReached = 5;
    expect(buyUpgrade(g, locked.id)).toBe(true);
  });

  it('grantsAbility adds the ability once', () => {
    const d: UpgradeDef = { id: 'test-grant', name: 't', description: '', maxLevel: 3, cost: () => 1, apply() {}, grantsAbility: 'dash' };
    upgradeRegistry.register(d, 'test');
    const g = fakeGame(10);
    buyUpgrade(g, d.id); buyUpgrade(g, d.id);
    expect(g.state.ownedAbilities.filter((a: string) => a === 'dash')).toHaveLength(1);
  });
});

describe('computeStats', () => {
  it('returns base stats with no upgrades', () => {
    expect(computeStats(createDefaultState())).toEqual({ ...BASE_STATS });
  });
  it('does not mutate BASE_STATS and applies owned upgrades', () => {
    const st = createDefaultState();
    const d = allUpgrades()[0];
    st.ownedUpgrades[d.id] = 1;
    const s = computeStats(st);
    expect(s).not.toEqual({ ...BASE_STATS });
    expect(BASE_STATS.speed).toBe(1);
  });
  it('ignores unknown ids and level 0, clamps armor', () => {
    const st = createDefaultState();
    st.ownedUpgrades = { bogus: 3 };
    expect(computeStats(st)).toEqual({ ...BASE_STATS });
    upgradeRegistry.register({ id: 'test-armor', name: '', description: '', maxLevel: 1, cost: () => 1, apply: (s) => { s.armor = 5; } }, 'test');
    st.ownedUpgrades = { 'test-armor': 1 };
    expect(computeStats(st).armor).toBe(0.9);
    st.ownedUpgrades = { 'test-armor': 0 };
    expect(computeStats(st).armor).toBe(0);
  });
});
