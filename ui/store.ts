// Zustand store: the single source of truth for the UI. The engine mutates GameState in place, so after every
// mutation the store publishes a shallow copy and bumps `version`; screens memoize derived data on `version`.
import { create } from 'zustand';
import type { JobId } from '../data/jobs';
import type { SimContext } from '../engine/context';
import {
  advanceDay, buyCertification, buyHomeGym, buyLabTest, buyMembership, cancelMembership, checkPlan, ctxForGame, newGame as engineNewGame,
  setPlan, weeklyGroceryRun, type GamePlan, type GameState, type NewGameOptions, type PlanCheck, type SetPlanOptions,
} from '../engine/game';
import type { HomeGymTier, MembershipTier } from '../engine/economy';
import { canAutoResolve, isShiftDay, jobDef } from '../engine/jobs';
import type { LabResult, LabTestId } from '../engine/labTests';
import type { DayReport } from '../engine/types';
import { autosave } from './saves';
import type { ScreenId } from './screens/ids';
import type { Units } from './units';

export type ThemeSetting = 'system' | 'light' | 'dark';

export interface UiSettings {
  units: Units;
  /** Applies to NEW games only (a game keeps the mode it was created with: GameState.settings.accelerated). */
  accelerated: boolean;
  autoPlay: boolean;
  theme: ThemeSetting;
}

export interface PendingShift {
  /** Day index of the shift that waits for its mini-game. */
  day: number;
  jobId: JobId;
  /** Days of the interrupted advance still to run (this shift day included) once the shift is played. */
  remaining: number;
}

export type Result<T = void> = { ok: true; value: T } | { ok: false; error: string };

export type NewGameInput = Omit<NewGameOptions, 'seed'> & { seed?: string };

export interface AdvanceOptions {
  /** Stop after a day with an injury or an important event (default true). */
  stopOnEvents?: boolean;
}

export interface Actions {
  newGame(opts: NewGameInput): GameState;
  loadGame(state: GameState): void;
  /** Run up to n days. Pauses with `pendingShift` before a shift day of a job that was never played. Returns the days simulated. */
  advance(n: number, opts?: AdvanceOptions): DayReport[];
  /** Record the mini-game play (performance 0..1), simulate the pending shift day, then continue the interrupted advance. */
  completeShift(perf: number): DayReport[];
  /** Voluntarily play today's shift (only on a shift day). */
  playShift(): Result;
  /** Drop the pending shift without playing (the day is not simulated; advancing again asks again). */
  cancelShift(): void;
  setScreen(screen: ScreenId): void;
  updatePlan(patch: Partial<GamePlan>, opts?: SetPlanOptions): Result<PlanCheck>;
  buyLabTest(id: LabTestId): Result<LabResult>;
  buyMembership(tier: MembershipTier): Result;
  cancelMembership(tier: MembershipTier): Result;
  buyHomeGym(tier: HomeGymTier): Result;
  buyCertification(jobId: JobId): Result;
  weeklyGroceryRun(): Result<number>;
  setSettings(patch: Partial<UiSettings>): void;
  setAutoPlay(on: boolean): void;
  clearNotice(): void;
}

export interface StoreState {
  game: GameState | null;
  /** Bumped on every publish; the cheapest dependency for useMemo/useEffect. */
  version: number;
  screen: ScreenId;
  settings: UiSettings;
  pendingShift: PendingShift | null;
  /** Reports of the most recent advance (oldest first). */
  lastResults: DayReport[];
  /** Short message for the top bar (autoplay stopped, error, ...). */
  notice: string | null;
  actions: Actions;
}

// ---- helpers ---------------------------------------------------------------------------------------------

const SETTINGS_KEY = 'phenotype.settings';
const DEFAULT_SETTINGS: UiSettings = { units: 'kg', accelerated: false, autoPlay: false, theme: 'system' };

function loadSettings(): UiSettings {
  try {
    const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<UiSettings>), autoPlay: false };
  } catch { /* storage blocked: defaults */ }
  return { ...DEFAULT_SETTINGS };
}

function persistSettings(s: UiSettings): void {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...s, autoPlay: false })); } catch { /* ignore */ }
}

const ctxCache = new Map<boolean, SimContext>();
/** Cached SimContext per accelerated flag (built via ctxForGame; the engine keeps lazy caches inside it). */
export function getCtx(accelerated: boolean): SimContext {
  let c = ctxCache.get(accelerated);
  if (!c) { c = ctxForGame({ settings: { accelerated, units: 'kg' } }); ctxCache.set(accelerated, c); }
  return c;
}
/** The context a game must be run with. Never mix modes. */
export const ctxOf = (game: GameState): SimContext => getCtx(game.settings.accelerated);

const errMsg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const IMPORTANT_EVENT = /caught|recovered|injur|ill|sick/i;

/** Reason to stop fast-forwarding after this day, or null. */
export function importantReason(r: DayReport): string | null {
  if (r.injuries.length > 0) return `Injury on ${r.date}: ${r.injuries.join(', ')}`;
  const ev = r.events.find((e) => IMPORTANT_EVENT.test(e));
  return ev ? `${ev} (${r.date})` : null;
}

/** The job whose unplayed mini-game blocks today's shift, or null. */
function blockingShift(game: GameState): JobId | null {
  const job = game.plan.job;
  if (!job || !isShiftDay(job.id, game.character.day)) return null;
  return canAutoResolve(game.jobHistory, job.id) ? null : job.id;
}

function wrap<T>(fn: () => T): Result<T> {
  try { return { ok: true, value: fn() }; } catch (e) { return { ok: false, error: errMsg(e) }; }
}

function maybeAutosave(game: GameState): void {
  if (typeof indexedDB === 'undefined') return;
  autosave(game).catch(() => undefined);
}

// ---- store -----------------------------------------------------------------------------------------------

export const useStore = create<StoreState>()((set, get) => {
  const publish = (game: GameState, extra: Partial<StoreState> = {}): void => set((s) => ({ game: { ...game }, version: s.version + 1, ...extra }));

  /** Shared day loop. `firstPerf` plays the first day with a mini-game result (skipping the pending check). */
  function run(n: number, opts: AdvanceOptions, firstPerf?: number): DayReport[] {
    const { game } = get();
    if (!game) return [];
    const ctx = ctxOf(game);
    const stopOnEvents = opts.stopOnEvents ?? true;
    const out: DayReport[] = [];
    let pending: PendingShift | null = null;
    let notice: string | null = null;
    let stop = false;
    try {
      for (let i = 0; i < n; i++) {
        const perf = i === 0 ? firstPerf : undefined;
        const blocker = perf === undefined ? blockingShift(game) : null;
        if (blocker) { pending = { day: game.character.day, jobId: blocker, remaining: n - i }; break; }
        const report = advanceDay(ctx, game, perf === undefined ? {} : { jobPerformance: perf }).report;
        out.push(report);
        const why = importantReason(report);
        if (why) { notice = why; if (stopOnEvents) { stop = true; break; } }
      }
    } catch (e) {
      notice = `Stopped: ${errMsg(e)}`;
      stop = true;
    }
    if (pending) notice = `Shift on ${jobDef(pending.jobId).name} needs its mini-game before time can pass.`;
    const s = get();
    publish(game, {
      lastResults: out,
      pendingShift: pending,
      notice,
      screen: pending ? 'minigame' : s.screen,
      settings: pending || stop ? { ...s.settings, autoPlay: false } : s.settings,
    });
    maybeAutosave(game);
    return out;
  }

  const actions: Actions = {
    newGame(input) {
      const { settings } = get();
      const opts: NewGameOptions = {
        ...input,
        seed: input.seed ?? `${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`,
        accelerated: input.accelerated ?? settings.accelerated,
        units: input.units ?? settings.units,
      };
      const game = engineNewGame(getCtx(opts.accelerated ?? false), opts);
      publish(game, { screen: 'dashboard', pendingShift: null, lastResults: [], notice: null, settings: { ...settings, autoPlay: false, units: game.settings.units } });
      return game;
    },
    loadGame(state) {
      const s = get();
      publish(structuredClone(state), { screen: 'dashboard', pendingShift: null, lastResults: [], notice: null, settings: { ...s.settings, autoPlay: false, units: state.settings.units } });
    },
    advance(n, opts = {}) {
      if (get().pendingShift) return [];
      return run(n, opts);
    },
    completeShift(perf) {
      const { pendingShift, game } = get();
      if (!game || !pendingShift) return [];
      const remaining = pendingShift.remaining;
      if (game.character.day !== pendingShift.day) { set({ pendingShift: null }); return []; }
      set({ pendingShift: null });
      const first = run(1, {}, Math.min(1, Math.max(0, perf)));
      if (remaining > 1) return [...first, ...run(remaining - 1, {})];
      return first;
    },
    playShift() {
      const { game, pendingShift } = get();
      if (!game) return { ok: false, error: 'No game' };
      const job = game.plan.job;
      if (!job) return { ok: false, error: 'You have no job' };
      if (!isShiftDay(job.id, game.character.day)) return { ok: false, error: 'No shift today' };
      if (!pendingShift) set({ pendingShift: { day: game.character.day, jobId: job.id, remaining: 1 }, screen: 'minigame' });
      return { ok: true, value: undefined };
    },
    cancelShift() { set({ pendingShift: null, screen: 'dashboard' }); },
    setScreen(screen) { set({ screen }); },
    updatePlan(patch, opts) {
      const { game } = get();
      if (!game) return { ok: false, error: 'No game' };
      const r = wrap(() => setPlan(ctxOf(game), game, patch, opts));
      publish(game);
      return r;
    },
    buyLabTest(id) { return mutate((g) => buyLabTest(ctxOf(g), g, id)); },
    buyMembership(tier) { return mutate((g) => buyMembership(g, tier)); },
    cancelMembership(tier) { return mutate((g) => cancelMembership(g, tier)); },
    buyHomeGym(tier) { return mutate((g) => buyHomeGym(ctxOf(g), g, tier)); },
    buyCertification(jobId) { return mutate((g) => buyCertification(ctxOf(g), g, jobId)); },
    weeklyGroceryRun() { return mutate((g) => weeklyGroceryRun(ctxOf(g), g)); },
    setSettings(patch) {
      const s = get();
      const next = { ...s.settings, ...patch };
      persistSettings(next);
      // Units are mirrored into the game so saved files remember them. `accelerated` is deliberately NOT: it only seeds new games.
      if (s.game && patch.units && s.game.settings.units !== patch.units) { s.game.settings.units = patch.units; publish(s.game, { settings: next }); } else set({ settings: next });
    },
    setAutoPlay(on) {
      const { game, pendingShift, settings } = get();
      set({ settings: { ...settings, autoPlay: on && !!game && !pendingShift } });
    },
    clearNotice() { set({ notice: null }); },
  };

  function mutate<T>(fn: (g: GameState) => T): Result<T> {
    const { game } = get();
    if (!game) return { ok: false, error: 'No game' };
    const r = wrap(() => fn(game));
    publish(game);
    return r;
  }

  return {
    game: null, version: 0, screen: 'newGame', settings: loadSettings(), pendingShift: null, lastResults: [], notice: null, actions,
  };
});

// ---- selector hooks --------------------------------------------------------------------------------------

export const useGame = (): GameState | null => useStore((s) => s.game);
export const useVersion = (): number => useStore((s) => s.version);
export const useScreen = (): ScreenId => useStore((s) => s.screen);
export const useSettings = (): UiSettings => useStore((s) => s.settings);
export const usePendingShift = (): PendingShift | null => useStore((s) => s.pendingShift);
export const useLastResults = (): DayReport[] => useStore((s) => s.lastResults);
export const useNotice = (): string | null => useStore((s) => s.notice);
export const useActions = (): Actions => useStore((s) => s.actions);
/** SimContext matching the current game's mode (cached; null without a game). */
export const useCtx = (): SimContext | null => useStore((s) => (s.game ? ctxOf(s.game) : null));
/** Current in-game day index (0 without a game). */
export const useDay = (): number => useStore((s) => s.game?.character.day ?? 0);
export const useUnits = (): Units => useStore((s) => s.settings.units);
/** Non-reactive handle for tests/devtools. */
export const getState = (): StoreState => useStore.getState();
export { checkPlan };
