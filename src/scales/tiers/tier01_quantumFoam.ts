import { defineTier } from '../types';

/** Tier 1 - Quantum Foam (10^-35 m). Flickering virtual particles in a violet/teal shimmering void. */
export default defineTier({
  id: 'quantumFoam',
  index: 1,
  name: 'Quantum Foam',
  scaleLabel: '10⁻³⁵ m',
  scaleExponent: -35,
  palette: {
    bgTop: 0x0a0322,
    bgBottom: 0x010a14,
    bgCenter: 0x2a0f55,
    fog: 0x120830,
    fogAlpha: 0.3,
    accent: 0xb59bff,
    glow: 0x47f5e0,
    player: 0xefe6ff,
    playerGlow: 0x9d7bff,
    particles: [0x47f5e0, 0xc39bff],
  },
  background: [
    { type: 'gradient', depth: 0, alpha: 0.5 },
    { type: 'nebula', depth: 0.12, colors: [0x2a0f55, 0x0e6b74, 0x9d7bff], alpha: 0.6, scale: 1.2, speed: 1.6 },
    { type: 'blobs', depth: 0.08, density: 4, alpha: 0.12, colors: [0x5a2bd8, 0x1fa89a] },
    { type: 'dots', depth: 0.3, color: 0x8f7bff, density: 1.1, alpha: 0.55, blend: 'add', params: { twinkle: 0.4 } },
    { type: 'sparks', depth: 0.5, colors: [0x47f5e0, 0xc39bff, 0xffffff], alpha: 0.7, params: { count: 60, size: [1.5, 3.5], drift: 4, flicker: 0.95 } },
  ],
  ambient: [
    { count: 40, colors: [0x47f5e0, 0xc39bff], size: [2, 5], drift: 8, flicker: 0.9, depth: 0.7 },
    { count: 12, colors: [0xd9c9ff], size: [3, 7], drift: 14, flicker: 0.8, depth: 1.4, alpha: 0.45 },
  ],
  music: {
    root: 'C#', octave: 2, mode: 'wholeTone', tempo: 60,
    timbre: { pad: 'sine', bass: 'sine', lead: 'triangle', texture: 'noise', perc: 'click' },
    mood: 'Weightless and unstable: shimmering static, notes that pop in and out of existence.',
    layers: ['drone', 'shimmer', 'pulse', 'arp'],
    reverb: 0.8,
  },
  spawns: [
    { archetype: 't01_virtualParticle', count: 16, size: [0.2, 0.55] },
    { archetype: 't01_stringlet', count: 12, size: [0.13, 0.26], group: { size: [4, 7], spread: 3 } },
    { archetype: 't01_foamBubble', count: 7, size: [0.5, 0.85] },
    { archetype: 't01_quantumKnot', count: 3, size: [0.92, 1.06], progress: [0.05, 1] },
    { archetype: 't01_planckKnot', count: 2, size: [1.4, 2.4], progress: [0.12, 1] },
  ],
  hazards: [{ archetype: 't01_falseVacuum', count: 1, size: [1.8, 2.8], progress: [0.35, 1] }],
  mechanics: [{ id: 'virtualPairs' }],
  abilityId: 'quantumTunnel',
  playerStage: 'blob',
  growthTarget: 16,
  nutrition: 0.5,
  previousSpeck: {
    // Only used in NG+ (tier 15 → 1): the multiverse you just ate, as specks of foam.
    count: 2,
    size: [0.3, 0.5],
    label: 'a bubble universe',
    colors: [0xffffff, 0xffd6f5],
    nutritionMul: 1.5,
    essence: 3,
  },
  titleCard: {
    title: 'Quantum Foam',
    subtitle: 'The Planck Scale',
    flavor: 'Spacetime boils. You are a flicker that refused to vanish.',
  },
});
