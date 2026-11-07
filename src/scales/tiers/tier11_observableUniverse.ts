import { stubTier } from '../stubTier';

/**
 * Tier 11 - Observable Universe (10²⁶ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'observableUniverse',
  index: 11,
  name: 'Observable Universe',
  scaleLabel: '10²⁶ m',
  scaleExponent: 26,
  colors: { top: 0x1a0a05, bottom: 0x050100, center: 0x4a1a0a, accent: 0xffa86b, glow: 0xff5f5f, player: 0xfff0e6 },
  music: { root: 'C', mode: 'aeolian', tempo: 50, mood: 'The whole cosmos breathing: CMB hiss, colossal swells.' },
  abilityId: 'inflationPulse',
  playerStage: 'cosmicEntity',
  previousLabel: 'a strand of the cosmic web',
  previousColors: [0x7aa8ff, 0xb07aff],
  title: { subtitle: 'Everything Visible', flavor: 'The edge of everything ever seen. Then: further.' },
});
