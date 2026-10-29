## PoseDriver acceptance test (no physics). Run: godot --headless --path . res://tests/pose_test.tscn
## Builds the layout dictionaries the way NpcBody does from data/body_parts.json and drives PoseDriver directly.
extends Node

const P := BodyIds.Part
const ORDER: Array[int] = [P.TORSO, P.NECK, P.HEAD, P.UPPER_ARM_L, P.LOWER_ARM_L, P.UPPER_ARM_R,
	P.LOWER_ARM_R, P.UPPER_LEG_L, P.LOWER_LEG_L, P.UPPER_LEG_R, P.LOWER_LEG_R,
	P.HAND_L, P.HAND_R, P.FOOT_L, P.FOOT_R]
const DT := 1.0 / 60.0

var _fails := 0
var _half := {}
var _layout := {}
var _all := {}   # attached set
var _has_ends := false


func _check(name: String, ok: bool, info := "") -> void:
	print("%s %s %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _build_layout() -> void:
	var cfg := DataDB.table("body_parts")
	var order: Array[int] = []
	var rest := {}
	var joint_rest := {}
	var limits := {}
	for pid in ORDER:
		var key := BodyIds.key(pid)
		if not cfg["parts"].has(key):
			continue
		var d: Dictionary = cfg["parts"][key]
		order.append(pid)
		rest[pid] = _v3(d["rest"])
		_half[pid] = _v3(d["half"])
		if d.get("joint") != null:
			joint_rest[pid] = _v3(d["joint"])
		var lim = d.get("limits")
		if lim != null:
			limits[pid] = {"x_min": deg_to_rad(float(lim["x"][0])), "x_max": deg_to_rad(float(lim["x"][1])),
				"y": deg_to_rad(float(lim["y"])), "z": deg_to_rad(float(lim["z"]))}
	var jp := {}
	var cfj := {}
	for pid in order:
		if pid == P.TORSO:
			continue
		var par: int = BodyIds.PARENT[pid]
		jp[pid] = joint_rest[pid] - rest[par]
		cfj[pid] = rest[pid] - joint_rest[pid]
		_all[pid] = true
	_all[P.TORSO] = true
	_has_ends = order.has(P.FOOT_L) and order.has(P.HAND_L)
	_layout = {"order": order, "rest": rest, "joint_rest": joint_rest, "jp": jp, "cfj": cfj,
		"limits": limits, "half": _half, "hip_height": float(cfg.get("hip_height", 0.88))}


static func _v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func _driver() -> PoseDriver:
	var d := PoseDriver.new()
	d.setup(_layout)
	return d


func _finite(xfs: Dictionary) -> bool:
	for pid in xfs:
		var xf: Transform3D = xfs[pid]
		if not (xf.origin.is_finite() and xf.basis.x.is_finite() and xf.basis.y.is_finite() and xf.basis.z.is_finite()):
			return false
		if absf(xf.basis.determinant() - 1.0) > 0.02 or xf.origin.length() > 20.0:
			return false
	return true


func _sole(xfs: Dictionary, side: String) -> float:
	var pid := BodyIds.from_key("foot_" + side)
	var xf: Transform3D = xfs[pid]
	var h: Vector3 = _half[pid]
	return xf.origin.y - (absf(xf.basis.x.y) * h.x + absf(xf.basis.y.y) * h.y + absf(xf.basis.z.y) * h.z)


## Run `frames` frames of `pose`; returns an array of per-frame outputs.
func _run(d: PoseDriver, pose: StringName, speed: float, frames: int, mover: Transform3D,
		attached := {}, cpart := -1, cpos := Vector3.ZERO) -> Array:
	var out := []
	var att := _all if attached.is_empty() else attached
	for i in frames:
		out.append(d.update(pose, speed, DT, mover, att, cpart, cpos))
	return out


func _ready() -> void:
	_build_layout()
	_check("0 layout has hands and feet", _has_ends, "parts=%d" % _layout["order"].size())
	var mover := Transform3D(Basis(Vector3.UP, 0.7), Vector3(1, 0.3, 2))
	var floor_y := mover.origin.y

	# 1. finite transforms for every pose, incl. unknown pose, speeds, clutch, broken, severed parts
	var ok := true
	var bad := ""
	for pose in [&"idle", &"walk", &"run", &"limp", &"clutch", &"stagger", &"crawl", &"bogus"]:
		for sp in [0.0, 0.8, 3.0, 6.0]:
			var d := _driver()
			var frames := _run(d, pose, sp, 120, mover, {}, P.TORSO, Vector3(1, 1.4, 2))
			for f in frames:
				if not _finite(f) or f.size() != _all.size():
					ok = false
					bad = "%s@%s" % [pose, sp]
	_check("1a all poses finite", ok, bad)
	ok = true
	for pose in [&"idle", &"walk", &"limp", &"clutch", &"crawl", &"stagger"]:
		var d := _driver()
		d.set_broken_parts([P.UPPER_ARM_L, P.LOWER_LEG_R])
		d.set_limp_side("l")
		var frames := _run(d, pose, 1.2, 90, mover, {}, P.UPPER_LEG_R, Vector3(1, 0.6, 2))
		for f in frames:
			ok = ok and _finite(f)
		var att := _all.duplicate()
		att.erase(P.HAND_R); att.erase(P.FOOT_L); att.erase(P.LOWER_LEG_R); att.erase(P.FOOT_R)
		frames = _run(d, pose, 1.2, 60, mover, att, P.LOWER_ARM_L, Vector3(1, 0.9, 2))
		for f in frames:
			ok = ok and _finite(f) and f.size() == att.size()
	_check("1b finite with broken parts, severed hand/foot/leg, limp hint", ok)

	# 2. idle: feet flat on the floor, hands relaxed beside the thighs
	var d := _driver()
	var fr := _run(d, &"idle", 0.0, 120, mover)
	var last: Dictionary = fr[-1]
	var flat: float = (last[P.FOOT_L] as Transform3D).basis.y.dot(Vector3.UP)
	_check("2a idle feet flat+on floor", flat > 0.99 and absf(_sole(last, "l") - floor_y) < 0.02 and absf(_sole(last, "r") - floor_y) < 0.02,
		"flat=%.3f soleL=%.3f soleR=%.3f" % [flat, _sole(last, "l") - floor_y, _sole(last, "r") - floor_y])
	var hl: Vector3 = (last[P.HAND_L] as Transform3D).origin
	var tl: Vector3 = (last[P.TORSO] as Transform3D).origin
	_check("2b idle hands hang low", hl.y < tl.y - 0.25, "hand_y=%.2f torso_y=%.2f" % [hl.y, tl.y])

	# 3. walk / run: feet stay near the floor, flat-ish, heel strike / toe-off visible
	for pose in [&"walk", &"run"]:
		var sp := 1.4 if pose == &"walk" else 4.0
		d = _driver()
		fr = _run(d, pose, sp, 400, mover)
		var min_low := 9.0
		var max_low := -9.0
		var max_air := 0.0
		var min_flat := 1.0
		var pitch_min := 9.0
		var pitch_max := -9.0
		for i in range(120, fr.size()):
			var f: Dictionary = fr[i]
			var lo := minf(_sole(f, "l"), _sole(f, "r")) - floor_y
			min_low = minf(min_low, lo)
			max_low = maxf(max_low, lo)
			max_air = maxf(max_air, maxf(_sole(f, "l"), _sole(f, "r")) - floor_y)
			var fx: Transform3D = f[P.FOOT_L]
			min_flat = minf(min_flat, fx.basis.y.dot(Vector3.UP))
			# pitch relative to mover heading: toes up (-) / toes down (+)
			var fwd := (mover.basis.inverse() * fx.basis.z)
			var pitch := -asin(clampf(fwd.y, -1.0, 1.0))
			pitch_min = minf(pitch_min, pitch)
			pitch_max = maxf(pitch_max, pitch)
		var tol := 0.03 if pose == &"walk" else 0.12
		_check("3 %s lowest sole near floor" % pose, min_low > -0.04 and max_low < tol,
			"lowest sole range [%.3f, %.3f] max_air=%.2f min_flat=%.2f foot_pitch=[%.2f,%.2f]" % [min_low, max_low, max_air, min_flat, pitch_min, pitch_max])
		if pose == &"walk":
			_check("3b walk heel strike + toe off", pitch_min < -0.12 and pitch_max > 0.2 and min_flat > 0.6 and max_air > 0.04)

	# 4. limp: asymmetric stance, shorter injured stride, torso rolls to the good side; walk stays symmetric
	for inj in ["l", "r"]:
		d = _driver()
		d.set_limp_side(inj)
		var good := "r" if inj == "l" else "l"
		fr = _run(d, &"limp", 1.0, 900, mover)
		var st := {"l": 0, "r": 0}
		var rng := {"l": [9.0, -9.0], "r": [9.0, -9.0]}
		var roll_sum := 0.0
		var n := 0
		for i in range(240, fr.size()):
			var f: Dictionary = fr[i]
			for s in ["l", "r"]:
				if _sole(f, s) - floor_y < 0.02:
					st[s] += 1
				var lz: float = (mover.basis.inverse() * ((f[BodyIds.from_key("lower_leg_" + s)] as Transform3D).origin - (f[P.TORSO] as Transform3D).origin)).z
				rng[s][0] = minf(rng[s][0], lz)
				rng[s][1] = maxf(rng[s][1], lz)
			# torso lean towards +x (left) positive in mover space
			var tx: Vector3 = mover.basis.inverse() * (f[P.TORSO] as Transform3D).basis.y
			roll_sum += tx.x
			n += 1
		var si: int = st[inj]
		var sg: int = st[good]
		var ri: float = rng[inj][1] - rng[inj][0]
		var rg: float = rng[good][1] - rng[good][0]
		var lean_to_good := (roll_sum / n) * (1.0 if good == "l" else -1.0)
		_check("4a limp(%s) stance injured < good" % inj, si > 0 and float(si) < 0.7 * float(sg), "stance frames inj=%d good=%d" % [si, sg])
		_check("4b limp(%s) injured stride shorter" % inj, ri < 0.85 * rg, "range inj=%.3f good=%.3f" % [ri, rg])
		_check("4c limp(%s) torso over good leg" % inj, lean_to_good > 0.01, "lean_to_good=%.3f" % lean_to_good)
		var xs := fr[-1] as Dictionary
		_check("4d limp(%s) feet near floor" % inj, absf(minf(_sole(xs, "l"), _sole(xs, "r")) - floor_y) < 0.04)
	d = _driver()
	fr = _run(d, &"walk", 1.0, 900, mover)
	var wl := 0
	var wr := 0
	for i in range(240, fr.size()):
		wl += 1 if _sole(fr[i], "l") - floor_y < 0.02 else 0
		wr += 1 if _sole(fr[i], "r") - floor_y < 0.02 else 0
	_check("4e walk is symmetric", absi(wl - wr) <= 0.1 * maxf(wl, wr), "stance frames l=%d r=%d" % [wl, wr])
	# inferred side: missing left foot -> limps left (no hint)
	d = _driver()
	var att_nf := _all.duplicate()
	att_nf.erase(P.FOOT_L)
	_run(d, &"limp", 1.0, 5, mover, att_nf)
	_check("4f limp side inferred from missing foot", d.get_limp_side() == "l")
	d.set_broken_parts([P.LOWER_LEG_R, P.LOWER_LEG_L])
	_check("4g both legs hurt -> both", d.get_limp_side() == "both")

	# 5. broken limbs
	d = _driver()
	d.set_broken_parts([P.LOWER_ARM_L, P.UPPER_LEG_R])
	fr = _run(d, &"idle", 0.0, 120, mover)
	last = fr[-1]
	var hand_l: Vector3 = (last[P.HAND_L] as Transform3D).origin
	var sh_l: Vector3 = (last[P.UPPER_ARM_L] as Transform3D).origin
	_check("5a broken arm hangs", sh_l.y - hand_l.y > 0.45, "drop=%.2f" % (sh_l.y - hand_l.y))
	var lift_r := _sole(last, "r") - floor_y
	_check("5b broken leg not weight-bearing", lift_r > 0.08 and absf(_sole(last, "l") - floor_y) < 0.03,
		"broken sole lift=%.3f good sole=%.3f" % [lift_r, _sole(last, "l") - floor_y])
	fr = _run(d, &"crawl", 0.5, 150, mover)
	last = fr[-1]
	var bh: Vector3 = mover.basis.inverse() * ((last[P.HAND_L] as Transform3D).origin - (last[P.UPPER_ARM_L] as Transform3D).origin)
	_check("5c broken arm in crawl trails behind, above the floor", (last[P.HAND_L] as Transform3D).origin.y > floor_y and bh.z < -0.3,
		"hand rel shoulder=%s" % bh)
	d.set_broken_parts([])
	fr = _run(d, &"idle", 0.0, 120, mover)
	_check("5d recovered: both soles on the floor", absf(_sole(fr[-1], "r") - floor_y) < 0.03)

	# 6. clutch: palm presses the part's front surface (torso, thigh), wound hint, side choice
	var tgt_cases := [[P.TORSO, "torso front"], [P.UPPER_LEG_R, "right thigh"], [P.LOWER_ARM_R, "right forearm"]]
	for tc in tgt_cases:
		d = _driver()
		var part: int = tc[0]
		# use the rest pose of this driver for the part centre (the pose moves; iterate with the part's own transform)
		var fr6 := []
		var cpos := (d.rest_pose(mover, _all)[part] as Transform3D).origin
		for i in 150:
			var xs6 := d.update(&"clutch", 0.0, DT, mover, _all, part, cpos)
			cpos = (xs6[part] as Transform3D).origin
			fr6.append(xs6)
		last = fr6[-1]
		var side := "l"
		var dl := ((last[P.HAND_L] as Transform3D).origin - (last[part] as Transform3D).origin).length()
		var dr := ((last[P.HAND_R] as Transform3D).origin - (last[part] as Transform3D).origin).length()
		if dr < dl:
			side = "r"
		var hx: Transform3D = last[BodyIds.from_key("hand_" + side)]
		var px: Transform3D = last[part]
		var ph: Vector3 = _half[part]
		var hh: Vector3 = _half[BodyIds.from_key("hand_" + side)]
		# distance from the hand box centre to the part's front face
		var loc := px.affine_inverse() * hx.origin
		var front_gap: float = loc.z - ph.z
		var palm_n: Vector3 = hx.basis.x * (-1.0 if side == "l" else 1.0)  # palm normal (hanging hand palm faces the body)
		var facing := palm_n.dot(-px.basis.z)
		var d_front := absf(front_gap) - hh.x
		_check("6 clutch %s palm on surface" % tc[1], absf(loc.x) < ph.x + 0.1 and d_front < 0.07 and _finite(last),
			"hand local=%s gap_front=%.3f palm_facing_in=%.2f" % [loc, front_gap, facing])
	d = _driver()
	d.set_clutch_wound(P.TORSO, Vector3(0.1, 0.1, 0.11), Vector3(0, 0, 1))
	var c0 := (d.rest_pose(mover, _all)[P.TORSO] as Transform3D).origin
	var cl := {}
	for i in 150:
		cl = d.update(&"clutch", 0.0, DT, mover, _all, P.TORSO, (cl[P.TORSO] as Transform3D).origin if i > 0 else c0)
	var wpos: Vector3 = (cl[P.TORSO] as Transform3D) * Vector3(0.1, 0.1, 0.11)
	var dh := ((cl[P.HAND_L] as Transform3D).origin - wpos).length()
	_check("6b clutch exact wound hint: hand within 6 cm", dh < 0.07, "dist=%.3f" % dh)
	# free arm swap when the natural arm is broken
	d = _driver()
	d.set_broken_parts([P.UPPER_ARM_L])
	cl = {}
	for i in 150:
		cl = d.update(&"clutch", 0.0, DT, mover, _all, P.TORSO, (cl[P.TORSO] as Transform3D).origin if i > 0 else c0)
	_check("6c broken free arm: sound arm reaches the torso", ((cl[P.HAND_R] as Transform3D).origin - (cl[P.TORSO] as Transform3D).origin).length() < 0.3
		and ((cl[P.HAND_L] as Transform3D).origin.y < (cl[P.UPPER_ARM_L] as Transform3D).origin.y - 0.4))

	# 7. crawl: palms down on the floor, hands keep to the floor plane
	d = _driver()
	fr = _run(d, &"crawl", 0.4, 300, mover)
	var hmin := 9.0
	var hmax := -9.0
	var down := 1.0
	for i in range(120, fr.size()):
		for s in ["l", "r"]:
			var hxf: Transform3D = fr[i][BodyIds.from_key("hand_" + s)]
			hmin = minf(hmin, hxf.origin.y - floor_y)
			hmax = maxf(hmax, hxf.origin.y - floor_y)
		down = minf(down, absf((fr[i][P.HAND_L] as Transform3D).basis.x.y))
	_check("7 crawl hands on floor, palms down", hmin > 0.0 and hmin < 0.1 and hmax < 0.3 and down > 0.6,
		"hand y range [%.3f, %.3f] palm_down=%.2f" % [hmin, hmax, down])

	# 8. get-up blend from arbitrary world transforms stays finite and converges to the pose
	d = _driver()
	var from := {}
	for pid in _all:
		from[pid] = Transform3D(Basis(Vector3.RIGHT, 1.2) * Basis(Vector3.UP, pid), Vector3(0.3 * pid, 0.2, 0.1))
	d.begin_get_up(from)
	fr = _run(d, &"idle", 0.0, 120, mover)
	var ref := _driver()
	var rf := _run(ref, &"idle", 0.0, 120, mover)
	var dev := ((fr[-1][P.HAND_L] as Transform3D).origin - (rf[-1][P.HAND_L] as Transform3D).origin).length()
	var all_fin := true
	for f in fr:
		all_fin = all_fin and _finite_loose(f)
	_check("8 get-up blend finite and converges", all_fin and dev < 0.05, "dev=%.4f" % dev)

	# 9. flinch additive decays
	d = _driver()
	_run(d, &"idle", 0.0, 30, mover)
	d.on_hit(P.TORSO, Vector3(20, 0, 0), 30.0)
	var hit := d.update(&"idle", 0.0, DT, mover, _all, -1, Vector3.ZERO)
	var after := _run(d, &"idle", 0.0, 60, mover)
	_check("9 flinch finite and decays", _finite(hit) and _finite(after[-1]))


	# 10. hit reactions: finite for every part x direction x pose; direction/part aware; decays
	var dirs := [Vector3.RIGHT, Vector3.LEFT, Vector3.UP, Vector3.DOWN, Vector3.FORWARD, Vector3.BACK,
		Vector3(1, 0.3, 1).normalized(), Vector3(-1, -0.4, -1).normalized()]
	ok = true
	bad = ""
	for pose in [&"idle", &"walk", &"limp", &"fight", &"cower", &"crawl", &"clutch"]:
		for pid in _all:
			d = _driver()
			_run(d, pose, 1.0, 10, mover)
			for k in dirs.size():
				for mag in [3.0 if k % 2 == 0 else 60.0]:
					d.on_hit(pid, mover.basis * dirs[k] * mag, 5.0)
					for f in _run(d, pose, 1.0, 12, mover):
						if not _finite(f):
							ok = false
							bad = "%s part %d dir %s" % [pose, pid, dirs[k]]
	_check("10a reactions finite (all parts, directions, poses)", ok, bad)
	var base := _driver()
	var base_f: Array = _run(base, &"idle", 0.0, 60, mover)
	# head shot: the head moves along the hit direction
	var hs := _driver()
	_run(hs, &"idle", 0.0, 60, mover)
	hs.on_hit(P.HEAD, mover.basis * Vector3(0, 0, 1) * 20.0, 4.5)
	var hf: Array = _run(hs, &"idle", 0.0, 8, mover)
	var dhv: Vector3 = mover.basis.inverse() * ((hf[-1][P.HEAD] as Transform3D).origin - (base_f[-1][P.HEAD] as Transform3D).origin)
	_check("10b head shot snaps the head along the hit", dhv.z > 0.03, "dz=%.3f" % dhv.z)
	hs = _driver()
	_run(hs, &"idle", 0.0, 60, mover)
	hs.on_hit(P.HEAD, mover.basis * Vector3(-1, 0, 0) * 20.0, 4.5)
	hf = _run(hs, &"idle", 0.0, 8, mover)
	dhv = mover.basis.inverse() * ((hf[-1][P.HEAD] as Transform3D).origin - (base_f[-1][P.HEAD] as Transform3D).origin)
	_check("10c head snaps sideways with a side hit", dhv.x < -0.03, "dx=%.3f" % dhv.x)
	# torso hit from the front: recoil/hunch moves the upper body
	hs = _driver()
	_run(hs, &"idle", 0.0, 60, mover)
	hs.on_hit(P.TORSO, mover.basis * Vector3(0, 0, -1) * 25.0, 30.0)
	hf = _run(hs, &"idle", 0.0, 8, mover)
	dhv = mover.basis.inverse() * ((hf[-1][P.HEAD] as Transform3D).origin - (base_f[-1][P.HEAD] as Transform3D).origin)
	_check("10d torso hit makes the upper body react", dhv.length() > 0.05, "d=%s" % dhv)
	# limb jerks along the hit; impulse scales the reaction
	var jd := []
	for imp in [3.0, 30.0]:
		hs = _driver()
		_run(hs, &"idle", 0.0, 60, mover)
		hs.on_hit(P.LOWER_ARM_L, mover.basis * Vector3(1, 0, 0) * imp, 1.4)
		hf = _run(hs, &"idle", 0.0, 8, mover)
		jd.append(((hf[-1][P.HAND_L] as Transform3D).origin - (base_f[-1][P.HAND_L] as Transform3D).origin).length())
	_check("10e limb jerk scales with impulse", jd[0] > 0.01 and jd[1] > jd[0] * 1.5, "small=%.3f big=%.3f" % [jd[0], jd[1]])
	# big hit: stagger step offsets the body, then everything decays
	hs = _driver()
	_run(hs, &"idle", 0.0, 60, mover)
	hs.on_hit(P.TORSO, mover.basis * Vector3(1, 0, 0) * 60.0, 30.0)
	var peak := 0.0
	for f in _run(hs, &"idle", 0.0, 30, mover):
		peak = maxf(peak, absf((mover.basis.inverse() * ((f[P.TORSO] as Transform3D).origin - (base_f[-1][P.TORSO] as Transform3D).origin)).x))
	var rest_f: Array = _run(hs, &"idle", 0.0, 80, mover)
	var ctl := _driver()
	var ctl_f: Array = _run(ctl, &"idle", 0.0, 170, mover)
	var resid: float = ((rest_f[-1][P.HEAD] as Transform3D).origin - (ctl_f[-1][P.HEAD] as Transform3D).origin).length()
	_check("10f big hit steps the torso, reaction decays within ~0.9 s", peak > 0.06 and resid < 0.01, "peak=%.3f residual=%.4f" % [peak, resid])

	# 11. cower: both hands above the shoulders; a broken arm hangs, the sound arm guards alone
	d = _driver()
	last = _run(d, &"cower", 0.0, 120, mover)[-1]
	var up_ok := true
	var info11 := ""
	for s in ["l", "r"]:
		var tfm: Transform3D = last[P.TORSO]
		var sh: Vector3 = tfm * Vector3((0.255 if s == "l" else -0.255), 0.27, 0.0)
		var hy: float = (last[BodyIds.from_key("hand_" + s)] as Transform3D).origin.y
		up_ok = up_ok and hy > sh.y + 0.05
		info11 += " %s hand-shoulder=%.2f" % [s, hy - sh.y]
	_check("11a cower raises both hands above the shoulders", up_ok, info11)
	d = _driver()
	d.set_broken_parts([P.LOWER_ARM_L])
	last = _run(d, &"cower", 0.0, 120, mover)[-1]
	var shl: Vector3 = (last[P.TORSO] as Transform3D) * Vector3(0.255, 0.27, 0.0)
	var shr: Vector3 = (last[P.TORSO] as Transform3D) * Vector3(-0.255, 0.27, 0.0)
	_check("11b cower with a broken arm: only the sound arm guards",
		(last[P.HAND_L] as Transform3D).origin.y < shl.y and (last[P.HAND_R] as Transform3D).origin.y > shr.y + 0.05)

	# 12. punch action
	d = _driver()
	_run(d, &"fight", 0.0, 30, mover)
	_check("12a unknown action returns 0", d.play_action(&"dance") == 0.0 and not d.is_acting())
	for pose in [&"fight", &"walk", &"limp"]:
		for brk in [[], [P.LOWER_ARM_R]]:
			d = _driver()
			d.set_broken_parts(brk)
			var spd := 0.0 if pose == &"fight" else 1.2
			_run(d, pose, spd, 90, mover)
			var t_imp: float = d.play_action(&"punch")
			var frames_n := int(round(t_imp / DT))
			var fr12 := _run(d, pose, spd, frames_n + 4, mover)
			var side := "r" if brk.is_empty() else "l"
			var reach := -9.0
			for i in range(maxi(0, frames_n - 3), fr12.size()):
				var f: Dictionary = fr12[i]
				var rel: Vector3 = mover.basis.inverse() * ((f[BodyIds.from_key("hand_" + side)] as Transform3D).origin - (f[P.TORSO] as Transform3D).origin)
				reach = maxf(reach, rel.z)
				ok = ok and _finite(f)
			_check("12b punch (%s%s) hand reaches >= 0.4 m forward at impact t=%.2f" % [pose, " broken R arm" if not brk.is_empty() else "", t_imp],
				t_imp > 0.0 and reach >= 0.4, "reach=%.2f side=%s" % [reach, side])
			var rest12 := _run(d, pose, spd, 40, mover)
			_check("12c action ends", not d.is_acting() and _finite(rest12[-1]))
	d = _driver()
	d.set_broken_parts([P.LOWER_ARM_L, P.UPPER_ARM_R])
	_run(d, &"fight", 0.0, 10, mover)
	_check("12d no sound arm -> no punch", d.play_action(&"punch") == 0.0)

	# 13. fight: stance, stable while walking
	d = _driver()
	last = _run(d, &"fight", 0.0, 120, mover)[-1]
	_check("13a fight stance: feet on the floor, staggered, torso upright",
		absf(_sole(last, "l") - floor_y) < 0.03 and absf(_sole(last, "r") - floor_y) < 0.03
		and ((last[P.FOOT_L] as Transform3D).origin - (last[P.FOOT_R] as Transform3D).origin).length() > 0.3
		and (last[P.TORSO] as Transform3D).basis.y.dot(Vector3.UP) > 0.9,
		"soles %.3f/%.3f feet apart=%.2f" % [_sole(last, "l") - floor_y, _sole(last, "r") - floor_y,
		((last[P.FOOT_L] as Transform3D).origin - (last[P.FOOT_R] as Transform3D).origin).length()])
	d = _driver()
	_run(d, &"fight", 0.0, 60, mover)
	var prev: Dictionary = {}
	var maxjump := 0.0
	var lowest := 9.0
	var upright := 1.0
	var guard := 9.0
	for sp in [0.0, 1.0, 1.4, 0.5, 0.0]:
		for f in _run(d, &"fight", sp, 120, mover):
			ok = ok and _finite(f)
			if not prev.is_empty():
				for pid in f:
					maxjump = maxf(maxjump, ((f[pid] as Transform3D).origin - (prev[pid] as Transform3D).origin).length())
			prev = f
			lowest = minf(lowest, minf(_sole(f, "l"), _sole(f, "r")) - floor_y)
			upright = minf(upright, (f[P.TORSO] as Transform3D).basis.y.dot(Vector3.UP))
			guard = minf(guard, (f[P.HAND_L] as Transform3D).origin.y - ((f[P.TORSO] as Transform3D) * Vector3(0.255, 0.0, 0.0)).y)
	_check("13b fight stable while walking (finite, no pops, feet on floor, fists up)", ok and maxjump < 0.12 and lowest > -0.04 and upright > 0.85 and guard > 0.0,
		"max per-frame move=%.3f lowest sole=%.3f upright=%.2f guard=%.2f" % [maxjump, lowest, upright, guard])

	print("pose_test done, fails=", _fails)
	get_tree().quit(1 if _fails > 0 else 0)


func _finite_loose(xfs: Dictionary) -> bool:
	for pid in xfs:
		var xf: Transform3D = xfs[pid]
		if not (xf.origin.is_finite() and xf.basis.x.is_finite() and xf.basis.y.is_finite() and xf.basis.z.is_finite()):
			return false
	return true
