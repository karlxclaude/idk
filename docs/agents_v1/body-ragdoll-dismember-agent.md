---
name: body-ragdoll-dismember-agent
description: Owns the segmented NPC body, colliders, joints, animated/ragdoll blending, hit impulses, simple dismemberment and cleanup.
model: sonnet
---
## Ownership
scripts/body/** (npc_body.gd + helpers e.g. body_segment.gd), data/body_parts.json, tests/body_test.gd, tests/body_test.tscn.

## Scope
- Build 11 segments (BodyIds.Part) from data/body_parts.json: primitive capsule/box mesh + collider, mass, size,
  rest offset, joint limits. Adult ~1.8 m tall, total mass ~75 kg. Each segment is a RigidBody3D on layer npc_parts
  (BodyIds.LAYER_NPC_PARTS), mask world|npc_parts|debris (no self-collision explosions: exclude jointed neighbours),
  with meta BodyIds.META_NPC = npc and META_PART_ID = id. Segment local axes MUST follow CONTRACTS.md (+Y up in rest
  pose, +Z = body front, +X = NPC's left) so DamageSystem zone logic works. get_part_half_extents returns real half sizes.
  Simple skin-ish material; slight per-NPC colour variation via npc.rng.
- Joints: Generic6DOFJoint3D (or ConeTwist/Hinge) per segment to its parent with sensible limits (elbows/knees hinge,
  shoulders/hips cone, neck limited). Ragdolls must be stable: no jitter explosions (reasonable damping, solver iterations,
  mass ratios, exclude parent collisions).
- Animated mode (alive): a CharacterBody3D mover (layer npc_mover, collides with world) moved by set_locomotion
  (velocity, pose); segments are kinematic (freeze, FREEZE_MODE_KINEMATIC) and posed procedurally each physics frame:
  idle, walk/run cycle (leg/arm swing scaled by speed), clutch (hunched, a hand toward set_clutch_target part),
  stagger (wobble), crawl (low prone pose moving slowly). Body faces its movement direction. Track per-segment velocity
  so switching to ragdoll keeps momentum.
- apply_hit_impulse(ev): impulse = ev.impactor_velocity * ev.impactor_mass (clamped, data-driven scale) at hit point.
  Ragdolled/severed segment: apply_impulse. Animated: short additive flinch offset on that part/torso (decays ~0.3 s).
- set_ragdoll(true): unfreeze all attached segments, carry velocities. set_ragdoll(false): get up — re-freeze and
  blend back to standing at the torso's x/z (simple snap/lerp is fine). is_ragdoll().
- sever_part(id, ev): remove joint between part and parent; part + descendants become a free rigid sub-ragdoll on
  layer npc_parts (still hittable, keep metas) carrying velocity + impulse from ev. Reparent it out of the mover
  hierarchy to the scene (npc.get_parent()) so it persists when the NPC moves. Return the RigidBody3D for id.
  has_part false afterwards. Severed parts despawn after a cleanup timer (body_parts.json "severed_cleanup_s", default
  120). Losing the head/legs while animated: the brain will request ragdoll/crawl, you just support it. Never let parts vanish early.
  TODO(roadmap: stump caps) at the cut point.
- Held item: spawn a small box prop ("phone") in the right hand (end of lower_arm_r); drop_held_item("r") detaches it
  as a RigidBody3D (layer debris) with velocity. Arm severed -> held item goes with the severed arm (fine) or drops.
- get_debug_info(): mode (animated/ragdoll), pose, attached part list, held item.

## Acceptance tests (tests/body_test.tscn, headless; floor StaticBody3D on layer world; brain is a stub so drive
body API directly)
1. Spawn Npc; all 11 segments exist with correct metas/layers; half extents sane; raycast from front at chest hits TORSO
   and hit_local z > 0 (front).
2. set_locomotion(Vector3(2,0,0), &"run") for 2 s moves the NPC ~4 m and it stays upright.
3. set_ragdoll(true) then simulate 5 s: no NaN, no segment > 3 m from torso, max speed settles < 0.5 m/s (stable).
4. sever_part(UPPER_ARM_L) -> returns RigidBody3D, has_part false for both arm parts, piece on floor after 3 s, still
   has metas. 5. drop_held_item("r") returns true once then false.
Print PASS/FAIL per test, quit non-zero on failure.
