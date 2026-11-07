import { stubTier } from '../stubTier';

/**
 * Tier 10 - Cosmic Web (10²⁴ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'cosmicWeb',
  index: 10,
  name: 'Cosmic Web',
  scaleLabel: '10²⁴ m',
  scaleExponent: 24,
  colors: { top: 0x02040f, bottom: 0x000004, center: 0x0a1a3a, accent: 0x7aa8ff, glow: 0xb07aff, player: 0xeaf0ff },
  music: { root: 'B', mode: 'wholeTone', tempo: 56, mood: 'Filament drones, dark-matter hum, glacial motion.' },
  abilityId: 'darkMatterTug',
  playerStage: 'cosmicEntity',
  previousLabel: 'a spiral galaxy',
  previousColors: [0xd89bff, 0xff6bd5],
  title: { subtitle: 'Filaments and Voids', flavor: 'Galaxy clusters strung on dark threads.' },
});
