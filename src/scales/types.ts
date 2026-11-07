/**
 * TierConfig: the data-driven definition of one scale tier. One file per tier in
 * src/scales/tiers/ (auto-registered by registry.ts via import.meta.glob).
 *
 * Coordinates: every tier has its own local space; the player starts at radius 20 at (0,0).
 * `scaleExponent` = log10(meters) of that starting radius. Sizes in spawn entries are
 * RELATIVE to the player's current radius by default.
 */
import type { EntityArchetype } from '../entities/types';

export interface TierPalette {
  /** Background vertical gradient. */
  bgTop: number;
  bgBottom: number;
  /** Optional radial glow at screen centre of the gradient layer. */
  bgCenter?: number;
  fog: number;
  fogAlpha: number;
  /** UI/title accent. */
  accent: number;
  /** Generic glow colour for FX. */
  glow: number;
  /** Player body + glow colours. */
  player: number;
  playerGlow: number;
  /** Eat-particle colours (falls back to entity colour). */
  particles?: number[];
}

/** Built-in layer types: 'gradient' | 'nebula' | 'dots' | 'sparks' | 'blobs' (add more in scales/backgrounds/). */
export interface BackgroundLayerDef {
  type: string;
  /** Parallax depth: 0 = fixed to screen, 1 = moves with the world, >1 = foreground. */
  depth: number;
  color?: number;
  colors?: number[];
  alpha?: number;
  /** Layer-specific density (e.g. dots per 100x100 px). */
  density?: number;
  blend?: 'normal' | 'add' | 'screen';
  /** Feature scale multiplier. */
  scale?: number;
  /** Animation speed multiplier. */
  speed?: number;
  params?: Record<string, unknown>;
}

/** Foreground/background ambient particle field (rendered by the 'sparks' layer type). */
export interface AmbientParticleConfig {
  count: number;
  colors: number[];
  /** Size range in screen px. */
  size: [number, number];
  /** Drift speed px/s. */
  drift: number;
  /** 0 = steady, 1 = strong pop in/out flicker. */
  flicker: number;
  depth: number;
  alpha?: number;
  blend?: 'normal' | 'add';
}

export type MusicMode =
  | 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian'
  | 'harmonicMinor' | 'wholeTone' | 'pentatonicMajor' | 'pentatonicMinor' | 'chromatic';

/** Parameters for the adaptive music engine (audio agent interprets these). */
export interface MusicParams {
  /** Root note name, e.g. 'C', 'F#'. */
  root: string;
  octave: number;
  mode: MusicMode;
  tempo: number;
  /** Timbre hints per voice: oscillator type or a named patch the audio engine knows. */
  timbre: { pad?: string; bass?: string; lead?: string; perc?: string; texture?: string };
  /** Free text mood for the composer agent. */
  mood: string;
  /** Layer names that fade in with tier progress (0→1), e.g. ['drone','pulse','arp','lead']. */
  layers: string[];
  /** 0..1 reverb amount. */
  reverb?: number;
}

export interface SpawnEntry {
  archetype: string;
  /** Target number alive around the player. */
  count: number;
  /** Radius range; relative to current player radius unless sizeMode is 'absolute'. */
  size: [number, number];
  sizeMode?: 'relative' | 'absolute';
  /** Override archetype colours for this tier (lets generic archetypes be re-skinned). */
  colors?: number[];
  colors2?: number[];
  /** Only active while tier progress is within [from, to] (0..1). */
  progress?: [number, number];
  /** Spawn as a group (schools, pairs). */
  group?: { size: [number, number]; spread: number };
  nutritionMul?: number;
  essenceBonus?: number;
  data?: Record<string, unknown>;
}

/** How the conquered previous world appears in this tier as edible particles. */
export interface PreviousSpeckConfig {
  /** Number of extra "echo" specks kept around (the real snapshot speck spawns once at shift). */
  count: number;
  /** Relative size range. */
  size: [number, number];
  /** Label floated when eaten, e.g. "a quantum foam bubble". */
  label: string;
  colors: number[];
  nutritionMul: number;
  essence: number;
}

export interface MechanicRef {
  id: string;
  params?: Record<string, unknown>;
}

export interface TitleCard {
  title: string;
  subtitle?: string;
  flavor?: string;
}

export interface TierConfig {
  /** Stable id, e.g. 'quantumFoam'. */
  id: string;
  /** 1-based position on the ladder (unique, contiguous). */
  index: number;
  name: string;
  /** Human label, e.g. '10^-35 m'. */
  scaleLabel: string;
  /** log10(meters) of the player's starting radius. */
  scaleExponent: number;
  palette: TierPalette;
  /** 4-6 parallax layers, back to front. */
  background: BackgroundLayerDef[];
  /** Ambient particles; depth <= 1 renders behind the world, > 1 in front. */
  ambient: AmbientParticleConfig[];
  music: MusicParams;
  spawns: SpawnEntry[];
  /** Hazards - same format as spawns, conventionally archetypes with edible 'never'. */
  hazards: SpawnEntry[];
  /** Tier-specific systems (gluon strings, fusion...) from src/scales/mechanics/. */
  mechanics?: MechanicRef[];
  /** Ability bound to the 'ability1' action in this tier (src/abilities/defs/). */
  abilityId: string;
  /** Player appearance stage id (src/entities/appearances/). */
  playerStage: string;
  /** Mass needed to fill the size meter (player starts at mass 1, radius = 20*sqrt(mass)). */
  growthTarget: number;
  /** Tier-wide nutrition multiplier (default 0.5). */
  nutrition?: number;
  eatRatio?: number;
  dangerRatio?: number;
  previousSpeck: PreviousSpeckConfig;
  titleCard: TitleCard;
  /** Optional tier-local archetypes (registered automatically at boot). */
  archetypes?: EntityArchetype[];
  maxEntities?: number;
}

export const defineTier = (t: TierConfig) => t;
