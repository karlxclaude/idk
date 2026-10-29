# scripts/body/pose - NpcBody <-> PoseDriver (internal interface)
`PoseDriver` (RefCounted, owned by NpcBody as `_pose_driver`) computes WHERE animated parts go; NpcBody owns
physics bodies. The driver never touches nodes. Tunables: data/pose.json. Tests: tests/pose_test.tscn
(driver only), tests/pose_visual.tscn (renders poses under xvfb).
NpcBody -> driver:
- `setup(layout)`: dicts keyed by part id: order, rest, joint_rest, jp, cfj, limits (radians), half, hip_height.
- `rest_pose(root_xf, attached) -> {id: Transform3D}`: standing pose for placement.
- `update(pose, speed, dt, mover_xf, attached, clutch_part, clutch_pos) -> {id: Transform3D}` once per animated
  physics frame (attached parts only; NpcBody `snap()`s them). clutch_pos = centre of clutch_part (world).
  Includes smoothing, foot plant, additive flinch, get-up blend. Poses: idle, walk, run, limp, clutch, stagger,
  crawl; unknown -> idle.
- `on_hit(part_id, impulse, part_mass)`, `begin_get_up(from_xfs)` (ragdoll -> animated blend).
- Optional hints (NpcBody forwards them): `set_limp_side("l"|"r"|"both"|"")` (brain: `set_locomotion(v, &"limp")` + side; "" = infer from broken or
  missing legs, else limp.default_side), `set_part_broken(id, bool)` / `set_broken_parts(ids)` (arm hangs limp
  and sways, a broken leg is held off the floor and the torso rolls over the sound leg; crawl ignores legs),
  `set_clutch_wound(part_id, local_pos, local_normal)` (exact palm contact; default = front face).

Behaviour: feet are kept level in the world by ankle compensation (heel strike dorsiflex, toe-off plantarflex,
toe-out) and the body is shifted vertically so the lowest weight-bearing sole touches the floor (`plant`
weights per pose; run floats). Hands relax, trail the arm swing. Clutch: nearest sound arm (never the wounded
one) is solved by 2-bone IK with the elbow swivelled so the palm faces the wound; out of reach -> extra forward
bend and squat. Crawl: palm-down IK hand steps on the floor. Limp: phase warp (injured stance short), shorter
injured stride, stance knee bend, torso rolls and dips over the good leg.

Parts: hand/foot rows come from the layout; a part without a rotation entry stays at rest. Severed parts are
skipped; hand missing -> the forearm tip clutches.
Hand palm normal = local X (thickness = half.x); foot toes = local +Z. Wrist uses x/y/z limits (wider z and
y = better palm contact). Sign conventions: +X rotation moves a hanging limb backward (flexion negative at
hip/shoulder/elbow, positive at knee, ankle plantarflex +). Left side sign = +1, right = -1.
