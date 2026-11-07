/**
 * Binds abilities to action slots and tracks cooldowns.
 *   ability1 = current tier's abilityId; ability2..4 = state.ownedAbilities[0..2].
 * Unknown ids fall back to 'pulse' so every tier has a working ability.
 */
import type { Action } from '../core/input';
import type { GameContext } from '../core/context';
import { abilityRegistry, type AbilityDef } from './registry';

export const ABILITY_SLOTS: Action[] = ['ability1', 'ability2', 'ability3', 'ability4'];

export interface AbilitySlotInfo {
  action: Action;
  def: AbilityDef | null;
  /** Remaining cooldown seconds. */
  cooldown: number;
  /** 0..1 readiness for UI rings. */
  ready: number;
}

export class AbilitySystem {
  private cooldowns = new Map<string, number>();
  constructor(private ctx: GameContext) {}

  slotDef(action: Action): AbilityDef | null {
    const i = ABILITY_SLOTS.indexOf(action);
    if (i < 0) return null;
    const id = i === 0 ? this.ctx.tier.abilityId : this.ctx.state.ownedAbilities[i - 1];
    if (!id) return null;
    return abilityRegistry.get(id) ?? (i === 0 ? abilityRegistry.get('pulse') ?? null : null);
  }

  slots(): AbilitySlotInfo[] {
    return ABILITY_SLOTS.map((action) => {
      const def = this.slotDef(action);
      const cd = def ? this.cooldowns.get(def.id) ?? 0 : 0;
      return { action, def, cooldown: cd, ready: def ? 1 - cd / def.cooldown : 0 };
    });
  }

  update(dt: number) {
    for (const [k, v] of this.cooldowns) this.cooldowns.set(k, Math.max(0, v - dt));
    const ctx = this.ctx;
    for (const action of ABILITY_SLOTS) {
      if (!ctx.input.consume(action)) continue;
      const def = this.slotDef(action);
      if (!def || (this.cooldowns.get(def.id) ?? 0) > 0 || !ctx.player.alive) continue;
      if (def.activate(ctx)) {
        this.cooldowns.set(def.id, def.cooldown);
        ctx.events.emit('abilityUsed', { id: def.id, action, x: ctx.player.x, y: ctx.player.y });
      }
    }
    for (const id of new Set([ctx.tier.abilityId, ...ctx.state.ownedAbilities])) abilityRegistry.get(id)?.update?.(ctx, dt);
  }

  reset() {
    this.cooldowns.clear();
  }
}
