# Roadmap (Phase 2 plug-in points)

Each item has a `TODO(roadmap: <name>)` comment at its plug-in point.

| Item | Plug-in point |
|---|---|
| Chunk-based head damage (jaw/face/cranium) | `BodyIds.Part` gains sub-parts; DamageSystem head rule; `TODO(roadmap: head chunks)` |
| Stump cap meshes / mesh segmentation | `NpcBody.sever_part`; `TODO(roadmap: stump caps)` |
| IK clutching | `NpcBody.set_clutch_target`; `TODO(roadmap: ik clutch)` |
| Fight-back mode | `NpcState.FIGHT` in NpcBrain; `TODO(roadmap: fight back)` |
| Extra weapons (shotgun, rifle, machete, hammer, explosives) | `data/weapons.json` entries + `DamageEvent.Type.EXPLOSIVE`; `TODO(roadmap: weapons)` |
| Extra toggles (slow-mo, immortal dummy, gore intensity, no-dismember, cleanup timer) | `GameSettings`; `TODO(roadmap: extra toggles)` |
| Advanced gore (wetness, arterial spray, mist, drips) | GoreFX; `TODO(roadmap: advanced gore)` |
| Blood staining on bodies/clothing | GoreFX + body materials; `TODO(roadmap: blood staining)` |
| Hands, feet, head sub-segments | `BodyIds` (contract change, orchestrator) |
| Stuck blades | weapons + DamageSystem; `TODO(roadmap: stuck blades)` |

## Status
- **V1**: done (acceptance 6/6).
- **Milestone 2**: done — Phase 2 agent roster, injury pipeline (mechanism + region rules), pose/IK module, hands and feet,
  limp gait, broken-limb posing, palm-to-wound clutch. Tests: 9 unit scenes + limb_integration (549) + acceptance (104), all green.
  Deferred: realistic CC0 humanoid assets (with milestone 4 segmentation), leg severing (milestone 5 heavy weapons).
- **Milestone 3**: done — direction/part-aware hit reactions with stagger steps, cower + fight poses, punch action, FIGHT state
  (fight-back hurts the player; player HP/regen/faint), immortal dummy, gore intensity, no-dismemberment, slow-mo on kill,
  time-scale slider, corpse/severed auto-cleanup, settings panel. Injury-consistency overseer: 6 findings fixed.
  Tests: 11 scenes green (acceptance 128, limb_integration 575, injury_consistency 50).
- **Milestone 4**: done — Godot-native offline bake (`tools/bake_body_meshes.tscn`) of 15 lofted body meshes with exact seams,
  vertex-colour clothing (per-NPC tint shader), joint balls, and 28 flesh/bone stump + severed caps shown on sever (~10.7k tris visible).
  Proportions pass (shoulders, neck, torso taper, face hints). Blender/CC0-model generator deferred (no external downloads here).
- **Milestone 5**: done — head damage chunks (jaw/face/cranium/occiput zones in the head segment: per-chunk hp and lethality,
  rifle spill, baked chunk meshes + wound caps + gibs, jaw→gurgle, face→disoriented), rifle (multi-body penetration),
  shotgun (pellets/spread/falloff), machete (arm/leg severing), hammer; energy/caliber-scaled bullet wounds; momentum/contact-area
  blunt force. Tests: 14 scenes green (acceptance 161, injury_consistency 91, limb_integration 575).
- **Next — milestone 6**: GoreFX pass — wound decals on skin/clothing (entry/exit), layered blood wetness/staining that runs
  downward, arterial spray, drips, mist for fast bullets, growing pools; layered audio (real CC0 assets need downloads).

## Tuning backlog (from docs/INJURY_CONSISTENCY.md suggestions; not bugs)
- Bullet/stab bleed ignores hit strength; bullet penetration constant (0.45 m) regardless of velocity → scale with velocity/caliber (pairs with milestone 5 calibers).
- Impactor mass ignored by injury (only weapon-side damage uses it) → blunt force should use momentum.
- Headshot kill margin thin (51 vs 48); single bullet never breaks arm/thigh/shin; chest/abdomen gunshots are slow killers (back to IDLE by 20 s).
- Torso/neck/limb HP have no standalone consequence; bat to the neck only bruises.
- Consolidate duplicated sever/immortal/fracture-guard logic and move hard-coded tunables out of bullet/slash/stab/torso rules.
- (M5 sweep) Shotgun pellets are judged one by one against head lethal_damage, so a point-blank 5-pellet head blast is not lethal;
  consider per-event-group (shot) accumulation. One buckshot pellet to the neck bleeds like a full arterial wound.
- (M5 sweep) Momentum only affects force-based outcomes; HP/bleed ignore impactor mass. Hammer breaks every long bone at a normal swing.
- (M5 sweep) Consolidate: immortal rule in 11 spots, two part-thickness sources, double chunk type multipliers, three head-lethality routes.
