import { stubTier } from '../stubTier';

/**
 * Tier 8 - Stellar (10¹² m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'stellar',
  index: 8,
  name: 'Stellar',
  scaleLabel: '10¹² m',
  scaleExponent: 12,
  colors: { top: 0x1a0a02, bottom: 0x050100, center: 0x4a2a0a, accent: 0xffd36b, glow: 0xff8a3d, player: 0xfffbe8 },
  music: { root: 'D', mode: 'harmonicMinor', tempo: 80, mood: 'Blazing solar choirs, flare crackles.' },
  abilityId: 'solarFlare',
  playerStage: 'starCore',
  previousLabel: 'a blue marble planet',
  previousColors: [0x6bb8ff, 0x7dffb0],
  title: { subtitle: 'Stellar Nursery', flavor: 'Stars ignite and die. Eat them before they go nova.' },
});
