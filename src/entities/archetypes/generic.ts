/**
 * Generic archetypes reused (and re-coloured via SpawnEntry.colors) by stub tiers 4-15.
 * Content agents should create tier-specific archetypes in their own files instead of editing these.
 */
import { defineArchetypes } from '../define';

export default defineArchetypes([
  {
    id: 'generic_food',
    renderer: { id: 'glowOrb' },
    behaviors: [{ id: 'wander', params: { speed: 1.2 } }, { id: 'flee', params: { speed: 2, range: 3 } }],
    colors: [0x88ffcc],
    essence: 1,
  },
  {
    id: 'generic_drifter',
    renderer: { id: 'ring' },
    behaviors: [{ id: 'drift', params: { speed: 0.4 } }],
    colors: [0xaaccff],
    spin: [0.2, 0.8],
    essence: 1,
  },
  {
    id: 'generic_school',
    renderer: { id: 'polygon', params: { sides: 3 } },
    behaviors: [{ id: 'schooling', params: { speed: 2.4 } }, { id: 'faceVelocity' }, { id: 'flee', params: { speed: 2, range: 4 } }],
    colors: [0xffee88],
    essence: 1,
  },
  {
    id: 'generic_big',
    renderer: { id: 'cluster', params: { count: 5 } },
    behaviors: [{ id: 'wander', params: { speed: 0.6 } }, { id: 'flee', params: { speed: 1.2, range: 3 } }],
    colors: [0xcc88ff],
    massValue: 1.2,
    essence: 3,
    spin: [0.1, 0.4],
  },
  {
    id: 'generic_predator',
    renderer: { id: 'spiky' },
    behaviors: [{ id: 'wander', params: { speed: 0.8 } }, { id: 'chase', params: { speed: 1.1, range: 6 } }],
    colors: [0xff4466],
    colors2: [0xffccaa],
    damage: 0.18,
    essence: 5,
    spin: [0.3, 0.9],
  },
  {
    id: 'generic_hazard',
    renderer: { id: 'spiky', params: { spikes: 14, depth: 0.2 } },
    behaviors: [{ id: 'drift', params: { speed: 0.15 } }, { id: 'pulse', params: { amount: 0.08 } }],
    colors: [0xff2255],
    colors2: [0x330011],
    edible: 'never',
    damage: 0.12,
    spin: [0.2, 0.5],
  },
  {
    id: 'generic_well',
    renderer: { id: 'ring', params: { glow: 3.5, glowAlpha: 0.6 } },
    behaviors: [{ id: 'gravityWell', params: { range: 6, strength: 0.6 } }, { id: 'drift', params: { speed: 0.1 } }],
    colors: [0x6644ff],
    edible: 'never',
    damage: 0,
    persistent: false,
  },
  {
    /** The previous tier's world as an edible speck (see Spawner + ScaleShift). */
    id: 'prevSpeck',
    renderer: { id: 'speck' },
    behaviors: [{ id: 'drift', params: { speed: 0.25 } }],
    colors: [0xffffff],
    massValue: 1.5,
    essence: 2,
    tags: ['prevWorld'],
  },
]);
