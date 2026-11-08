/** Title screen: DOM foreground + zooming Canvas2D background. */
import type { Game } from '../../core/Game';
import { saveStore } from '../../core/save';
import { TitleBackground } from './background';

const CSS = `
.eh-title{position:fixed;inset:0;z-index:50;pointer-events:auto;display:none;flex-direction:column;align-items:center;justify-content:center;
 color:#fff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;text-align:center;padding:16px;box-sizing:border-box;
 overflow:hidden;touch-action:manipulation;user-select:none}
.eh-title.on{display:flex}
.eh-title canvas{position:absolute;inset:0;width:100%;height:100%;z-index:0}
.eh-title .eh-fg{position:relative;z-index:1;display:flex;flex-direction:column;align-items:center;gap:clamp(14px,3vh,28px);width:100%}
.eh-logo{margin:0;font-size:clamp(34px,10.5vw,120px);font-weight:900;letter-spacing:.06em;line-height:1;white-space:nowrap}
.eh-logo span{display:inline-block;color:#fff;text-shadow:0 0 12px #7fe4ff,0 0 34px #4a8cff,0 0 70px #a050ff;
 animation:eh-shim 4s ease-in-out infinite;animation-delay:calc(var(--i)*.18s)}
.eh-calm .eh-logo span{animation:none}
@keyframes eh-shim{0%,100%{filter:brightness(1);transform:translateY(0)}50%{filter:brightness(1.5) hue-rotate(40deg);transform:translateY(-3px)}}
.eh-tag{margin:0;font-size:clamp(13px,3.6vw,22px);opacity:.85;letter-spacing:.04em;text-shadow:0 0 10px #000}
.eh-btns{display:flex;flex-direction:column;gap:12px;width:min(320px,86vw)}
.eh-btns button{min-height:50px;font:600 18px system-ui,sans-serif;color:#fff;background:rgba(10,14,34,.55);
 border:1px solid rgba(160,200,255,.5);border-radius:12px;cursor:pointer;backdrop-filter:blur(4px);
 transition:background .15s,box-shadow .15s,transform .1s}
.eh-btns button:hover,.eh-btns button:focus-visible{background:rgba(70,110,220,.5);box-shadow:0 0 18px rgba(120,170,255,.6);outline:none}
.eh-btns button:active{transform:scale(.97)}
.eh-btns button.primary{background:rgba(60,110,230,.6);border-color:#9cc8ff}
.eh-row{display:flex;gap:12px}.eh-row button{flex:1}
`;

export function mountTitleScreen(game: Game, root: HTMLElement): { show(): void; hide(): void } {
  if (!document.getElementById('eh-title-css')) {
    const st = document.createElement('style');
    st.id = 'eh-title-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.className = 'eh-title';
  const letters = [...'EVERHUNGER'].map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  el.innerHTML = `<canvas></canvas><div class="eh-fg">
    <h1 class="eh-logo" aria-label="EVERHUNGER">${letters}</h1>
    <p class="eh-tag">From atoms to the multiverse. Eat everything.</p>
    <div class="eh-btns">
      <button class="primary" data-a="continue">Continue</button>
      <button class="primary" data-a="new">New Game</button>
      <div class="eh-row"><button data-a="map">Scale Map</button><button data-a="settings">Settings</button></div>
    </div></div>`;
  root.appendChild(el);

  const canvas = el.querySelector('canvas') as HTMLCanvasElement;
  const btn = (a: string) => el.querySelector(`[data-a="${a}"]`) as HTMLButtonElement;
  let bg: TitleBackground | null = null;
  let visible = false;
  let wasPaused = false;

  const hasSave = (): boolean => {
    try {
      const s = saveStore as unknown as Record<string, unknown>;
      if (typeof s.hasSave === 'function') return !!(s.hasSave as () => boolean)();
      if (typeof s.exists === 'function') return !!(s.exists as () => boolean)();
      return saveStore.load() != null;
    } catch {
      return false;
    }
  };

  const hide = () => {
    if (!visible) return;
    visible = false;
    el.classList.remove('on');
    bg?.stop();
    bg = null;
    if (!wasPaused) game.setPaused(false);
  };
  const show = () => {
    if (visible) return;
    visible = true;
    wasPaused = game.loop.paused;
    wasPaused = false; // title always resumes the game when dismissed
    game.setPaused(true);
    const calm = !!game.state.settings.reduceFlashing;
    el.classList.toggle('eh-calm', calm);
    btn('continue').style.display = hasSave() ? '' : 'none';
    el.classList.add('on');
    bg = new TitleBackground(canvas, calm);
    bg.start();
    (btn('continue').style.display === 'none' ? btn('new') : btn('continue')).focus({ preventScroll: true });
  };

  const fire = (name: string) => window.dispatchEvent(new CustomEvent(name));
  el.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    switch (b.dataset.a) {
      case 'continue':
        hide();
        fire('everhunger:continue');
        break;
      case 'new':
        hide();
        fire('everhunger:newGame');
        break;
      case 'map': fire('everhunger:openScaleMap'); break;
      case 'settings': fire('everhunger:openSettings'); break;
    }
  });
  return { show, hide };
}
