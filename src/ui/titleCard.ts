/**
 * Tier title card ("TIER 2 - QUARK SOUP · 10^-18 m"). Listens to 'tierEnter'.
 * OWNED BY THE UI AGENT (package b) - restyle freely, keep it event-driven.
 */
import { events } from '../core/events';
import { colorToCss } from '../core/math';
import { SHIFT_IN_DURATION } from '../scales/ScaleShift';

export function mountTitleCard(root: HTMLElement) {
  const el = document.createElement('div');
  el.id = 'title-card';
  el.innerHTML = `
    <style>
      #title-card { position:absolute; left:0; right:0; top:34%; text-align:center; pointer-events:none; opacity:0; transform: scale(.96); transition: opacity .6s ease, transform 2.4s ease-out; }
      #title-card.show { opacity:1; transform: scale(1); }
      #title-card .t1 { font-size: clamp(12px, 3.2vw, 16px); letter-spacing:.5em; opacity:.8; }
      #title-card .t2 { font-size: clamp(30px, 9vw, 64px); font-weight:800; letter-spacing:.12em; margin:.15em 0; }
      #title-card .t3 { font-size: clamp(12px, 3.4vw, 18px); letter-spacing:.25em; opacity:.85; }
      #title-card .t4 { font-size: clamp(11px, 3vw, 14px); opacity:.6; margin-top:.8em; font-style:italic; }
    </style>
    <div class="t1"></div><div class="t2"></div><div class="t3"></div><div class="t4"></div>`;
  root.appendChild(el);
  const [t1, t2, t3, t4] = ['.t1', '.t2', '.t3', '.t4'].map((s) => el.querySelector(s) as HTMLElement);
  let hideTimer = 0;
  events.on('tierEnter', ({ tier, viaShift }) => {
    t1.textContent = `TIER ${tier.index}`;
    t2.textContent = tier.titleCard.title.toUpperCase();
    t3.textContent = `${tier.titleCard.subtitle ?? ''} · ${tier.scaleLabel}`;
    t4.textContent = tier.titleCard.flavor ?? '';
    const c = colorToCss(tier.palette.accent);
    t2.style.color = '#fff';
    t2.style.textShadow = `0 0 24px ${c}, 0 0 4px ${c}`;
    window.clearTimeout(hideTimer);
    el.classList.remove('show');
    window.setTimeout(() => el.classList.add('show'), viaShift ? 250 : 50);
    hideTimer = window.setTimeout(() => el.classList.remove('show'), (viaShift ? SHIFT_IN_DURATION * 1000 : 0) + 2600);
  });
  return el;
}
