# Gore Sandbox

Physics-driven injury sandbox (Godot 4.4 + Jolt, GDScript). Adult, fictional, single-player.
Spawn NPCs and injure them with firearms, blades and blunt weapons: localized wounds, simulated bleeding,
pain/panic AI, fractures, dismemberment with capped stumps, chunk-based head damage, blood staining.

## Play
Open the folder in Godot 4.4+ (Forward+ renderer) and run `scenes/main.tscn`.

| Input | Action |
|---|---|
| WASD / mouse / Space | move / look / jump |
| 1–7 | handgun, knife, bat, rifle, shotgun, machete, hammer |
| LMB / RMB | fire or swing / knife thrust |
| Shift + mouse | free swing (swing speed follows the mouse) |
| E or MMB (hold) | grab a ragdoll limb, severed piece, gib or prop; LMB while holding throws |
| N | spawn an NPC; the Spawner panel spawns groups and props |
| F1 | debug overlay (blood, wounds, state per NPC) |
| Esc | release the mouse (needed to click UI panels) |

Settings panel: panic, scream, ragdoll-only, fight back, slow-mo on kill, immortal dummy, gore intensity,
no dismemberment, auto cleanup, time scale.

## Tests (headless)
`godot --headless --path . res://tests/<name>_test.tscn` — smoke, ai, damage, body, pose, arms, legs, head_neck,
penetrating, blunt, weapons_fx, fx, limb_integration, acceptance (~6 min), injury_consistency (~13 min).
Perf: `godot --headless --fixed-fps 60 --path . res://tools/perf_bench.tscn -- npcs=20`.
Renders: see `tools/README.md` (xvfb + `--rendering-driver opengl3`).
Regenerate body meshes after editing `data/body_mesh.json`: `godot --headless --path . res://tools/bake_body_meshes.tscn`.

## Docs
`docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/REVIEW.md`,
`docs/LIMB_CHECKLIST.md`, `docs/INJURY_CONSISTENCY.md`. Agent roster: `.claude/agents/`.
