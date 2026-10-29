## OWNER: body-ragdoll-dismember-agent. Public API is contractual (docs/CONTRACTS.md).
## Segmented body: 15 BodySegments (RigidBody3D), 6DOF joints, procedural animation (kinematic),
## ragdoll, hit impulses, dismemberment. Tunables: data/body_parts.json.
class_name NpcBody
extends Node3D

## Emitted after a part subtree is detached (Npc also re-emits part_severed).
signal part_detached(part_id: int, severed_root: RigidBody3D)

const P := BodyIds.Part
## Parents before children.
const ORDER: Array[int] = [P.TORSO, P.NECK, P.HEAD, P.UPPER_ARM_L, P.LOWER_ARM_L, P.UPPER_ARM_R,
	P.LOWER_ARM_R, P.UPPER_LEG_L, P.LOWER_LEG_L, P.UPPER_LEG_R, P.LOWER_LEG_R,
	P.HAND_L, P.HAND_R, P.FOOT_L, P.FOOT_R]

var npc: Npc

var _cfg: Dictionary = {}
var _segments: Dictionary = {}   # part id -> BodySegment (kept after severing)
var _joints: Dictionary = {}     # child part id -> Generic6DOFJoint3D
var _rest: Dictionary = {}       # part id -> Vector3 centre rel. torso centre (rest pose)
var _joint_rest: Dictionary = {} # part id -> Vector3 joint pos rel. torso centre
var _jp: Dictionary = {}         # joint position in parent-centre frame
var _cfj: Dictionary = {}        # part centre relative to its joint
var _limits: Dictionary = {}     # part id -> {x_min,x_max,y,z} radians
var _mover: CharacterBody3D
var _mover_shape: CollisionShape3D
var _hip_h := 0.88

var _ragdoll := false
var _pose: StringName = &"idle"
var _desired_vel := Vector3.ZERO
var _clutch_target := -1
var _pose_driver := PoseDriver.new()  # procedural posing (scripts/body/pose/)
var _held: MeshInstance3D = null
var _held_part := -1


func setup(owner_npc: Npc) -> void:
	npc = owner_npc
	_cfg = DataDB.table("body_parts")
	_hip_h = float(_cfg.get("hip_height", 0.88))
	_build()
	npc.part_broken.connect(func(id: int): set_part_broken(id, true))


# ------------------------------------------------------------------ build

func _pc(pid: int) -> Dictionary:
	return _cfg["parts"][BodyIds.key(pid)]


func _col(a, mul := 1.0) -> Color:
	return Color(float(a[0]) * mul, float(a[1]) * mul, float(a[2]) * mul)


func _build() -> void:
	var cols: Dictionary = _cfg.get("colors", {})
	var var_amt := float(cols.get("skin_variation", 0.15))
	var skin_mul := 1.0 + npc.rng.randf_range(-var_amt, var_amt)
	var skin := _col(cols.get("skin", [0.85, 0.66, 0.55]), skin_mul)
	var shirts: Array = cols.get("shirt_list", [[0.3, 0.3, 0.5]])
	var pants: Array = cols.get("pants_list", [[0.2, 0.2, 0.25]])
	var mats := {
		"skin": _mat(skin),
		"shirt": _mat(_col(shirts[npc.rng.randi() % shirts.size()])),
		"pants": _mat(_col(pants[npc.rng.randi() % pants.size()])),
	}
	var npc_fwd := npc.global_basis.z
	var root := Transform3D(Basis(Vector3.UP, atan2(npc_fwd.x, npc_fwd.z)), npc.global_position)

	# mover
	var mc: Dictionary = _cfg.get("mover", {})
	_mover = CharacterBody3D.new()
	_mover.name = "Mover"
	_mover.collision_layer = BodyIds.LAYER_NPC_MOVER
	_mover.collision_mask = BodyIds.LAYER_WORLD
	_mover_shape = CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = float(mc.get("radius", 0.3))
	cap.height = float(mc.get("height", 1.72))
	_mover_shape.shape = cap
	_mover_shape.position.y = cap.height * 0.5
	_mover.add_child(_mover_shape)
	_mover.top_level = true  # global == local, independent of the (possibly rotated) Npc
	_mover.transform = root  # set before add_child: bodies must never exist at the origin
	add_child(_mover)

	for pid in ORDER:
		var d := _pc(pid)
		_rest[pid] = BodySegment._v3(d["rest"])
		if d.get("joint") != null:
			_joint_rest[pid] = BodySegment._v3(d["joint"])
		var lim = d.get("limits")
		if lim != null:
			_limits[pid] = {
				"x_min": deg_to_rad(float(lim["x"][0])), "x_max": deg_to_rad(float(lim["x"][1])),
				"y": deg_to_rad(float(lim["y"])), "z": deg_to_rad(float(lim["z"]))}
		var seg := BodySegment.new()
		seg.build(pid, npc, d, mats[d.get("color", "skin")], _cfg)
		_segments[pid] = seg
	for pid in ORDER:
		if pid == P.TORSO:
			continue
		var par: int = BodyIds.PARENT[pid]
		_jp[pid] = _joint_rest[pid] - _rest[par]
		_cfj[pid] = _rest[pid] - _joint_rest[pid]

	# Rest pose is assigned BEFORE entering the tree (top_level: transform == global). A body that
	# first appears at the origin would overlap whatever lies there and be depenetrated violently
	# (this launched other NPCs' corpses). Joints are made afterwards from this pose.
	var half := {}
	for pid in ORDER:
		half[pid] = (_segments[pid] as BodySegment).half
	_pose_driver.setup({"order": ORDER, "rest": _rest, "joint_rest": _joint_rest, "jp": _jp, "cfj": _cfj,
		"limits": _limits, "half": half, "hip_height": _hip_h})
	var rest_xf := _pose_driver.rest_pose(root, _attached_set())
	for pid in ORDER:
		var sg: BodySegment = _segments[pid]
		sg.transform = rest_xf[pid]
		add_child(sg)
	for pid in ORDER:
		if pid != P.TORSO:
			_make_joint(pid, root.basis)
	_add_exceptions()
	_make_held_item()


func _mat(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.85
	return m


func _make_joint(pid: int, basis: Basis) -> void:
	var par: int = BodyIds.PARENT[pid]
	var pseg: BodySegment = _segments[par]
	var cseg: BodySegment = _segments[pid]
	var j := Generic6DOFJoint3D.new()
	j.name = "J_" + BodyIds.key(pid)
	j.top_level = true
	add_child(j)
	j.global_transform = Transform3D(basis, pseg.global_transform * _jp[pid])
	var l: Dictionary = _limits[pid]
	for axis in 3:
		_jflag(j, axis, Generic6DOFJoint3D.FLAG_ENABLE_LINEAR_LIMIT, true)
		_jparam(j, axis, Generic6DOFJoint3D.PARAM_LINEAR_LOWER_LIMIT, 0.0)
		_jparam(j, axis, Generic6DOFJoint3D.PARAM_LINEAR_UPPER_LIMIT, 0.0)
		_jflag(j, axis, Generic6DOFJoint3D.FLAG_ENABLE_ANGULAR_LIMIT, true)
	_jparam(j, 0, Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, l["x_min"])
	_jparam(j, 0, Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, l["x_max"])
	_jparam(j, 1, Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, -l["y"])
	_jparam(j, 1, Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, l["y"])
	_jparam(j, 2, Generic6DOFJoint3D.PARAM_ANGULAR_LOWER_LIMIT, -l["z"])
	_jparam(j, 2, Generic6DOFJoint3D.PARAM_ANGULAR_UPPER_LIMIT, l["z"])
	j.node_a = j.get_path_to(pseg)
	j.node_b = j.get_path_to(cseg)
	_joints[pid] = j


func _jflag(j: Generic6DOFJoint3D, axis: int, flag: int, v: bool) -> void:
	match axis:
		0: j.set_flag_x(flag, v)
		1: j.set_flag_y(flag, v)
		_: j.set_flag_z(flag, v)


func _jparam(j: Generic6DOFJoint3D, axis: int, prm: int, v: float) -> void:
	match axis:
		0: j.set_param_x(prm, v)
		1: j.set_param_y(prm, v)
		_: j.set_param_z(prm, v)


## No collisions between neighbours: ancestors up to 3 steps up (so hands/feet ignore the torso too) and
## siblings -> no self-collision explosions.
func _add_exceptions() -> void:
	for a in ORDER:
		for b in ORDER:
			if a >= b:
				continue
			if _close(a, b) or _close(b, a) or BodyIds.PARENT[a] == BodyIds.PARENT[b]:
				(_segments[a] as BodySegment).add_collision_exception_with(_segments[b])


## True if `anc` is within 3 steps above `pid`.
func _close(pid: int, anc: int) -> bool:
	var p: int = BodyIds.PARENT[pid]
	for i in 3:
		if p < 0:
			return false
		if p == anc:
			return true
		p = BodyIds.PARENT[p]
	return false


func _make_held_item() -> void:
	var hc: Dictionary = _cfg.get("held_item", {})
	var seg: BodySegment = _segments[P.HAND_R]
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = BodySegment._v3(hc.get("size", [0.07, 0.14, 0.012]))
	mi.mesh = bm
	mi.material_override = _mat(_col(hc.get("color", [0.08, 0.08, 0.1])))
	mi.name = "Phone"
	seg.add_child(mi)
	# held in the palm (right palm faces +X): phone's thin axis along the hand's X, screen toward the thumb side
	mi.rotation = Vector3(0, PI * 0.5, 0)
	mi.position = Vector3(seg.half.x + 0.006, -seg.half.y * 0.2, 0)
	seg.held_item = mi
	_held = mi
	_held_part = P.HAND_R


# ------------------------------------------------------------------ queries

func _seg(part_id: int) -> BodySegment:
	var s = _segments.get(part_id)
	return s if is_instance_valid(s) else null


func get_part_global_transform(part_id: int) -> Transform3D:
	var s := _seg(part_id)
	return s.global_transform if s else global_transform


func get_part_half_extents(part_id: int) -> Vector3:
	var s := _seg(part_id)
	return s.half if s else Vector3(0.1, 0.1, 0.1)


func get_part_node(part_id: int) -> Node3D:
	return _seg(part_id)


func has_part(part_id: int) -> bool:
	var s := _seg(part_id)
	return s != null and s.attached


func get_center() -> Vector3:
	var s := _seg(P.TORSO)
	return s.global_position if s else global_position


func get_forward() -> Vector3:
	var b: Basis = _mover.global_basis
	if _ragdoll:
		var s := _seg(P.TORSO)
		if s:
			b = s.global_basis
	var f := Vector3(b.z.x, 0.0, b.z.z)
	if f.length() < 0.2:
		f = Vector3(b.y.x, 0.0, b.y.z)
	return f.normalized() if f.length() > 0.001 else Vector3.BACK


func is_ragdoll() -> bool:
	return _ragdoll


func get_debug_info() -> Dictionary:
	var att: Array = []
	for pid in ORDER:
		if has_part(pid):
			att.append(BodyIds.key(pid))
	var held := ""
	if is_instance_valid(_held):
		held = "phone"
	return {"mode": "ragdoll" if _ragdoll else "animated", "pose": String(_pose),
		"attached": att, "held_item": held}


# ------------------------------------------------------------------ control

func set_locomotion(velocity: Vector3, pose: StringName) -> void:
	_desired_vel = Vector3(velocity.x, 0.0, velocity.z)
	_pose = pose


func set_clutch_target(part_id: int) -> void:
	_clutch_target = part_id


## One-shot upper-body action over the current pose (e.g. &"punch"). Returns seconds until its impact
## moment; 0.0 while ragdolled, for an unknown action, or if the driver cannot play actions.
func play_action(action: StringName) -> float:
	if _ragdoll or not _pose_driver.has_method("play_action"):
		return 0.0
	return float(_pose_driver.play_action(action))


## Seconds until a severed piece / dropped item is freed: GameSettings.auto_cleanup_time when > 0.
func _cleanup_s() -> float:
	var t := float(GameSettings.auto_cleanup_time)
	return t if t > 0.0 else float(_cfg.get("severed_cleanup_s", 120.0))


func set_limp_side(side: String) -> void:
	_pose_driver.set_limp_side(side)


func set_part_broken(part_id: int, broken := true) -> void:
	_pose_driver.set_part_broken(part_id, broken)


func set_clutch_wound(part_id: int, local_pos: Vector3, local_normal: Vector3) -> void:
	_pose_driver.set_clutch_wound(part_id, local_pos, local_normal)


func set_ragdoll(enabled: bool) -> void:
	if enabled == _ragdoll:
		return
	if enabled:
		_ragdoll = true
		for pid in ORDER:
			var s := _seg(pid)
			if s and s.attached:
				s.make_dynamic()
		_mover.collision_layer = 0
		_mover.collision_mask = 0
		_mover.velocity = Vector3.ZERO
	else:
		_get_up()


func _get_up() -> void:
	var torso := _seg(P.TORSO)
	if torso == null:
		return
	var tp := torso.global_position
	# facing from torso: front axis, or head direction when lying flat on front/back
	var f := Vector3(torso.global_basis.z.x, 0.0, torso.global_basis.z.z)
	if f.length() < 0.35:
		f = Vector3(torso.global_basis.y.x, 0.0, torso.global_basis.y.z)
	var yaw := _mover.global_rotation.y
	if f.length() > 0.05:
		yaw = atan2(f.x, f.z)
	var y := tp.y - _hip_h - torso.half.y
	var q := PhysicsRayQueryParameters3D.create(tp + Vector3.UP * 0.3, tp + Vector3.DOWN * 3.0,
		BodyIds.LAYER_WORLD)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	if hit:
		y = hit.position.y
	var from := {}
	for pid in ORDER:
		var s := _seg(pid)
		if s and s.attached:
			from[pid] = s.global_transform
			s.make_kinematic()
	_mover.global_transform = Transform3D(Basis(Vector3.UP, yaw), Vector3(tp.x, y, tp.z))
	_mover.velocity = Vector3.ZERO
	_mover.collision_layer = BodyIds.LAYER_NPC_MOVER
	_mover.collision_mask = BodyIds.LAYER_WORLD
	_pose_driver.begin_get_up(from)
	_ragdoll = false


# ------------------------------------------------------------------ hits

func apply_hit_impulse(ev: DamageEvent) -> void:
	var s := _seg(ev.part_id)
	if s == null:
		return
	var imp := ev.impactor_velocity * ev.impactor_mass * float(_cfg.get("hit_impulse_scale", 1.0))
	imp = imp.limit_length(float(_cfg.get("max_hit_impulse", 80.0)))
	if imp.length() < 0.001:
		return
	if s.freeze:
		_pose_driver.on_hit(ev.part_id, imp, s.mass)
	else:
		s.apply_impulse(imp, ev.hit_position - s.global_position)


# ------------------------------------------------------------------ dismemberment

## Immortal NPCs: DamageSystem never requests HEAD/NECK severs for them. This function does not check
## npc.immortal itself (it would sever if asked).
func sever_part(part_id: int, ev: DamageEvent) -> RigidBody3D:
	if part_id == P.TORSO or not has_part(part_id):
		return null
	# Only segments still attached move: descendants severed earlier already live in their own Severed_* container.
	var ids: Array[int] = [part_id]
	for d in BodyIds.descendants_of(part_id):
		if has_part(d):
			ids.append(d)
	var host: Node = npc.get_parent() if npc and npc.get_parent() else self
	var container := Node3D.new()
	container.name = "Severed_%s_%d" % [BodyIds.key(part_id), npc.npc_id if npc else 0]
	host.add_child(container)
	var root_seg: BodySegment = _segments[part_id]
	# joints: cut link to parent, others move with the pieces
	var moving_joints: Array = []
	if _joints.has(part_id):
		var cut: Node = _joints[part_id]
		_joints.erase(part_id)
		cut.queue_free()
		remove_child(cut)
	for pid in ids:
		if pid != part_id and _joints.has(pid) and (_joints[pid] as Node).get_parent() == self:
			var j: Node = _joints[pid]
			remove_child(j)
			moving_joints.append(j)
	var segs: Array[BodySegment] = []
	for pid in ids:
		var s: BodySegment = _segments[pid]
		var lin := s.tracked_lin if s.freeze else s.linear_velocity
		var ang := s.tracked_ang if s.freeze else s.angular_velocity
		var xf := s.global_transform
		remove_child(s)
		container.add_child(s)
		s.global_transform = xf
		s.attached = false
		s.freeze = false
		s.linear_velocity = lin
		s.angular_velocity = ang
		s.sleeping = false
		segs.append(s)
	for j in moving_joints:
		container.add_child(j)
	# impulse from the cutting blow
	var imp := ev.impactor_velocity * ev.impactor_mass * float(_cfg.get("hit_impulse_scale", 1.0))
	imp = imp.limit_length(float(_cfg.get("max_hit_impulse", 80.0)))
	root_seg.apply_impulse(imp, ev.hit_position - root_seg.global_position)
	# TODO(roadmap: stump caps): place cap meshes at the cut on root_seg and on the parent's end.
	var timer := Timer.new()
	timer.one_shot = true
	timer.wait_time = _cleanup_s()
	timer.timeout.connect(container.queue_free)
	container.add_child(timer)
	timer.start()
	part_detached.emit(part_id, root_seg)
	return root_seg


func drop_held_item(side: String) -> bool:
	if side != "r" or not is_instance_valid(_held):
		return false
	var seg := _seg(_held_part)
	if seg == null or not seg.attached:
		return false  # went with the severed arm
	var hc: Dictionary = _cfg.get("held_item", {})
	var rb := RigidBody3D.new()
	rb.name = "DroppedPhone"
	rb.mass = float(hc.get("mass", 0.2))
	rb.collision_layer = BodyIds.LAYER_DEBRIS
	rb.collision_mask = BodyIds.LAYER_WORLD | BodyIds.LAYER_DEBRIS
	var size := BodySegment._v3(hc.get("size", [0.07, 0.14, 0.012]))
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new(); bs.size = size
	cs.shape = bs
	rb.add_child(cs)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new(); bm.size = size
	mi.mesh = bm
	mi.material_override = _held.material_override
	rb.add_child(mi)
	var host: Node = npc.get_parent() if npc and npc.get_parent() else self
	host.add_child(rb)
	rb.global_transform = _held.global_transform
	rb.linear_velocity = seg.tracked_lin if seg.freeze else seg.linear_velocity
	rb.angular_velocity = seg.tracked_ang if seg.freeze else seg.angular_velocity
	# Timer lives on the dropped body itself: nothing captures this NpcBody (it may be freed first).
	var timer := Timer.new()
	timer.one_shot = true
	timer.wait_time = _cleanup_s()
	timer.timeout.connect(rb.queue_free)
	rb.add_child(timer)
	timer.start()
	_held.queue_free()
	seg.held_item = null
	_held = null
	return true


# ------------------------------------------------------------------ per-frame

func _physics_process(delta: float) -> void:
	if _mover == null:
		return
	if _ragdoll:
		var s := _seg(P.TORSO)
		if s:
			_mover.global_position = Vector3(s.global_position.x, _mover.global_position.y, s.global_position.z)
		return
	_animated_step(delta)


func _attached_set() -> Dictionary:
	var out := {}
	for pid in ORDER:
		if has_part(pid):
			out[pid] = true
	return out


func _animated_step(dt: float) -> void:
	var mc: Dictionary = _cfg.get("mover", {})
	# --- mover
	var v := _mover.velocity
	var hv := Vector2(v.x, v.z).move_toward(Vector2(_desired_vel.x, _desired_vel.z),
		float(mc.get("accel", 20.0)) * dt)
	v.x = hv.x
	v.z = hv.y
	if _mover.is_on_floor():
		v.y = -0.5
	else:
		v.y -= 9.8 * dt
	_mover.velocity = v
	_mover.move_and_slide()
	if _desired_vel.length() > 0.15:
		var yaw := atan2(_desired_vel.x, _desired_vel.z)
		_mover.rotation.y = lerp_angle(_mover.rotation.y, yaw,
			minf(1.0, float(mc.get("turn_rate", 10.0)) * dt))
	var speed := Vector2(_mover.velocity.x, _mover.velocity.z).length()

	# --- pose (PoseDriver) -> kinematic segments
	var clutch := _clutch_target if (_clutch_target >= 0 and has_part(_clutch_target)) else -1
	var clutch_pos := get_part_global_transform(clutch).origin if clutch >= 0 else Vector3.ZERO
	var xfs := _pose_driver.update(_pose, speed, dt, _mover.global_transform, _attached_set(),
		clutch, clutch_pos)
	for pid in xfs:
		var s := _seg(pid)
		if s:
			s.snap(xfs[pid], dt)
