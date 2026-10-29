## Procedural posing for NpcBody (owner of "what pose": ik-agent). Pure computation: no physics nodes.
## Interface documented in scripts/body/pose/README.md. Tunables: data/pose.json.
class_name PoseDriver
extends RefCounted

const P := BodyIds.Part

var _cfg: Dictionary = {}
var _order: Array[int] = []
var _rest: Dictionary = {}
var _joint_rest: Dictionary = {}
var _jp: Dictionary = {}
var _cfj: Dictionary = {}
var _limits: Dictionary = {}
var _half: Dictionary = {}
var _hip_h := 0.88
var _torso_hy := 0.3

var _t := 0.0
var _phase := 0.0
var _cur_rot: Dictionary = {}
var _cur_torso := Basis.IDENTITY
var _cur_hip := 0.88
var _blend_t := 1.0
var _blend_from: Dictionary = {}
var _flinch: Dictionary = {}   # part id -> {"off": Vector3, "t": float}


## layout (from NpcBody): order, rest, joint_rest, jp, cfj, limits, half (all keyed by part id), hip_height.
func setup(layout: Dictionary) -> void:
	_cfg = DataDB.table("pose")
	_order.assign(layout["order"])
	_rest = layout["rest"]
	_joint_rest = layout["joint_rest"]
	_jp = layout["jp"]
	_cfj = layout["cfj"]
	_limits = layout["limits"]
	_half = layout["half"]
	_hip_h = float(layout["hip_height"])
	_cur_hip = _hip_h
	_torso_hy = (_half[P.TORSO] as Vector3).y


## Rest (standing, identity) world transforms of all parts for a mover frame.
func rest_pose(root_xf: Transform3D, attached: Dictionary) -> Dictionary:
	return _fk(root_xf, _hip_h, Basis.IDENTITY, {}, attached)


## Hit reaction (additive flinch). Call for animated (kinematic) parts only.
func on_hit(part_id: int, impulse: Vector3, part_mass: float) -> void:
	var fc: Dictionary = _cfg["flinch"]
	var mag := minf(impulse.length() / part_mass * float(fc["gain"]), float(fc["max"]))
	var off := impulse.normalized() * mag
	_flinch[part_id] = {"off": off, "t": float(fc["time"])}
	if part_id != P.TORSO:
		_flinch[P.TORSO] = {"off": off * float(fc["torso_share"]), "t": float(fc["time"])}


## Ragdoll -> animated: blend from the given world transforms (part id -> Transform3D) to the pose.
func begin_get_up(from_xfs: Dictionary) -> void:
	_blend_from = from_xfs.duplicate()
	_cur_rot.clear()
	_cur_torso = Basis.IDENTITY
	_cur_hip = _hip_h
	_blend_t = 0.0


## One frame. mover_xf: feet frame (+Z front). attached: {part id: true}. clutch_part: part id or -1,
## clutch_pos: its world position. Returns {part id: world Transform3D} for attached parts only.
func update(pose: StringName, speed: float, dt: float, mover_xf: Transform3D, attached: Dictionary,
		clutch_part: int, clutch_pos: Vector3) -> Dictionary:
	_t += dt
	var pt := _pose_target(pose, speed, dt, mover_xf, clutch_part, clutch_pos)
	var k := 1.0 - exp(-float(_cfg["blend_rate"]) * dt)
	_cur_hip = lerpf(_cur_hip, pt.hip, k)
	_cur_torso = Basis(Quaternion(_cur_torso).slerp(Quaternion(pt.torso), k))
	var tgt_rots: Dictionary = pt.rots
	for pid in tgt_rots:
		var cur: Basis = _cur_rot.get(pid, Basis.IDENTITY)
		_cur_rot[pid] = Basis(Quaternion(cur).slerp(Quaternion(tgt_rots[pid]), k))
	var xfs := _fk(mover_xf, _cur_hip, _cur_torso, _cur_rot, attached)

	var ft := float(_cfg["flinch"]["time"])
	var shift := Vector3.ZERO
	if _flinch.has(P.TORSO) and _flinch[P.TORSO]["t"] > 0.0:
		shift = _flinch[P.TORSO]["off"] * (_flinch[P.TORSO]["t"] / ft)
	var bl := 1.0
	if _blend_t < 1.0:
		_blend_t = minf(1.0, _blend_t + dt / maxf(0.05, float(_cfg["get_up_blend_s"])))
		bl = smoothstep(0.0, 1.0, _blend_t)
	for pid in xfs:
		var xf: Transform3D = xfs[pid]
		if bl < 1.0 and _blend_from.has(pid):
			xf = (_blend_from[pid] as Transform3D).interpolate_with(xf, bl)
		var off := shift
		var fl = _flinch.get(pid)
		if fl != null and fl["t"] > 0.0:
			if pid != P.TORSO:
				off += fl["off"] * (fl["t"] / ft)
			fl["t"] = maxf(0.0, fl["t"] - dt)
		xf.origin += off
		xfs[pid] = xf
	return xfs


## Forward kinematics of attached parts. Parts whose parent is missing are skipped.
func _fk(root_xf: Transform3D, hip: float, torso_b: Basis, rots: Dictionary, attached: Dictionary) -> Dictionary:
	var out := {}
	var tb := root_xf.basis * torso_b
	var pivot := root_xf.origin + root_xf.basis * Vector3(0, hip, 0)
	out[P.TORSO] = Transform3D(tb, pivot + tb * Vector3(0, _torso_hy, 0))
	for pid in _order:
		if pid == P.TORSO:
			continue
		var par: int = BodyIds.PARENT[pid]
		if not out.has(par) or not attached.has(pid):
			continue
		var r: Basis = rots.get(pid, Basis.IDENTITY)
		out[pid] = (out[par] as Transform3D) * Transform3D(r, _jp[pid] + r * _cfj[pid])
	return out


func _eb(pid: int, x: float, y: float = 0.0, z: float = 0.0) -> Basis:
	var l: Dictionary = _limits[pid]
	return Basis.from_euler(Vector3(clampf(x, l["x_min"], l["x_max"]),
		clampf(y, -l["y"], l["y"]), clampf(z, -l["z"], l["z"])))


func _id(base: String, side: String) -> int:
	return BodyIds.from_key(base + "_" + side)


## Target {hip, torso, rots} for a pose. Sign conventions: rotation about +X by + moves a hanging
## limb backwards (shoulder/hip/elbow flexion negative; knee flexion positive). Parts without a
## rotation entry stay at identity (rest) relative to their parent: new parts need only add rows here.
func _pose_target(pose: StringName, speed: float, dt: float, mover_xf: Transform3D,
		clutch_part: int, clutch_pos: Vector3) -> Dictionary:
	var rots := {}
	var hip := _hip_h
	var torso := Basis.IDENTITY
	var t := _t
	match pose:
		&"walk", &"run":
			var c: Dictionary = _cfg["gait"]
			_phase += dt * TAU * clampf(float(c["cycle_hz_per_speed"]) * speed, 0.0, float(c["cycle_hz_max"]))
			var sf := clampf(speed / float(c["speed_full"]), 0.0, 1.0)
			var amp := clampf(float(c["amp_base"]) + float(c["amp_per_speed"]) * speed,
				float(c["amp_base"]), float(c["amp_max"])) * sf
			var s := sin(_phase)
			var cs := cos(_phase)
			var lean := clampf(speed * float(c["lean_per_speed"]), 0.0, float(c["lean_max"]))
			var run_f := smoothstep(float(c["run_from"]), float(c["run_to"]), speed)
			var twist := float(c["torso_twist"])
			torso = Basis.from_euler(Vector3(lean, s * twist * sf, 0.0))
			hip = _hip_h - float(c["hip_drop"]) * sf + float(c["hip_bounce"]) * sf * absf(cs)
			rots[P.NECK] = _eb(P.NECK, -lean * float(c["neck_lean"]))
			rots[P.HEAD] = _eb(P.HEAD, -lean * float(c["neck_lean"]), -s * float(c["head_twist"]) * sf)
			for side in ["l", "r"]:
				var sg := 1.0 if side == "l" else -1.0
				var sw := sg * s
				var cw := sg * cs
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), -amp * sw - lean, 0.0, sg * float(c["leg_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side),
					float(c["knee_base"]) + float(c["knee_amp"]) * amp * maxf(0.0, cw))
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_amp"]) * amp * sw, 0.0, sg * float(c["arm_abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), -(float(c["elbow_base"]) + float(c["elbow_run"]) * run_f))
		&"clutch":
			var c: Dictionary = _cfg["clutch"]
			var pitch := float(c["pitch"])
			torso = Basis.from_euler(Vector3(pitch, 0.0, sin(t * float(c["roll_hz"])) * float(c["roll_amp"])))
			hip = _hip_h - float(c["hip_drop"])
			rots[P.NECK] = _eb(P.NECK, float(c["neck"]))
			rots[P.HEAD] = _eb(P.HEAD, float(c["head"]))
			for side in ["l", "r"]:
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), -pitch + float(c["leg_extra"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee"]))
			var free_side := "l"
			var has_t := clutch_part >= 0
			if has_t and BodyIds.side_of(clutch_part) == "r":
				free_side = "r"
			var other := "r" if free_side == "l" else "l"
			var sgo := 1.0 if other == "l" else -1.0
			rots[_id("upper_arm", other)] = _eb(_id("upper_arm", other), float(c["other_arm"]), 0.0, sgo * float(c["other_abduct"]))
			rots[_id("lower_arm", other)] = _eb(_id("lower_arm", other), float(c["other_elbow"]))
			var fu := _id("upper_arm", free_side)
			var fl := _id("lower_arm", free_side)
			var sgf := 1.0 if free_side == "l" else -1.0
			if has_t:
				var tb := mover_xf.basis * _cur_torso
				var pivot := mover_xf.origin + mover_xf.basis * Vector3(0, _cur_hip, 0)
				var tc := Transform3D(tb, pivot + tb * Vector3(0, _torso_hy, 0))
				var ik := _arm_ik(fu, tc.affine_inverse() * clutch_pos)
				rots[fu] = ik[0]
				rots[fl] = ik[1]
			else:
				rots[fu] = _eb(fu, float(c["free_arm"]), 0.0, sgf * float(c["free_abduct"]))
				rots[fl] = _eb(fl, float(c["free_elbow"]))
		&"stagger":
			var c: Dictionary = _cfg["stagger"]
			var sw := sin(t * float(c["hz"]))
			torso = Basis.from_euler(Vector3(float(c["pitch"]), sin(t * float(c["twist_hz"])) * float(c["twist_amp"]), sw * float(c["roll_amp"])))
			hip = _hip_h - float(c["hip_drop"])
			rots[P.NECK] = _eb(P.NECK, 0.0, 0.0, -sw * float(c["neck_roll"]))
			rots[P.HEAD] = _eb(P.HEAD, 0.0, 0.0, -sw * float(c["neck_roll"]))
			for side in ["l", "r"]:
				var sg := 1.0 if side == "l" else -1.0
				var ph := sin(t * float(c["leg_hz"])) * sg
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), float(c["hip_base"]) + float(c["hip_amp"]) * ph, 0.0, sg * float(c["hip_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee_base"]) + float(c["knee_amp"]) * maxf(0.0, ph))
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_amp"]) * sin(t * float(c["arm_hz"]) + sg), 0.0, sg * float(c["arm_abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c["elbow"]))
		&"crawl":
			var c: Dictionary = _cfg["crawl"]
			_phase += dt * TAU * clampf(float(c["cycle_hz_per_speed"]) * speed + float(c["cycle_hz_base"]), 0.0, float(c["cycle_hz_max"]))
			var s := sin(_phase)
			torso = Basis.from_euler(Vector3(float(c["torso_pitch"]), 0.0, 0.0))
			hip = float(c["hip"])
			rots[P.NECK] = _eb(P.NECK, float(c["neck"]))
			rots[P.HEAD] = _eb(P.HEAD, float(c["head"]))
			for side in ["l", "r"]:
				var sg := 1.0 if side == "l" else -1.0
				var sw := sg * s
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_base"]) + float(c["arm_amp"]) * sw, 0.0, sg * float(c["arm_abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c["elbow_base"]) + float(c["elbow_amp"]) * maxf(0.0, sw))
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), 0.0, 0.0, sg * float(c["leg_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee_base"]) + float(c["knee_amp"]) * sw)
		_:  # idle
			var c: Dictionary = _cfg["idle"]
			var b := sin(t * float(c["breath_hz"]))
			torso = Basis.from_euler(Vector3(float(c["pitch_amp"]) * b, 0.0, sin(t * float(c["roll_hz"])) * float(c["roll_amp"])))
			hip = _hip_h + float(c["hip_bob"]) * b
			for side in ["l", "r"]:
				var sg := 1.0 if side == "l" else -1.0
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_swing"]) * b, 0.0,
					sg * (float(c["arm_abduct"]) + float(c["arm_abduct_breath"]) * b))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c["elbow"]))
	return {"hip": hip, "torso": torso, "rots": rots}


## Two-bone IK for an arm, in torso-centre space. Returns [upper_basis, lower_basis].
func _arm_ik(upper_id: int, target_local: Vector3) -> Array:
	var lower_id := _id("lower_arm", BodyIds.side_of(upper_id))
	var a: float = (_half[upper_id] as Vector3).y * 2.0
	var b: float = (_half[lower_id] as Vector3).y * 2.0
	var d: Vector3 = target_local - (_joint_rest[upper_id] as Vector3)
	var dist := clampf(d.length(), 0.12, a + b - 0.02)
	var tdir := d.normalized() if d.length() > 0.001 else Vector3.DOWN
	var phi := acos(clampf((a * a + b * b - dist * dist) / (2.0 * a * b), -1.0, 1.0))
	var alpha := acos(clampf((a * a + dist * dist - b * b) / (2.0 * a * dist), -1.0, 1.0))
	var n := Vector3(0, 0, 1).cross(tdir)
	n = n.normalized() if n.length() > 0.05 else Vector3.RIGHT
	var u := tdir.rotated(n, alpha)
	var by := -u
	var bz := n.cross(by)
	return [Basis(n, by, bz).orthonormalized(), Basis(Vector3.RIGHT, -(PI - phi))]
