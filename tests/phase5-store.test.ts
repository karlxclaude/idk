// UI store, saves and unit formatters (node env; Dexie runs on fake-indexeddb).
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { isShiftDay } from '../engine/jobs';
import { getDb, exportSave, importSave, listSaves, loadSave, saveGame, autosave, deleteSave } from '../ui/saves';
import { useStore } from '../ui/store';
import { fmtLoad, fmtMass, fmtMoney, fmtPct, fmtTime, kgToLb } from '../ui/units';

const st = () => useStore.getState();

const settle = () => new Promise((r) => setTimeout(r, 25));

beforeEach(async () => {
  await getDb().saves.clear();
  st().actions.newGame({ archetypeId: 'desk_worker', seed: 'store-test' });
});

// The store autosaves fire-and-forget; let it finish before the next test clears the table.
afterEach(settle);

describe('store', () => {
  it('newGame then advance(7) changes the day', () => {
    st().actions.updatePlan({ job: null });
    expect(st().game?.character.day).toBe(0);
    const out = st().actions.advance(7, { stopOnEvents: false });
    expect(out).toHaveLength(7);
    expect(st().game?.character.day).toBe(7);
    expect(st().lastResults).toHaveLength(7);
    expect(st().screen).toBe('dashboard');
  });

  it('pauses on the first shift day of an unplayed job until completeShift', () => {
    const game = st().game!;
    expect(game.plan.job).not.toBeNull();
    expect(isShiftDay(game.plan.job!.id, 0)).toBe(true);
    const v0 = st().version;
    expect(st().actions.advance(7, { stopOnEvents: false })).toEqual([]);
    expect(st().pendingShift).toMatchObject({ day: 0, jobId: game.plan.job!.id, remaining: 7 });
    expect(st().game?.character.day).toBe(0);
    expect(st().screen).toBe('minigame');
    expect(st().version).toBeGreaterThan(v0);
    // further advances are refused while a shift is pending
    expect(st().actions.advance(1)).toEqual([]);
    expect(st().game?.character.day).toBe(0);

    st().actions.completeShift(0.8);
    expect(st().pendingShift).toBeNull();
    expect(st().game?.jobHistory[game.plan.job!.id]).toEqual({ plays: 1, sumPerformance: 0.8 });
    expect(st().game?.character.day).toBeGreaterThanOrEqual(1);
  });
});

describe('saves', () => {
  it('round-trips state through Dexie and export/import', async () => {
    st().actions.updatePlan({ job: null });
    st().actions.advance(3, { stopOnEvents: false });
    const game = st().game!;
    const id = await saveGame('slot a', game);
    // JSON-normalised: the engine may produce -0, which JSON turns into 0.
    expect(await loadSave(id)).toEqual(JSON.parse(JSON.stringify(game)));
    expect((await listSaves()).map((s) => s.name)).toContain('slot a');
    expect(await saveGame('slot a', game)).toBe(id);
    expect(importSave(exportSave(game))).toEqual(JSON.parse(JSON.stringify(game)));
    expect(() => importSave('{"nope":1}')).toThrow();
    expect(() => importSave('not json')).toThrow();
    await deleteSave(id);
    expect(await loadSave(id)).toBeNull();
  });

  it('autosave keeps a single slot, rewritten once 7 in-game days have passed', async () => {
    st().actions.updatePlan({ job: null });
    const slot = async () => (await listSaves()).filter((x) => x.name === 'Autosave');
    st().actions.advance(3, { stopOnEvents: false });
    await settle();
    expect((await slot()).map((x) => x.day)).toEqual([3]);
    st().actions.advance(4, { stopOnEvents: false });
    await settle();
    expect((await slot()).map((x) => x.day)).toEqual([3]);
    expect(await autosave(st().game!)).toBe(false);
    st().actions.advance(3, { stopOnEvents: false });
    await settle();
    expect((await slot()).map((x) => x.day)).toEqual([10]);
  });
});

describe('units', () => {
  it('converts kg to lb', () => {
    expect(kgToLb(100)).toBeCloseTo(220.462, 2);
    expect(fmtMass(100, 'kg')).toBe('100 kg');
    expect(fmtMass(100, 'lb')).toBe('220.5 lb');
    expect(fmtLoad(102.5, 'kg')).toBe('102.5 kg');
    expect(fmtLoad(100, 'lb')).toBe('220 lb');
  });
  it('formats money, percent, time', () => {
    expect(fmtMoney(1234.4)).toBe('$1,234');
    expect(fmtMoney(-12)).toBe('-$12');
    expect(fmtPct(0.185, 1)).toBe('18.5%');
    expect(fmtTime(7.5)).toBe('07:30');
  });
});
