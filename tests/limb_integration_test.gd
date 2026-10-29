## Limb integration test (milestone 2 overseer pass). Run: godot --headless --path . res://tests/limb_integration_test.tscn
## Real Npc instances in an arena (floor on the world layer) are hit with weapon-built DamageEvents through
## Npc.apply_damage. For every limb type (upper arm, lower arm, hand, thigh, shin, foot; both sides) the whole chain
## damage -> signals -> AI -> body/pose is checked for: fracture, bleeding, sever. Writes a PASS/FAIL matrix.
##
## Modes (user args after `--`):
##   (none)           outer run: starts this scene again headless as a child process (`--inner`), prints its log and
##                    FAILS when that log holds a SCRIPT ERROR / Parse Error (Godot 4.4 offers no in-process log hook).
##   --inner          the actual tests.
##   --visual <dir>   renders PNGs (limping, clutching, broken-arm NPC) under a display, e.g.
##                    xvfb-run -a -s "-screen 0 1600x900x24" godot --path . --rendering-driver opengl3 \
##                      res://tests/limb_integration_test.tscn -- --visual /abs/out/dir
##
## Events come from the real weapon code: handgun via HitscanWeapon.fire_ray, knife/bat via MeleeWeapon._build_event +
## Weapon._deliver (the same functions a swing sweep calls). Weapons strike from behind (+Z travel) so every NPC
## flees straight ahead and lanes never cross. When no shipped weapon can reach a threshold (see REACH), the chain is
## still verified with a clearly marked synthetic event of the same type.
extends Node3D

const P := BodyIds.Part
const S := BodyIds.NpcState

const SPACING := 9.0                  # > ai.alert_radius (8) so neighbours never alert each other
const SETTLE_FRAMES := 40
const BAT_LADDER: Array[float] = [8.0, 10.0, 12.0, 14.0, 16.0, 18.0, 20.0, 22.0]
const KNIFE_LADDER: Array[float] = [7.5, 9.0, 10.5, 12.0, 14.0]
const PHASE_TIMEOUT_FRAMES := 60 * 60

# pose thresholds (documented in docs/LIMB_CHECKLIST.md)
const ARM_SWING_RATIO_MAX := 0.6      # broken hand's fore/aft swing <= 60 % of the sound hand's while walking
const ARM_HANG_MIN_M := 0.0           # broken hand is not higher than the sound hand while walking (can only drop ~1 cm: the sound arm already hangs)
const IDLE_HANG_MIN_M := 0.0          # IDLE: broken hand is not higher than a control NPC's same hand
const IDLE_VISIBLE_MIN_M := 0.08      # IDLE: broken hand is >= 8 cm away from where a sound hand sits (otherwise it reads as a normal arm)
const CLUTCH_NEAR_M := 0.20           # clutching hand centre within 20 cm of the wound
const CLUTCH_FAR_M := 0.25            # broken arm stays at least 25 cm away
const JOINT_GAP_MAX := 0.12           # ragdoll joints may stretch this far for a moment after a 16 m/s bat hit (must recover to < 3 cm)
const FOOT_LIFT_MIN_M := 0.04         # broken foot's sole clears the floor by >= 4 cm on average (not weight bearing)
const SOUND_FOOT_MAX_M := 0.03        # the sound foot's sole reaches the floor
const REST_MAX_HEIGHT := 0.10         # a severed piece's lowest point is within 10 cm of the floor after 3 s
const MAX_TORSO_STEP := 0.25          # m per physics frame: a hit must not launch/teleport the torso

const LIMBS := [
	{"name": "upper_arm", "kind": "arm", "ids": {"l": P.UPPER_ARM_L, "r": P.UPPER_ARM_R}},
	{"name": "lower_arm", "kind": "arm", "ids": {"l": P.LOWER_ARM_L, "r": P.LOWER_ARM_R}},
	{"name": "hand", "kind": "hand", "ids": {"l": P.HAND_L, "r": P.HAND_R}},
	{"name": "upper_leg", "kind": "thigh", "ids": {"l": P.UPPER_LEG_L, "r": P.UPPER_LEG_R}},
	{"name": "lower_leg", "kind": "shin", "ids": {"l": P.LOWER_LEG_L, "r": P.LOWER_LEG_R}},
	{"name": "foot", "kind": "foot", "ids": {"l": P.FOOT_L, "r": P.FOOT_R}},
]
const GROUPS := ["frac.state", "frac.ai", "frac.pose", "bleed", "hit", "sever.state", "sever.floor", "sever.stump",
	"sever.ai", "sever.pose", "clutch", "ragdoll", "dead.hit", "fx", "reach"]

var _rows: Array[Dictionary] = []     # {group, label, name, ok, info}
var _fails := 0
var _arena: Node3D
var _weapons := {}                    # weapon id -> Weapon (in tree, physics off)
var _pending := 0
var _reach := {"frac": {}, "sever": {}}   # part id -> min weapon speed (m/s) that works, -1 = no shipped weapon
var _lmb := {"knife": 0.0, "bat": 0.0}    # measured tip speed of a normal swing
var _idle_report: Array[String] = []
var _cues := {}                       # npc id -> Array[StringName] of audio cues
var _gore: GoreFX


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if "--visual" in args:
		var i := args.find("--visual")
		var out := String(args[i + 1]) if args.size() > i + 1 else "res://tests/captures/"
		await _run_visual(out)
	elif "--inner" in args:
		await _run_tests()
	else:
		_run_outer()


# ============================================================================== outer (log scan)

func _run_outer() -> void:
	var output: Array = []
	var exe := OS.get_executable_path()
	var proj := ProjectSettings.globalize_path("res://")
	var code := OS.execute(exe, ["--headless", "--path", proj, "res://tests/limb_integration_test.tscn", "--", "--inner"],
		output, true)
	var log := "" if output.is_empty() else String(output[0])
	var script_errors := 0
	var other_errors := 0
	var seen := {}
	var lines := log.split("\n")
	for i in lines.size():
		var line: String = lines[i]
		var is_err := line.begins_with("SCRIPT ERROR") or line.begins_with("Parse Error") or line.contains("SCRIPT ERROR:")
		if is_err:
			script_errors += 1
			var key: String = line + (lines[i + 1] if i + 1 < lines.size() else "")
			seen[key] = int(seen.get(key, 0)) + 1
			if int(seen[key]) > 2:
				continue                     # collapse the 2000-line spam of one repeating error
		elif line.begins_with("ERROR:"):
			other_errors += 1
			print("  >> engine error: ", line)
		elif line.begins_with("          at:") and i > 0 and (lines[i - 1] as String).contains("SCRIPT ERROR"):
			if int(seen.get(lines[i - 1] + line, 0)) > 2:
				continue
		print(line)
	for k in seen:
		if int(seen[k]) > 2:
			print("  (repeated %d times: %s)" % [int(seen[k]), String(k).replace("\n", " ")])
	var ok := script_errors == 0 and other_errors == 0
	print("%s  no SCRIPT ERROR / engine ERROR in the log  script_errors=%d engine_errors=%d inner_exit=%d" % [
		"PASS" if ok else "FAIL", script_errors, other_errors, code])
	var all_ok := ok and code == 0
	print("LIMB INTEGRATION TEST ", "OK" if all_ok else "FAILED")
	get_tree().quit(0 if all_ok else 1)


# ============================================================================== harness

func _check(group: String, label: String, name: String, ok: bool, info: String = "") -> void:
	_rows.append({"group": group, "label": label, "name": name, "ok": ok, "info": info})
	if not ok:
		_fails += 1
	print("%s  [%s] %s: %s  %s" % ["PASS" if ok else "FAIL", label, group, name, info])


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _build_arena() -> void:
	_arena = Node3D.new()
	_arena.name = "Arena"
	add_child(_arena)
	var floor_body := StaticBody3D.new()
	floor_body.name = "Floor"
	floor_body.collision_layer = BodyIds.LAYER_WORLD
	floor_body.collision_mask = 0
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(600, 1, 200)
	col.shape = box
	col.position = Vector3(0, -0.5, 0)
	floor_body.add_child(col)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = box.size
	mi.mesh = bm
	mi.position = col.position
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.45, 0.5, 0.45)
	mi.material_override = fm
	floor_body.add_child(mi)
	_arena.add_child(floor_body)
	_gore = GoreFX.new()
	_gore.name = "GoreFX"
	_arena.add_child(_gore)
	var audio := AudioCues.new()
	audio.name = "AudioCues"
	_arena.add_child(audio)
	GameEvents.audio_cue.connect(func(n, cue: StringName, _pos: Vector3, _i: float):
		if n != null:
			var id: int = n.npc_id
			if not _cues.has(id):
				_cues[id] = []
			_cues[id].append(cue))
	var wholder := Node3D.new()
	wholder.name = "Weapons"
	_arena.add_child(wholder)
	for id in ["handgun", "knife", "bat"]:
		var w := WeaponFactory.create(WeaponDefs.get_def(id), null)
		wholder.add_child(w)
		w.set_physics_process(false)
		_weapons[id] = w


func _cases() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for limb in LIMBS:
		for side in ["l", "r"]:
			out.append({"limb": limb.name, "kind": limb.kind, "side": side, "pid": int(limb.ids[side]),
				"label": "%s_%s" % [limb.name, side], "idx": out.size()})
	return out


func _spawn(c: Dictionary, tag: String) -> Npc:
	var holder := Node3D.new()
	holder.name = "H_%s_%s" % [c.label, tag]
	_arena.add_child(holder)
	var xf := Transform3D(Basis.IDENTITY, Vector3(-54.0 + SPACING * float(c.idx), 0.02, -8.0))
	return Npc.spawn(holder, xf, 100 + int(c.idx))


func _free(npc: Npc) -> void:
	_gore.clear_all()      # what main.gd's clear_all does: gore is cleared together with the NPCs
	var h := npc.get_parent()
	if is_instance_valid(h):
		h.queue_free()


## Records the signals a case cares about.
func _watch(npc: Npc) -> Dictionary:
	var r := {"broken": [], "severed": [], "states": [], "stunned": [], "wounded": 0}
	npc.part_broken.connect(func(p: int): r.broken.append(p))
	npc.part_severed.connect(func(p: int, root: RigidBody3D, _ev: DamageEvent): r.severed.append({"pid": p, "root": root}))
	npc.state_changed.connect(func(_o: int, n: int): r.states.append(n))
	npc.stunned.connect(func(d: float, cause: StringName): r.stunned.append([d, cause]))
	npc.wounded.connect(func(_w: Wound, _e: DamageEvent): r.wounded += 1)
	return r


func _run_all(cases: Array[Dictionary], fn: Callable) -> void:
	_pending = cases.size()
	for c in cases:
		_run_case(fn, c)
	var waited := 0
	while _pending > 0 and waited < PHASE_TIMEOUT_FRAMES:
		await get_tree().physics_frame
		waited += 1
	if _pending > 0:
		_check("frac.state", "phase", "phase finished", false, "%d cases still pending (script error?)" % _pending)


func _run_case(fn: Callable, c: Dictionary) -> void:
	await fn.call(c)
	_pending -= 1


# ============================================================================== striking (weapon-style events)

## Strike part `pid` of `npc` with a real weapon's event. kind: "bullet" | "blunt" | "slash".
## speed < 0 -> synthetic event of that type (no shipped weapon reaches the threshold).
func _strike(npc: Npc, pid: int, kind: String, speed: float, dir := Vector3(0, 0, 1), aim := Vector3.ZERO) -> Dictionary:
	var c := npc.body.get_part_global_transform(pid).origin + aim
	var from := c - dir * 1.5
	var q := PhysicsRayQueryParameters3D.create(from, c + dir * 0.6, Weapon.hit_mask())
	var res := get_world_3d().direct_space_state.intersect_ray(q)
	var out := {"ray_part": -1, "ev": null, "synthetic": speed < 0.0 and kind != "bullet"}
	var collider: Object = null
	var pos := c
	var normal := -dir
	if not res.is_empty():
		collider = res.collider
		out.ray_part = BodyIds.part_from_collider(collider)
		pos = res.position
		normal = res.normal
	var clear: bool = int(out.ray_part) == pid
	if not clear:
		collider = npc.body.get_part_node(pid)   # fall back: deliver to the intended part at its centre
		pos = c
		normal = -dir
	var ev: DamageEvent = null
	if kind == "bullet":
		var hg: HitscanWeapon = _weapons["handgun"]
		if clear:
			ev = hg.fire_ray(from, dir)
		else:
			ev = hg._new_event(DamageEvent.Type.BULLET)
			var def: Dictionary = hg.def
			ev.direction = dir
			ev.impactor_velocity = dir * float(def.muzzle_velocity)
			ev.impactor_mass = float(def.mass)
			ev.penetration = float(def.penetration)
			ev.amount = float(def.base_damage)
			hg._deliver(ev, collider, pos, normal)
	elif speed >= 0.0:
		var w: MeleeWeapon = _weapons["bat" if kind == "blunt" else "knife"]
		# blade axis (-Z) = UP, perpendicular to the +Z travel -> BLADE_SLASH for the knife
		w.global_transform = Transform3D(Basis.looking_at(Vector3.UP, dir), pos)
		ev = w._build_event(dir * speed)
		w._deliver(ev, collider, pos, normal)
	else:
		ev = DamageEvent.new()
		ev.weapon_id = &"synthetic"
		ev.direction = dir
		ev.impactor_velocity = dir * 14.0
		ev.hit_position = pos
		ev.hit_normal = normal
		ev.part_id = pid
		if kind == "blunt":
			ev.type = DamageEvent.Type.BLUNT
			ev.amount = 90.0
			ev.impactor_mass = 0.9
		else:
			ev.type = DamageEvent.Type.BLADE_SLASH
			ev.amount = 90.0
			ev.impactor_mass = 0.25
			ev.penetration = 0.03
			ev.can_dismember = true
		npc.apply_damage(ev)
	out.ev = ev
	out.clear = clear
	return out


func _fracture_speed(pid: int) -> float:
	return float(_reach.frac.get(pid, -1.0))


func _sever_speed(pid: int) -> float:
	return float(_reach.sever.get(pid, -1.0))


# ============================================================================== geometry / sampling helpers

static func _box_low(xf: Transform3D, h: Vector3) -> float:
	var b := xf.basis
	return xf.origin.y - (absf(b.x.y) * h.x + absf(b.y.y) * h.y + absf(b.z.y) * h.z)


func _sole(npc: Npc, pid: int) -> float:
	return _box_low(npc.body.get_part_global_transform(pid), npc.body.get_part_half_extents(pid)) \
		- npc.get_parent().global_position.y


func _dropped_count(npc: Npc) -> int:
	var n := 0
	for ch in npc.get_parent().get_children():
		if String(ch.name).begins_with("DroppedPhone"):
			n += 1
	return n


## Samples the tracked parts for `frames` physics frames. Returns means / ranges (in metres).
func _sample(npc: Npc, frames: int) -> Dictionary:
	var hy := {"l": [], "r": []}
	var hf := {"l": [], "r": []}
	var sole := {"l": [], "r": []}
	var ff := {"l": [], "r": []}
	var torso_y: Array[float] = []
	var up_dot: Array[float] = []
	var max_step := 0.0
	var prev := npc.body.get_part_global_transform(P.TORSO).origin
	for i in frames:
		await get_tree().physics_frame
		var t := npc.body.get_part_global_transform(P.TORSO)
		max_step = maxf(max_step, t.origin.distance_to(prev))
		prev = t.origin
		var fwd := npc.body.get_forward()
		torso_y.append(t.origin.y)
		up_dot.append(t.basis.y.dot(Vector3.UP))
		for s in ["l", "r"]:
			var h := npc.body.get_part_global_transform(BodyIds.hand_of(s)).origin
			hy[s].append(h.y)
			hf[s].append((h - t.origin).dot(fwd))
			var fid: int = P.FOOT_L if s == "l" else P.FOOT_R
			sole[s].append(_sole(npc, fid))
			ff[s].append((npc.body.get_part_global_transform(fid).origin - t.origin).dot(fwd))
	var out := {"torso_y": _mean(torso_y), "up_dot": _mean(up_dot), "max_step": max_step}
	for s in ["l", "r"]:
		out["hand_y_" + s] = _mean(hy[s])
		out["hand_range_" + s] = _range(hf[s])
		out["sole_mean_" + s] = _mean(sole[s])
		out["sole_min_" + s] = _min(sole[s])
		out["foot_range_" + s] = _range(ff[s])
	return out


static func _mean(a: Array) -> float:
	if a.is_empty():
		return 0.0
	var t := 0.0
	for v in a:
		t += float(v)
	return t / a.size()


static func _range(a: Array) -> float:
	if a.is_empty():
		return 0.0
	var lo := INF
	var hi := -INF
	for v in a:
		lo = minf(lo, float(v))
		hi = maxf(hi, float(v))
	return hi - lo


static func _min(a: Array) -> float:
	var lo := INF
	for v in a:
		lo = minf(lo, float(v))
	return lo


static func _cm(v: float) -> String:
	return "%.1fcm" % (v * 100.0)


func _reacted(state: int) -> bool:
	return state in [S.PANIC_FLEE, S.STAGGER, S.ALERT, S.CLUTCH_WOUND]


# ============================================================================== run

func _run_tests() -> void:
	_build_arena()
	await _frames(3)
	await _measure_lmb()
	await _phase_reach()
	await _run_all(_cases(), _c_fracture)
	await _run_all(_cases(), _c_bleed)
	await _run_all(_cases(), _c_sever)
	var arm_cases: Array[Dictionary] = []
	for c in _cases():
		if c.kind in ["arm", "hand"]:
			arm_cases.append(c)
	await _run_all(arm_cases, _c_idle_arm)
	await _run_all(_clutch_cases(), _c_clutch)
	await _run_all(_roundtrip_cases(), _c_roundtrip)
	await _run_all(_cases(), _c_dead_hit)
	await _phase_fx()
	await _combo_both_feet()
	await _combo_chain("chain_arm_l", [P.HAND_L, P.LOWER_ARM_L, P.UPPER_ARM_L], 1)
	await _combo_chain("chain_leg_r", [P.FOOT_R, P.LOWER_LEG_R, P.UPPER_LEG_R], 2)
	await _combo_corpse_sever()
	await _fx_cleanup_seam()
	_print_report()
	get_tree().quit(1 if _fails > 0 else 0)


## Tip speed of a normal LMB swing (what the player gets without Shift free-swing).
func _measure_lmb() -> void:
	for id in ["knife", "bat"]:
		var w := WeaponFactory.create(WeaponDefs.get_def(id), null)
		_arena.add_child(w)
		w.debug_swing(1.0, &"swing")
		var mx := 0.0
		for i in 45:
			await get_tree().physics_frame
			mx = maxf(mx, (w as MeleeWeapon).tip_speed)
		_lmb[id] = mx
		w.queue_free()


## Lowest weapon speed that fractures / severs each part (fresh NPC per rung).
func _phase_reach() -> void:
	var probe := {"idx": 0, "label": "probe", "limb": "probe"}
	for c in _cases():
		var pid: int = c.pid
		for kind in ["frac", "sever"]:
			var ladder: Array[float] = BAT_LADDER if kind == "frac" else KNIFE_LADDER
			_reach[kind][pid] = -1.0
			for v in ladder:
				var npc := _spawn(probe, "probe")
				await _frames(2)
				_strike(npc, pid, "blunt" if kind == "frac" else "slash", v)
				var bp := npc.damage.get_part(pid)
				var hit_ok: bool = bp.broken if kind == "frac" else bp.severed
				_free(npc)
				await _frames(2)
				if hit_ok:
					_reach[kind][pid] = v
					break
	for c in _cases():
		var pid: int = c.pid
		var fv := _fracture_speed(pid)
		var sv := _sever_speed(pid)
		var fmsg := "bat >= %s m/s (normal swing %.1f)%s" % [_fv(fv), _lmb.bat, "" if fv >= 0 and fv <= _lmb.bat + 0.01 else " - needs a faster-than-LMB swing"]
		var smsg := "knife >= %s m/s (normal swing %.1f)%s" % [_fv(sv), _lmb.knife, "" if sv >= 0 and sv <= _lmb.knife + 0.01 else " - needs a faster-than-LMB swing"]
		# no shipped weapon at all = FAIL; reachable only with a faster-than-LMB swing = noted, still PASS
		_check("reach", c.label, "fracturable by a shipped weapon", fv >= 0.0, fmsg)
		_check("reach", c.label, "severable by a shipped weapon", sv >= 0.0, smsg)


# ============================================================================== phase: fracture

func _c_fracture(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var kind: String = c.kind
	var side: String = c.side
	var npc := _spawn(c, "frac")
	await _frames(SETTLE_FRAMES)
	var rec := _watch(npc)
	var fv := _fracture_speed(pid)
	var hit := _strike(npc, pid, "blunt", fv)
	var ev: DamageEvent = hit.ev
	var tag := "bat %.1f m/s" % fv if fv >= 0.0 else "SYNTHETIC blunt 90"
	_check("frac.state", label, "ray lands on the part", bool(hit.clear), "ray_part=%s" % [BodyIds.key(int(hit.ray_part)) if int(hit.ray_part) >= 0 else "none"])
	var bp := npc.damage.get_part(pid)
	_check("frac.state", label, "BodyPart.broken", bp.broken, "%s hp=%.1f" % [tag, bp.hp])
	_check("frac.state", label, "part_broken emitted once with this part", rec.broken == [pid], str(rec.broken))
	_check("frac.state", label, "not severed, still attached", not bp.severed and npc.body.has_part(pid))
	var fw := false
	for w in npc.wounds.get_wounds_on(pid):
		fw = fw or w.is_fracture
	_check("frac.state", label, "fracture wound recorded", fw)
	await _frames(6)
	var cn: int = _cues.get(npc.npc_id, []).count(&"bone_crack")
	_check("frac.state", label, "bone_crack cue emitted once", cn == 1, "count=%d" % cn)
	var st := npc.get_state()
	var dbg: Dictionary = npc.brain.get_debug_info()
	var holder := npc.get_parent()
	match kind:
		"arm", "hand":
			_check("frac.ai", label, "arm chain flagged unusable (one-handed)", int(dbg.usable_arms) == 1 and bool(dbg.one_handed), "usable=%s" % dbg.usable_arms)
			var held: String = npc.body.get_debug_info().held_item
			var dropped := _dropped_count(npc)
			if side == "r":
				_check("frac.ai", label, "right hand drops the phone", held == "" and dropped == 1, "held='%s' dropped=%d" % [held, dropped])
			else:
				_check("frac.ai", label, "left break keeps the phone in the right hand", held == "phone" and dropped == 0, "held='%s' dropped=%d" % [held, dropped])
			_check("frac.ai", label, "NPC reacts (not idle, not crawling)", _reacted(st), BodyIds.state_name(st))
		"foot":
			_check("frac.ai", label, "limp side == broken foot side", npc.brain.get_limp_side() == side, "limp_side='%s'" % npc.brain.get_limp_side())
			_check("frac.ai", label, "foot break does not crawl", st != S.CRAWL and _reacted(st), BodyIds.state_name(st))
		"thigh", "shin":
			await _frames(6)
			st = npc.get_state()
			_check("frac.ai", label, "leg break -> CRAWL", st == S.CRAWL, BodyIds.state_name(st))
			_check("frac.ai", label, "body pose is crawl", String(npc.body.get_debug_info().pose) == "crawl", String(npc.body.get_debug_info().pose))
	# ----- pose
	match kind:
		"arm", "hand":
			npc.brain.force_state(S.ALERT)    # walk straight ahead (flee dir = hit direction = +Z)
			await _frames(30)
			var m := await _sample(npc, 140)
			var bs := side
			var os := "r" if side == "l" else "l"
			var lower: float = float(m["hand_y_" + os]) - float(m["hand_y_" + bs])
			var ratio: float = float(m["hand_range_" + bs]) / maxf(float(m["hand_range_" + os]), 0.001)
			_check("frac.pose", label, "WALK: broken hand not higher than the sound hand (hang)", lower >= ARM_HANG_MIN_M,
				"broken hand lower by %s (a straight arm can drop only ~1 cm below a sound one)" % _cm(lower))
			_check("frac.pose", label, "broken hand does not swing with the stride", ratio <= ARM_SWING_RATIO_MAX,
				"swing range broken=%s sound=%s ratio=%.2f (max %.2f)" % [_cm(m["hand_range_" + bs]), _cm(m["hand_range_" + os]), ratio, ARM_SWING_RATIO_MAX])
			_check("frac.pose", label, "pose is a walking pose and torso upright", String(npc.body.get_debug_info().pose) == "walk" and float(m.up_dot) > 0.9,
				"pose=%s up_dot=%.2f" % [npc.body.get_debug_info().pose, m.up_dot])
		"foot":
			npc.brain.force_state(S.ALERT)
			await _frames(30)
			var pose := String(npc.body.get_debug_info().pose)
			var drv_side := ""
			if "_pose_driver" in npc.body:
				drv_side = String(npc.body._pose_driver.get_limp_side())
			_check("frac.pose", label, "locomotion pose is limp", pose == "limp", pose)
			_check("frac.pose", label, "PoseDriver limps on the broken side", drv_side == side, "driver_side='%s'" % drv_side)
			var m := await _sample(npc, 140)
			var os := "r" if side == "l" else "l"
			_check("frac.pose", label, "broken foot is not weight bearing (sole lifted)", float(m["sole_mean_" + side]) >= FOOT_LIFT_MIN_M,
				"broken sole mean %s, min %s" % [_cm(m["sole_mean_" + side]), _cm(m["sole_min_" + side])])
			_check("frac.pose", label, "sound foot carries the weight (sole reaches floor)", float(m["sole_min_" + os]) <= SOUND_FOOT_MAX_M,
				"sound sole min %s" % _cm(m["sole_min_" + os]))
		"thigh", "shin":
			var p0 := npc.body.get_part_global_transform(P.TORSO).origin
			var m := await _sample(npc, 150)
			var p1 := npc.body.get_part_global_transform(P.TORSO).origin
			_check("frac.pose", label, "crawl: torso low and pitched forward", float(m.torso_y) < 0.6 and float(m.up_dot) < 0.5,
				"torso_y=%.2f up_dot=%.2f" % [m.torso_y, m.up_dot])
			_check("frac.pose", label, "crawl: hands on the floor, NPC makes progress", (p1 - p0).length() > 0.3,
				"moved %.2f m in 2.5 s" % (p1 - p0).length())
	_free(npc)


# ============================================================================== phase: bleeding / hand+foot hits

func _c_bleed(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var npc := _spawn(c, "bleed")
	await _frames(SETTLE_FRAMES)
	var rec := _watch(npc)
	var vol0 := npc.blood.state.volume
	var torso0 := npc.body.get_part_global_transform(P.TORSO).origin
	var hit := _strike(npc, pid, "bullet", 0.0)
	var ev: DamageEvent = hit.ev
	_check("hit", label, "9mm ray lands on the part collider", bool(hit.clear) and ev != null and ev.part_id == pid,
		"ray_part=%s" % [BodyIds.key(int(hit.ray_part)) if int(hit.ray_part) >= 0 else "none"])
	var entry := 0
	var exit_w := 0
	for w in npc.wounds.get_wounds_on(pid):
		if w.is_exit:
			exit_w += 1
		elif not w.is_fracture:
			entry += 1
	_check("hit", label, "entry + exit wound (penetrating)", entry == 1 and exit_w == 1, "entry=%d exit=%d" % [entry, exit_w])
	var step_max := 0.0
	var prev := torso0
	for i in 60:
		await get_tree().physics_frame
		var t := npc.body.get_part_global_transform(P.TORSO).origin
		step_max = maxf(step_max, t.distance_to(prev))
		prev = t
	var flowing := 0
	var sum_flow := 0.0
	for w in npc.wounds.get_wounds_on(pid):
		if not w.is_fracture and w.current_flow > 0.0:
			flowing += 1
			sum_flow += w.current_flow
	_check("bleed", label, "penetrating wound current_flow > 0", flowing >= 1, "%d wounds flowing, total %.2f ml/s" % [flowing, sum_flow])
	_check("bleed", label, "BloodSystem external rate > 0 and volume dropping", npc.blood.state.external_rate > 0.0 and npc.blood.state.volume < vol0,
		"rate=%.2f lost=%.2f ml" % [npc.blood.state.external_rate, vol0 - npc.blood.state.volume])
	_check("hit", label, "NPC reacts to the hit", _reacted(npc.get_state()) or npc.get_state() == S.CRAWL, BodyIds.state_name(npc.get_state()))
	_check("hit", label, "no launch (max torso step %s/frame < %s)" % [_cm(step_max), _cm(MAX_TORSO_STEP)], step_max < MAX_TORSO_STEP)
	if BodyIds.is_hand(pid) or BodyIds.is_foot(pid):
		var bp := npc.damage.get_part(pid)
		_check("hit", label, "small part keeps a consistent state (hp, broken flag)", bp.hp < bp.max_hp and (not bp.broken or rec.broken == [pid]),
			"hp %.1f/%.1f broken=%s" % [bp.hp, bp.max_hp, bp.broken])
	_free(npc)


# ============================================================================== phase: sever

func _c_sever(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var kind: String = c.kind
	var side: String = c.side
	var npc := _spawn(c, "sever")
	await _frames(SETTLE_FRAMES)
	var rec := _watch(npc)
	var parent := BodyIds.parent_of(pid)
	var sub: Array[int] = [pid]
	sub.append_array(BodyIds.descendants_of(pid))
	var sv := _sever_speed(pid)
	var hit := _strike(npc, pid, "slash", sv)
	var ev: DamageEvent = hit.ev
	var tag := "knife %.1f m/s (amount %.1f)" % [sv, ev.amount] if sv >= 0.0 else "SYNTHETIC slash 90"
	var all_cut := true
	var all_flag := true
	for p in sub:
		all_cut = all_cut and not npc.body.has_part(p)
		all_flag = all_flag and npc.damage.get_part(p).severed
	_check("sever.state", label, "has_part false for the whole subtree %s" % [str(sub)], all_cut, tag)
	_check("sever.state", label, "BodyPart.severed set on the whole subtree", all_flag)
	_check("sever.state", label, "parent still attached and intact", npc.body.has_part(parent) and not npc.damage.get_part(parent).severed)
	var others_ok := true
	for p in BodyIds.KEYS:
		if p not in sub and p != pid:
			others_ok = others_ok and npc.body.has_part(p) == true
	_check("sever.state", label, "every other part still attached", others_ok)
	var one: bool = rec.severed.size() == 1 and int(rec.severed[0].pid) == pid
	_check("sever.state", label, "part_severed emitted once for the subtree root", one, str(rec.severed.map(func(d): return d.pid)))
	var root: RigidBody3D = rec.severed[0].root if rec.severed.size() > 0 else null
	var contract_ok := root != null and root.has_meta(BodyIds.META_NPC) and int(root.get_meta(BodyIds.META_PART_ID, -1)) == pid \
		and (root.collision_layer & BodyIds.LAYER_NPC_PARTS) != 0 and root is BodySegment and not (root as BodySegment).freeze
	_check("sever.state", label, "severed RigidBody3D is dynamic, on npc_parts, carries npc/part_id metas", contract_ok)
	var sc: int = _cues.get(npc.npc_id, []).count(&"sever")
	_check("sever.state", label, "sever cue emitted once", sc == 1, "count=%d" % sc)
	# stump
	var stump: Wound = null
	for w in npc.wounds.get_wounds_on(parent):
		if w.is_stump:
			stump = w
	_check("sever.stump", label, "stump wound on the parent (%s)" % BodyIds.key(parent), stump != null and not stump.detached)
	var detached_ok := true
	for w in npc.wounds.get_wounds():
		if w.part_id in sub:
			detached_ok = detached_ok and w.detached and w.current_flow == 0.0
	_check("sever.stump", label, "wounds on the severed subtree are detached and stop bleeding", detached_ok)
	await _frames(6)
	var st := npc.get_state()
	var dbg: Dictionary = npc.brain.get_debug_info()
	match kind:
		"arm", "hand":
			_check("sever.ai", label, "one-handed / arm lost", int(dbg.usable_arms) == 1 and bool(dbg.one_handed), "usable=%s" % dbg.usable_arms)
			_check("sever.ai", label, "NPC reacts (flee/stagger, not crawl)", _reacted(st), BodyIds.state_name(st))
			# phone: travels with a severed right arm/hand, never duplicated as a dropped debris item
			var phone_seg := npc.body.get_part_node(P.HAND_R) as BodySegment
			var dropped := _dropped_count(npc)
			if side == "r":
				_check("sever.ai", label, "phone leaves with the severed right hand (no ghost drop)",
					phone_seg != null and phone_seg.held_item != null and not phone_seg.attached and dropped == 0,
					"held_item=%s attached=%s dropped=%d" % [phone_seg.held_item != null, phone_seg.attached, dropped])
			else:
				_check("sever.ai", label, "right hand keeps the phone", phone_seg.attached and phone_seg.held_item != null and dropped == 0)
		_:
			_check("sever.ai", label, "leg/foot loss -> CRAWL", st == S.CRAWL, BodyIds.state_name(st))
			_check("sever.ai", label, "body pose is crawl", String(npc.body.get_debug_info().pose) == "crawl", String(npc.body.get_debug_info().pose))
	await _frames(30)
	# stump bleeding (BloodSystem has stepped for ~0.6 s)
	var stump_flow := stump.current_flow if stump != null else 0.0
	_check("sever.stump", label, "stump current_flow > 0", stump_flow > 0.0, "%.1f ml/s" % stump_flow)
	await _frames(144)    # ~3 s after the cut
	# severed pieces at rest on the floor
	var floor_ok := root != null and is_instance_valid(root)
	var floor_info := ""
	if floor_ok:
		var seg := root as BodySegment
		var low: float = _box_low(seg.global_transform, seg.half) - npc.get_parent().global_position.y
		var spd := seg.linear_velocity.length()
		floor_ok = low <= REST_MAX_HEIGHT and low >= -0.06 and spd < 0.5
		floor_info = "root lowest point %s, speed %.2f m/s, y=%.2f" % [_cm(low), spd, seg.global_position.y]
		for p in sub:
			var ps := npc.body.get_part_node(p) as BodySegment
			if ps != null:
				var pl: float = _box_low(ps.global_transform, ps.half) - npc.get_parent().global_position.y
				if pl < -0.06 or ps.global_position.y > 1.0:
					floor_ok = false
					floor_info += " | %s off (low %s)" % [BodyIds.key(p), _cm(pl)]
	_check("sever.floor", label, "severed piece rests on the floor after 3 s", floor_ok, floor_info)
	# shooting what was cut off must not hurt the (living) NPC again
	var targets: Array[int] = [pid]
	if sub.size() > 1:
		targets.append(sub[sub.size() - 1])
	var pain0: float = npc.brain.get_pain()
	var stumps0 := 0
	for w in npc.wounds.get_wounds():
		stumps0 += int(w.is_stump)
	var sev_events0: int = rec.severed.size()
	var cues0: int = _cues.get(npc.npc_id, []).size()
	var wounds0: int = npc.wounds.get_wounds().size()
	for t in targets:
		var h := _strike(npc, t, "bullet", 0.0, Vector3.DOWN)
		_check("sever.state", label, "9mm into the severed %s lands on the piece" % BodyIds.key(t), h.ray_part == t, "ray_part=%s" % [BodyIds.key(int(h.ray_part)) if int(h.ray_part) >= 0 else "none"])
	await _frames(4)
	var stumps1 := 0
	var new_detached := true
	var new_flow := 0.0
	var all_w: Array[Wound] = npc.wounds.get_wounds()
	for i in all_w.size():
		stumps1 += int(all_w[i].is_stump)
		if i >= wounds0:
			new_detached = new_detached and all_w[i].detached
			new_flow += all_w[i].current_flow
	_check("sever.state", label, "wounds on a severed piece are recorded detached, no second sever/stump", all_w.size() > wounds0 and new_detached and stumps1 == stumps0 and rec.severed.size() == sev_events0 and new_flow == 0.0,
		"new wounds=%d detached=%s stumps %d->%d sever events %d->%d flow=%.1f" % [all_w.size() - wounds0, new_detached, stumps0, stumps1, sev_events0, rec.severed.size(), new_flow])
	var pain1: float = npc.brain.get_pain()
	var cues1: Array = _cues.get(npc.npc_id, []).slice(cues0)
	var vocal := cues1.filter(func(q): return q == &"grunt" or q == &"scream").size()
	_check("sever.ai", label, "NPC feels no new pain / vocal reaction from shots into the severed piece", pain1 <= pain0 + 0.001 and vocal == 0,
		"pain %.3f -> %.3f, new grunt/scream cues=%d" % [pain0, pain1, vocal])
	# state / pose 3 s later
	st = npc.get_state()
	var pose := String(npc.body.get_debug_info().pose)
	var m := await _sample(npc, 20)
	match kind:
		"arm", "hand":
			_check("sever.pose", label, "stump side: NPC keeps moving upright, not ragdolled", not npc.body.is_ragdoll() and float(m.up_dot) > 0.8 and st != S.CRAWL,
				"state=%s pose=%s up_dot=%.2f" % [BodyIds.state_name(st), pose, m.up_dot])
		_:
			_check("sever.pose", label, "crawling on hands, torso low", st == S.CRAWL and pose == "crawl" and float(m.torso_y) < 0.6 and not npc.body.is_ragdoll(),
				"state=%s pose=%s torso_y=%.2f" % [BodyIds.state_name(st), pose, m.torso_y])
	_free(npc)


# ============================================================================== phase: idle arm hang (open item)

func _c_idle_arm(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var side: String = c.side
	var ctrl_case := c.duplicate()
	ctrl_case.idx = int(c.idx) + 12
	var npc := _spawn(c, "idle")
	var ctrl := _spawn(ctrl_case, "ctrl")
	await _frames(SETTLE_FRAMES)
	_strike(npc, pid, "blunt", _fracture_speed(pid))
	npc.brain.force_state(S.IDLE)
	await _frames(70)
	var m := await _sample(npc, 100)
	var mc := await _sample(ctrl, 100)
	var os := "r" if side == "l" else "l"
	var h_b: float = m["hand_y_" + side]
	var h_s: float = m["hand_y_" + os]
	var h_c: float = mc["hand_y_" + side]
	var lower_ctrl := h_c - h_b
	var lower_sound := h_s - h_b
	var off_b: Vector3 = npc.body.get_part_global_transform(BodyIds.hand_of(side)).origin - npc.body.get_part_global_transform(P.TORSO).origin
	var off_c: Vector3 = ctrl.body.get_part_global_transform(BodyIds.hand_of(side)).origin - ctrl.body.get_part_global_transform(P.TORSO).origin
	var dev := (off_b - off_c).length()
	var flex_b := _elbow_flex_deg(npc, side)
	var flex_c := _elbow_flex_deg(ctrl, side)
	_check("frac.pose", label, "IDLE: broken hand hangs (not higher than a sound hand) [open item]", lower_ctrl >= IDLE_HANG_MIN_M,
		"broken hand %s than control's same hand, %s than own sound hand; elbow flexion broken %.1f deg vs sound %.1f deg" % [
			("LOWER by " if lower_ctrl >= 0 else "HIGHER by ") + _cm(absf(lower_ctrl)), ("lower by " if lower_sound >= 0 else "higher by ") + _cm(absf(lower_sound)), flex_b, flex_c])
	_check("frac.pose", label, "IDLE: broken arm reads differently from a sound one", dev >= IDLE_VISIBLE_MIN_M,
		"hand is %s from where the control's hand sits (min %s)" % [_cm(dev), _cm(IDLE_VISIBLE_MIN_M)])
	_idle_report.append("%s: hand y broken %.3f | control %.3f | sound-side %.3f ; deviation from control %s ; elbow flex %.1f vs %.1f deg" % [
		label, h_b, h_c, h_s, _cm(dev), flex_b, flex_c])
	_free(npc)
	_free(ctrl)



# ============================================================================== phase: clutch with an injured arm

func _clutch_cases() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for c in _cases():
		if c.limb == "lower_arm" or c.limb == "hand":
			var cc := c.duplicate()
			cc.mode = "break" if c.limb == "lower_arm" else "sever"
			out.append(cc)
	return out


## Distance from `point` to the hand of `side` (forearm tip when the hand is gone).
func _reach_dist(npc: Npc, side: String, point: Vector3) -> float:
	var hid := BodyIds.hand_of(side)
	if npc.body.has_part(hid):
		return npc.body.get_part_global_transform(hid).origin.distance_to(point)
	var lid: int = P.LOWER_ARM_L if side == "l" else P.LOWER_ARM_R
	if npc.body.has_part(lid):
		var xf := npc.body.get_part_global_transform(lid)
		return (xf.origin - xf.basis.y * npc.body.get_part_half_extents(lid).y).distance_to(point)
	return 99.0


func _c_clutch(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var side: String = c.side
	var os := "r" if side == "l" else "l"
	var npc := _spawn(c, "clutch")
	await _frames(SETTLE_FRAMES)
	if c.mode == "break":
		_strike(npc, pid, "blunt", _fracture_speed(pid))
	else:
		_strike(npc, pid, "slash", _sever_speed(pid))
	await _frames(20)
	_strike(npc, P.TORSO, "bullet", 0.0, Vector3(0, 0, -1), Vector3(0, 0.12, 0))   # 9mm into the chest from the front
	await _frames(4)
	npc.brain.force_state(S.CLUTCH_WOUND)
	await _frames(80)
	var best: Wound = null
	for w in npc.wounds.get_wounds_on(P.TORSO):
		if not w.detached and (best == null or w.severity > best.severity):
			best = w
	var txf := npc.body.get_part_global_transform(P.TORSO)
	var wp := txf * best.local_position if best != null else txf.origin
	var d_s := _reach_dist(npc, side, wp)
	var d_o := _reach_dist(npc, os, wp)
	var st := npc.get_state()
	var info := "wound=%s on torso (%s), distance to wound: %s hand %s, %s hand %s" % [
		"exit" if best != null and best.is_exit else "entry", "local %s" % [best.local_position] if best else "none", side, _cm(d_s), os, _cm(d_o)]
	_check("clutch", label, "NPC is clutching the chest wound", st == S.CLUTCH_WOUND and best != null, BodyIds.state_name(st))
	if c.mode == "break":
		_check("clutch", label, "sound arm (%s) presses the wound" % os, d_o <= CLUTCH_NEAR_M, info)
		_check("clutch", label, "broken arm (%s) is not used" % side, d_s >= CLUTCH_FAR_M, info)
	else:
		_check("clutch", label, "an arm (hand or stump tip) reaches the wound", minf(d_s, d_o) <= CLUTCH_NEAR_M, info)
	var dbg: Dictionary = npc.get_debug_info()    # every debug getter must cope with missing parts
	_check("clutch", label, "debug info still builds", dbg.has("body") and dbg.has("brain"))
	_free(npc)


# ============================================================================== phase: ragdoll round trip with injured limbs

func _roundtrip_cases() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	for d in [["hand", "l", "sever_before"], ["lower_arm", "r", "break_before"], ["foot", "l", "break_before"], ["foot", "r", "sever_during"]]:
		for c in _cases():
			if c.limb == d[0] and c.side == d[1]:
				var cc := c.duplicate()
				cc.mode = d[2]
				out.append(cc)
	return out


func _c_roundtrip(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var side: String = c.side
	var os := "r" if side == "l" else "l"
	var mode: String = c.mode
	var npc := _spawn(c, "rt")
	await _frames(SETTLE_FRAMES)
	if mode == "sever_before":
		_strike(npc, pid, "slash", _sever_speed(pid))
	elif mode == "break_before":
		_strike(npc, pid, "blunt", _fracture_speed(pid))
	await _frames(10)
	npc.emit_stunned(2.5, &"test_knockdown")
	await _frames(3)
	_check("ragdoll", label, "stun >= 2 s knocks the NPC down (ragdoll)", npc.get_state() == S.UNCONSCIOUS and npc.body.is_ragdoll(),
		BodyIds.state_name(npc.get_state()))
	if mode == "sever_during":
		await _frames(30)
		_strike(npc, pid, "slash", _sever_speed(pid))   # cut while ragdolled
		await _frames(6)
		_check("ragdoll", label, "limb cut off while ragdolled: has_part false", not npc.body.has_part(pid))
	await _frames(190)
	var st := npc.get_state()
	_check("ragdoll", label, "NPC gets up again (animated, not unconscious)", st != S.UNCONSCIOUS and st != S.DEAD and not npc.body.is_ragdoll(),
		"%s ragdoll=%s" % [BodyIds.state_name(st), npc.body.is_ragdoll()])
	var m := await _sample(npc, 90)
	var pose := String(npc.body.get_debug_info().pose)
	match mode:
		"sever_before":
			_check("ragdoll", label, "severed hand stays gone, NPC upright again", not npc.body.has_part(pid) and float(m.up_dot) > 0.8,
				"up_dot=%.2f state=%s pose=%s" % [m.up_dot, BodyIds.state_name(npc.get_state()), pose])
		"break_before":
			if BodyIds.is_arm(pid):
				var ratio: float = float(m["hand_range_" + side]) / maxf(float(m["hand_range_" + os]), 0.001)
				_check("ragdoll", label, "broken arm is still limp after getting up (swing ratio)", ratio <= ARM_SWING_RATIO_MAX,
					"ratio %.2f pose=%s" % [ratio, pose])
			else:
				var drv := String(npc.body._pose_driver.get_limp_side()) if "_pose_driver" in npc.body else ""
				_check("ragdoll", label, "broken foot still limps on the same side after getting up", pose == "limp" and drv == side and npc.brain.get_limp_side() == side,
					"pose=%s driver_side='%s' brain_side='%s'" % [pose, drv, npc.brain.get_limp_side()])
				_check("ragdoll", label, "broken foot still not weight bearing", float(m["sole_mean_" + side]) >= FOOT_LIFT_MIN_M, "sole mean %s" % _cm(m["sole_mean_" + side]))
		"sever_during":
			_check("ragdoll", label, "lost foot while down -> gets up crawling", st == S.CRAWL and pose == "crawl" and float(m.torso_y) < 0.6,
				"state=%s pose=%s torso_y=%.2f" % [BodyIds.state_name(st), pose, m.torso_y])
	_free(npc)


# ============================================================================== phase: hits on ragdolled (dead) limbs

static func _v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


## Distance between the joint anchor as seen from the parent and from the child segment (0 when the joint holds).
func _joint_gap(npc: Npc, pid: int) -> float:
	var par := BodyIds.parent_of(pid)
	var parts: Dictionary = DataDB.table("body_parts").parts
	var jr := _v3(parts[BodyIds.key(pid)].joint)
	var rc := _v3(parts[BodyIds.key(pid)].rest)
	var rp := _v3(parts[BodyIds.key(par)].rest)
	var ap := npc.body.get_part_global_transform(par) * (jr - rp)
	var ac := npc.body.get_part_global_transform(pid) * (jr - rc)
	return ap.distance_to(ac)


func _c_dead_hit(c: Dictionary) -> void:
	var pid: int = c.pid
	var label: String = c.label
	var npc := _spawn(c, "dead")
	await _frames(SETTLE_FRAMES)
	npc.brain.force_state(S.DEAD)
	await _frames(110)
	var t0 := npc.body.get_part_global_transform(P.TORSO).origin
	var seg := npc.body.get_part_node(pid) as BodySegment
	_strike(npc, pid, "blunt", 16.0)
	var max_gap := 0.0
	var max_speed := 0.0
	var worst := -1
	var end_gap := 0.0
	for i in 90:
		await get_tree().physics_frame
		max_speed = maxf(max_speed, seg.linear_velocity.length())
		for q in BodyIds.KEYS:
			if q != P.TORSO:
				var g := _joint_gap(npc, q)
				if g > max_gap:
					max_gap = g
					worst = q
	for q in BodyIds.KEYS:
		if q != P.TORSO:
			end_gap = maxf(end_gap, _joint_gap(npc, q))
	var moved := npc.body.get_part_global_transform(P.TORSO).origin.distance_to(t0)
	_check("dead.hit", label, "bat hit on a ragdolled limb: joints hold (and recover)", max_gap < JOINT_GAP_MAX and end_gap < 0.03,
		"peak joint gap %s (%s), after 1.5 s %s; limits %s / 3.0cm" % [_cm(max_gap), BodyIds.key(worst) if worst >= 0 else "-", _cm(end_gap), _cm(JOINT_GAP_MAX)])
	_check("dead.hit", label, "no launch: hit part <= 26 m/s, torso moved < 2.5 m", max_speed <= 26.0 and moved < 2.5,
		"part peak %.1f m/s, torso moved %.2f m" % [max_speed, moved])
	_free(npc)


# ============================================================================== phase: FX seam (GoreFX on hands/feet/stumps)

func _phase_fx() -> void:
	for c in _cases():
		_gore.clear_all()
		var npc := _spawn(c, "fx")
		await _frames(SETTLE_FRAMES)
		var n0 := _gore.emitter_count()
		_strike(npc, c.pid, "bullet", 0.0)
		await _frames(20)
		var n1 := _gore.emitter_count()
		_check("fx", c.label, "bleeding wounds get blood emitters", n1 > n0, "%d -> %d emitters" % [n0, n1])
		_free(npc)
		await _frames(3)
		_gore.clear_all()
		var npc2 := _spawn(c, "fx2")
		await _frames(SETTLE_FRAMES)
		var m0 := _gore.emitter_count()
		_strike(npc2, c.pid, "slash", _sever_speed(c.pid))
		await _frames(20)
		var m1 := _gore.emitter_count()
		var seg := npc2.body.get_part_node(c.pid)
		var on_piece := false
		for ch in seg.get_children():
			on_piece = on_piece or ch is GPUParticles3D
		_check("fx", c.label, "sever: stump emitters on the severed piece and on the parent", m1 - m0 >= 2 and on_piece,
			"%d -> %d emitters, emitter on piece=%s" % [m0, m1, on_piece])
		_free(npc2)
		await _frames(3)
	_gore.clear_all()


## Cut a limb piece by piece, tip first (hand, forearm, upper arm): earlier pieces must stay intact where they fell.
func _combo_chain(label: String, ids: Array[int], idx: int) -> void:
	var c := {"idx": idx, "label": label, "limb": "chain"}
	var npc := _spawn(c, "chain")
	await _frames(SETTLE_FRAMES)
	var rec := _watch(npc)
	var roots: Array = []
	var parents: Array = []
	for pid in ids:
		_strike(npc, pid, "slash", _sever_speed(pid))
		await _frames(20)
		_check("combo", label, "%s cut off" % BodyIds.key(pid), not npc.body.has_part(pid) and npc.damage.get_part(pid).severed)
		if rec.severed.size() > roots.size():
			roots.append(rec.severed[rec.severed.size() - 1].root)
			parents.append(roots[roots.size() - 1].get_parent())
	await _frames(150)
	var order: Array = rec.severed.map(func(d): return d.pid)
	_check("combo", label, "one part_severed per cut, in order", order == ids, str(order))
	var intact := roots.size() == ids.size()
	var info := ""
	for i in roots.size():
		var r: RigidBody3D = roots[i]
		if not is_instance_valid(r) or r.get_parent() != parents[i]:
			intact = false
			info += " | %s lost/reparented" % BodyIds.key(ids[i])
		elif r.global_position.y < -0.1 or r.global_position.y > 1.0:
			intact = false
			info += " | %s at y=%.2f" % [BodyIds.key(ids[i]), r.global_position.y]
	_check("combo", label, "earlier pieces stay where they fell (not re-cut / reparented)", intact, info)
	_check("combo", label, "rest of the body unaffected, crawling or fleeing", not npc.body.is_ragdoll() and npc.get_state() != S.IDLE,
		BodyIds.state_name(npc.get_state()))
	_free(npc)


## Dismember a corpse (ragdoll bodies are dynamic, severing takes a different path than for animated ones).
func _combo_corpse_sever() -> void:
	var c := {"idx": 3, "label": "corpse_sever", "limb": "corpse"}
	var npc := _spawn(c, "corpse")
	await _frames(SETTLE_FRAMES)
	npc.brain.force_state(S.DEAD)
	await _frames(110)
	var rec := _watch(npc)
	for pid in [P.LOWER_LEG_L, P.UPPER_ARM_R]:
		var sub: Array[int] = [pid]
		sub.append_array(BodyIds.descendants_of(pid))
		_strike(npc, pid, "slash", -1.0)
		await _frames(6)
		var gone := true
		for q in sub:
			gone = gone and not npc.body.has_part(q)
		_check("combo", c.label, "%s severed from a ragdolled corpse (subtree gone)" % BodyIds.key(pid), gone and rec.severed.size() > 0)
	await _frames(150)
	var phone := npc.body.get_part_node(P.HAND_R) as BodySegment
	_check("combo", c.label, "phone leaves with the severed right arm", phone.held_item != null and not phone.attached and _dropped_count(npc) == 0)
	var ok := true
	var info := ""
	for d in rec.severed:
		var r: RigidBody3D = d.root
		if not is_instance_valid(r) or r.global_position.y < -0.1 or r.linear_velocity.length() > 1.0:
			ok = false
			info += " | %s y=%.2f v=%.1f" % [BodyIds.key(d.pid), r.global_position.y if is_instance_valid(r) else -9.0, r.linear_velocity.length() if is_instance_valid(r) else -1.0]
	_check("combo", c.label, "severed pieces settle on the floor", ok, info)
	_free(npc)


## main.gd frees NPCs (and severed pieces are freed after severed_cleanup_s = 120 s) while their blood emitters are
## still registered in GoreFX. GoreFX must drop those emitters instead of erroring every frame.
func _fx_cleanup_seam() -> void:
	_gore.clear_all()
	var c := {"idx": 0, "label": "fx_cleanup", "limb": "hand"}
	var npc := _spawn(c, "cleanup")
	await _frames(SETTLE_FRAMES)
	_strike(npc, P.HAND_L, "slash", _sever_speed(P.HAND_L))
	await _frames(10)
	var before := _gore.emitter_count()
	npc.get_parent().queue_free()            # NPC + its severed hand container vanish (as after the 120 s cleanup)
	await _frames(12)
	var after := _gore.emitter_count()
	_check("combo", c.label, "GoreFX drops emitters whose part nodes were freed", before >= 2 and after == 0,
		"emitters %d -> %d (a freed node makes GoreFX._update_emitters raise a SCRIPT ERROR every frame)" % [before, after])
	_gore.clear_all()


# ============================================================================== combo: both feet broken

func _combo_both_feet() -> void:
	var c := {"idx": 0, "label": "foot_l+foot_r", "limb": "foot"}
	var npc := _spawn(c, "both")
	await _frames(SETTLE_FRAMES)
	_strike(npc, P.FOOT_L, "blunt", _fracture_speed(P.FOOT_L))
	await _frames(20)
	_strike(npc, P.FOOT_R, "blunt", _fracture_speed(P.FOOT_R))
	await _frames(6)
	_check("combo", c.label, "both feet broken -> limp side 'both', not crawling", npc.brain.get_limp_side() == "both" and npc.get_state() != S.CRAWL,
		"limp_side='%s' state=%s" % [npc.brain.get_limp_side(), BodyIds.state_name(npc.get_state())])
	npc.brain.force_state(S.ALERT)
	await _frames(30)
	var pose := String(npc.body.get_debug_info().pose)
	var drv := String(npc.body._pose_driver.get_limp_side()) if "_pose_driver" in npc.body else ""
	var m := await _sample(npc, 120)
	_check("combo", c.label, "walks with the limp pose, both feet carry weight", pose == "limp" and drv == "both" and float(m.up_dot) > 0.9
		and float(m.sole_min_l) <= SOUND_FOOT_MAX_M and float(m.sole_min_r) <= SOUND_FOOT_MAX_M,
		"pose=%s driver='%s' sole min l=%s r=%s up_dot=%.2f" % [pose, drv, _cm(m.sole_min_l), _cm(m.sole_min_r), m.up_dot])
	_free(npc)


# ============================================================================== report

func _print_report() -> void:
	print("")
	print("=== LIMB MATRIX (all checks of a group must pass) ===")
	var cols := GROUPS
	var header := "limb".rpad(14)
	for g in cols:
		header += g.rpad(13)
	print(header)
	for c in _cases():
		var line := String(c.label).rpad(14)
		for g in cols:
			var any := false
			var ok := true
			for r in _rows:
				if r.label == c.label and r.group == g:
					any = true
					ok = ok and r.ok
			line += ("-" if not any else ("PASS" if ok else "FAIL")).rpad(13)
		print(line)
	print("")
	print("=== REACH (lowest weapon speed that works; LMB knife %.1f m/s, bat %.1f m/s) ===" % [_lmb.knife, _lmb.bat])
	for c in _cases():
		var pid: int = c.pid
		print("%s  fracture bat>=%s  sever knife>=%s" % [String(c.label).rpad(14), _fv(_fracture_speed(pid)), _fv(_sever_speed(pid))])
	var combo := false
	for r in _rows:
		if r.group == "combo":
			if not combo:
				print("=== COMBOS ===")
				combo = true
			print("%s  [%s] %s  %s" % ["PASS" if r.ok else "FAIL", r.label, r.name, r.info])
	if not _idle_report.is_empty():
		print("")
		print("=== IDLE hand heights (m) ===")
		for l in _idle_report:
			print(l)
	print("")
	var total := _rows.size()
	print("LIMB INTEGRATION %d checks, %d failed" % [total, _fails])
	print("LIMB INTEGRATION TEST ", "OK" if _fails == 0 else "FAILED")


func _elbow_flex_deg(npc: Npc, side: String) -> float:
	var up: int = P.UPPER_ARM_L if side == "l" else P.UPPER_ARM_R
	var lo: int = P.LOWER_ARM_L if side == "l" else P.LOWER_ARM_R
	var a := npc.body.get_part_global_transform(up).basis.y
	var b := npc.body.get_part_global_transform(lo).basis.y
	return rad_to_deg(a.angle_to(b))


static func _fv(v: float) -> String:
	return "none" if v < 0.0 else "%.1f" % v


# ============================================================================== visual capture

var _cam: Camera3D


func _run_visual(out_dir: String) -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out_dir) if out_dir.begins_with("res://") else out_dir)
	_build_arena()
	(_arena.get_node("Weapons") as Node3D).visible = false
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.55, 0.62, 0.7)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.65, 0.65, 0.7)
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 150, 0)
	sun.light_energy = 1.1
	add_child(sun)
	_cam = Camera3D.new()
	_cam.fov = 34
	add_child(_cam)
	_cam.current = true
	await _frames(5)

	var xf := func(x: float) -> Transform3D: return Transform3D(Basis.IDENTITY, Vector3(x, 0.02, 0.0))

	# --- 1. limping NPC (broken left foot), control walking next to it
	var limper := Npc.spawn(_arena, xf.call(0.0), 11)
	var ctrl := Npc.spawn(_arena, xf.call(2.2), 12)
	await _frames(SETTLE_FRAMES)
	_strike_visual(limper, P.FOOT_L)
	limper.brain.force_state(S.ALERT)
	ctrl.brain.force_state(S.ALERT)   # no flee dir -> stands in a walk pose; used only for scale reference
	await _frames(60)
	print("limper state=%s pose=%s limp=%s" % [BodyIds.state_name(limper.get_state()), limper.body.get_debug_info().pose, limper.brain.get_limp_side()])
	await _shot_follow(limper, Vector3(3.2, 0.9, 0.0), "limp_side_a", out_dir)
	await _frames(25)
	await _shot_follow(limper, Vector3(3.2, 0.9, 0.0), "limp_side_b", out_dir)
	await _frames(10)
	await _shot_follow(limper, Vector3(1.4, 0.8, 3.0), "limp_front", out_dir)
	_arena_clear()

	# --- 2. clutching NPC: 9mm into the chest from BEHIND (exit wound on the chest) and from the FRONT (exit wound on the back)
	var clutcher := Npc.spawn(_arena, xf.call(0.0), 21)
	var clutcher2 := Npc.spawn(_arena, xf.call(3.0), 22)
	await _frames(SETTLE_FRAMES)
	_strike(clutcher, P.TORSO, "bullet", 0.0, Vector3(0, 0, 1), Vector3(0, 0.12, 0))
	_strike(clutcher2, P.TORSO, "bullet", 0.0, Vector3(0, 0, -1), Vector3(0, 0.12, 0))
	for n in [clutcher, clutcher2]:
		if n.get_state() != S.CLUTCH_WOUND:
			print("9mm chest hit gave state ", BodyIds.state_name(n.get_state()), " -> forcing CLUTCH_WOUND for the picture")
			n.brain.force_state(S.CLUTCH_WOUND)
	await _frames(70)
	print("clutchers: %s %s" % [BodyIds.state_name(clutcher.get_state()), BodyIds.state_name(clutcher2.get_state())])
	await _shot_follow(clutcher, Vector3(3.0, 0.9, 1.5), "clutch_shot_from_behind_side", out_dir)
	await _shot_follow(clutcher, Vector3(0.0, 0.9, 3.0), "clutch_shot_from_behind_front", out_dir)
	await _shot_follow(clutcher2, Vector3(3.0, 0.9, 1.5), "clutch_shot_from_front_side", out_dir)
	await _shot_follow(clutcher2, Vector3(0.0, 0.9, 3.0), "clutch_shot_from_front_front", out_dir)
	await _shot_follow(clutcher2, Vector3(0.0, 0.9, -3.0), "clutch_shot_from_front_back", out_dir)
	_arena_clear()

	# --- 3. broken arm (left lower arm) next to a control NPC: idle, then walking
	var broken := Npc.spawn(_arena, xf.call(-0.8), 31)
	var ctrl2 := Npc.spawn(_arena, xf.call(0.8), 32)
	await _frames(SETTLE_FRAMES)
	var fv := 14.0
	_strike_visual(broken, P.LOWER_ARM_L, fv)
	broken.brain.force_state(S.IDLE)
	await _frames(90)
	print("broken arm: broken=%s state=%s" % [broken.damage.get_part(P.LOWER_ARM_L).broken, BodyIds.state_name(broken.get_state())])
	_cam_at(Vector3(0.0, 0.95, 3.4), Vector3(0.0, 0.85, 0.0))
	await _shot("brokenarm_idle_front", out_dir)
	broken.brain.force_state(S.ALERT)
	await _frames(45)
	await _shot_follow(broken, Vector3(3.2, 0.9, 0.0), "brokenarm_walk_side_a", out_dir)
	await _frames(20)
	await _shot_follow(broken, Vector3(1.6, 0.9, 3.0), "brokenarm_walk_front", out_dir)
	get_tree().quit(0)


func _arena_clear() -> void:
	_gore.clear_all()
	for n in get_tree().get_nodes_in_group(&"npc"):
		n.queue_free()


func _strike_visual(npc: Npc, pid: int, speed: float = 14.0) -> void:
	var v := _fracture_speed(pid)
	_strike(npc, pid, "blunt", speed if v < 0.0 else maxf(v, speed))


func _cam_at(pos: Vector3, look: Vector3) -> void:
	_cam.position = pos
	_cam.look_at(look)


func _shot_follow(npc: Npc, offset: Vector3, name: String, out_dir: String) -> void:
	var c := npc.body.get_center()
	_cam_at(Vector3(c.x, 0.0, c.z) + offset, Vector3(c.x, 0.85, c.z))
	await _shot(name, out_dir)


func _shot(name: String, out_dir: String) -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	var path := out_dir.path_join(name + ".png")
	img.save_png(path)
	print("captured ", path)
