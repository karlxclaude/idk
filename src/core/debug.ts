/**
 * Debug tools for testers and agents.
 *   Keys:  ]  fill meter (forces a scale shift)   [  +20% of tier mass   \  jump to next tier (instant)
 *   URL:   ?tier=N   start at tier N        ?debug=1  show fps/entity count      ?seed=123  fixed RNG seed
 *          ?quality=low|medium|high          ?nodebugkeys=1  disable the hotkeys
 *   Console: window.__game (the Game instance)
 */
import type { Game } from './Game';
import { nextTierIndex } from '../scales/registry';

export function readUrlOptions() {
  const q = new URLSearchParams(location.search);
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : undefined);
  return {
    tier: num('tier'),
    seed: num('seed'),
    debug: q.has('debug'),
    quality: q.get('quality') as 'low' | 'medium' | 'high' | null,
    debugKeys: !q.has('nodebugkeys'),
  };
}

export function installDebug(game: Game, enabledKeys: boolean) {
  (window as unknown as { __game: Game }).__game = game;
  if (!enabledKeys) return;
  const { input } = game;
  input.onAction('debugFill', () => {
    if (game.shifting) return;
    game.player.setMass(game.tier.growthTarget);
  });
  input.onAction('debugMass', () => {
    if (game.shifting) return;
    game.player.grow((game.tier.growthTarget - 1) * 0.2, 0.5);
  });
  input.onAction('debugNextTier', () => {
    if (game.shifting) return;
    game.jumpToTier(nextTierIndex(game.tier.index));
  });
}
