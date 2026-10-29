# Decisions log

- **GDScript over C#**: container has no .NET SDK; GDScript avoids tooling friction. Whole project stays GDScript.
- **Godot 4.4.1**: Jolt is built in (`physics/3d/physics_engine="Jolt Physics"`), no addon needed.
- **Primitive body** (capsules/boxes) for v1; no external meshes, so CREDITS.md has no assets yet.
- **JSON data files** (not .tres) loaded by `DataDB` autoload: diff-friendly and hand-editable.
- **NPC built in code** (`Npc.spawn`) instead of a .tscn so no two agents edit one scene file.
- **Brain is the sole owner of NPC state**; damage/blood report facts (`lethal_injury`, `blood_level_changed`) and the brain decides.
- **Weapons compute raw `amount`/`penetration`** from their stats + velocity; DamageSystem applies per-part rules.

## AI (ai-states-agent)
- Exertion is a pure function of state: IDLE 0, ALERT 0.3, PANIC_FLEE 1.0, CRAWL 0.6, CLUTCH_WOUND 0.3, STAGGER 0.2.
- Pain per wound = severity × type weight × part weight (+ fracture bonus), decays; `get_pain()` = sum / pain_tolerance, clamped 0..1.
- Shock is informational only; BloodSystem levels stay authoritative for collapse/death.
- Torso hit severity ≥ 0.6 → CLUTCH_WOUND 2–4 s; other hits → PANIC_FLEE (panic on) or STAGGER (off); bruise < 0.3 only staggers.
- Neck arterial → CLUTCH_WOUND on neck with gurgle, no scream; blood level takes over.
- Stun ≥ 2 s = knockdown (ragdoll, UNCONSCIOUS, wake timer); blood CRITICAL → UNCONSCIOUS (no wake); FATAL → DEAD.
- Brain tracks its own `_ragdolled` flag; steers inside arena by reflecting heading.

## Damage / blood (damage-wounds-bleed-agent)
- Torso chest vs abdomen = `hit_local_normalized.y > 0`. Exit wound only when `ev.penetration` > part thickness.
- Arterial pulse = `1 + amp·sin(2π·phase)` (mean 1); heart rate 70→160 bpm with loss; flow tapers linearly with volume.
- Dead bleed at 0.35× flow, no pulse. Clotting only for small non-arterial/stump/exit wounds.
- Non-slash `can_dismember` severs only at 2× dismember threshold. Neck sever destroys head → `decapitated`. Lethal reported once.
- Fracture when accumulated damage ≥ `fracture_accum` or blunt `amount` ≥ `fracture_force`. Head HP accumulates (repeated hits kill).
- `BloodSystem.step(delta)` is public so tests can simulate deterministically.

## Body (body-ragdoll-dismember-agent)
- Body front is +Z (contract); `get_forward()` returns +Z. The Npc node never moves — a child CharacterBody3D "Mover" does; use `npc.body.get_center()`.
- Alive = kinematic segments posed by FK each frame (idle/walk/run/clutch/stagger/crawl); ragdoll = unfreeze with tracked velocities. Clutch uses 2-bone IK for the free hand.
- Crawl is an animated prone pose, not ragdoll-driven. Stability via damping (lin 0.3, ang 4.0) + collision exceptions, default Jolt solver.
- Severed subtrees are reparented under the NPC's parent with a 120 s cleanup timer; the phone goes with a severed right arm.

## Weapons / FX (weapons-fx-agent)
- Melee hits: 3 sample points per weapon swept frame-to-frame; each uses its own velocity; knife stab vs slash = angle to blade axis.
- Below `min_velocity` the event has amount 0 and is not delivered. LMB = scripted arc (speed_scale divides duration), RMB knife = thrust, Shift = mouse-driven free swing.
- Wound emitters are GPUParticles3D on the part node, rate driven by `wound.current_flow`. Decals capped, oldest removed first. One pool per downed NPC.
- AudioCues plays an asset from `gore.json` if present, else a procedural blip.

## Review fixes (round 1)
- NpcBrain is the sole source of vocal cues (grunt/gurgle/scream), once per DamageEvent; neck hits never scream; death scream skipped for headshot/decapitation.
- Head `lethal_damage` 48 so one 9mm headshot kills; upper-arm sever threshold 45: only a fast Shift free-swing knife slash (~11 m/s) severs arms/neck; a normal LMB slash (7.1 m/s) severs hands (knife `dismember_min_velocity` 6.0).

## Milestone 2
- Phase 2 agent roster in `.claude/agents/` (v1 definitions archived in `docs/agents_v1/`). Added **weapons-ui-agent**: the Phase 2 list had no owner for weapons/player/UI.
- Injury logic split into a pipeline (`HitContext` + `InjuryRule`): mechanism rules (penetrating, blunt) then region rules (head, neck, torso, arm, leg), commit in DamageSystem (bleed-agent). Lets region and mechanism agents own separate files.
- Body split: physics body (dismember-agent) vs pose/IK module `scripts/body/pose/` (ik-agent).
- Clutch-neck behaviour and gurgle audio stay with ai-agent (brain owns behaviour and vocal cues); head-neck-agent owns the injury side only.
- "Better assets" deferred to milestone 4 with the Blender segmentation pipeline: swapping meshes before segmentation exists would be redone.
- Pipeline details: shared fracture/sever-threshold logic in `regions/limb_base.gd` (arm/leg/neck); rules are `preload`ed, not `class_name`d. Slash stores unscaled bleed in `ctx.tags.base_ext` so the neck rule keeps arterial flow unscaled; blunt bruise passes via `ctx.tags.bruise`. `high_damage_sever_mult` repeated per region file (each rule reads only its own data). EXPLOSIVE still routes through slash.
- PoseDriver (RefCounted owned by NpcBody) returns per-part target transforms; parts without a pose rotation stay at rest relative to parent.
- Hands/feet: hand 0.5 kg, foot 1.0 kg; lower arms/legs shortened to keep 1.81 m / 75 kg. Phone held in `hand_r`. Collision exceptions extend 3 ancestors up + siblings. `col_pad` fattens small colliders without changing hit half-extents.
- Hand: 20 HP, sever threshold 18 (fast knife slash), bleed ×0.5. Foot: 30 HP, fracture_force 25, sever 40. Foot fracture => limp (brain), leg bone break / leg or foot loss => crawl.
- Limp is a pose + speed modifier with a side ("l"/"r"/"both"), not an NpcState. Clutch uses the nearest sound arm.
- body_test corpse-drift threshold relaxed to 4 m (drift is chaotic, 1.2–3 m); the launch regression is guarded by the peak-speed ≤ 25 m/s check.
- Leg severing (thigh 70 / shin 55) stays out of reach of the v1 knife on purpose; it arrives with the machete/heavy weapons in milestone 5. Hands/feet and arms remain knife-severable.

## Milestone 4
- Segmented body meshes are generated by a Godot-native offline bake (`tools/bake_body_meshes.tscn`, dismember-agent) instead of a
  Blender + downloaded CC0 model pipeline: no external downloads in this environment. Each part is a lofted mesh whose end rings match
  its neighbours so the assembled body reads as one continuous figure; closed stump caps (flesh + bone) are baked per joint for both
  sides, hidden until severed. Meshes are saved as resources under `assets/body/` and loaded at runtime; primitives remain as fallback.
  A Blender/CC0-model path can later replace the generator behind the same baked-resource interface.
