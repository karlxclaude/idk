/**
 * Persistent game state + settings model. The save agent persists this via `save.ts`.
 * Everything here must stay JSON-serialisable.
 */
export interface Settings {
  masterVolume: number; // 0..1
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  /** Accessibility: tone down full-screen flashes and strobing. */
  reduceFlashing: boolean;
  /** Accessibility: disable/attenuate screen shake. */
  reduceShake: boolean;
  /** Render quality hint: 'low' disables shader backgrounds & lowers particle counts. */
  quality: 'low' | 'medium' | 'high';
  /** Touch steering: 'follow' = move toward finger; 'joystick' = relative drag from touch-down point. */
  touchMode: 'follow' | 'joystick';
  haptics: boolean;
  showFps: boolean;
  /** Mute all audio (honored by the audio engine if present). */
  muted?: boolean;
}

export interface GameStats {
  eaten: number;
  deaths: number;
  playTimeSec: number;
  biggestEatRatio: number;
}

export interface GameState {
  version: 1;
  /** 1-based tier index currently being played. */
  tierIndex: number;
  /** Player mass inside the current tier (1 = tier start). */
  mass: number;
  /** Currency for upgrades. */
  essence: number;
  totalEssence: number;
  /** upgradeId -> level. Read by computeStats() (src/core/stats.ts). */
  ownedUpgrades: Record<string, number>;
  /** Ability ids the player owns beyond the tier ability (bound to ability2..4 in order). */
  ownedAbilities: string[];
  /** Highest tier index ever reached (Scale Map unlocks). */
  maxTierReached: number;
  /** Tier indexes unlocked (for Scale Map / title screen). */
  unlockedTiers: number[];
  /** New Game+ cycle count (incremented when the final tier loops to tier 1). */
  ngPlus: number;
  settings: Settings;
  stats: GameStats;
}

export function defaultSettings(): Settings {
  return {
    masterVolume: 0.8,
    musicVolume: 0.7,
    sfxVolume: 0.8,
    reduceFlashing: false,
    reduceShake: false,
    quality: 'high',
    touchMode: 'follow',
    haptics: true,
    showFps: false,
  };
}

export function createDefaultState(): GameState {
  return {
    version: 1,
    tierIndex: 1,
    mass: 1,
    essence: 0,
    totalEssence: 0,
    ownedUpgrades: {},
    ownedAbilities: [],
    maxTierReached: 1,
    unlockedTiers: [1],
    ngPlus: 0,
    settings: defaultSettings(),
    stats: { eaten: 0, deaths: 0, playTimeSec: 0, biggestEatRatio: 0 },
  };
}
