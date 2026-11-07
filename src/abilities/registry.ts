/**
 * Abilities (tier abilities + purchasable ones). OWNED BY THE UPGRADE AGENT (package f).
 * Drop files in src/abilities/defs/ exporting default AbilityDef | AbilityDef[].
 */
import { Registry } from '../core/registry';
import type { GameContext } from '../core/context';

export interface AbilityDef {
  id: string;
  name: string;
  description: string;
  /** Cooldown seconds. */
  cooldown: number;
  /** Optional icon glyph/emoji or texture key for the UI. */
  icon?: string;
  /** Fire the ability. Return false if it could not activate (no cooldown consumed). */
  activate(ctx: GameContext): boolean;
  /** Optional per-step update while the tier is active (for lingering effects). */
  update?(ctx: GameContext, dt: number): void;
}

export const abilityRegistry = new Registry<AbilityDef>('ability');
abilityRegistry.addModules(import.meta.glob('./defs/**/*.ts', { eager: true }));
