/** EVERHUNGER bootstrap. */
import { Game } from './core/Game';
import { createDefaultState } from './core/state';
import { installAutosave } from './core/autosave';
import type { GameState, Settings } from './core/state';
import { saveStore } from './core/save';
import { installDebug, readUrlOptions } from './core/debug';
import { input } from './core/input';
import { mountUI } from './ui';
import { AudioEngine } from './audio/AudioEngine';
import { validateContent } from './scales/validate';
import { TIER_COUNT } from './scales/registry';

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

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
  const hadSave = saveStore.hasSave();
  // With an existing save the title screen decides (Continue / New Game); until then don't overwrite it.
  const autosave = installAutosave(game, !hadSave || opts.tier !== undefined);

  // The Game's state object is readonly, so restore into it in place.
  const restore = (src: GameState) => {
    const keepSettings = game.state.settings;
    Object.assign(game.state, src, { settings: keepSettings });
  };

  window.addEventListener('everhunger:continue', () => {
    restore(saveStore.loadGame() ?? createDefaultState());
    game.refreshStats();
    const m = game.state.mass;
    game.enterTier(clamp(game.state.tierIndex, 1, TIER_COUNT), { viaShift: false, mass: m > 1 ? m : undefined });
    autosave.enable();
  });
  window.addEventListener('everhunger:newGame', () => {
    saveStore.clearSave();
    restore(createDefaultState());
    game.refreshStats();
    game.start(1);
    autosave.enable();
  });
  window.addEventListener('everhunger:settingsChanged', (e) => {
    const d = (e as CustomEvent<Settings | { settings: Settings } | undefined>).detail;
    const settings = d && 'settings' in d ? d.settings : (d as Settings | undefined);
    if (settings) saveStore.saveSettings(settings);
  });
  game.events.on('settingsChanged', ({ settings }) => saveStore.saveSettings(settings));

  game.start(startTier);
}

boot().catch((err) => {
  console.error(err);
  document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f66;position:fixed;top:0;left:0;padding:12px">EVERHUNGER failed to start:\n${String(err)}</pre>`);
});
