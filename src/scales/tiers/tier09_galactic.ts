import { stubTier } from '../stubTier';

/**
 * Tier 9 - Galactic (10²¹ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'galactic',
  index: 9,
  name: 'Galactic',
  scaleLabel: '10²¹ m',
  scaleExponent: 21,
  colors: { top: 0x0d0418, bottom: 0x020006, center: 0x2a0a3a, accent: 0xd89bff, glow: 0xff6bd5, player: 0xfbeaff },
  music: { root: 'F#', mode: 'lydian', tempo: 66, mood: 'Slow spiral grandeur, shimmering starfield arps.' },
  abilityId: 'spiralArm',
  playerStage: 'starCore',
  previousLabel: 'a burning star',
  previousColors: [0xffd36b, 0xff8a3d],
  title: { subtitle: 'Spiral Arms', flavor: 'Galaxies wheel and collide. Swallow their cores.' },
});
