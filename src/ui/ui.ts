/** DOM overlay: title, HUD, pause and death screens. Every screen change is an eased fade. */
import type { Game } from '../Game';

const CSS = `
#ui-root { font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: #dff5ea; }
#ui-root .screen { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
  text-align: center; padding: 24px; opacity: 0; transform: scale(1.035); pointer-events: none;
  transition: opacity .75s cubic-bezier(.4,0,.2,1), transform .75s cubic-bezier(.4,0,.2,1); }
#ui-root .screen.on { opacity: 1; transform: none; pointer-events: auto; }
#ui-root .screen.dim { background: radial-gradient(ellipse at center, rgba(3,12,10,.35), rgba(3,12,10,.75)); }
#ui-root h1 { font-size: clamp(42px, 9vw, 92px); letter-spacing: .18em; margin: 0; font-weight: 300;
  text-shadow: 0 0 24px rgba(120,240,200,.45), 0 0 60px rgba(80,200,160,.25); }
#ui-root h2 { font-size: clamp(28px, 6vw, 48px); letter-spacing: .12em; margin: 0 0 12px; font-weight: 300; }
#ui-root .sub { opacity: .75; letter-spacing: .25em; text-transform: uppercase; font-size: 13px; margin: 10px 0 34px; }
#ui-root .hint { opacity: .55; font-size: 13px; max-width: 420px; line-height: 1.6; margin-top: 28px; }
#ui-root button { appearance: none; border: 1px solid rgba(170,245,220,.45); background: rgba(40,120,100,.25); color: #e8fff5;
  font: inherit; font-size: 16px; letter-spacing: .2em; text-transform: uppercase; padding: 14px 34px; border-radius: 999px; margin: 6px;
  cursor: pointer; backdrop-filter: blur(6px); transition: background .3s, transform .3s, box-shadow .3s; min-width: 200px; }
#ui-root button:hover { background: rgba(60,170,140,.35); box-shadow: 0 0 24px rgba(120,240,200,.25); transform: translateY(-1px); }
#ui-root button:active { transform: scale(.97); }
#ui-root .hud { position: absolute; left: max(16px, env(safe-area-inset-left)); right: max(16px, env(safe-area-inset-right)); top: max(14px, env(safe-area-inset-top));
  display: flex; justify-content: space-between; align-items: flex-start; opacity: 0; transition: opacity .9s ease; pointer-events: none; }
#ui-root .hud.on { opacity: 1; }
#ui-root .hud .stats { display: flex; flex-direction: column; gap: 4px; font-size: 13px; letter-spacing: .08em; text-shadow: 0 1px 6px rgba(0,0,0,.6); }
#ui-root .hud .stats b { font-weight: 500; font-size: 20px; letter-spacing: .04em; }
#ui-root .hud .stats .meter { width: 120px; height: 4px; border-radius: 2px; background: rgba(255,255,255,.14); overflow: hidden; margin-top: 4px; }
#ui-root .hud .stats .meter i { display: block; height: 100%; width: 0; background: linear-gradient(90deg, #52c9a1, #b8ffe3); transition: width .4s ease; }
#ui-root .hud .pbtn { pointer-events: auto; min-width: 0; width: 44px; height: 44px; padding: 0; border-radius: 50%; font-size: 14px; letter-spacing: 0; display: grid; place-items: center; }
#ui-root .toast { position: absolute; left: 50%; top: 18%; transform: translate(-50%, 10px); opacity: 0; letter-spacing: .3em; text-transform: uppercase; font-size: 14px;
  text-shadow: 0 0 18px rgba(120,240,200,.5); transition: opacity .8s ease, transform .8s ease; pointer-events: none; white-space: nowrap; }
#ui-root .toast.on { opacity: .9; transform: translate(-50%, 0); }
#fade { position: absolute; inset: 0; background: #030a08; opacity: 1; pointer-events: none; transition: opacity 1.1s cubic-bezier(.4,0,.2,1); }
#fade.clear { opacity: 0; }
#fade.fast { transition-duration: .55s; }
@media (max-width: 600px) { #ui-root button { padding: 12px 26px; font-size: 14px; min-width: 170px; } #ui-root .hint { font-size: 12px; } }
`;

export class UI {
  private root: HTMLElement;
  private title!: HTMLElement;
  private pause!: HTMLElement;
  private death!: HTMLElement;
  private hud!: HTMLElement;
  private fade!: HTMLElement;
  private toast!: HTMLElement;
  private els: Record<string, HTMLElement> = {};
  private toastTimer = 0;

  constructor(private game: Game, root: HTMLElement) {
    this.root = root;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    root.innerHTML = `
      <div class="hud">
        <div class="stats">
          <b id="h-size">Ø 20 µm</b>
          <span id="h-gen">generation 0</span>
          <span id="h-colony" style="opacity:.75"></span>
          <div class="meter"><i id="h-meter"></i></div>
        </div>
        <button class="pbtn interactive" id="h-pause" aria-label="Pause">▐▐</button>
      </div>
      <div class="toast" id="toast"></div>
      <div class="screen dim title">
        <h1>EVERHUNGER</h1>
        <p class="sub">a life at twenty microns</p>
        <button data-a="play">Begin</button>
        <p class="hint">You are a single cell. Swim toward your cursor or finger (or use WASD).<br>Engulf what is smaller. Avoid what is bigger. Grow until you divide.</p>
      </div>
      <div class="screen dim pause">
        <h2>Paused</h2>
        <button data-a="resume">Resume</button>
        <button data-a="sound">Sound: on</button>
        <button data-a="restart">Restart</button>
      </div>
      <div class="screen dim death">
        <h2>Engulfed</h2>
        <p class="sub" id="d-stats"></p>
        <button data-a="restart">Begin again</button>
      </div>
      <div id="fade"></div>`;
    this.title = root.querySelector('.title')!;
    this.pause = root.querySelector('.pause')!;
    this.death = root.querySelector('.death')!;
    this.hud = root.querySelector('.hud')!;
    this.fade = root.querySelector('#fade')!;
    this.toast = root.querySelector('#toast')!;
    for (const id of ['h-size', 'h-gen', 'h-colony', 'h-meter', 'd-stats', 'h-pause']) this.els[id] = root.querySelector('#' + id)!;
    root.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      game.audio.click();
      const a = b.dataset.a;
      if (a === 'play') game.play();
      else if (a === 'resume') game.togglePause(false);
      else if (a === 'restart') game.restart();
      else if (a === 'sound') { game.audio.setMuted(!game.audio.muted); b.textContent = `Sound: ${game.audio.muted ? 'off' : 'on'}`; }
    });
    this.els['h-pause'].addEventListener('click', () => game.togglePause(true));
  }

  showTitle(on: boolean) { this.title.classList.toggle('on', on); }
  showPause(on: boolean) { this.pause.classList.toggle('on', on); }
  showDeath(on: boolean, stats?: string) {
    if (stats) this.els['d-stats'].textContent = stats;
    this.death.classList.toggle('on', on);
  }
  showHud(on: boolean) { this.hud.classList.toggle('on', on); }
  /** Fade the whole view to black (`dark=true`) or back; `fast` halves the duration. */
  setFade(dark: boolean, fast = false) {
    this.fade.classList.toggle('fast', fast);
    this.fade.classList.toggle('clear', !dark);
  }
  showToast(text: string, ms = 2200) {
    this.toast.textContent = text;
    this.toast.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toast.classList.remove('on'), ms);
  }
  updateHud(diameterUm: number, generation: number, kin: number, progress: number) {
    this.els['h-size'].textContent = `Ø ${diameterUm < 100 ? diameterUm.toFixed(1) : Math.round(diameterUm)} µm`;
    this.els['h-gen'].textContent = `generation ${generation}`;
    this.els['h-colony'].textContent = kin > 0 ? `colony of ${kin + 1}` : '';
    this.els['h-meter'].style.width = `${Math.round(Math.max(0, Math.min(1, progress)) * 100)}%`;
  }
}
