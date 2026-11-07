/**
 * Save/load interface. OWNED BY THE SAVE AGENT (package d) - this is a minimal working stub.
 * Keep the `SaveStore` interface stable; swap the implementation freely (versioned migrations,
 * autosave cadence, cloud, export/import strings...).
 */
import { createDefaultState, defaultSettings, type GameState, type Settings } from './state';

export interface SaveStore {
  load(): GameState | null;
  save(state: GameState): void;
  clear(): void;
  loadSettings(): Settings;
  saveSettings(settings: Settings): void;
}

const KEY = 'everhunger.save.v1';
const SETTINGS_KEY = 'everhunger.settings.v1';

export class LocalStorageSaveStore implements SaveStore {
  load(): GameState | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<GameState>;
      const base = createDefaultState();
      return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } };
    } catch {
      return null;
    }
  }
  save(state: GameState): void {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* storage blocked / full - ignore */
    }
  }
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
  loadSettings(): Settings {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return { ...defaultSettings(), ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
    } catch {
      return defaultSettings();
    }
  }
  saveSettings(settings: Settings): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }
}

export const saveStore: SaveStore = new LocalStorageSaveStore();
