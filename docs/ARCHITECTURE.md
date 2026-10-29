# Architecture

Godot 4.4 + Jolt, GDScript. One `Npc` node composes five decoupled systems that talk only through
the `Npc` hub (signals + helpers) and the frozen contracts in `scripts/contracts/`. See `CONTRACTS.md`.

```
Weapon ──DamageEvent──▶ Npc.apply_damage ──▶ DamageSystem ──▶ WoundSystem (Wound[])
                                  │                │  emits wounded/broken/severed/stunned/lethal
                                  ▼                ▼
                         NpcBody.apply_hit_impulse  BloodSystem (ticks volume from wounds × exertion)
                                                    │  blood_level_changed
                                                    ▼
                         NpcBrain (FSM) ◀── signals ── drives NpcBody (locomotion/ragdoll/drop)
GameEvents bus ──▶ GoreFX (particles, decals, pools), audio hooks, DebugOverlay
```

Ownership (Phase 2 roster, `.claude/agents/`):

| Files | Owner |
|---|---|
| `scripts/contracts`, `scripts/core`, `scripts/npc`, `project.godot`, `tools/` | orchestrator |
| `scripts/damage/damage_system.gd`, `wound_system.gd`, `blood_system.gd`, `data/injury/core.json`, `data/blood.json` | bleed-agent |
| `scripts/damage/mechanisms/{bullet,stab,slash}.gd`, `data/injury/penetrating.json` | penetrating-agent |
| `scripts/damage/mechanisms/blunt.gd`, `data/injury/blunt.json` | blunt-agent |
| `scripts/damage/regions/{head,neck}.gd`, `data/injury/head_neck.json` | head-neck-agent |
| `scripts/damage/regions/torso.gd`, `data/injury/torso.json` | torso-agent |
| `scripts/damage/regions/arm.gd`, `data/injury/arms.json` | arms-agent |
| `scripts/damage/regions/leg.gd`, `data/injury/legs.json` | legs-agent |
| `scripts/damage/regions/limb_base.gd` | arms-agent (legs/head-neck request changes via orchestrator) |
| `scripts/body/npc_body.gd`, `body_segment.gd`, `data/body_parts.json` | dismember-agent |
| `scripts/body/pose/**`, `data/pose.json` | ik-agent |
| `scripts/ai/**`, `data/ai.json` | ai-agent |
| `scripts/fx/**`, `data/gore.json` | fx-audio-agent |
| `scripts/weapons/**`, `scripts/player/**`, `scripts/ui/**`, `scenes/**`, `data/weapons.json` | weapons-ui-agent |
| `tests/acceptance_test.*`, `docs/REVIEW.md` | systems-review-agent |

Data-driven: every tunable lives in `data/*.json`. Adding a weapon = adding a JSON entry.
