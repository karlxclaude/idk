import { stubTier } from '../stubTier';

/**
 * Tier 6 - Civilization (10⁴ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'civilization',
  index: 6,
  name: 'Civilization',
  scaleLabel: '10⁴ m',
  scaleExponent: 4,
  colors: { top: 0x0a0518, bottom: 0x020108, center: 0x2a0a3a, accent: 0xffe066, glow: 0xff4fa3, player: 0xfff8e0 },
  music: { root: 'C', mode: 'mixolydian', tempo: 118, mood: 'Neon city pulse, traffic arpeggios, sirens.' },
  abilityId: 'gridlock',
  playerStage: 'beast',
  previousLabel: 'a stretch of coastline',
  previousColors: [0xffc36b, 0x6bd3ff],
  title: { subtitle: 'The Neon Sprawl', flavor: 'Cars, towers, entire districts. Everything is edible eventually.' },
});
