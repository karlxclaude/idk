# Contracts (frozen for v1 — agents read, never edit)

Owned by the orchestrator. If you need a change, STOP and report it to the orchestrator.

Contract files: `scripts/contracts/*.gd`, `scripts/core/*.gd`, `scripts/npc/npc.gd`, `project.godot`.
Language: **GDScript**, Godot 4.4, Jolt physics. Data in `res://data/*.json`, read via `DataDB.table("name")`.

## Data structs (`scripts/contracts/`)
| Class | Purpose | Mutated only by |
|---|---|---|
| `BodyIds` | Part enum, `PARENT` hierarchy, `KEYS` (json keys), `NpcState`, `BloodLevel`, `Tissue`, physics layers, collider meta keys, helpers (`children_of`, `descendants_of`, `is_arm`, `is_leg`, `side_of`, `npc_from_collider`, `part_from_collider`) | — |
| `DamageEvent` | `{type, amount, hit_position, hit_normal, direction, impactor_velocity, impactor_mass, penetration, can_dismember, weapon_id, source, part_id, extra}` + `hit_local`, `hit_local_normalized`, `time` filled by `Npc.apply_damage` | weapon (creates) |
| `Wound` | `{id, part_id, type, local_position, local_normal, local_direction, severity, bleed_rate, internal_bleed_rate, is_arterial, is_exit, is_stump, is_fracture, is_bruise, created_time, current_flow, detached}` | WoundSystem/DamageSystem create; BloodSystem writes `current_flow`; WoundSystem sets `detached` |
| `BodyPart` | runtime injury state `{part_id, tissue, max_hp, hp, broken, severed, destroyed, bruise, hit_count}` | DamageSystem |
| `BloodState` | `{max_volume, volume, external_rate, internal_rate, level, heart_rate, pulse_phase}` | BloodSystem |

Damage types: `BULLET, BLADE_STAB, BLADE_SLASH, BLUNT` (`EXPLOSIVE` reserved).
States: `IDLE, ALERT, PANIC_FLEE, CLUTCH_WOUND, STAGGER, CRAWL, UNCONSCIOUS, DEAD, FIGHT(stub)`.
Blood levels: `NORMAL, LIGHT, HEAVY, CRITICAL, FATAL`.

## Skeleton
```
TORSO (root)
├── NECK ── HEAD
├── UPPER_ARM_L ── LOWER_ARM_L      ├── UPPER_ARM_R ── LOWER_ARM_R
└── UPPER_LEG_L ── LOWER_LEG_L      └── UPPER_LEG_R ── LOWER_LEG_R
```
Part-local axes (rest pose, arms hanging): **+Y up, +Z front of body (facing), +X NPC's left.**
`DamageEvent.hit_local_normalized` = hit_local / half-extents (≈ -1..1 per axis). Torso: y>0 is chest (heart/lung), y<0 abdomen.

Every body-part collider (attached or severed) carries metadata `npc` (Npc) and `part_id` (int) and is on physics layer `npc_parts` (bit 2). Severed pieces stay on `npc_parts` so they can still be hit. Layers: 1 world, 2 npc_parts, 3 player, 4 weapons, 5 debris, 6 npc_mover.

## NPC composition (`scripts/npc/npc.gd`, class `Npc`)
`Npc.spawn(parent, xform, seed)` creates children Body (`NpcBody`), Wounds (`WoundSystem`), Blood (`BloodSystem`), Damage (`DamageSystem`), Brain (`NpcBrain`), then calls `setup(npc)` on each in that order. `npc.rng` is a seeded RNG for per-NPC randomness.

Flow: weapon → `npc.apply_damage(ev)` → fills local hit → `damage.apply(ev)` → `body.apply_hit_impulse(ev)`.

### Signals (on Npc; also re-emitted on `GameEvents` with npc first)
| Signal | Emitted via helper | Called by |
|---|---|---|
| `wounded(wound, ev)` | `emit_wounded` | DamageSystem |
| `part_broken(part_id)` | `emit_part_broken` | DamageSystem |
| `part_severed(part_id, severed_root, ev)` | `notify_part_severed(part_id, ev)` (calls `body.sever_part` first) | DamageSystem, once per cut (subtree root) |
| `state_changed(old, new)` | `emit_state_changed` | NpcBrain |
| `died(cause)` | `emit_died` | NpcBrain (on entering DEAD) |
| `stunned(duration, cause)` | `emit_stunned` | DamageSystem (concussion, head graze, winded) |
| `lethal_injury(cause)` | `report_lethal_injury` | DamageSystem (head destroyed, decapitation) → brain kills |
| `blood_level_changed(old, new)` | `emit_blood_level_changed` | BloodSystem |
`npc.cue(name, intensity)` → `GameEvents.audio_cue` (scream, grunt, gurgle, pain_breath, bone_crack, sever, body_fall...).
`GameEvents` also has `npc_spawned`, `world_impact(pos, normal, ev)`, `audio_cue(npc, cue, pos, intensity)`.

### Component APIs (stubs in place; owners implement, must keep signatures)
- **NpcBody** (`scripts/body/npc_body.gd`): `get_part_global_transform(id)`, `get_part_half_extents(id)`, `get_part_node(id)`, `has_part(id)`, `get_center()`, `get_forward()`, `apply_hit_impulse(ev)`, `sever_part(id, ev) -> RigidBody3D`, `set_ragdoll(bool)`, `is_ragdoll()`, `set_locomotion(velocity, pose)` (poses: idle, walk, run, clutch, stagger, crawl), `set_clutch_target(id)`, `drop_held_item(side) -> bool`, `get_debug_info()`, signal `part_detached`.
- **DamageSystem**: `apply(ev) -> Array[Wound]`, `get_part(id) -> BodyPart`, `get_parts()`, `get_debug_info()`.
- **WoundSystem**: `get_wounds()`, `get_wounds_on(id)`, `get_attached_wounds()`, `get_debug_info()` (+ internal add/detach API used by DamageSystem — same owner).
- **BloodSystem**: `state: BloodState`, `get_debug_info()`. Reads `npc.get_exertion()` (running worsens bleed).
- **NpcBrain**: `state`, `get_exertion()`, `get_pain()`, `force_state(s)`, `get_debug_info()`. Only the brain changes `state` and calls `body.set_ragdoll/set_locomotion/drop_held_item`.

### Settings (`GameSettings` autoload)
`panic_enabled`, `scream_enabled`, `ragdoll_only`, `debug_overlay`; `set_setting(name, value)` emits `changed`.

## Tests
Scene-based: `tests/<name>.tscn` with a root script that sets up, simulates via `await get_tree().physics_frame`, prints PASS/FAIL lines and calls `get_tree().quit(code)`.
Run: `godot --headless --path . res://tests/<name>.tscn`. After adding new `class_name` scripts run `godot --headless --path . --import` once.

## Injury pipeline (milestone 2)
`DamageSystem.apply(ev)`:
1. Build `HitContext` (`scripts/contracts/hit_context.gd`): part state, part data row, `region`, `detached`, `base_damage`.
2. **Mechanism rule** for `ev.type` (`scripts/damage/mechanisms/{bullet,stab,slash,blunt}.gd`, each `extends InjuryRule`): sets `damage`, `depth`, `passes_through`, `force`, base `wounds`.
3. **Region rule** for `ctx.region` (`scripts/damage/regions/{head,neck,torso,arm,leg}.gd`): arterial/organ bleed, fracture/sever/destroy/stun/lethal requests.
4. **Commit** (DamageSystem): HP, wounds → WoundSystem, fracture → `emit_part_broken`, sever → `notify_part_severed` + stump, stun → `emit_stunned`, lethal → `report_lethal_injury`, `cues` → `npc.cue`, then `emit_wounded` per wound.
Rules only fill the context; they never mutate state or emit. Each rule reads only its own data file:
`data/injury/core.json` (pipeline/commit), `penetrating.json`, `blunt.json`, `head_neck.json`, `torso.json`, `arms.json`, `legs.json` (per-part rows live in their region's file).

## Body split (milestone 2)
`NpcBody` keeps segments, joints, mover, ragdoll, impulses, severing, held item. Procedural posing, locomotion animation,
hit-reaction additives and IK live in `scripts/body/pose/` behind an internal interface documented in `scripts/body/pose/README.md`.
