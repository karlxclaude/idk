/**
 * PLACEHOLDER HUD (DOM overlay). OWNED BY THE UI AGENT (package b) - replace freely.
 * Reads Game.getHudSnapshot() each frame and wires on-screen buttons into the input action API.
 */
import type { Game } from '../core/Game';
import { colorToCss } from '../core/math';
import { input } from '../core/input';

export function mountHud(game: Game, root: HTMLElement) {
  const el = document.createElement('div');
  el.id = 'hud';
  el.innerHTML = `
    <style>
      #hud { position:absolute; inset:0; font-family: system-ui, sans-serif; color:#fff; text-shadow:0 1px 3px #000; }
      #hud .top { position:absolute; top:max(10px, env(safe-area-inset-top)); left:50%; transform:translateX(-50%); text-align:center; width:min(92vw, 520px); }
      #hud .tier { font-size:14px; letter-spacing:.18em; text-transform:uppercase; opacity:.9; }
      #hud .scale { font-size:12px; opacity:.7; margin-top:2px; font-variant-numeric: tabular-nums; }
      #hud .meter { margin-top:6px; height:10px; border-radius:6px; background:rgba(255,255,255,.12); overflow:hidden; box-shadow: 0 0 12px rgba(0,0,0,.4) inset; }
      #hud .fill { height:100%; width:0%; border-radius:6px; transition: width .15s linear; }
      #hud .essence { position:absolute; top:max(10px, env(safe-area-inset-top)); right:14px; font-size:14px; }
      #hud .fps { position:absolute; bottom:6px; left:8px; font-size:11px; opacity:.6; }
      #hud .btns { position:absolute; right:max(16px, env(safe-area-inset-right)); bottom:max(18px, env(safe-area-inset-bottom)); display:flex; gap:12px; }
      #hud button { width:64px; height:64px; border-radius:50%; border:2px solid rgba(255,255,255,.4); background:rgba(255,255,255,.08); color:#fff; font-size:13px; font-weight:600; backdrop-filter: blur(4px); touch-action:none; }
      #hud button:active { background:rgba(255,255,255,.25); }
      #hud .pausebtn { position:absolute; top:max(10px, env(safe-area-inset-top)); left:12px; width:40px; height:40px; font-size:16px; }
      #hud .paused { position:absolute; inset:0; display:none; align-items:center; justify-content:center; font-size:32px; letter-spacing:.3em; background:rgba(0,0,0,.45); }
      #hud .hint { position:absolute; bottom:8px; left:50%; transform:translateX(-50%); font-size:11px; opacity:.45; white-space:nowrap; }
    </style>
    <div class="top">
      <div class="tier"></div>
      <div class="scale"></div>
      <div class="meter"><div class="fill"></div></div>
    </div>
    <div class="essence"></div>
    <button class="pausebtn interactive" aria-label="Pause">II</button>
    <div class="btns">
      <button class="interactive" data-action="ability1">ABIL</button>
      <button class="interactive" data-action="dash">DASH</button>
    </div>
    <div class="paused interactive">PAUSED</div>
    <div class="fps"></div>
    <div class="hint">mouse/touch to move · space dash · Q ability · ] fill · [ mass · \\ next tier</div>
  `;
  root.appendChild(el);
  const $ = (s: string) => el.querySelector(s) as HTMLElement;
  const tierEl = $('.tier'), scaleEl = $('.scale'), fill = $('.fill'), ess = $('.essence'), fps = $('.fps'), paused = $('.paused');

  el.querySelectorAll<HTMLButtonElement>('button[data-action]').forEach((b) => {
    const a = b.dataset.action as Parameters<typeof input.press>[0];
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      input.press(a);
    });
  });
  $('.pausebtn').addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    input.press('pause');
  });
  paused.addEventListener('pointerdown', () => game.setPaused(false));

  const isTouch = matchMedia('(pointer: coarse)').matches;
  if (!isTouch) ($('.btns').style.display = 'none');
  else $('.hint').style.display = 'none';

  let lastTier = -1;
  const frame = () => {
    const s = game.getHudSnapshot();
    if (s.tierIndex !== lastTier) {
      lastTier = s.tierIndex;
      tierEl.textContent = `Tier ${s.tierIndex} · ${s.tierName}${s.ngPlus ? `  (NG+${s.ngPlus})` : ''}`;
      fill.style.background = `linear-gradient(90deg, ${colorToCss(s.accent, 0.7)}, ${colorToCss(s.accent)})`;
      fill.style.boxShadow = `0 0 10px ${colorToCss(s.accent)}`;
    }
    scaleEl.textContent = `size ≈ ${s.scaleLabel}`;
    fill.style.width = `${(s.shifting ? 1 : s.progress) * 100}%`;
    ess.textContent = `✦ ${s.essence}`;
    fps.textContent = game.state.settings.showFps || location.search.includes('debug') ? `${s.fps.toFixed(0)} fps · ${game.world.count} ent` : '';
    paused.style.display = s.paused ? 'flex' : 'none';
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  return el;
}
