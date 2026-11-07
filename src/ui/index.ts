/** UI entry point: mounts DOM overlays. OWNED BY THE UI AGENT (package b). */
import type { Game } from '../core/Game';
import { mountHud } from './hud';
import { mountTitleCard } from './titleCard';

export function mountUI(game: Game, root: HTMLElement) {
  mountHud(game, root);
  mountTitleCard(root);
}
