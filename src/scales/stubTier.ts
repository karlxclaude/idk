/**
 * Helper used by the STUB tiers 2-12 so the whole ladder is walkable. Content agents should
 * replace a stub's file with a full defineTier({...}) (like tier01) and their own archetypes.
 */
import { defineTier, type MusicMode, type TierConfig } from './types';

export interface StubTierInput {
  id: string;
  index: number;
  name: string;
  scaleLabel: string;
  scaleExponent: number;
  colors: { top: number; bottom: number; center: number; accent: number; glow: number; player: number };
  music: { root: string; mode: MusicMode; tempo: number; mood: string };
  abilityId: string;
  playerStage: string;
  previousLabel: string;
  previousColors: number[];
  title: { subtitle: string; flavor: string };
}

export function stubTier(i: StubTierInput): TierConfig {
  const c = i.colors;
  return defineTier({
    id: i.id,
    index: i.index,
    name: i.name,
    scaleLabel: i.scaleLabel,
    scaleExponent: i.scaleExponent,
    palette: {
      bgTop: c.top, bgBottom: c.bottom, bgCenter: c.center, fog: c.center, fogAlpha: 0.3,
      accent: c.accent, glow: c.glow, player: c.player, playerGlow: c.accent, particles: [c.accent, c.glow],
    },
    background: [
      { type: 'gradient', depth: 0, alpha: 0.5 },
      { type: 'nebula', depth: 0.12, colors: [c.center, c.glow, c.accent], alpha: 0.45, scale: 1.2 },
      { type: 'blobs', depth: 0.08, density: 4, alpha: 0.12, colors: [c.accent, c.glow] },
      { type: 'dots', depth: 0.3, color: c.accent, density: 1, alpha: 0.5, blend: 'add' },
    ],
    ambient: [
      { count: 30, colors: [c.accent, c.glow], size: [2, 5], drift: 10, flicker: 0.3, depth: 0.7 },
      { count: 8, colors: [c.player], size: [3, 7], drift: 16, flicker: 0.2, depth: 1.4, alpha: 0.4 },
    ],
    music: {
      root: i.music.root, octave: 2, mode: i.music.mode, tempo: i.music.tempo,
      timbre: { pad: 'sine', bass: 'triangle', lead: 'square' },
      mood: i.music.mood, layers: ['drone', 'bass', 'perc', 'lead'], reverb: 0.5,
    },
    spawns: [
      { archetype: 'generic_food', count: 18, size: [0.2, 0.55], colors: [c.accent, c.glow, c.player] },
      { archetype: 'generic_school', count: 12, size: [0.12, 0.25], group: { size: [4, 8], spread: 3 }, colors: [c.player, c.accent] },
      { archetype: 'generic_drifter', count: 6, size: [0.5, 0.85], colors: [c.glow], colors2: [c.accent] },
      { archetype: 'generic_big', count: 3, size: [0.9, 1.06], colors: [c.accent], colors2: [c.glow], progress: [0.05, 1] },
      { archetype: 'generic_predator', count: 2, size: [1.3, 2.3], progress: [0.1, 1] },
    ],
    hazards: [{ archetype: 'generic_hazard', count: 1, size: [1.8, 2.6], progress: [0.3, 1] }],
    mechanics: [],
    abilityId: i.abilityId,
    playerStage: i.playerStage,
    growthTarget: 14,
    nutrition: 0.5,
    previousSpeck: { count: 3, size: [0.3, 0.5], label: i.previousLabel, colors: i.previousColors, nutritionMul: 1.5, essence: 2 },
    titleCard: { title: i.name, subtitle: i.title.subtitle, flavor: i.title.flavor },
  });
}
