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
  const menus = mountMenus(game, root);
  const title = mountTitleScreen(game, root);
  const shop = mountShop(game, root);
  void shop; // shop listens for 'everhunger:openShop' itself
  window.addEventListener('everhunger:openTitle', () => title.show());
  // Title-screen buttons open these panels above the title overlay (z-index 50).
  window.addEventListener('everhunger:openScaleMap', () => { menus.map.el.style.zIndex = '70'; menus.openMap(); });
  window.addEventListener('everhunger:openSettings', () => { menus.settings.el.style.zIndex = '70'; menus.settings.open(); });
  // Show the title on boot unless a tier was forced via ?tier=N (dev/testing).
  if (!new URLSearchParams(location.search).has('tier')) title.show();
}
