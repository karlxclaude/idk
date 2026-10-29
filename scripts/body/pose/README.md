# scripts/body/pose - NpcBody <-> PoseDriver (internal interface)
`PoseDriver` (RefCounted, owned by NpcBody as `_pose_driver`) computes WHERE animated parts go; NpcBody
owns physics bodies. The driver never touches nodes. Tunables: data/pose.json (physical data: body_parts.json).

NpcBody -> driver:
- `setup(layout)`: dicts keyed by part id: order, rest, joint_rest, jp, cfj, limits (radians), half, hip_height.
- `rest_pose(root_xf, attached) -> {id: Transform3D}`: standing pose used for initial placement.
- `update(pose, speed, dt, mover_xf, attached, clutch_part, clutch_pos) -> {id: Transform3D}` once per
  animated physics frame. World transforms for attached parts only (`attached = {id: true}`); NpcBody
  calls `BodySegment.snap()` with them. Includes smoothing, additive flinch and get-up blend.
- `on_hit(part_id, impulse, part_mass)`: flinch for an animated part (decays, torso gets a share).
- `begin_get_up(from_xfs)`: ragdoll -> animated; blends from the given world transforms.
Poses: idle, walk, run, clutch (2-bone arm IK to clutch_pos), stagger, crawl; unknown -> idle.

Adding parts (HAND_*, FOOT_*): add rows to body_parts.json (rest/joint/limits). The driver builds joint offsets
from the layout; a part with no entry in a pose's `rots` stays at rest relative to its parent. Add its
rotations in `_pose_target` (`rots[id] = _eb(id, x, y, z)`; `_eb` clamps to joint limits).

Conventions: +X rotation moves a hanging limb backward (hip/shoulder/elbow flexion negative, knee positive).
Part-local +Y up, +Z front, +X NPC left. Left side sign = +1, right = -1 for abduction.
