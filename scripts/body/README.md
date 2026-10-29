# scripts/body
Segmented NPC body. Owner: body-ragdoll-dismember-agent. Tunables: data/body_parts.json.

- `npc_body.gd` (NpcBody): builds 15 `BodySegment`s (incl. hands and feet) + Generic6DOF joints + a CharacterBody3D "Mover".
- `body_segment.gd` (BodySegment): RigidBody3D with collider/mesh/metas; kinematic while animated.
- Frame: feet at Npc origin, body front = +Z, NPC left = +X. `get_forward()` is the body +Z.
- Animated: mover walks; posing lives in `pose/` (PoseDriver, see pose/README.md, data/pose.json) (poses: idle, walk, run,
  clutch (2-bone IK hand to clutch target), stagger, crawl). Pose angles are smoothed and kept inside joint limits.
- Ragdoll: segments unfreeze with tracked velocities. Get-up re-freezes, mover placed under torso, 0.6 s blend.
- Hits: animated -> decaying flinch offset; ragdoll/severed -> apply_impulse (impactor_velocity * mass).
- sever_part: cuts joint to parent, reparents subtree + inner joints into a `Severed_*` node under
  npc.get_parent(), freed after `severed_cleanup_s`. Piece keeps layer npc_parts and metas.
- Held item "phone" is a child of hand_r (a severed hand_r takes it along); drop_held_item("r") turns it into a debris RigidBody3D.
- Per-part optional keys in body_parts.json: `col_pad` (collision shape fatter than mesh), `lin_damp`, `ang_damp`
  (hands/feet are light: higher damping). Collision exceptions cover ancestors up to 3 steps and siblings.
- Visuals: `"visual": "baked"` in body_parts.json uses lofted meshes from `assets/body/` (bake: `godot --headless --path . res://tools/bake_body_meshes.tscn`,
  profiles in data/body_mesh.json, shader `body_vc.gdshader` colours the vertex-colour regions per NPC). Hidden stump/severed caps and a
  joint ball per joint; sever_part shows the caps and hides the ball. Falls back to primitives if assets are missing. Colliders stay primitive.
  Visual check: `xvfb-run -a godot --path . --rendering-driver opengl3 res://tests/body_visual.tscn` -> tools/captures/body_*.png.
- Test: `godot --headless --path . res://tests/body_test.tscn`
