import { stubTier } from '../stubTier';

/**
 * Tier 7 - The Abyss (10⁰ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'abyss',
  index: 7,
  name: 'The Abyss',
  scaleLabel: '10⁰ m',
  scaleExponent: 0,
  colors: { top: 0x01040f, bottom: 0x000105, center: 0x041a3a, accent: 0x3ff5ff, glow: 0x1b6bff, player: 0xd8fbff },
  music: { root: 'F', mode: 'aeolian', tempo: 64, mood: 'Crushing deep-sea dark, bioluminescent blips, whale-song pads.' },
  abilityId: 'bioluminescentLure',
  playerStage: 'creature',
  previousLabel: 'a microbe colony',
  previousColors: [0xa8ff60, 0x3fd9a0],
  title: { subtitle: 'Deep Sea', flavor: 'In the dark, light is a lie. Lure them in.' },
});
