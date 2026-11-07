/** EVERHUNGER bootstrap. */
import { Game } from './core/Game';
import { createDefaultState } from './core/state';
import { saveStore } from './core/save';
import { installDebug, readUrlOptions } from './core/debug';
import { input } from './core/input';
import { mountUI } from './ui';
import { AudioEngine } from './audio/AudioEngine';
import { validateContent } from './scales/validate';
import { TIER_COUNT } from './scales/registry';

async function boot() {
  const opts = readUrlOptions();
  const state = createDefaultState();
  state.settings = saveStore.loadSettings();
  if (opts.quality) state.settings.quality = opts.quality;
  if (opts.debug) state.settings.showFps = true;

  const app = await Game.createApp(document.getElementById('game')!);
  input.attach(app.canvas);
  const game = new Game(app, state, opts.seed);
  new AudioEngine(state.settings).init();
  mountUI(game, document.getElementById('ui-root')!);
  installDebug(game, opts.debugKeys);
  if (import.meta.env.DEV) validateContent();

  const startTier = opts.tier && opts.tier >= 1 && opts.tier <= TIER_COUNT ? Math.floor(opts.tier) : 1;
  game.start(startTier);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:fixed;top:0;left:0;padding:12px">EVERHUNGER failed to start:\n${String(err)}</pre>`);
});
