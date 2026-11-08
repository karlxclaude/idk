/**
 * Essence shop: glassy DOM overlay with mutation cards and the ability slot picker.
 * Opens after each scale shift and on window event 'everhunger:openShop'. Pauses the game.
 */
import type { Game } from '../../core/Game';
import { events } from '../../core/events';
import { abilityRegistry } from '../../abilities/registry';
import { installSplit } from '../../abilities/defs/split';
import { installProgression } from '../../upgrades/progression';
import { allUpgrades, buyUpgrade, canBuy, equipAbility, isUnlocked, nextCost, upgradeLevel } from '../../upgrades/purchase';

const CSS = `
.eh-shop{position:fixed;inset:0;z-index:60;pointer-events:auto;display:none;flex-direction:column;align-items:center;
  background:radial-gradient(ellipse at 50% 0%,rgba(30,10,60,.82),rgba(3,1,10,.94));backdrop-filter:blur(14px);
  -webkit-backdrop-filter:blur(14px);color:#e9e4ff;font-family:system-ui,-apple-system,Segoe UI,sans-serif;--a:#8affd8;
  opacity:0;transition:opacity .35s;touch-action:pan-y}
.eh-shop.on{display:flex}.eh-shop.vis{opacity:1}
.eh-head{width:100%;max-width:1000px;box-sizing:border-box;padding:16px 16px 8px;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.eh-title{font-size:clamp(20px,4vw,30px);font-weight:800;letter-spacing:.14em;text-transform:uppercase;text-shadow:0 0 18px var(--a)}
.eh-sub{font-size:12px;opacity:.65;letter-spacing:.08em}
.eh-ess{font-size:22px;font-weight:700;padding:8px 16px;border-radius:999px;border:1px solid var(--a);background:rgba(255,255,255,.06);box-shadow:0 0 18px color-mix(in srgb,var(--a) 45%,transparent)}
.eh-ess b{color:var(--a)}
.eh-body{flex:1;width:100%;max-width:1000px;box-sizing:border-box;overflow-y:auto;padding:8px 16px 16px;-webkit-overflow-scrolling:touch}
.eh-h2{font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.6;margin:14px 2px 8px}
.eh-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.eh-card{position:relative;padding:14px;border-radius:16px;background:linear-gradient(160deg,rgba(255,255,255,.1),rgba(255,255,255,.03));
  border:1px solid rgba(255,255,255,.16);box-shadow:0 4px 24px rgba(0,0,0,.35),inset 0 0 22px rgba(255,255,255,.03);display:flex;flex-direction:column;gap:8px}
.eh-card.can{border-color:var(--a);box-shadow:0 0 22px color-mix(in srgb,var(--a) 35%,transparent),inset 0 0 22px rgba(255,255,255,.04)}
.eh-card.lock{opacity:.5}
.eh-row{display:flex;align-items:center;gap:10px}
.eh-ico{width:42px;height:42px;border-radius:12px;display:grid;place-items:center;font-size:22px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);color:var(--a);flex:none;text-shadow:0 0 10px var(--a)}
.eh-name{font-weight:700;font-size:16px}
.eh-pips{display:flex;gap:4px;margin-top:3px}.eh-pip{width:14px;height:6px;border-radius:3px;background:rgba(255,255,255,.18)}
.eh-pip.f{background:var(--a);box-shadow:0 0 8px var(--a)}
.eh-desc{font-size:13px;opacity:.8;line-height:1.35}
.eh-eff{font-size:12px;opacity:.9;color:var(--a);min-height:16px}
.eh-buy{appearance:none;border:1px solid var(--a);background:rgba(255,255,255,.06);color:#fff;font:inherit;font-weight:700;padding:12px;min-height:44px;border-radius:12px;cursor:pointer;
  display:flex;justify-content:space-between;align-items:center;gap:8px;transition:background .15s,transform .1s}
.eh-buy:hover:not(:disabled){background:color-mix(in srgb,var(--a) 28%,transparent)}.eh-buy:active:not(:disabled){transform:scale(.97)}
.eh-buy:disabled{opacity:.4;cursor:not-allowed;border-color:rgba(255,255,255,.25)}
.eh-slots{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}
.eh-slot{padding:12px;border-radius:14px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);display:flex;flex-direction:column;gap:6px}
.eh-slot label{font-size:12px;letter-spacing:.1em;opacity:.7}
.eh-slot select{font:inherit;min-height:44px;border-radius:10px;border:1px solid var(--a);background:rgba(10,4,24,.9);color:#fff;padding:0 10px}
.eh-ab{font-size:12px;opacity:.75;min-height:30px;line-height:1.3}
.eh-foot{width:100%;max-width:1000px;box-sizing:border-box;padding:10px 16px calc(14px + env(safe-area-inset-bottom));display:flex;justify-content:flex-end}
.eh-go{appearance:none;font:inherit;font-weight:800;letter-spacing:.1em;text-transform:uppercase;font-size:16px;padding:14px 32px;min-height:48px;border-radius:999px;border:1px solid var(--a);
  background:linear-gradient(90deg,color-mix(in srgb,var(--a) 30%,transparent),rgba(255,255,255,.08));color:#fff;cursor:pointer;box-shadow:0 0 24px color-mix(in srgb,var(--a) 50%,transparent)}
.eh-go:active{transform:scale(.97)}
@media(max-width:560px){.eh-grid{grid-template-columns:1fr}.eh-go{width:100%}.eh-head{padding-top:12px}}
`;

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const SLOT_KEYS = ['E', 'R', '4'];

export function mountShop(game: Game, root: HTMLElement): { open(): void; close(): void } {
  installSplit(game);
  installProgression(game);

  if (!document.getElementById('eh-shop-css')) {
    const st = document.createElement('style');
    st.id = 'eh-shop-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  const el = document.createElement('div');
  el.className = 'eh-shop';
  el.innerHTML = `
    <div class="eh-head"><div><div class="eh-title">Evolve</div><div class="eh-sub" data-sub></div></div><div class="eh-ess">Essence <b data-ess>0</b></div></div>
    <div class="eh-body"><div class="eh-h2">Mutations</div><div class="eh-grid" data-cards></div>
      <div class="eh-h2">Abilities - slots</div><div class="eh-slots" data-slots></div></div>
    <div class="eh-foot"><button class="eh-go" data-go>Continue &rarr;</button></div>`;
  root.appendChild(el);
  const $ = <T extends HTMLElement>(s: string) => el.querySelector(s) as T;
  const cards = $('[data-cards]'), slots = $('[data-slots]'), essEl = $('[data-ess]'), sub = $('[data-sub]');

  let isOpen = false;
  let pausedByUs = false;
  let openTimer = 0;

  function render() {
    el.style.setProperty('--a', hex(game.tier.palette.accent));
    essEl.textContent = String(game.state.essence);
    sub.textContent = `Tier ${game.state.tierIndex} - ${game.tier.name}`;
    cards.innerHTML = '';
    for (const def of allUpgrades()) {
      const lvl = upgradeLevel(game, def.id);
      const unlocked = isUnlocked(game, def);
      const cost = nextCost(game, def);
      const can = canBuy(game, def);
      const card = document.createElement('div');
      card.className = 'eh-card' + (can ? ' can' : '') + (unlocked ? '' : ' lock');
      let pips = '';
      for (let i = 0; i < def.maxLevel; i++) pips += `<span class="eh-pip${i < lvl ? ' f' : ''}"></span>`;
      const cur = def.effect?.(lvl) ?? '';
      const nxt = cost !== null && def.effect ? def.effect(lvl + 1) : '';
      const eff = !unlocked ? `Unlocks at tier ${def.unlockTier}` : cost === null ? `MAX: ${cur}` : lvl ? `${cur} → ${nxt}` : `Next: ${nxt}`;
      card.innerHTML = `<div class="eh-row"><div class="eh-ico">${def.icon ?? '✦'}</div><div><div class="eh-name">${esc(def.name)}</div><div class="eh-pips">${pips}</div></div></div>
        <div class="eh-desc">${esc(def.description)}</div><div class="eh-eff">${esc(eff)}</div>`;
      const btn = document.createElement('button');
      btn.className = 'eh-buy';
      btn.disabled = !can;
      btn.innerHTML = cost === null ? '<span>Maxed</span>' : !unlocked ? '<span>Locked</span>' : `<span>Evolve</span><span>${cost} &#9672;</span>`;
      btn.addEventListener('click', () => { if (buyUpgrade(game, def.id)) render(); });
      card.appendChild(btn);
      cards.appendChild(card);
    }
    // ability slots
    slots.innerHTML = '';
    const owned = game.state.ownedAbilities;
    const t1 = abilityRegistry.get(game.tier.abilityId) ?? abilityRegistry.get('pulse');
    const s1 = document.createElement('div');
    s1.className = 'eh-slot';
    s1.innerHTML = `<label>SLOT 1 (Q) - current tier</label><div class="eh-name">${esc((t1?.icon ?? '') + ' ' + (t1?.name ?? '-'))}</div><div class="eh-ab">${esc(t1?.description ?? '')}</div>`;
    slots.appendChild(s1);
    for (let i = 0; i < 3; i++) {
      const cur = owned[i] ? abilityRegistry.get(owned[i]) : undefined;
      const d = document.createElement('div');
      d.className = 'eh-slot';
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="">- empty -</option>` + owned.map((id) => {
        const a = abilityRegistry.get(id);
        return a ? `<option value="${id}"${id === owned[i] ? ' selected' : ''}>${esc((a.icon ?? '') + ' ' + a.name)}</option>` : '';
      }).join('');
      sel.addEventListener('change', () => { equipAbility(game, i, sel.value || null); render(); });
      d.innerHTML = `<label>SLOT ${i + 2} (${SLOT_KEYS[i]})</label>`;
      d.appendChild(sel);
      const ab = document.createElement('div');
      ab.className = 'eh-ab';
      ab.textContent = cur ? `${cur.description} (${cur.cooldown}s)` : owned.length ? 'Pick an ability.' : 'Complete tiers to earn abilities.';
      d.appendChild(ab);
      slots.appendChild(d);
    }
  }

  function open() {
    if (isOpen) { render(); return; }
    isOpen = true;
    pausedByUs = !game.loop.paused;
    game.setPaused(true);
    render();
    el.classList.add('on');
    requestAnimationFrame(() => el.classList.add('vis'));
  }
  function close() {
    if (!isOpen) return;
    isOpen = false;
    el.classList.remove('vis', 'on');
    if (pausedByUs) game.setPaused(false);
    pausedByUs = false;
  }

  $('[data-go]').addEventListener('click', close);
  events.on('essenceChanged', () => { if (isOpen) render(); });
  events.on('pause', ({ paused }) => { if (isOpen && !paused && pausedByUs) game.setPaused(true); });
  events.on('scaleShiftEnd', () => {
    clearTimeout(openTimer);
    openTimer = window.setTimeout(open, 700);
  });
  window.addEventListener('everhunger:openShop', open);
  return { open, close };
}
