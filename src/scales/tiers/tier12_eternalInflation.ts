import { stubTier } from '../stubTier';

/**
 * Tier 12 - Eternal Inflation (beyond 10²⁷ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'eternalInflation',
  index: 12,
  name: 'Eternal Inflation',
  scaleLabel: 'beyond 10²⁷ m',
  scaleExponent: 30,
  colors: { top: 0x0a0a14, bottom: 0x000000, center: 0x2a2a4a, accent: 0xffffff, glow: 0xff9bf0, player: 0xffffff },
  music: { root: 'C', mode: 'chromatic', tempo: 120, mood: 'Prismatic, fractal, infinite: every previous theme layered and folded.' },
  abilityId: 'bubbleNucleation',
  playerStage: 'fractal',
  previousLabel: 'an entire observable universe',
  previousColors: [0xffa86b, 0xff5f5f],
  title: { subtitle: 'The Multiverse', flavor: 'Bubble universes foam endlessly. Eat them all - and begin again.' },
});
