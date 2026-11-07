import { stubTier } from '../stubTier';

/**
 * Tier 5 - Living Shore (10² m). STUB: playable with generic archetypes.
 * Content agent: replace with a full defineTier({...}) + tier-specific archetypes/mechanics.
 */
export default stubTier({
  id: 'livingShore',
  index: 5,
  name: 'Living Shore',
  scaleLabel: '10² m',
  scaleExponent: 2,
  colors: { top: 0x2a1a3a, bottom: 0x0a1a2a, center: 0x6b3a4a, accent: 0xffc36b, glow: 0x6bd3ff, player: 0xfff3e0 },
  music: { root: 'A', mode: 'ionian', tempo: 100, mood: 'Sunset surf, gulls, bright wave swells.' },
  abilityId: 'tidalSurge',
  playerStage: 'creature',
  previousLabel: 'a glowing abyssal fish',
  previousColors: [0x3ff5ff, 0x1b6bff],
  title: { subtitle: 'Where Sea Meets Land', flavor: 'The tide brings food. And bigger mouths.' },
});
