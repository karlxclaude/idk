/**
 * Identity helpers that give content files type checking. Kept dependency-free on purpose:
 * content modules are imported eagerly BY the registries, so they must not import registries.ts.
 */
import type { BehaviorDef, EntityArchetype, RendererDef } from './types';
import type { PlayerAppearanceDef } from './appearance';

export const defineArchetypes = (a: EntityArchetype[]) => a;
export const defineBehaviors = (b: BehaviorDef[]) => b;
export const defineRenderers = (r: RendererDef[]) => r;
export const defineAppearance = (a: PlayerAppearanceDef) => a;
