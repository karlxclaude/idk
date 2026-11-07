/**
 * Auto-registering registries for entity content. DO NOT add imports here - drop a file into:
 *   (content files import helpers from './define', NEVER from this file - it would create an init cycle)
 *   src/entities/behaviors/**.ts   → export default BehaviorDef | BehaviorDef[]
 *   src/entities/renderers/**.ts   → export default RendererDef | RendererDef[]
 *   src/entities/archetypes/**.ts  → export default EntityArchetype | EntityArchetype[]
 *   src/entities/appearances/**.ts → export default PlayerAppearanceDef | PlayerAppearanceDef[]
 */
import { Registry } from '../core/registry';
import type { BehaviorDef, EntityArchetype, RendererDef } from './types';
import type { PlayerAppearanceDef } from './appearance';

export const behaviorRegistry = new Registry<BehaviorDef>('behavior');
export const rendererRegistry = new Registry<RendererDef>('renderer');
export const archetypeRegistry = new Registry<EntityArchetype>('archetype');
export const appearanceRegistry = new Registry<PlayerAppearanceDef>('appearance');

behaviorRegistry.addModules(import.meta.glob('./behaviors/**/*.ts', { eager: true }));
rendererRegistry.addModules(import.meta.glob('./renderers/**/*.ts', { eager: true }));
archetypeRegistry.addModules(import.meta.glob('./archetypes/**/*.ts', { eager: true }));
appearanceRegistry.addModules(import.meta.glob('./appearances/**/*.ts', { eager: true }));

export interface ResolvedBehavior {
  def: BehaviorDef;
  params: any;
}
const resolvedCache = new WeakMap<EntityArchetype, ResolvedBehavior[]>();

/** Behaviors of an archetype with defaults merged (cached). Unknown ids are skipped with a warning. */
export function resolveBehaviors(arch: EntityArchetype): ResolvedBehavior[] {
  let r = resolvedCache.get(arch);
  if (r) return r;
  r = [];
  for (const ref of arch.behaviors ?? []) {
    const def = behaviorRegistry.get(ref.id);
    if (!def) {
      console.warn(`[archetype ${arch.id}] unknown behavior '${ref.id}'`);
      continue;
    }
    r.push({ def, params: { ...(def.defaults ?? {}), ...(ref.params ?? {}) } });
  }
  resolvedCache.set(arch, r);
  return r;
}

export function resolveRenderer(arch: EntityArchetype): { def: RendererDef; params: any } {
  let def = rendererRegistry.get(arch.renderer.id);
  if (!def) {
    console.warn(`[archetype ${arch.id}] unknown renderer '${arch.renderer.id}', using glowOrb`);
    def = rendererRegistry.require('glowOrb');
  }
  return { def, params: { ...(def.defaults ?? {}), ...(arch.renderer.params ?? {}) } };
}

/** Re-exported for convenience in non-content code. Content files must import from './define'. */
export { defineArchetypes, defineBehaviors, defineRenderers, defineAppearance } from './define';
