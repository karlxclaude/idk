# scripts/body
Segmented NPC body. Owner: body-ragdoll-dismember-agent. Tunables: data/body_parts.json.

- `npc_body.gd` (NpcBody): builds 11 `BodySegment`s + Generic6DOF joints + a CharacterBody3D "Mover".
- `body_segment.gd` (BodySegment): RigidBody3D with collider/mesh/metas; kinematic while animated.
- Frame: feet at Npc origin, body front = +Z, NPC left = +X. `get_forward()` is the body +Z.
- Animated: mover walks, segments are posed by FK every physics frame (poses: idle, walk, run,
  clutch (2-bone IK hand to clutch target), stagger, crawl). Pose angles are smoothed and kept inside joint limits.
- Ragdoll: segments unfreeze with tracked velocities. Get-up re-freezes, mover placed under torso, 0.6 s blend.
- Hits: animated -> decaying flinch offset; ragdoll/severed -> apply_impulse (impactor_velocity * mass).
- sever_part: cuts joint to parent, reparents subtree + inner joints into a `Severed_*` node under
  npc.get_parent(), freed after `severed_cleanup_s`. Piece keeps layer npc_parts and metas.
- Held item "phone" is a child of lower_arm_r; drop_held_item("r") turns it into a debris RigidBody3D.
- Test: `godot --headless --path . res://tests/body_test.tscn`
