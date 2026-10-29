## Procedural posing for NpcBody (owner of "what pose": ik-agent). Pure computation: no physics nodes.
## Interface documented in scripts/body/pose/README.md. Tunables: data/pose.json.
class_name PoseDriver
extends RefCounted

const P := BodyIds.Part
const POSES: Array[StringName] = [&"idle", &"walk", &"run", &"limp", &"clutch", &"stagger", &"crawl", &"cower", &"fight"]

var _cfg: Dictionary = {}
var _limp_cfg: Dictionary = {}   # gait table with the limp overrides merged in
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
var _plant_off := 0.0
var _clutch_extra := 0.0        # extra forward bend / squat when the wound is out of arm's reach
var _blend_t := 1.0
var _blend_from: Dictionary = {}
var _flinch: Dictionary = {}   # part id -> {"off": Vector3, "t": float}
var _reacts: Array = []        # active hit reactions {part, d (mover-local), mag, t, dur, step}
var _action: Dictionary = {}   # active one-shot action {name, side, t}
var _mover := Transform3D.IDENTITY
var _attached: Dictionary = {}
var _last_out: Dictionary = {}  # last returned world transforms (clutch contact estimate)
var _limp_side := ""            # hint: "l", "r", "both" or "" (infer from broken/missing legs)
var _broken: Dictionary = {}    # part id -> true
var _wound := {"part": -1, "pos": Vector3.ZERO, "n": Vector3.ZERO}  # optional exact clutch contact (part-local)


## layout (from NpcBody): order, rest, joint_rest, jp, cfj, limits, half (all keyed by part id), hip_height.
func setup(layout: Dictionary) -> void:
	_cfg = DataDB.table("pose")
	_limp_cfg = (_cfg["gait"] as Dictionary).merged(_cfg["limp"], true)
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


## Hit reaction (additive, layered over any pose): small positional flinch plus direction- and part-aware
## rotations (head snap, torso recoil/hunch, limb jerk, stagger step for big hits). Animated parts only.
func on_hit(part_id: int, impulse: Vector3, part_mass: float) -> void:
	if impulse.length() < 0.001:
		return
	var fc: Dictionary = _cfg["flinch"]
	var mag := minf(impulse.length() / part_mass * float(fc["gain"]), float(fc["max"]))
	var off := impulse.normalized() * mag
	_flinch[part_id] = {"off": off, "t": float(fc["time"])}
	if part_id != P.TORSO:
		_flinch[P.TORSO] = {"off": off * float(fc["torso_share"]), "t": float(fc["time"])}
	var rc: Dictionary = _cfg["react"]
	var m := clampf(impulse.length() / float(rc["ref_impulse"]), float(rc["min_mag"]), 1.0)
	var d := (_mover.basis.inverse() * impulse).normalized()
	var dur := float(rc["time"]) * (0.7 + 0.6 * m)
	if _reacts.size() >= 8:
		_reacts.pop_front()
	_reacts.append({"part": part_id, "d": d, "mag": m, "t": 0.0, "dur": dur, "step": false})
	var sc: Dictionary = rc["step"]
	if m >= float(sc["threshold"]):
		_reacts.append({"part": P.TORSO, "d": d, "mag": m, "t": 0.0, "dur": float(sc["time"]), "step": true})


## One-shot upper-body action layered over the current pose ("punch"). Returns the seconds until its impact
## moment, or 0 (nothing played) for an unknown action or when no sound arm is available.
func play_action(action: StringName) -> float:
	var ac: Dictionary = _cfg["actions"]
	if not ac.has(String(action)):
		return 0.0
	var c: Dictionary = ac[String(action)]
	var order: Array = [String(c["prefer"]), "l" if String(c["prefer"]) == "r" else "r"]
	for side in order:
		if _arm_usable(side):
			_action = {"name": String(action), "side": side, "t": 0.0}
			return float(c["impact"])
	return 0.0


func is_acting() -> bool:
	return not _action.is_empty()


func _arm_usable(side: String) -> bool:
	if _arm_broken(side):
		return false
	return _attached.is_empty() or (_attached.has(_id("upper_arm", side)) and _attached.has(_id("lower_arm", side)))


## Ragdoll -> animated: blend from the given world transforms (part id -> Transform3D) to the pose.
func begin_get_up(from_xfs: Dictionary) -> void:
	_blend_from = from_xfs.duplicate()
	_cur_rot.clear()
	_cur_torso = Basis.IDENTITY
	_cur_hip = _hip_h
	_plant_off = 0.0
	_blend_t = 0.0


## Which leg limps in pose `limp`: "l", "r", "both" or "" (infer from broken / missing legs).
func set_limp_side(side: String) -> void:
	_limp_side = side if side in ["l", "r", "both"] else ""


func get_limp_side() -> String:
	return _limp_side_eff()


## Broken parts: arms hang limp, a broken leg is not weight-bearing. Either call style works.
func set_part_broken(part_id: int, broken: bool = true) -> void:
	if broken:
		_broken[part_id] = true
	else:
		_broken.erase(part_id)


func set_broken_parts(ids: Array) -> void:
	_broken.clear()
	for id in ids:
		_broken[int(id)] = true


## Optional exact clutch contact: wound position/normal in the clutched part's local space.
## Without it the hand presses on the front surface of the part. part_id -1 clears it.
func set_clutch_wound(part_id: int, local_pos: Vector3 = Vector3.ZERO, local_normal: Vector3 = Vector3.ZERO) -> void:
	_wound = {"part": part_id, "pos": local_pos, "n": local_normal}


## One frame. mover_xf: feet frame (+Z front). attached: {part id: true}. clutch_part: part id or -1,
## clutch_pos: its world position. Returns {part id: world Transform3D} for attached parts only.
func update(pose: StringName, speed: float, dt: float, mover_xf: Transform3D, attached: Dictionary,
		clutch_part: int, clutch_pos: Vector3) -> Dictionary:
	_t += dt
	_attached = attached
	_mover = mover_xf
	if not pose in POSES:
		pose = &"idle"
	var pt := _pose_target(pose, speed, dt, mover_xf, clutch_part, clutch_pos)
	var k := 1.0 - exp(-float(_cfg["blend_rate"]) * dt)
	_cur_hip = lerpf(_cur_hip, pt.hip, k)
	_cur_torso = Basis(Quaternion(_cur_torso).slerp(Quaternion(pt.torso), k))
	var tgt_rots: Dictionary = pt.rots
	for pid in tgt_rots:
		var cur: Basis = _cur_rot.get(pid, Basis.IDENTITY)
		_cur_rot[pid] = Basis(Quaternion(cur).slerp(Quaternion(tgt_rots[pid]), k))
	for pid in _cur_rot.keys():  # parts this pose does not drive relax back to rest
		if not tgt_rots.has(pid) and not pt.ends.has(pid):
			_cur_rot[pid] = Basis(Quaternion(_cur_rot[pid]).slerp(Quaternion(Basis.IDENTITY), k))
	var end_k := 1.0 - exp(-float(_cfg["foot"]["rate"]) * dt)
	# layered additives (not smoothed): hit reactions and one-shot actions
	var rots_f: Dictionary = _cur_rot.duplicate()
	var rx := _react_step(dt, rots_f)
	var ax := _action_step(dt, rots_f)
	var torso_f := Basis.from_euler((rx["torso"] as Vector3) + ax) * _cur_torso
	var xfs := _fk(mover_xf, _cur_hip - float(rx["hip"]), torso_f, rots_f, attached, pt.ends, end_k)

	# foot plant: translate the body so the lowest weight-bearing sole touches the floor
	var pc: Dictionary = _cfg["plant"]
	var low := _lowest_sole(xfs, pt.skip)
	var off_t := 0.0
	if low < INF:
		off_t = clampf(-(low - mover_xf.origin.y) * float(pt.plant), -float(pc["max_drop"]) * float(pt.drop), float(pc["max_lift"]))
	_plant_off = lerpf(_plant_off, off_t, 1.0 - exp(-float(pc["rate"]) * dt))

	var ft := float(_cfg["flinch"]["time"])
	var shift := Vector3(0, _plant_off, 0) + (rx["shift"] as Vector3)
	if _flinch.has(P.TORSO) and _flinch[P.TORSO]["t"] > 0.0:
		shift += _flinch[P.TORSO]["off"] * (_flinch[P.TORSO]["t"] / ft)
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
	_last_out = xfs
	return xfs


## Forward kinematics of attached parts. Parts whose parent is missing are skipped.
## ends: {part id: world Basis}: the part (foot) is oriented in world space by its parent's joint
## (clamped to the joint limits) and eased into _cur_rot with end_k.
func _fk(root_xf: Transform3D, hip: float, torso_b: Basis, rots: Dictionary, attached: Dictionary,
		ends: Dictionary = {}, end_k: float = 1.0) -> Dictionary:
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
		var pxf: Transform3D = out[par]
		var r: Basis = rots.get(pid, Basis.IDENTITY)
		if ends.has(pid):
			var want := _clamp_basis(pid, pxf.basis.inverse() * (ends[pid] as Basis))
			r = want
			if _cur_rot.has(pid):
				r = Basis(Quaternion(_cur_rot[pid]).slerp(Quaternion(want), end_k))
			_cur_rot[pid] = r
		out[pid] = pxf * Transform3D(r, _jp[pid] + r * _cfj[pid])
	return out


## Lowest point (world y) of the weight-bearing soles: the foot box, else the lower leg's end.
func _lowest_sole(xfs: Dictionary, skip: Dictionary) -> float:
	var low := INF
	for side in ["l", "r"]:
		if skip.has(side):
			continue
		for key in ["foot", "lower_leg", "upper_leg"]:
			var pid := _id(key, side)
			if xfs.has(pid) and _half.has(pid):
				low = minf(low, _box_low(xfs[pid], _half[pid]))
				break
	return low


static func _box_low(xf: Transform3D, h: Vector3) -> float:
	var b := xf.basis
	return xf.origin.y - (absf(b.x.y) * h.x + absf(b.y.y) * h.y + absf(b.z.y) * h.z)


func _clamp_basis(pid: int, b: Basis) -> Basis:
	if not _limits.has(pid):
		return b
	var e := b.orthonormalized().get_euler()
	return _eb(pid, e.x, e.y, e.z)


func _eb(pid: int, x: float, y: float = 0.0, z: float = 0.0) -> Basis:
	if not _limits.has(pid):
		return Basis.from_euler(Vector3(x, y, z))
	var l: Dictionary = _limits[pid]
	return Basis.from_euler(Vector3(clampf(x, l["x_min"], l["x_max"]),
		clampf(y, -l["y"], l["y"]), clampf(z, -l["z"], l["z"])))


func _id(base: String, side: String) -> int:
	return BodyIds.from_key(base + "_" + side)


static func _sg(side: String) -> float:
	return 1.0 if side == "l" else -1.0


func _arm_broken(side: String) -> bool:
	return _broken.has(_id("upper_arm", side)) or _broken.has(_id("lower_arm", side)) \
		or _broken.has(_id("hand", side))


func _leg_down(side: String) -> bool:
	return _broken.has(_id("upper_leg", side)) or _broken.has(_id("lower_leg", side)) \
		or _broken.has(_id("foot", side))


func _leg_missing(side: String) -> bool:
	for key in ["upper_leg", "lower_leg", "foot"]:
		var pid := _id(key, side)
		if _half.has(pid) and not _attached.has(pid):
			return true
	return false


## Limping side: hint, else broken/missing legs, else the data default.
func _limp_side_eff() -> String:
	if _limp_side != "":
		return _limp_side
	var l := _leg_down("l") or _leg_missing("l")
	var r := _leg_down("r") or _leg_missing("r")
	if l and r:
		return "both"
	if l:
		return "l"
	if r:
		return "r"
	return String(_cfg["limp"].get("default_side", "l"))


## Target {hip, torso, rots, ends, plant, skip} for a pose. Sign conventions: rotation about +X by + moves a
## hanging limb backwards (shoulder/hip/elbow flexion negative; knee flexion positive; ankle plantarflexion
## positive, toes down). Parts without a rotation entry stay at identity (rest) relative to their parent.
func _pose_target(pose: StringName, speed: float, dt: float, mover_xf: Transform3D,
		clutch_part: int, clutch_pos: Vector3, apply_broken := true) -> Dictionary:
	var rots := {}
	var ends := {}   # foot id -> world basis (flat-foot compensation)
	var hip := _hip_h
	var torso := Basis.IDENTITY
	var t := _t
	var hc: Dictionary = _cfg["hand"]
	var fc: Dictionary = _cfg["foot"]
	var sway_w := 0.0
	if pose != &"clutch":
		_clutch_extra = 0.0
	match pose:
		&"walk", &"run", &"limp":
			var limp := pose == &"limp"
			var c: Dictionary = _limp_cfg if limp else _cfg["gait"]
			_phase = fposmod(_phase + dt * TAU * clampf(float(c["cycle_hz_per_speed"]) * speed, 0.0, float(c["cycle_hz_max"])), TAU)
			var sf := clampf(speed / float(c["speed_full"]), 0.0, 1.0)
			var amp := clampf(float(c["amp_base"]) + float(c["amp_per_speed"]) * speed,
				float(c["amp_base"]), float(c["amp_max"])) * sf
			sway_w = sf
			# limp: warp the phase so the injured leg's stance is short (fast through its stance)
			var inj := ""
			var psi := _phase
			if limp:
				inj = _limp_side_eff()
				if inj == "l" or inj == "r":
					psi = _phase + float(c["asym"]) * sin(_phase - (PI if inj == "l" else 0.0))
			var s := sin(psi)
			var cs := cos(psi)
			var lean := clampf(speed * float(c["lean_per_speed"]), 0.0, float(c["lean_max"]))
			var run_f := smoothstep(float(c["run_from"]), float(c["run_to"]), speed)
			var twist := float(c["torso_twist"])
			var pitch_x := lean
			var roll_z := 0.0
			var neck_z := 0.0
			if limp and (inj == "l" or inj == "r"):
				# weight on the good leg: torso rolls and dips over it
				var sgi := _sg(inj)
				var load_good := 1.0 - smoothstep(-0.1, 0.8, -sgi * cs)
				roll_z = sgi * float(c["roll_good"]) * load_good * sf
				pitch_x += float(c["dip_pitch"]) * load_good * sf
				neck_z = -roll_z * float(c["neck_comp"])
			torso = Basis.from_euler(Vector3(pitch_x, s * twist * sf, roll_z))
			hip = _hip_h - float(c["hip_drop"]) * sf + float(c["hip_bounce"]) * sf * absf(cs)
			rots[P.NECK] = _eb(P.NECK, -lean * float(c["neck_lean"]), 0.0, neck_z)
			rots[P.HEAD] = _eb(P.HEAD, -lean * float(c["neck_lean"]), -s * float(c["head_twist"]) * sf, neck_z)
			for side in ["l", "r"]:
				var sg := _sg(side)
				var sw := sg * s
				var cw := sg * cs
				var hurt: bool = limp and (inj == side or inj == "both")
				var amp_s := amp
				if limp:
					amp_s *= float(c["inj_amp_scale"]) if hurt else float(c["good_amp_scale"])
				var knee := float(c["knee_base"]) + (float(c["knee_amp"]) + float(c["knee_run"]) * run_f) * amp_s * maxf(0.0, cw)
				if hurt:
					knee += float(c["inj_knee_stance"]) * smoothstep(-0.1, 0.8, -cw) * sf
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), -amp_s * sw - lean, 0.0, sg * float(c["leg_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), knee)
				var arm_s := float(c["inj_arm_scale"]) if (limp and hurt) else 1.0
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_amp"]) * amp * arm_s * sw, 0.0, sg * float(c["arm_abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), -(float(c["elbow_base"]) + float(c["elbow_run"]) * run_f))
				# wrist trails the arm swing, fist loosens into the run
				rots[_id("hand", side)] = _eb(_id("hand", side),
					float(hc["idle_x"]) + (float(hc["run_x"]) - float(hc["idle_x"])) * run_f - float(hc["lag"]) * amp * cw,
					0.0, sg * float(hc["idle_z"]))
				# heel strike (toes up) -> flat stance -> toe-off (toes down), foot kept level in the world
				var fsc := float(c["foot_scale"]) * (1.0 - float(fc["run_calm"]) * run_f) * (float(c["inj_foot_scale"]) if (limp and hurt) else 1.0) * sf
				var ex := float(fc["exp"])
				var fp := (float(fc["plantar"]) * pow(maxf(0.0, -sw), ex) - float(fc["dorsi"]) * pow(maxf(0.0, sw), ex)) * fsc + float(fc["run_plantar"]) * run_f
				ends[_id("foot", side)] = mover_xf.basis * Basis.from_euler(Vector3(fp, sg * float(fc["toe_out"]), 0.0))
		&"clutch":
			var c: Dictionary = _cfg["clutch"]
			var extra := _clutch_extra
			var pitch := float(c["pitch"]) + extra
			var sq := extra * float(c["squat"])
			torso = Basis.from_euler(Vector3(pitch, 0.0, sin(t * float(c["roll_hz"])) * float(c["roll_amp"])))
			hip = _hip_h - float(c["hip_drop"])
			rots[P.NECK] = _eb(P.NECK, float(c["neck"]))
			rots[P.HEAD] = _eb(P.HEAD, float(c["head"]))
			for side in ["l", "r"]:
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), -pitch + float(c["leg_extra"]) - sq)
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee"]) + sq)
				ends[_id("foot", side)] = mover_xf.basis * Basis.from_euler(Vector3(0.0, _sg(side) * float(fc["toe_out"]), 0.0))
			var has_t := clutch_part >= 0
			var tc := _torso_frame(mover_xf)
			var ct := [clutch_pos, Vector3.ZERO]
			var free_side := "l"
			if has_t:
				ct = _clutch_contact(clutch_part, clutch_pos, tc)
				free_side = _clutch_side(clutch_part, ct[0], tc)
			var other := "r" if free_side == "l" else "l"
			var sgo := _sg(other)
			rots[_id("upper_arm", other)] = _eb(_id("upper_arm", other), float(c["other_arm"]), 0.0, sgo * float(c["other_abduct"]))
			rots[_id("lower_arm", other)] = _eb(_id("lower_arm", other), float(c["other_elbow"]))
			rots[_id("hand", other)] = _eb(_id("hand", other), float(hc["other_x"]))
			var fu := _id("upper_arm", free_side)
			var fl := _id("lower_arm", free_side)
			var sgf := _sg(free_side)
			if has_t:
				var a := _arm_reach(free_side, tc.affine_inverse() * ct[0], tc.basis.inverse() * (-(ct[1] as Vector3)),
					float(hc["clutch_wrist"]))
				rots[fu] = a[0]
				rots[fl] = a[1]
				rots[_id("hand", free_side)] = a[2]
				# out of reach: bend further forward and squat (smoothed, so the contact keeps moving)
				var reach := ((_half[fu] as Vector3).y + (_half[fl] as Vector3).y) * 2.0 + 0.08
				var excess := ((tc * (_joint_rest[fu] as Vector3)) - (ct[0] as Vector3)).length() - reach
				_clutch_extra = lerpf(_clutch_extra, clampf(excess * float(c["extra_gain"]), 0.0, float(c["extra_max"])),
					1.0 - exp(-float(c["extra_rate"]) * dt))
			else:
				rots[fu] = _eb(fu, float(c["free_arm"]), 0.0, sgf * float(c["free_abduct"]))
				rots[fl] = _eb(fl, float(c["free_elbow"]))
				rots[_id("hand", free_side)] = _eb(_id("hand", free_side), float(hc["free_x"]))
				_clutch_extra = lerpf(_clutch_extra, 0.0, 1.0 - exp(-float(c["extra_rate"]) * dt))
		&"stagger":
			var c: Dictionary = _cfg["stagger"]
			var sw := sin(t * float(c["hz"]))
			torso = Basis.from_euler(Vector3(float(c["pitch"]), sin(t * float(c["twist_hz"])) * float(c["twist_amp"]), sw * float(c["roll_amp"])))
			hip = _hip_h - float(c["hip_drop"])
			sway_w = 1.0
			rots[P.NECK] = _eb(P.NECK, 0.0, 0.0, -sw * float(c["neck_roll"]))
			rots[P.HEAD] = _eb(P.HEAD, 0.0, 0.0, -sw * float(c["neck_roll"]))
			for side in ["l", "r"]:
				var sg := _sg(side)
				var ph := sin(t * float(c["leg_hz"])) * sg
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), float(c["hip_base"]) + float(c["hip_amp"]) * ph, 0.0, sg * float(c["hip_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee_base"]) + float(c["knee_amp"]) * maxf(0.0, ph))
				var aph := sin(t * float(c["arm_hz"]) + sg)
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_amp"]) * aph, 0.0, sg * float(c["arm_abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c["elbow"]))
				rots[_id("hand", side)] = _eb(_id("hand", side), float(hc["stagger_x"]) + float(hc["stagger_amp"]) * aph, 0.0, sg * float(hc["idle_z"]))
				ends[_id("foot", side)] = mover_xf.basis * Basis.from_euler(Vector3(0.0, sg * float(fc["toe_out"]), 0.0))
		&"crawl":
			var c: Dictionary = _cfg["crawl"]
			_phase = fposmod(_phase + dt * TAU * clampf(float(c["cycle_hz_per_speed"]) * speed + float(c["cycle_hz_base"]), 0.0, float(c["cycle_hz_max"])), TAU)
			var s := sin(_phase)
			torso = Basis.from_euler(Vector3(float(c["torso_pitch"]), 0.0, 0.0))
			hip = float(c["hip"])
			sway_w = 0.4
			rots[P.NECK] = _eb(P.NECK, float(c["neck"]))
			rots[P.HEAD] = _eb(P.HEAD, float(c["head"]))
			var tc := _torso_frame(mover_xf)
			var floor_y := mover_xf.origin.y
			for side in ["l", "r"]:
				var sg := _sg(side)
				var sw := sg * s
				var cw := sg * cos(_phase)
				# palms down on the floor: reach, plant, drag back, lift and swing forward again
				var sh := tc * (_joint_rest[_id("upper_arm", side)] as Vector3)
				var tgt := Vector3(sh.x, floor_y + 0.005, sh.z) \
					+ mover_xf.basis.z * (float(c["reach"]) + float(c["reach_amp"]) * sw) \
					+ mover_xf.basis.x * sg * float(c["spread"]) \
					+ Vector3.UP * (float(c["lift"]) * maxf(0.0, cw))
				var a := _arm_reach(side, tc.affine_inverse() * tgt, tc.basis.inverse() * Vector3.DOWN, float(c["wrist"]),
					tc.basis.inverse() * mover_xf.basis.z)
				rots[_id("upper_arm", side)] = a[0]
				rots[_id("lower_arm", side)] = a[1]
				rots[_id("hand", side)] = a[2]
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), 0.0, 0.0, sg * float(c["leg_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee_base"]) + float(c["knee_amp"]) * sw)
				rots[_id("foot", side)] = _eb(_id("foot", side), float(c["foot_x"]))
		&"cower":
			var c: Dictionary = _cfg["cower"]
			var tr := sin(t * float(c["tremor_hz"])) * float(c["tremor"])
			var pitch := float(c["pitch"])
			var sq := float(c["squat"])
			torso = Basis.from_euler(Vector3(pitch + tr * 0.4, 0.0, tr))
			hip = _hip_h - float(c["hip_drop"])
			rots[P.NECK] = _eb(P.NECK, float(c["neck"]))
			rots[P.HEAD] = _eb(P.HEAD, float(c["head"]))
			for side in ["l", "r"]:
				var sg := _sg(side)
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), -pitch + float(c["leg_extra"]) - sq, 0.0, sg * float(c["leg_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c["knee"]) + sq)
				ends[_id("foot", side)] = mover_xf.basis * Basis.from_euler(Vector3(0.0, sg * float(fc["toe_out"]), 0.0))
				# arms up over the head and face (a broken arm hangs instead; the sound one guards alone)
				var solo := _arm_broken("r" if side == "l" else "l")
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["solo_arm"] if solo else c["arm"]) + tr, 0.0,
					sg * float(c["solo_abduct"] if solo else c["abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c["elbow"]) - tr)
				rots[_id("hand", side)] = _eb(_id("hand", side), float(c["hand"]))
		&"fight":
			var c: Dictionary = _cfg["fight"]
			var b := sin(t * float(c["breath_hz"]))
			var w := smoothstep(float(c["walk_from"]), float(c["walk_to"]), speed)
			var lead := String(c["lead"])
			# bladed: the lead shoulder (same side as the lead foot) is turned towards the opponent
			var yaw := float(c["yaw"]) * (-1.0 if lead == "l" else 1.0) * (1.0 - float(c["walk_yaw_loss"]) * w)
			torso = Basis.from_euler(Vector3(float(c["pitch"]) + 0.012 * b, yaw, 0.0))
			hip = _hip_h - float(c["hip_drop"])
			rots[P.NECK] = _eb(P.NECK, -float(c["pitch"]) * 0.5, -yaw * 0.5)
			rots[P.HEAD] = _eb(P.HEAD, -float(c["pitch"]) * 0.5, -yaw * 0.4)
			for side in ["l", "r"]:
				var sg := _sg(side)
				var is_lead: bool = side == lead
				var pre := "lead_" if is_lead else "rear_"
				rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), -float(c["pitch"]) + float(c[pre + "hip"]), 0.0, sg * float(c["leg_abduct"]))
				rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(c[pre + "knee"]))
				var toe := float(fc["toe_out"]) + (0.0 if is_lead else float(c["rear_toe"]))
				ends[_id("foot", side)] = mover_xf.basis * Basis.from_euler(Vector3(0.0, sg * toe, 0.0))
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c[pre + "arm"]) + 0.03 * b, 0.0, sg * float(c["arm_abduct"]))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c[pre + "elbow"]))
				rots[_id("hand", side)] = _eb(_id("hand", side), float(c["hand"]))
			if w > 0.001:  # moving: legs, hips and feet follow the walk gait, the guard stays up
				var g := _pose_target(&"walk", speed, dt, mover_xf, -1, Vector3.ZERO, false)
				var gr: Dictionary = g["rots"]
				for side in ["l", "r"]:
					for key in ["upper_leg", "lower_leg"]:
						var pid := _id(key, side)
						rots[pid] = _mix(rots[pid], gr[pid], w)
					var fid := _id("foot", side)
					ends[fid] = _mix(ends[fid], (g["ends"] as Dictionary)[fid], w)
				hip = lerpf(hip, float(g["hip"]), w)
				torso = _mix(torso, g["torso"], w * float(c["walk_torso"]))
				sway_w = w
		_:  # idle
			var c: Dictionary = _cfg["idle"]
			var b := sin(t * float(c["breath_hz"]))
			torso = Basis.from_euler(Vector3(float(c["pitch_amp"]) * b, 0.0, sin(t * float(c["roll_hz"])) * float(c["roll_amp"])))
			hip = _hip_h + float(c["hip_bob"]) * b
			sway_w = 0.0
			for side in ["l", "r"]:
				var sg := _sg(side)
				rots[_id("upper_arm", side)] = _eb(_id("upper_arm", side), float(c["arm_swing"]) * b, 0.0,
					sg * (float(c["arm_abduct"]) + float(c["arm_abduct_breath"]) * b))
				rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(c["elbow"]))
				rots[_id("hand", side)] = _eb(_id("hand", side), float(hc["idle_x"]) + float(hc["breath"]) * b, 0.0, sg * float(hc["idle_z"]))
				ends[_id("foot", side)] = mover_xf.basis * Basis.from_euler(Vector3(0.0, sg * float(fc["toe_out"]), 0.0))

	var skip := {}
	if apply_broken and not _broken.is_empty():
		var r := _apply_broken(pose, rots, ends, torso, hip, mover_xf.basis, sway_w)
		torso = r[0]
		hip = r[1]
		skip = r[2]
	return {"hip": hip, "torso": torso, "rots": rots, "ends": ends, "skip": skip,
		"plant": float(_cfg["plant"]["weights"].get(String(pose), 1.0)),
		"drop": float(_cfg["plant"]["drop_scale"].get(String(pose), 1.0))}


## Broken limbs (overrides the pose in place). A broken arm hangs toward the ground and sways; a broken
## leg is held off the floor (not weight-bearing) and the torso rolls over the sound leg.
## Returns [torso, hip, skip_sides] (skip_sides: sides the foot plant must ignore).
func _apply_broken(pose: StringName, rots: Dictionary, ends: Dictionary, torso: Basis, hip: float,
		mover_b: Basis, sway_w: float) -> Array:
	var bc: Dictionary = _cfg["broken"]
	var e := torso.get_euler()
	var skip := {}
	for side in ["l", "r"]:
		var sg := _sg(side)
		if _arm_broken(side):
			var sway := float(bc["arm_sway"]) * sin(_t * float(bc["arm_sway_hz"]) + sg) * (0.3 + 0.7 * sway_w)
			var up := _id("upper_arm", side)
			# hangs towards the ground; a prone body (crawl) lets it trail along the body instead
			var prone := pose == &"crawl"
			rots[up] = _eb(up, float(bc["arm_x"]) - (0.0 if prone else e.x) + sway, 0.0,
				sg * (float(bc["arm_abduct"]) + (float(bc["crawl_abduct"]) if prone else 0.0)))
			rots[_id("lower_arm", side)] = _eb(_id("lower_arm", side), float(bc["elbow"]))
			rots[_id("hand", side)] = _eb(_id("hand", side), float(bc["hand_x"]) + sway * 0.6, 0.0, sg * float(bc["hand_z"]))
			if not prone:
				e.z -= sg * float(bc["arm_roll"])  # shoulder drops on the broken side
	var dl := _leg_down("l")
	var dr := _leg_down("r")
	if dl != dr and pose != &"crawl":
		var side := "l" if dl else "r"
		var sg := _sg(side)
		var swing := float(bc["leg_swing"]) * sin(_phase) * sg * sway_w
		rots[_id("upper_leg", side)] = _eb(_id("upper_leg", side), float(bc["leg_hip"]) - e.x + swing, 0.0, sg * float(bc["leg_abduct"]))
		rots[_id("lower_leg", side)] = _eb(_id("lower_leg", side), float(bc["leg_knee"]))
		rots.erase(_id("foot", side))
		ends[_id("foot", side)] = mover_b * Basis.from_euler(Vector3(float(bc["foot_x"]), sg * float(_cfg["foot"]["toe_out"]), 0.0))  # dangles
		skip[side] = true
		e.z += sg * float(bc["roll"])
		hip -= float(bc["hip_drop"])
	return [Basis.from_euler(e), hip, skip]


## Which arm clutches: the one whose shoulder is nearest the contact (never the wounded arm itself;
## a broken arm only if the other cannot).
func _clutch_side(part: int, contact: Vector3, tc: Transform3D) -> String:
	var wounded := BodyIds.side_of(part) if BodyIds.is_arm(part) else ""
	var best := "l"
	var best_d := INF
	for side in ["l", "r"]:
		var d := (tc * (_joint_rest[_id("upper_arm", side)] as Vector3)).distance_to(contact)
		if side == wounded:
			d += 20.0
		if _arm_broken(side):
			d += 10.0
		if d < best_d - 0.001:
			best_d = d
			best = side
	return best


static func _mix(a: Basis, b: Basis, w: float) -> Basis:
	return Basis(Quaternion(a.orthonormalized()).slerp(Quaternion(b.orthonormalized()), clampf(w, 0.0, 1.0)))


func _acc(add: Dictionary, pid: int, v: Vector3) -> void:
	add[pid] = (add.get(pid, Vector3.ZERO) as Vector3) + v


## Advance hit reactions; adds limb/head rotations into rots (clamped to joint limits). Returns the
## torso euler additive, hip dip and world-space shift (stagger step).
func _react_step(dt: float, rots: Dictionary) -> Dictionary:
	var rc: Dictionary = _cfg["react"]
	var hc: Dictionary = rc["head"]
	var tc: Dictionary = rc["torso"]
	var lc: Dictionary = rc["limb"]
	var sc: Dictionary = rc["step"]
	var add := {}
	var te := Vector3.ZERO
	var hip := 0.0
	var shift := Vector3.ZERO
	var i := _reacts.size() - 1
	while i >= 0:
		var r: Dictionary = _reacts[i]
		r["t"] = float(r["t"]) + dt
		if float(r["t"]) >= float(r["dur"]):
			_reacts.remove_at(i)
			i -= 1
			continue
		i -= 1
		var u := float(r["t"]) / float(r["dur"])
		var d: Vector3 = r["d"]
		var part: int = r["part"]
		if r["step"]:
			var e2 := minf(1.0, float(r["t"]) / 0.08) * (1.0 - u) * (1.0 - u) * float(r["mag"])
			var dh := Vector3(d.x, 0.0, d.z)
			shift += _mover.basis * dh.normalized() * float(sc["dist"]) * e2 if dh.length() > 0.01 else Vector3.ZERO
			var st := sin(PI * u) * float(r["mag"])
			var lead := "l" if d.x >= 0.0 else "r"
			for side in ["l", "r"]:
				var f := 1.0 if side == lead else -0.5
				_acc(add, _id("upper_leg", side), Vector3(-d.z * float(sc["leg"]) * st * f, 0, 0))
				_acc(add, _id("lower_leg", side), Vector3(float(sc["knee"]) * st * maxf(f, 0.0), 0, 0))
			continue
		var a := minf(1.0, float(r["t"]) / float(rc["attack"])) * (1.0 - u) * (1.0 - u) * float(r["mag"])
		var any := float(rc["any_torso"])
		if part == P.HEAD or part == P.NECK:
			_acc(add, P.HEAD, Vector3(float(hc["pitch"]) * d.z * a, float(hc["yaw"]) * d.x * a, -float(hc["roll"]) * d.x * a))
			_acc(add, P.NECK, Vector3(float(hc["pitch"]) * d.z * a, 0, -float(hc["roll"]) * d.x * a) * float(hc["neck_share"]))
			te += Vector3(float(tc["recoil"]) * d.z, 0, -float(tc["roll"]) * d.x) * a * float(hc["torso_share"])
		elif part == P.TORSO:
			te += Vector3(float(tc["recoil"]) * d.z + float(tc["hunch"]) * maxf(0.0, -d.z), 0, -float(tc["roll"]) * d.x) * a
			hip += float(tc["hip"]) * a
		elif BodyIds.is_arm(part) or BodyIds.is_leg(part):
			var arm := BodyIds.is_arm(part)
			var side := BodyIds.side_of(part)
			var up := _id("upper_arm" if arm else "upper_leg", side)
			var lo := _id("lower_arm" if arm else "lower_leg", side)
			var w_up := 1.0 if part == up else float(lc["parent_share"])
			var w_lo := float(lc["child_share"]) if part == up else 1.0
			var swing := Vector3(-d.z, 0, d.x) * float(lc["swing"]) * a   # the tip moves along the hit
			_acc(add, up, swing * w_up)
			_acc(add, lo, swing * w_lo * 0.6 + Vector3((-1.0 if arm else 1.0) * float(lc["flex"]) * a * w_lo, 0, 0))
			te += Vector3(float(tc["recoil"]) * d.z, 0, -float(tc["roll"]) * d.x) * a * float(lc["torso_share"])
		te += Vector3(float(tc["recoil"]) * d.z, 0, -float(tc["roll"]) * d.x) * a * any
	for pid in add:
		rots[pid] = _clamp_basis(pid, Basis.from_euler(add[pid]) * (rots.get(pid, Basis.IDENTITY) as Basis))
	return {"torso": te, "hip": hip, "shift": shift}


## Advance the one-shot action; overrides the acting arm in rots. Returns the torso euler additive.
func _action_step(dt: float, rots: Dictionary) -> Vector3:
	if _action.is_empty():
		return Vector3.ZERO
	var c: Dictionary = _cfg["actions"][_action["name"]]
	var t: float = float(_action["t"]) + dt
	_action["t"] = t
	var total := float(c["total"])
	if t >= total:
		_action = {}
		return Vector3.ZERO
	var side: String = _action["side"]
	var sg := _sg(side)
	var wind := float(c["windup"])
	var imp := float(c["impact"])
	var hold := float(c["hold"])
	var wgt := 1.0
	var k := 1.0
	if t < wind:
		wgt = smoothstep(0.0, wind, t)
		k = 0.0
	elif t < imp:
		var x := (t - wind) / maxf(0.001, imp - wind)
		k = 1.0 - (1.0 - x) * (1.0 - x)
	elif t > imp + hold:
		var y := smoothstep(0.0, 1.0, (t - imp - hold) / maxf(0.001, total - imp - hold))
		wgt = 1.0 - y
		k = 1.0 - 0.6 * y
	var wv: Dictionary = c["wind"]
	var sv: Dictionary = c["strike"]
	var up := _id("upper_arm", side)
	var lo := _id("lower_arm", side)
	var hd := _id("hand", side)
	var ux := lerpf(float(wv["arm"]), float(sv["arm"]), k)
	var uz := -sg * lerpf(float(wv["cross"]), float(sv["cross"]), k)
	var ex := lerpf(float(wv["elbow"]), float(sv["elbow"]), k)
	var hx := lerpf(float(wv["hand"]), float(sv["hand"]), k)
	rots[up] = _mix(rots.get(up, Basis.IDENTITY), _eb(up, ux, 0.0, uz), wgt)
	rots[lo] = _mix(rots.get(lo, Basis.IDENTITY), _eb(lo, ex), wgt)
	rots[hd] = _mix(rots.get(hd, Basis.IDENTITY), _eb(hd, hx), wgt)
	return Vector3(lerpf(float(wv["pitch"]), float(sv["pitch"]), k), sg * -lerpf(float(wv["yaw"]), float(sv["yaw"]), k), 0.0) * wgt


func _torso_frame(mover_xf: Transform3D) -> Transform3D:
	var tb := mover_xf.basis * _cur_torso
	var pivot := mover_xf.origin + mover_xf.basis * Vector3(0, _cur_hip, 0)
	return Transform3D(tb, pivot + tb * Vector3(0, _torso_hy, 0))


## World contact point + outward surface normal for a clutched part. Uses the exact wound if one was set,
## else the front face of the part (clutch_pos is the part centre).
func _clutch_contact(part: int, centre: Vector3, tc: Transform3D) -> Array:
	var pxf: Transform3D = _last_out.get(part, Transform3D(tc.basis, centre))
	pxf.origin = centre
	if int(_wound["part"]) == part and (_wound["n"] as Vector3).length() > 0.01:
		return [pxf * (_wound["pos"] as Vector3), (pxf.basis * (_wound["n"] as Vector3)).normalized()]
	var n := pxf.basis.z.normalized()
	var h: Vector3 = _half.get(part, Vector3(0.1, 0.1, 0.1))
	var ln := pxf.basis.inverse() * n
	var support := absf(ln.x) * h.x + absf(ln.y) * h.y + absf(ln.z) * h.z
	return [pxf.origin + n * support, n]


## TODO(roadmap: ik clutch): bandaging / pressing with both hands plugs in here (second arm via _arm_reach).
## Reach with `side`'s arm so the palm presses a point (torso-centre space) with the palm facing `palm_dir`
## (into the surface). Falls back to the forearm tip when the hand is gone. Returns [upper, lower, hand] bases.
func _arm_reach(side: String, target: Vector3, palm_dir: Vector3, wrist_x: float, finger_dir := Vector3.ZERO) -> Array:
	var up := _id("upper_arm", side)
	var hd := _id("hand", side)
	var pd := palm_dir.normalized() if bool(_cfg["hand"]["swivel"]) else Vector3.ZERO
	if not (_half.has(hd) and _attached.has(hd)):
		var ik0 := _arm_ik(up, target, pd)
		return [ik0[0], ik0[1], _eb(hd, wrist_x)]
	var hx: float = (_half[hd] as Vector3).x
	var cfj_h: Vector3 = _cfj[hd]  # wrist -> hand centre
	var wt := target - pd * hx - cfj_h.length() * (target - (_joint_rest[up] as Vector3)).normalized()
	var ik: Array = []
	var hr := _eb(hd, wrist_x)
	var sg := _sg(side)
	for i in 3:
		ik = _arm_ik(up, wt, pd)
		var lb: Basis = (ik[0] as Basis) * (ik[1] as Basis)
		if pd != Vector3.ZERO:
			# palm normal -> pd, fingers along finger_dir (default: the forearm), within the wrist limits
			var fd := finger_dir if finger_dir != Vector3.ZERO else lb * Vector3(0, -1, 0)
			var f := fd - pd * fd.dot(pd)
			if f.length() < 0.2:
				f = lb * Vector3(0, -1, 0) - pd * (lb * Vector3(0, -1, 0)).dot(pd)
			var yy := -f.normalized()
			var xx := -sg * pd
			xx = (xx - yy * xx.dot(yy)).normalized()
			hr = _clamp_basis(hd, lb.inverse() * Basis(xx, yy, xx.cross(yy)))
		wt = target - pd * hx - lb * hr * cfj_h
	return [ik[0], ik[1], hr]


## Two-bone IK for an arm, in torso-centre space. Returns [upper_basis, lower_basis]. palm_dir (optional)
## swivels the elbow plane so that the hand's palm normal (the forearm's x axis) faces palm_dir.
func _arm_ik(upper_id: int, target_local: Vector3, palm_dir: Vector3 = Vector3.ZERO) -> Array:
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
	if palm_dir != Vector3.ZERO:
		var pp := palm_dir - tdir * palm_dir.dot(tdir)
		if pp.length() > 0.25:
			n = -_sg(BodyIds.side_of(upper_id)) * pp.normalized()
	var u := tdir.rotated(n, alpha)
	var by := -u
	var bz := n.cross(by)
	return [Basis(n, by, bz).orthonormalized(), Basis(Vector3.RIGHT, -(PI - phi))]
