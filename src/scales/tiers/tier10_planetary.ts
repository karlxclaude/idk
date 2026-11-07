import { stubTier } from '../stubTier';

/**
 * Tier 10 - Planetary (10⁷ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'planetary',
  index: 10,
  name: 'Planetary',
  scaleLabel: '10⁷ m',
  scaleExponent: 7,
  colors: { top: 0x020a1a, bottom: 0x00030a, center: 0x0a2a4a, accent: 0x6bb8ff, glow: 0x7dffb0, player: 0xeaf6ff },
  music: { root: 'E', mode: 'lydian', tempo: 72, mood: 'Vast orbital pads, moons ticking like clocks.' },
  abilityId: 'tectonicQuake',
  playerStage: 'planet',
  previousLabel: 'a glittering city',
  previousColors: [0xffe066, 0xff4fa3],
  title: { subtitle: 'Worlds and Moons', flavor: 'Moons, asteroids, whole worlds in orbit.' },
});
