/** Autosave: persists the game on key events, throttled, and when the page is hidden/closed. */
import type { Game } from './Game';
import { events } from './events';
import { saveStore } from './save';

const THROTTLE_MS = 4000;
const PERIODIC_MS = 30000;

export interface Autosave {
  /** Allow writes (call once the session owns the state: after Continue / New Game / fresh start). */
  enable(): void;
  flush(): void;
  dispose(): void;
}

export function installAutosave(game: Game, startEnabled = true): Autosave {
  let enabled = startEnabled;
  let last = 0;
  let timer: number | undefined;

  const flush = () => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    
    if (!enabled) return; // never clobber an existing save with the untouched boot state
    const st = game.state;
    if (st.tierIndex === 1 && st.stats.eaten === 0 && st.essence === 0 && st.totalEssence === 0 && st.stats.playTimeSec < 1) return;
    last = performance.now();
    saveStore.saveGame(game.state);
  };
  const throttled = () => {
    if (timer !== undefined) return;
    const wait = Math.max(0, THROTTLE_MS - (performance.now() - last));
    timer = window.setTimeout(flush, wait);
  };

  const offs = [
    events.on('scaleShiftEnd', flush),
    events.on('tierEnter', throttled),
    events.on('essenceChanged', throttled),
    events.on('ngPlus', flush),
    events.on('pause', ({ paused }) => paused && flush()),
  ];
  const onHide = () => {
    if (document.visibilityState === 'hidden') flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', flush);
  const periodic = window.setInterval(throttled, PERIODIC_MS);

  const dispose = () => {
    offs.forEach((o) => o());
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', flush);
    clearInterval(periodic);
    if (timer !== undefined) clearTimeout(timer);
  };
  return {
    enable: () => {
      enabled = true;
    },
    flush,
    dispose,
  };
}
