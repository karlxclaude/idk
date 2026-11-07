/**
 * Save/load. Versioned envelope { v, savedAt, game } stored in localStorage, settings stored separately.
 * Schema v2 (current). v1 = the raw GameState JSON under 'everhunger.save.v1' (migrated on read).
 * All storage access is try/catch-wrapped (private mode / quota / blocked storage).
 */
import { createDefaultState, defaultSettings, type GameState, type Settings } from './state';

export interface SaveStore {
  load(): GameState | null;
  save(state: GameState): void;
  clear(): void;
  loadSettings(): Settings;
  saveSettings(settings: Settings): void;
  hasSave(): boolean;
  loadGame(): GameState | null;
  saveGame(state: GameState): void;
  clearSave(): void;
  exportString(state?: GameState): string;
  importString(str: string): GameState | null;
}

export const SAVE_SCHEMA_VERSION = 2;
const KEY = 'everhunger.save.v2';
const LEGACY_KEY_V1 = 'everhunger.save.v1';
const SETTINGS_KEY = 'everhunger.settings.v1';
const MAX_TIER = 64; // sanity clamp only; Game clamps to TIER_COUNT

interface SaveEnvelope {
  v: number;
  savedAt: number;
  game: unknown;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const num = (x: unknown, def: number, min = -Infinity, max = Infinity): number =>
  typeof x === 'number' && Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
const int = (x: unknown, def: number, min: number, max: number): number => Math.floor(num(x, def, min, max));

/** Validate arbitrary data into a full GameState (settings excluded, those are stored separately). */
export function sanitizeGame(raw: unknown): GameState {
  const d = createDefaultState();
  if (!isObj(raw)) return d;
  d.tierIndex = int(raw.tierIndex, 1, 1, MAX_TIER);
  d.mass = num(raw.mass, 1, 1);
  d.essence = num(raw.essence, 0, 0);
  d.totalEssence = Math.max(d.essence, num(raw.totalEssence, d.essence, 0));
  if (isObj(raw.ownedUpgrades)) {
    for (const [k, v] of Object.entries(raw.ownedUpgrades)) {
      const lv = int(v, 0, 0, 9999);
      if (lv > 0) d.ownedUpgrades[k] = lv;
    }
  }
  if (Array.isArray(raw.ownedAbilities)) {
    d.ownedAbilities = [...new Set(raw.ownedAbilities.filter((a): a is string => typeof a === 'string'))];
  }
  d.maxTierReached = Math.max(d.tierIndex, int(raw.maxTierReached, 1, 1, MAX_TIER));
  const tiers = Array.isArray(raw.unlockedTiers)
    ? raw.unlockedTiers.map((t) => int(t, 0, 0, MAX_TIER)).filter((t) => t >= 1)
    : [];
  d.unlockedTiers = [...new Set([1, d.tierIndex, ...tiers])].sort((a, b) => a - b);
  d.ngPlus = int(raw.ngPlus, 0, 0, 9999);
  const s = isObj(raw.stats) ? raw.stats : {};
  d.stats = {
    eaten: num(s.eaten, 0, 0),
    deaths: num(s.deaths, 0, 0),
    playTimeSec: num(s.playTimeSec, 0, 0),
    biggestEatRatio: num(s.biggestEatRatio, 0, 0),
  };
  return d;
}

/** Migrate any known historical payload to the current envelope's `game` data. */
function migrate(parsed: unknown): GameState | null {
  if (!isObj(parsed)) return null;
  // v2+ envelope
  if (typeof parsed.v === 'number' && 'game' in parsed) {
    if (parsed.v > SAVE_SCHEMA_VERSION) return sanitizeGame(parsed.game); // newer save: best effort
    return sanitizeGame(parsed.game);
  }
  // v1: raw GameState
  if ('tierIndex' in parsed || 'ownedUpgrades' in parsed) return sanitizeGame(parsed);
  return null;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function fromBase64(s: string): string {
  const bin = atob(s.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function persistable(state: GameState): GameState {
  const { settings: _settings, ...rest } = state;
  return { ...rest, settings: defaultSettings() } as GameState;
}

export class LocalStorageSaveStore implements SaveStore {
  hasSave(): boolean {
    return this.loadGame() !== null;
  }

  loadGame(): GameState | null {
    for (const key of [KEY, LEGACY_KEY_V1]) {
      const raw = readKey(key);
      if (!raw) continue;
      try {
        const g = migrate(JSON.parse(raw));
        if (g) return g;
      } catch {
        /* corrupt - try next */
      }
    }
    return null;
  }

  saveGame(state: GameState): void {
    try {
      const env: SaveEnvelope = { v: SAVE_SCHEMA_VERSION, savedAt: Date.now(), game: persistable(state) };
      localStorage.setItem(KEY, JSON.stringify(env));
    } catch {
      /* storage blocked / full - ignore */
    }
  }

  clearSave(): void {
    try {
      localStorage.removeItem(KEY);
      localStorage.removeItem(LEGACY_KEY_V1);
    } catch {
      /* ignore */
    }
  }

  // Legacy SaveStore API (kept stable)
  load(): GameState | null {
    const g = this.loadGame();
    if (g) g.settings = this.loadSettings();
    return g;
  }
  save(state: GameState): void {
    this.saveGame(state);
  }
  clear(): void {
    this.clearSave();
  }

  loadSettings(): Settings {
    const base = defaultSettings();
    try {
      const raw = readKey(SETTINGS_KEY);
      if (!raw) return base;
      const p = JSON.parse(raw) as unknown;
      if (!isObj(p)) return base;
      const out = { ...base } as Record<string, unknown>;
      for (const k of Object.keys(base) as (keyof Settings)[]) {
        if (typeof p[k] === typeof base[k] && (typeof p[k] !== 'number' || Number.isFinite(p[k] as number))) out[k] = p[k];
      }
      const s = out as unknown as Settings;
      if (!['low', 'medium', 'high'].includes(s.quality)) s.quality = base.quality;
      if (!['follow', 'joystick'].includes(s.touchMode)) s.touchMode = base.touchMode;
      for (const k of ['masterVolume', 'musicVolume', 'sfxVolume'] as const) s[k] = Math.min(1, Math.max(0, s[k]));
      return s;
    } catch {
      return base;
    }
  }

  saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }

  /** base64(JSON envelope) for copy/paste backups. */
  exportString(state?: GameState): string {
    const g = state ?? this.loadGame();
    if (!g) return '';
    return toBase64(JSON.stringify({ v: SAVE_SCHEMA_VERSION, savedAt: Date.now(), game: persistable(g) } satisfies SaveEnvelope));
  }

  /** Parse + validate an export string. Returns the state (and stores it) or null if invalid. */
  importString(str: string): GameState | null {
    try {
      const g = migrate(JSON.parse(fromBase64(str)));
      if (!g) return null;
      this.saveGame(g);
      return g;
    } catch {
      return null;
    }
  }
}

export const saveStore: SaveStore = new LocalStorageSaveStore();
