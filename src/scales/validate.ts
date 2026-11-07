/** Dev-time content validation: warns about dangling ids so content agents catch typos fast. */
import { abilityRegistry } from '../abilities/registry';
import { appearanceRegistry, archetypeRegistry, behaviorRegistry, rendererRegistry } from '../entities/registries';
import { backgroundRegistry } from './backgroundRegistry';
import { mechanicRegistry } from './mechanicRegistry';
import { TIERS } from './registry';

export function validateContent(): string[] {
  const issues: string[] = [];
  for (const a of archetypeRegistry.all()) {
    if (!rendererRegistry.has(a.renderer.id)) issues.push(`archetype ${a.id}: unknown renderer '${a.renderer.id}'`);
    for (const b of a.behaviors ?? []) if (!behaviorRegistry.has(b.id)) issues.push(`archetype ${a.id}: unknown behavior '${b.id}'`);
  }
  for (const t of TIERS) {
    for (const s of [...t.spawns, ...t.hazards]) if (!archetypeRegistry.has(s.archetype)) issues.push(`tier ${t.index}: unknown archetype '${s.archetype}'`);
    for (const l of t.background) if (!backgroundRegistry.has(l.type)) issues.push(`tier ${t.index}: unknown background layer '${l.type}'`);
    for (const m of t.mechanics ?? []) if (!mechanicRegistry.has(m.id)) issues.push(`tier ${t.index}: unknown mechanic '${m.id}'`);
    if (!abilityRegistry.has(t.abilityId)) issues.push(`tier ${t.index}: ability '${t.abilityId}' not implemented yet (falls back to 'pulse')`);
    if (!appearanceRegistry.has(t.playerStage)) issues.push(`tier ${t.index}: appearance '${t.playerStage}' not implemented yet (falls back to 'blob')`);
    if (t.growthTarget <= 1) issues.push(`tier ${t.index}: growthTarget must be > 1`);
  }
  if (issues.length) console.info(`[validate] ${issues.length} content notes:\n  ` + issues.join('\n  '));
  return issues;
}
