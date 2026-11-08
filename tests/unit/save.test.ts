import { beforeEach, describe, expect, it } from 'vitest';
import { LocalStorageSaveStore, sanitizeGame, SAVE_SCHEMA_VERSION } from '../../src/core/save';
import { createDefaultState, defaultSettings } from '../../src/core/state';

class MemStorage {
  data = new Map<string, string>();
  getItem(k: string) { return this.data.has(k) ? this.data.get(k)! : null; }
  setItem(k: string, v: string) { this.data.set(k, String(v)); }
  removeItem(k: string) { this.data.delete(k); }
  clear() { this.data.clear(); }
}

let ls: MemStorage;
beforeEach(() => {
  ls = new MemStorage();
  (globalThis as any).localStorage = ls;
});

describe('sanitizeGame', () => {
  it('returns defaults for garbage', () => {
    for (const bad of [null, undefined, 5, 'x', [], true]) {
      expect(sanitizeGame(bad)).toEqual(createDefaultState());
    }
  });
  it('clamps and repairs bad fields', () => {
    const g = sanitizeGame({
      tierIndex: -4, mass: NaN, essence: -10, totalEssence: 'x',
      ownedUpgrades: { a: 3.7, b: -1, c: 'z' }, ownedAbilities: ['p', 'p', 3],
      unlockedTiers: [5, 'q', 0, 2], maxTierReached: 0, ngPlus: -1,
      stats: { eaten: -5, deaths: Infinity },
    });
    expect(g.tierIndex).toBe(1);
    expect(g.mass).toBe(1);
    expect(g.essence).toBe(0);
    expect(g.ownedUpgrades).toEqual({ a: 3 });
    expect(g.ownedAbilities).toEqual(['p']);
    expect(g.unlockedTiers).toEqual([1, 2, 5]);
    expect(g.maxTierReached).toBeGreaterThanOrEqual(g.tierIndex);
    expect(g.ngPlus).toBe(0);
    expect(g.stats.eaten).toBe(0);
    expect(g.stats.deaths).toBe(0);
  });
  it('keeps maxTierReached >= tierIndex and tierIndex unlocked', () => {
    const g = sanitizeGame({ tierIndex: 7, maxTierReached: 3 });
    expect(g.maxTierReached).toBe(7);
    expect(g.unlockedTiers).toContain(7);
  });
});

describe('LocalStorageSaveStore', () => {
  it('has no save initially; save/load round-trips', () => {
    const s = new LocalStorageSaveStore();
    expect(s.hasSave()).toBe(false);
    const st = createDefaultState();
    st.tierIndex = 4; st.essence = 99; st.totalEssence = 150; st.ownedUpgrades = { speed: 2 };
    st.maxTierReached = 5; st.unlockedTiers = [1, 2, 3, 4, 5];
    s.saveGame(st);
    expect(s.hasSave()).toBe(true);
    const back = s.loadGame()!;
    expect(back.tierIndex).toBe(4);
    expect(back.essence).toBe(99);
    expect(back.ownedUpgrades).toEqual({ speed: 2 });
    s.clearSave();
    expect(s.hasSave()).toBe(false);
  });

  it('migrates a legacy v1 raw state', () => {
    ls.setItem('everhunger.save.v1', JSON.stringify({ tierIndex: 3, essence: 20, ownedUpgrades: { speed: 1 } }));
    const g = new LocalStorageSaveStore().loadGame()!;
    expect(g.tierIndex).toBe(3);
    expect(g.essence).toBe(20);
  });

  it('ignores corrupt JSON and falls through to legacy key', () => {
    ls.setItem('everhunger.save.v2', '{not json');
    ls.setItem('everhunger.save.v1', JSON.stringify({ tierIndex: 2 }));
    expect(new LocalStorageSaveStore().loadGame()!.tierIndex).toBe(2);
    ls.clear();
    ls.setItem('everhunger.save.v2', '{not json');
    expect(new LocalStorageSaveStore().loadGame()).toBeNull();
  });

  it('survives a throwing localStorage', () => {
    (globalThis as any).localStorage = {
      getItem() { throw new Error('blocked'); },
      setItem() { throw new Error('blocked'); },
      removeItem() { throw new Error('blocked'); },
    };
    const s = new LocalStorageSaveStore();
    expect(s.loadGame()).toBeNull();
    expect(() => s.saveGame(createDefaultState())).not.toThrow();
    expect(() => s.clearSave()).not.toThrow();
    expect(s.loadSettings()).toEqual(defaultSettings());
  });

  it('export/import round-trip', () => {
    const s = new LocalStorageSaveStore();
    const st = createDefaultState();
    st.tierIndex = 6; st.essence = 42; st.totalEssence = 42; st.ownedAbilities = ['dash'];
    const str = s.exportString(st);
    expect(str).not.toBe('');
    ls.clear();
    const g = s.importString(str)!;
    expect(g.tierIndex).toBe(6);
    expect(g.essence).toBe(42);
    expect(g.ownedAbilities).toEqual(['dash']);
    expect(s.hasSave()).toBe(true); // import persists
  });

  it('import rejects invalid strings', () => {
    const s = new LocalStorageSaveStore();
    expect(s.importString('!!!not base64!!!')).toBeNull();
    expect(s.importString(btoa('{"foo":1}'))).toBeNull();
    expect(s.importString('')).toBeNull();
  });

  it('exports empty string when nothing to export', () => {
    expect(new LocalStorageSaveStore().exportString()).toBe('');
  });

  it('settings are validated and clamped', () => {
    const s = new LocalStorageSaveStore();
    ls.setItem('everhunger.settings.v1', JSON.stringify({ masterVolume: 5, quality: 'ultra', touchMode: 'joystick', haptics: 'yes', sfxVolume: -1 }));
    const st = s.loadSettings();
    expect(st.masterVolume).toBe(1);
    expect(st.sfxVolume).toBe(0);
    expect(st.quality).toBe(defaultSettings().quality);
    expect(st.touchMode).toBe('joystick');
    expect(st.haptics).toBe(defaultSettings().haptics);
    s.saveSettings({ ...defaultSettings(), showFps: true });
    expect(s.loadSettings().showFps).toBe(true);
  });

  it('exports schema version 2', () => {
    expect(SAVE_SCHEMA_VERSION).toBe(2);
  });
});
