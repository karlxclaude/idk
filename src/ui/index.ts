/** UI entry point: mounts DOM overlays. */
import type { Game } from '../core/Game';
import { injectTheme } from './dom';
import { mountHud } from './hud';
import { mountTitleCard } from './titleCard';
import { mountMenus } from './menus';
import { mountTitleScreen } from './title';
import { mountShop } from './shop';

export function mountUI(game: Game, root: HTMLElement) {
  injectTheme();
  mountHud(game, root);
  mountTitleCard(root, game);
  mountMenus(game, root);
  const title = mountTitleScreen(game, root);
  const shop = mountShop(game, root);
  window.addEventListener('everhunger:openShop', () => shop.open());
  window.addEventListener('everhunger:openTitle', () => title.show());
}
