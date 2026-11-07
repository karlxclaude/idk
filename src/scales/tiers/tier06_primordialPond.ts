import { stubTier } from '../stubTier';

/**
 * Tier 6 - Primordial Pond (10⁻⁵ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'primordialPond',
  index: 6,
  name: 'Primordial Pond',
  scaleLabel: '10⁻⁵ m',
  scaleExponent: -5,
  colors: { top: 0x061a08, bottom: 0x020a04, center: 0x1d4a1a, accent: 0xa8ff60, glow: 0x3fd9a0, player: 0xf2ffe0 },
  music: { root: 'G', mode: 'dorian', tempo: 76, mood: 'Warm murky water, slow organic pulses, first life.' },
  abilityId: 'flagellumBurst',
  playerStage: 'cell',
  previousLabel: 'a tangle of molecules',
  previousColors: [0x5dffb0, 0xff7ad9],
  title: { subtitle: 'First Life', flavor: 'Cells, flagella and the first hunger.' },
});
