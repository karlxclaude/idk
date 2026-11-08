import { describe, expect, it } from 'vitest';
import { abilityRegistry } from '../../src/abilities/registry';
import { archetypeRegistry, behaviorRegistry, rendererRegistry } from '../../src/entities/registries';
import { backgroundRegistry } from '../../src/scales/backgroundRegistry';
import { mechanicRegistry } from '../../src/scales/mechanicRegistry';
import { TIERS } from '../../src/scales/registry';

describe('content validation', () => {
  it('has tiers, contiguous from 1', () => {
    expect(TIERS.length).toBeGreaterThan(0);
    TIERS.forEach((t, i) => expect(t.index, `tier ${t.id}`).toBe(i + 1));
  });
  it('scale exponents strictly increase', () => {
    for (let i = 1; i < TIERS.length; i++) {
      expect(TIERS[i].scaleExponent, `tier ${TIERS[i].index}`).toBeGreaterThan(TIERS[i - 1].scaleExponent);
    }
  });
  it('archetypes reference existing renderers/behaviors', () => {
    for (const a of archetypeRegistry.all()) {
      expect(rendererRegistry.has(a.renderer.id), `archetype ${a.id} renderer ${a.renderer.id}`).toBe(true);
      for (const b of a.behaviors ?? []) expect(behaviorRegistry.has(b.id), `archetype ${a.id} behavior ${b.id}`).toBe(true);
    }
  });
  it('tier spawns/hazards/backgrounds/mechanics/abilities all resolve', () => {
    for (const t of TIERS) {
      for (const s of [...t.spawns, ...t.hazards]) expect(archetypeRegistry.has(s.archetype), `tier ${t.index} archetype ${s.archetype}`).toBe(true);
      for (const l of t.background) expect(backgroundRegistry.has(l.type), `tier ${t.index} background ${l.type}`).toBe(true);
      for (const m of t.mechanics ?? []) expect(mechanicRegistry.has(m.id), `tier ${t.index} mechanic ${m.id}`).toBe(true);
      expect(abilityRegistry.has(t.abilityId), `tier ${t.index} ability ${t.abilityId}`).toBe(true);
      expect(t.growthTarget, `tier ${t.index} growthTarget`).toBeGreaterThan(1);
    }
  });
});
