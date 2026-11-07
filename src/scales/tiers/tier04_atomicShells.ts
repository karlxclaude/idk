import { stubTier } from '../stubTier';

/**
 * Tier 4 - Atomic Shells (10⁻¹⁰ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'atomicShells',
  index: 4,
  name: 'Atomic Shells',
  scaleLabel: '10⁻¹⁰ m',
  scaleExponent: -10,
  colors: { top: 0x020818, bottom: 0x000310, center: 0x0b2a55, accent: 0x5ad1ff, glow: 0x9bf0ff, player: 0xe9fbff },
  music: { root: 'B', mode: 'lydian', tempo: 84, mood: 'Clean orbital chimes, electrons humming in quantised shells.' },
  abilityId: 'electronCloud',
  playerStage: 'blob',
  previousLabel: 'a forged nucleus',
  previousColors: [0x7fd4ff, 0xff6a5a],
  title: { subtitle: 'Electron Orbitals', flavor: 'Electrons hop between shells. Grab them mid-jump.' },
});
