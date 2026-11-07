/** Starter upgrade examples (the upgrade agent expands/rebalances these). */
import type { UpgradeDef } from '../registry';

const upgrades: UpgradeDef[] = [
  {
    id: 'speed',
    name: 'Momentum',
    description: '+12% top speed per level.',
    maxLevel: 5,
    cost: (l) => 10 * Math.pow(2, l),
    apply: (s, l) => { s.speed *= 1 + 0.12 * l; },
  },
  {
    id: 'magnet',
    name: 'Hunger Field',
    description: 'Pull nearby food toward you.',
    maxLevel: 5,
    cost: (l) => 15 * Math.pow(2, l),
    apply: (s, l) => { s.magnetRadius = Math.max(s.magnetRadius, 1.5 + l * 0.6); s.magnetStrength += l * 0.4; },
  },
  {
    id: 'armor',
    name: 'Event Horizon Skin',
    description: '-10% damage taken per level.',
    maxLevel: 5,
    cost: (l) => 20 * Math.pow(2, l),
    apply: (s, l) => { s.armor += 0.1 * l; },
  },
  {
    id: 'dash',
    name: 'Lunge',
    description: 'Shorter dash cooldown, stronger dash.',
    maxLevel: 5,
    cost: (l) => 12 * Math.pow(2, l),
    apply: (s, l) => { s.dashCooldown *= Math.pow(0.85, l); s.dashPower *= 1 + 0.08 * l; },
  },
];
export default upgrades;
