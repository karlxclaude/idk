/** Grants a tier's ability permanently once that tier is completed. */
import type { Game } from '../core/Game';
import { abilityRegistry } from '../abilities/registry';
import { events } from '../core/events';

const installed = new WeakSet<Game>();

export function installProgression(game: Game) {
  if (installed.has(game)) return;
  installed.add(game);
  events.on('scaleShiftEnd', ({ from }) => {
    const id = from.abilityId;
    const owned = game.state.ownedAbilities;
    if (id && abilityRegistry.has(id) && !owned.includes(id)) {
      owned.push(id);
      window.dispatchEvent(new CustomEvent('everhunger:abilityGranted', { detail: { id } }));
    }
  });
}
