import { defineTier } from '../types';

/** Tier 1 - Elemental (10^-10 m). Electrons, photons and atoms of the periodic table. */
export default defineTier({
  id: 'elemental',
  index: 1,
  name: 'Elemental',
  scaleLabel: '10⁻¹⁰ m',
  scaleExponent: -10,
  palette: {
    bgTop: 0x050822,
    bgBottom: 0x01040f,
    bgCenter: 0x14205a,
    fog: 0x0a1236,
    fogAlpha: 0.3,
    accent: 0x7ad7ff,
    glow: 0xb59bff,
    player: 0xeef8ff,
    playerGlow: 0x5ab8ff,
    particles: [0x7ad7ff, 0xb59bff],
  },
  background: [
    { type: 'gradient', depth: 0, alpha: 0.5 },
    { type: 'nebula', depth: 0.12, colors: [0x14205a, 0x2a4fa8, 0x8f6bff], alpha: 0.55, scale: 1.1, speed: 1.2 },
    { type: 'blobs', depth: 0.08, density: 4, alpha: 0.12, colors: [0x3a5bd8, 0x7a3bd8] },
    { type: 'dots', depth: 0.3, color: 0x8fb8ff, density: 1.1, alpha: 0.5, blend: 'add', params: { twinkle: 0.3 } },
    { type: 'sparks', depth: 0.5, colors: [0x7ad7ff, 0xffffff, 0xb59bff], alpha: 0.6, params: { count: 50, size: [1.5, 3.5], drift: 5, flicker: 0.8 } },
  ],
  ambient: [
    { count: 36, colors: [0x7ad7ff, 0xb59bff], size: [2, 5], drift: 9, flicker: 0.6, depth: 0.7 },
    { count: 10, colors: [0xdfe8ff], size: [3, 7], drift: 14, flicker: 0.4, depth: 1.4, alpha: 0.45 },
  ],
  music: {
    root: 'B', octave: 2, mode: 'lydian', tempo: 72,
    timbre: { pad: 'sine', bass: 'sine', lead: 'triangle', texture: 'noise', perc: 'click' },
    mood: 'Clean crystalline chimes; electrons humming in quantised shells.',
    layers: ['drone', 'shimmer', 'pulse', 'arp'],
    reverb: 0.7,
  },
  spawns: [
    { archetype: 't01_electron', count: 18, size: [0.18, 0.45] },
    { archetype: 't01_photon', count: 12, size: [0.12, 0.24], group: { size: [4, 7], spread: 3 } },
    { archetype: 't01_lightAtom', count: 8, size: [0.5, 0.85] },
    { archetype: 't01_midAtom', count: 4, size: [0.92, 1.1], progress: [0.05, 1] },
    { archetype: 't01_ion', count: 2, size: [1.2, 1.7], progress: [0.1, 1] },
    { archetype: 't01_heavyAtom', count: 2, size: [1.5, 2.4], progress: [0.15, 1] },
  ],
  hazards: [{ archetype: 't01_radioactive', count: 1, size: [1.8, 2.6], progress: [0.35, 1] }],
  mechanics: [{ id: 'ionize' }],
  abilityId: 'quantumLeap',
  playerStage: 'blob',
  growthTarget: 16,
  nutrition: 0.5,
  previousSpeck: {
    // Only used in NG+ (final tier → 1): the multiverse you just ate, as a glittering speck.
    count: 2,
    size: [0.3, 0.5],
    label: 'a bubble universe',
    colors: [0xffffff, 0xffd6f5],
    nutritionMul: 1.5,
    essence: 3,
  },
  titleCard: {
    title: 'Elemental',
    subtitle: 'The Periodic Sea',
    flavor: 'Strip their electrons. Crack their shells. Swallow the elements.',
  },
});
