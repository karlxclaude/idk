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

| Folder | Owner | Contents |
|---|---|---|
| `scripts/contracts`, `scripts/core`, `scripts/npc`, `project.godot` | orchestrator | contracts, autoloads, NPC wiring |
| `scripts/damage`, `data/injury.json`, `data/blood.json` | damage-wounds-bleed-agent | damage rules, wounds, bleeding |
| `scripts/body`, `data/body_parts.json` | body-ragdoll-dismember-agent | segments, joints, ragdoll, severing |
| `scripts/ai`, `data/ai.json` | ai-states-agent | FSM, pain/shock |
| `scripts/weapons`, `scripts/player`, `scripts/fx`, `scripts/ui`, `scenes/`, `data/weapons.json`, `data/gore.json` | weapons-fx-agent | weapons, player, FX, overlay, main scene |
| `tests/acceptance_test.*` | review-agent | end-to-end acceptance |

Data-driven: every tunable lives in `data/*.json`. Adding a weapon = adding a JSON entry.
