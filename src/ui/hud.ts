/**
 * HUD (DOM overlay): size meter, tier line, essence counter, ability buttons, pause + fps.
 * Reads Game.getHudSnapshot() each frame; buttons call the input action API.
 */
import type { Game } from '../core/Game';
import { colorToCss } from '../core/math';
import { input, type Action } from '../core/input';
import { events } from '../core/events';
import { h, injectTheme, isTouchDevice } from './dom';

const ICON_DASH = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l7 6-7 6"/><path d="M12 6l7 6-7 6"/></svg>`;
const ICON_SPLIT = `<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="7.5" cy="12" r="4.5"/><circle cx="17" cy="12" r="3"/><path d="M12.5 9l1.5-1M12.5 15l1.5 1" /></svg>`;
const ICON_PAUSE = `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1.5"/><rect x="14" y="5" width="4" height="14" rx="1.5"/></svg>`;

const KEYS: Partial<Record<Action, string>> = { dash: 'SPACE', split: 'F', ability1: 'Q', ability2: 'E', ability3: 'R', ability4: '4' };
const BUTTONS: Action[] = ['dash', 'split', 'ability1', 'ability2', 'ability3', 'ability4'];

const CSS = /* css */ `
#hud { position:absolute; inset:0; overflow:hidden; text-shadow: 0 1px 4px rgba(0,0,0,.7); }
#hud .top { position:absolute; top:max(12px, env(safe-area-inset-top)); left:50%; transform:translateX(-50%); width:min(70vw, 460px); text-align:center; }
#hud .tierline { font-size:12px; font-weight:600; letter-spacing:.2em; text-transform:uppercase; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--eh-text); }
#hud .tierline b { color: var(--eh-accent); font-weight:700; text-shadow:0 0 12px var(--eh-accent); }
#hud .tierline .sc { opacity:.65; font-variant-numeric: tabular-nums; }
#hud .meter { position:relative; margin-top:7px; height:12px; border-radius:8px; padding:2px; }
#hud .track { position:relative; height:100%; border-radius:6px; background:rgba(0,0,0,.45); overflow:hidden; }
#hud .fill { position:absolute; left:0; top:0; bottom:0; width:0; border-radius:6px; transition:width .22s cubic-bezier(.2,.8,.3,1); background:linear-gradient(90deg, var(--eh-accent-dim), var(--eh-accent)); box-shadow:0 0 14px var(--eh-accent); }
#hud .fill::after { content:''; position:absolute; inset:0; background:linear-gradient(100deg, transparent 30%, rgba(255,255,255,.55) 50%, transparent 70%); background-size:220% 100%; animation: ehShine 2.8s linear infinite; mix-blend-mode:overlay; }
@keyframes ehShine { from { background-position:160% 0 } to { background-position:-60% 0 } }
#hud .meter.near { animation: ehNear 0.9s ease-in-out infinite; }
#hud.rf .meter.near { animation:none; box-shadow:0 0 14px var(--eh-accent); }
#hud.rf .fill::after { animation:none; }
@keyframes ehNear { 0%,100% { box-shadow:0 0 6px -2px var(--eh-accent); } 50% { box-shadow:0 0 26px 2px var(--eh-accent); } }
#hud .pct { margin-top:4px; font-size:10px; letter-spacing:.2em; opacity:.55; font-variant-numeric:tabular-nums; }

#hud .essence { position:absolute; top:max(12px, env(safe-area-inset-top)); right:max(14px, env(safe-area-inset-right)); display:flex; align-items:center; gap:8px; height:38px; padding:0 14px 0 11px; border-radius:19px; font-weight:700; font-size:17px; font-variant-numeric:tabular-nums; transform-origin:right center; }
#hud .essence .gem { color:var(--eh-accent); filter:drop-shadow(0 0 6px var(--eh-accent)); font-size:15px; }
#hud .essence.bump { animation: ehBump .38s cubic-bezier(.2,1.6,.4,1); }
@keyframes ehBump { 0% { transform:scale(1) } 35% { transform:scale(1.2); box-shadow:0 0 28px var(--eh-accent); } 100% { transform:scale(1) } }
#hud .essence .delta { position:absolute; right:10px; top:100%; font-size:12px; color:var(--eh-accent); opacity:0; pointer-events:none; }
#hud .essence .delta.go { animation: ehDelta 1s ease-out; }
@keyframes ehDelta { 0% { opacity:1; transform:translateY(-2px) } 100% { opacity:0; transform:translateY(14px) } }

#hud .pausebtn { position:absolute; top:max(12px, env(safe-area-inset-top)); left:max(14px, env(safe-area-inset-left)); width:42px; height:42px; border-radius:50%; display:grid; place-items:center; padding:0; transition:box-shadow .15s, transform .1s; }
#hud .pausebtn:hover { box-shadow:0 0 20px -2px var(--eh-accent); }
#hud .pausebtn:active { transform:scale(.92); }

#hud .fps { position:absolute; left:max(10px, env(safe-area-inset-left)); bottom:max(8px, env(safe-area-inset-bottom)); font-size:11px; opacity:.6; font-variant-numeric:tabular-nums; }

/* ability buttons */
#hud .abil { position:absolute; pointer-events:none; }
#hud .ab { --s:60px; position:relative; width:var(--s); height:var(--s); border-radius:50%; padding:0; display:none; place-items:center; flex-direction:column; touch-action:none; overflow:hidden; font-size:calc(var(--s) * .4); line-height:1; transition:transform .1s, box-shadow .2s, border-color .2s; border-color:color-mix(in srgb, var(--eh-accent) 45%, rgba(255,255,255,.2)); }
#hud .ab.on { display:grid; }
#hud .ab:active, #hud .ab.down { transform:scale(.9); background:rgba(255,255,255,.22); }
#hud .ab .ic { position:relative; z-index:1; filter:drop-shadow(0 0 5px var(--eh-accent)); }
#hud .ab .nm { position:relative; z-index:1; margin-top:3px; font-size:calc(var(--s) * .15); letter-spacing:.08em; text-transform:uppercase; opacity:.8; max-width:92%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
#hud .ab .cd { position:absolute; inset:0; z-index:2; border-radius:50%; background:conic-gradient(rgba(5,2,14,.74) var(--cd, 0deg), transparent 0); pointer-events:none; }
#hud .ab .cdt { position:absolute; z-index:3; font-size:calc(var(--s) * .27); font-weight:700; display:none; }
#hud .ab.cooling .cdt { display:block; }
#hud .ab .key { position:absolute; z-index:3; top:2px; font-size:9px; letter-spacing:.1em; opacity:.7; font-weight:700; background:rgba(0,0,0,.4); border-radius:6px; padding:1px 5px; }
#hud .ab.cooling { opacity:.85; }
#hud .ab.cooling .ic { opacity:.45; }
#hud .ab.pop { animation: ehReady .5s ease-out; }
#hud.rf .ab.pop { animation:none; }
@keyframes ehReady { 0% { box-shadow:0 0 0 0 var(--eh-accent); } 100% { box-shadow:0 0 0 18px transparent; } }

/* desktop: compact row, bottom centre */
#hud .abil.desk { left:50%; bottom:max(14px, env(safe-area-inset-bottom)); transform:translateX(-50%); display:flex; gap:10px; align-items:flex-end; }
#hud .abil.desk .ab { --s:58px; pointer-events:auto; }
/* touch: big thumb cluster bottom-right */
#hud .abil.touch { right:max(14px, env(safe-area-inset-right)); bottom:max(20px, env(safe-area-inset-bottom)); width:0; height:0; }
#hud .abil.touch .ab { --s:66px; position:absolute; pointer-events:auto; }
#hud .abil.touch .ab .key { display:none; }
#hud .abil.touch .ab[data-a=dash] { --s:92px; right:0; bottom:0; }
#hud .abil.touch .ab[data-a=ability1] { --s:72px; right:10px; bottom:106px; }
#hud .abil.touch .ab[data-a=ability2] { right:14px; bottom:188px; }
#hud .abil.touch .ab[data-a=split] { right:106px; bottom:10px; }
#hud .abil.touch .ab[data-a=ability3] { right:182px; bottom:34px; }
#hud .abil.touch .ab[data-a=ability4] { right:176px; bottom:112px; }
@media (max-height:420px) {
  #hud .abil.touch .ab[data-a=dash] { --s:78px; }
  #hud .abil.touch .ab[data-a=ability1] { --s:62px; bottom:90px; right:8px; }
  #hud .abil.touch .ab[data-a=ability2] { --s:56px; bottom:156px; right:12px; }
  #hud .abil.touch .ab[data-a=split] { --s:60px; right:92px; }
  #hud .abil.touch .ab[data-a=ability3] { --s:56px; right:158px; bottom:26px; }
  #hud .abil.touch .ab[data-a=ability4] { --s:56px; right:158px; bottom:92px; }
}
`;

export function mountHud(game: Game, root: HTMLElement) {
  injectTheme();
  const touch = isTouchDevice();
  const el = h('div');
  el.id = 'hud';
  el.innerHTML = `
    <style>${CSS}</style>
    <div class="top">
      <div class="tierline"></div>
      <div class="meter eh-glass"><div class="track"><div class="fill"></div></div></div>
      <div class="pct"></div>
    </div>
    <div class="essence eh-glass interactive"><span class="gem">✦</span><span class="num">0</span><span class="delta"></span></div>
    <button class="pausebtn eh-glass interactive" aria-label="Pause">${ICON_PAUSE}</button>
    <div class="abil ${touch ? 'touch' : 'desk'}"></div>
    <div class="fps"></div>`;
  root.appendChild(el);
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => el.querySelector(s) as T;
  const tierEl = $('.tierline'), fill = $('.fill'), meter = $('.meter'), pct = $('.pct');
  const essBox = $('.essence'), essNum = $('.num'), essDelta = $('.delta'), fps = $('.fps');
  const abil = $('.abil');
  // The essence pill should not intercept game input, only be decorative.
  essBox.style.pointerEvents = 'none';

  // ---- ability buttons ----
  interface Btn { el: HTMLButtonElement; ic: HTMLElement; nm: HTMLElement; cd: HTMLElement; cdt: HTMLElement; on: boolean; ready: number; label: string }
  const btns = new Map<Action, Btn>();
  for (const a of BUTTONS) {
    const b = h('button', 'ab eh-glass interactive');
    b.dataset.a = a;
    b.innerHTML = `<span class="ic"></span><span class="nm"></span><span class="cd"></span><span class="cdt"></span>${touch ? '' : `<span class="key">${KEYS[a]}</span>`}`;
    b.style.touchAction = 'none';
    const press = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.add('down');
      input.press(a);
    };
    b.addEventListener('pointerdown', press);
    const rel = () => b.classList.remove('down');
    b.addEventListener('pointerup', rel);
    b.addEventListener('pointerleave', rel);
    b.addEventListener('pointercancel', rel);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    abil.appendChild(b);
    btns.set(a, {
      el: b, ic: b.querySelector('.ic')!, nm: b.querySelector('.nm')!, cd: b.querySelector('.cd')!,
      cdt: b.querySelector('.cdt')!, on: false, ready: -1, label: '',
    });
  }
  // Desktop order: dash, split, abilities.
  const setBtn = (a: Action, show: boolean, icon: string, name: string, ready: number, cdSec: number) => {
    const b = btns.get(a)!;
    if (show !== b.on) {
      b.on = show;
      b.el.classList.toggle('on', show);
    }
    if (!show) return;
    const lab = icon + '|' + name;
    if (lab !== b.label) {
      b.label = lab;
      b.ic.innerHTML = icon;
      b.nm.textContent = touch ? '' : name;
      b.el.title = name;
      b.el.setAttribute('aria-label', name);
    }
    const r = Math.round(ready * 200) / 200;
    if (r !== b.ready) {
      const was = b.ready;
      b.ready = r;
      b.cd.style.setProperty('--cd', `${(1 - r) * 360}deg`);
      const cooling = r < 1;
      b.el.classList.toggle('cooling', cooling);
      b.cdt.textContent = cooling && cdSec > 0.05 ? (cdSec >= 10 ? String(Math.ceil(cdSec)) : cdSec.toFixed(1)) : '';
      if (was >= 0 && was < 1 && r >= 1) {
        b.el.classList.remove('pop');
        void b.el.offsetWidth;
        b.el.classList.add('pop');
      }
    } else if (r < 1) {
      b.cdt.textContent = cdSec > 0.05 ? (cdSec >= 10 ? String(Math.ceil(cdSec)) : cdSec.toFixed(1)) : '';
    }
  };

  // ---- pause ----
  $('.pausebtn').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    input.press('pause');
  });

  // ---- essence ----
  let shownEss = game.state.essence, targetEss = shownEss;
  events.on('essenceChanged', ({ essence, delta }) => {
    targetEss = essence;
    if (delta > 0) {
      essBox.classList.remove('bump');
      essDelta.classList.remove('go');
      void essBox.offsetWidth;
      essBox.classList.add('bump');
      essDelta.textContent = `+${Math.round(delta)}`;
      essDelta.classList.add('go');
    }
  });

  let lastTier = -1, lastLabel = '', lastPct = '';
  const frame = () => {
    const s = game.getHudSnapshot();
    const st = game.state.settings;
    el.classList.toggle('rf', !!st.reduceFlashing);
    if (s.tierIndex !== lastTier) {
      lastTier = s.tierIndex;
      el.style.setProperty('--eh-accent', colorToCss(s.accent));
      el.style.setProperty('--eh-accent-dim', colorToCss(s.accent, 0.55));
      root.style.setProperty('--eh-accent', colorToCss(s.accent));
    }
    const label = `Tier ${s.tierIndex} · <b>${s.tierName}</b> · <span class="sc">${s.scaleLabel}</span>${s.ngPlus ? ` · NG+${s.ngPlus}` : ''}`;
    if (label !== lastLabel) {
      lastLabel = label;
      tierEl.innerHTML = label;
    }
    const p = s.shifting ? 1 : s.progress;
    fill.style.width = `${p * 100}%`;
    meter.classList.toggle('near', p > 0.9);
    const ps = `${Math.floor(p * 100)}%`;
    if (ps !== lastPct) {
      lastPct = ps;
      pct.textContent = `SIZE ${ps}`;
    }
    // essence tween
    if (shownEss !== targetEss) {
      const d = targetEss - shownEss;
      shownEss = Math.abs(d) < 1 ? targetEss : shownEss + d * 0.18;
    }
    const t = Math.round(shownEss).toLocaleString();
    if (essNum.textContent !== t) essNum.textContent = t;

    // abilities
    const cdOf = (a: Action) => s.abilities.find((x) => x.action === a);
    const dashCd = Math.max(0, (1 - s.dashReady) * game.stats.dashCooldown);
    setBtn('dash', true, ICON_DASH, 'Dash', Math.min(1, s.dashReady), dashCd);
    setBtn('split', true, ICON_SPLIT, 'Split', 1, 0);
    for (const a of ['ability1', 'ability2', 'ability3', 'ability4'] as Action[]) {
      const sl = cdOf(a);
      const def = sl?.def;
      if (!sl || !def) setBtn(a, false, '', '', 1, 0);
      else setBtn(a, true, def.icon ?? def.name.charAt(0).toUpperCase(), def.name, Math.max(0, Math.min(1, sl.ready)), sl.cooldown);
    }
    fps.textContent = st.showFps || location.search.includes('debug') ? `${s.fps.toFixed(0)} fps · ${game.world.count} ent` : '';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return el;
}
