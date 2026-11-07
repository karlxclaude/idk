import { stubTier } from '../stubTier';

/**
 * Tier 2 - Molecular Reef (10⁻⁸ m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'molecularReef',
  index: 2,
  name: 'Molecular Reef',
  scaleLabel: '10⁻⁸ m',
  scaleExponent: -8,
  colors: { top: 0x02141a, bottom: 0x01060d, center: 0x0c4a4a, accent: 0x5dffb0, glow: 0xff7ad9, player: 0xeafff5 },
  music: { root: 'D', mode: 'mixolydian', tempo: 92, mood: 'Bubbly, crystalline, playful molecular clicks.' },
  abilityId: 'bondSnap',
  playerStage: 'cell',
  previousLabel: 'a glittering atom',
  previousColors: [0x5ad1ff, 0x9bf0ff],
  title: { subtitle: 'Chemistry Blooms', flavor: 'Bonds form and break. Swallow whole molecules.' },
});
