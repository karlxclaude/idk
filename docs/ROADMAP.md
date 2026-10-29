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
- **Next — milestone 3**: hit-reaction additives, fight-back mode, remaining toggles (slow-mo, immortal dummy, gore intensity,
  no-dismember, cleanup timer); injury-consistency overseer pass.
