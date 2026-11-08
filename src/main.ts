/** EVERHUNGER bootstrap. */
import { Game } from './Game';
import { input } from './core/input';
import { UI } from './ui/ui';

declare global { interface Window { __game?: Game } }

async function boot() {
  const app = await Game.createApp(document.getElementById('game')!);
  input.attach(app.canvas);
  const game = new Game(app);
  game.ui = new UI(game, document.getElementById('ui-root')!);
  game.audio.init();
  game.boot();
  window.__game = game;
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:fixed;top:0;left:0;padding:12px">EVERHUNGER failed to start:\n${String(err)}</pre>`);
});
