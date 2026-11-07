/**
 * Tier title card ("TIER 2 · QUARK SOUP · 10⁻¹⁸ m"). Listens to 'tierEnter'.
 * Staggered cinematic reveal; reduced to a plain fade when settings.reduceFlashing is on.
 */
import { events } from '../core/events';
import { colorToCss } from '../core/math';
import type { Game } from '../core/Game';
import { injectTheme } from './dom';

const CSS = /* css */ `
#title-card { position:absolute; left:0; right:0; top:30%; text-align:center; pointer-events:none; padding:0 16px; font-family:var(--eh-font); --tc:#fff; visibility:hidden; }
#title-card.run { visibility:visible; }
#title-card > * { opacity:0; will-change:opacity, transform, filter; }
#title-card .line { width:min(60vw, 360px); height:2px; margin:14px auto; background:linear-gradient(90deg, transparent, var(--tc), transparent); box-shadow:0 0 14px var(--tc); transform:scaleX(0); }
#title-card .t1 { font-size:clamp(12px, 3.2vw, 16px); font-weight:500; letter-spacing:.55em; padding-left:.55em; color:var(--tc); text-shadow:0 0 14px var(--tc); }
#title-card .t2 { font-size:clamp(30px, 9vw, 68px); font-weight:800; letter-spacing:.14em; padding-left:.14em; margin:.12em 0; color:#fff; text-shadow:0 0 28px var(--tc), 0 0 6px var(--tc), 0 4px 30px rgba(0,0,0,.6); }
#title-card .t3 { font-size:clamp(12px, 3.4vw, 18px); font-weight:500; letter-spacing:.28em; padding-left:.28em; opacity:0; }
#title-card .t4 { font-size:clamp(11px, 3vw, 15px); margin-top:.9em; font-style:italic; font-weight:300; letter-spacing:.04em; }
#title-card.run .t1 { animation: tcRise .9s .0s cubic-bezier(.2,.8,.2,1) both, tcOut .8s var(--hold) ease-in forwards; }
#title-card.run .t2 { animation: tcTitle 1.5s .12s cubic-bezier(.16,.9,.2,1) both, tcOut .9s var(--hold) ease-in forwards; }
#title-card.run .line { animation: tcLine 1.1s .3s cubic-bezier(.2,.8,.2,1) both, tcOut .7s var(--hold) ease-in forwards; }
#title-card.run .t3 { animation: tcRise .9s .55s cubic-bezier(.2,.8,.2,1) both, tcOut .8s var(--hold) ease-in forwards; --o:.9; }
#title-card.run .t4 { animation: tcRise 1s .85s cubic-bezier(.2,.8,.2,1) both, tcOut .8s var(--hold) ease-in forwards; --o:.65; }
@keyframes tcRise { from { opacity:0; transform:translateY(14px); filter:blur(6px); } to { opacity:var(--o, .9); transform:none; filter:none; } }
@keyframes tcTitle { from { opacity:0; transform:scale(1.18); letter-spacing:.5em; filter:blur(14px); } 60% { filter:blur(0); } to { opacity:1; transform:scale(1); letter-spacing:.14em; filter:none; } }
@keyframes tcLine { from { opacity:0; transform:scaleX(0); } to { opacity:.9; transform:scaleX(1); } }
@keyframes tcOut { from { opacity:var(--o, 1); transform:none; } to { opacity:0; transform:translateY(-8px); filter:blur(4px); } }
#title-card.calm.run .t1, #title-card.calm.run .t2, #title-card.calm.run .t3, #title-card.calm.run .t4, #title-card.calm.run .line { animation: tcFade 1s ease both, tcFadeOut .8s var(--hold) ease-in forwards; filter:none; transform:none; }
#title-card.calm .line { transform:none; }
#title-card.calm .t2 { text-shadow:0 2px 14px rgba(0,0,0,.7); }
@keyframes tcFade { from { opacity:0 } to { opacity:var(--o, 1) } }
@keyframes tcFadeOut { from { opacity:var(--o, 1) } to { opacity:0 } }
`;

export function mountTitleCard(root: HTMLElement, game?: Game) {
  injectTheme();
  const el = document.createElement('div');
  el.id = 'title-card';
  el.innerHTML = `<style>${CSS}</style><div class="t1"></div><div class="t2"></div><div class="line"></div><div class="t3"></div><div class="t4"></div>`;
  root.appendChild(el);
  const [t1, t2, t3, t4] = ['.t1', '.t2', '.t3', '.t4'].map((s) => el.querySelector(s) as HTMLElement);
  let startTimer = 0;
  let endTimer = 0;
  events.on('tierEnter', ({ tier, viaShift }) => {
    t1.textContent = `TIER ${tier.index}`;
    t2.textContent = tier.titleCard.title.toUpperCase();
    t3.textContent = `${tier.titleCard.subtitle ? tier.titleCard.subtitle + ' · ' : ''}${tier.scaleLabel}`;
    t4.textContent = tier.titleCard.flavor ?? '';
    t4.style.display = tier.titleCard.flavor ? '' : 'none';
    el.style.setProperty('--tc', colorToCss(tier.palette.accent));
    el.classList.toggle('calm', !!game?.state.settings.reduceFlashing);
    window.clearTimeout(startTimer);
    window.clearTimeout(endTimer);
    el.classList.remove('run');
    const delay = viaShift ? 250 : 80;
    const hold = 2.9; // seconds before fade-out begins
    el.style.setProperty('--hold', `${hold}s`);
    startTimer = window.setTimeout(() => {
      void el.offsetWidth;
      el.classList.add('run');
    }, delay);
    endTimer = window.setTimeout(() => el.classList.remove('run'), delay + (hold + 1) * 1000);
  });
  return el;
}
