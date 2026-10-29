## injury-consistency overseer: headless sweep of every mechanism x body part x intensity (docs/INJURY_CONSISTENCY.md).
## Run: godot --headless --path . res://tests/injury_consistency_test.tscn [-- out=/abs/table.tsv] [only=<section>]
##   sections: table, sweep, gates, repeat, data   (default: all)
## Output lines:  CHK|<id>|PASS/FAIL|<name>|<evidence>   INFO|...   WARN|...   TSV|... (one row per table case)
## Exit code 1 when any CHK fails.
##
## Events come from the real weapon code, never from hand-written numbers:
##   bullet  -> HitscanWeapon.fire_ray (real raycast, real damage/penetration scaling from data/weapons.json)
##   melee   -> MeleeWeapon._sweep (the per-frame hit path: ray, _build_event, _deliver) driven with a chosen tip velocity
## Every case uses a fresh Npc.spawn() NPC. The "table" section simulates 1 s (AI state) and 20 s (blood) with the real
## brain / blood systems running. Only the gate/repeat sections use clearly marked synthetic overkill events.
extends Node3D

const P := BodyIds.Part
const S := BodyIds.NpcState

const SEED := 7
const DT := 1.0 / 60.0
const MECHS: Array[String] = ["bullet", "stab", "slash", "blunt"]
const INTEN: Array[String] = ["slow", "normal", "fast"]      # weapon-speed scale 0.5 / 1.0 / 1.5 (bullet: 120/250/380 m/s)
const SCALES: Array[float] = [0.5, 1.0, 1.5]
const BULLET_SPEEDS: Array[float] = [120.0, 250.0, 380.0]
const SWEEP_SPEEDS := {
	"bullet": [20.0, 60.0, 100.0, 150.0, 200.0, 250.0, 300.0, 380.0],
	"stab": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0],
	"slash": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0],
	"blunt": [3.0, 5.0, 7.0, 9.0, 11.0, 13.0, 15.0, 17.0, 19.0, 21.0],
}
const EPS := 1e-4

var failures := 0
var checks := 0
var tick := 0
var _only := ""
var _out_path := ""
var _arena: Node3D
var _zones: Array[Dictionary] = []
var _weapons := {}          # key -> Weapon (in tree, physics off)
var _lmb := {}              # "stab"/"slash"/"blunt" -> [slow, normal, fast] measured tip speeds
var _cases: Array[Dictionary] = []
var _case_by_key := {}
var _sweep_res := {}        # "mech|zone" -> Array of metric dicts, one per SWEEP_SPEEDS entry
var _saved_settings := {}
var _dump := false


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		a = a.lstrip("-")
		if a.begins_with("out="):
			_out_path = a.substr(4)
		elif a.begins_with("only="):
			_only = a.substr(5)
		elif a == "dump=1":
			_dump = true
	_build_arena()
	_build_zones()
	for k in ["no_dismemberment", "gore_intensity", "immortal_dummy"]:
		_saved_settings[k] = GameSettings.get(k)
	await get_tree().physics_frame
	var t0 := Time.get_ticks_msec()
	await _measure_lmb()
	for sec in ["table", "sweep", "gates", "repeat", "data"]:
		if _only != "" and _only != sec:
			continue
		var s0 := Time.get_ticks_msec()
		await call("_sec_" + sec)
		_restore_settings()
		print("INFO|section %s took %.1fs wall" % [sec, (Time.get_ticks_msec() - s0) / 1000.0])
	print("INJURY CONSISTENCY %s (%d checks, %d failed, %.1fs wall)" % [
		"FAILED" if failures > 0 else "ALL PASSED", checks, failures, (Time.get_ticks_msec() - t0) / 1000.0])
	get_tree().quit(1 if failures > 0 else 0)


func _physics_process(_d: float) -> void:
	tick += 1


func chk(id: String, name: String, ok: bool, evidence := "") -> void:
	checks += 1
	if not ok:
		failures += 1
	print("CHK|%s|%s|%s|%s" % [id, "PASS" if ok else "FAIL", name, evidence])


## Design observation (not a failure): printed as SUG|id|FOUND/none|..., never counted in the exit code.
func sug(id: String, name: String, clean: bool, evidence := "") -> void:
	print("SUG|%s|%s|%s|%s" % [id, "none" if clean else "FOUND", name, evidence])


func frames(n: int) -> void:
	var target := tick + n
	while tick < target:
		await get_tree().physics_frame


func seconds(s: float) -> void:
	await frames(int(round(s / DT)))


func _restore_settings() -> void:
	for k in _saved_settings:
		GameSettings.set(k, _saved_settings[k])


# ------------------------------------------------------------------ set-up

func _build_arena() -> void:
	_arena = Node3D.new()
	add_child(_arena)
	var fb := StaticBody3D.new()
	fb.collision_layer = BodyIds.LAYER_WORLD
	fb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(400, 1, 400)
	cs.shape = bs
	cs.position = Vector3(0, -0.5, 0)
	fb.add_child(cs)
	_arena.add_child(fb)
	var holder := Node3D.new()
	holder.name = "Weapons"
	_arena.add_child(holder)
	for id in ["handgun", "knife", "bat"]:
		var w := WeaponFactory.create(WeaponDefs.get_def(id), null)
		holder.add_child(w)
		w.set_physics_process(false)
		_weapons[id] = w
	# heavy / light bat clones for the mass check
	for tag in [["bat_light", 0.1], ["bat_heavy", 9.0]]:
		var d: Dictionary = WeaponDefs.get_def("bat").duplicate(true)
		d["mass"] = tag[1]
		var w2 := WeaponFactory.create(d, null)
		holder.add_child(w2)
		w2.set_physics_process(false)
		_weapons[tag[0]] = w2
	for i in BULLET_SPEEDS.size():
		var d2: Dictionary = WeaponDefs.get_def("handgun").duplicate(true)
		d2["muzzle_velocity"] = BULLET_SPEEDS[i]
		var g := WeaponFactory.create(d2, null)
		holder.add_child(g)
		g.set_physics_process(false)
		_weapons["gun%d" % i] = g
	# bullet sweep guns are made lazily by _gun_for_speed


func _build_zones() -> void:
	# order = BodyIds.Part order with the torso split into the chest / abdomen zones the rules use
	_zones = [
		{"key": "head", "part": P.HEAD, "y": 0.0},
		{"key": "neck", "part": P.NECK, "y": 0.0},
		{"key": "chest", "part": P.TORSO, "y": 0.5},
		{"key": "abdomen", "part": P.TORSO, "y": -0.5},
		{"key": "upper_arm_l", "part": P.UPPER_ARM_L, "y": 0.0},
		{"key": "lower_arm_l", "part": P.LOWER_ARM_L, "y": 0.0},
		{"key": "hand_l", "part": P.HAND_L, "y": 0.0},
		{"key": "upper_arm_r", "part": P.UPPER_ARM_R, "y": 0.0},
		{"key": "lower_arm_r", "part": P.LOWER_ARM_R, "y": 0.0},
		{"key": "hand_r", "part": P.HAND_R, "y": 0.0},
		{"key": "upper_leg_l", "part": P.UPPER_LEG_L, "y": 0.0},
		{"key": "lower_leg_l", "part": P.LOWER_LEG_L, "y": 0.0},
		{"key": "foot_l", "part": P.FOOT_L, "y": 0.0},
		{"key": "upper_leg_r", "part": P.UPPER_LEG_R, "y": 0.0},
		{"key": "lower_leg_r", "part": P.LOWER_LEG_R, "y": 0.0},
		{"key": "foot_r", "part": P.FOOT_R, "y": 0.0},
	]


func _zone(key: String) -> Dictionary:
	for z in _zones:
		if z.key == key:
			return z
	return {}


## Tip speed of the scripted swing / thrust at speed_scale 0.5, 1.0, 1.5 (what debug_swing(scale) produces).
func _measure_lmb() -> void:
	for spec in [["stab", "knife", &"thrust"], ["slash", "knife", &"swing"], ["blunt", "bat", &"swing"]]:
		var speeds: Array = []
		for sc in SCALES:
			var w := WeaponFactory.create(WeaponDefs.get_def(spec[1]), null)
			_arena.add_child(w)
			w.global_position = Vector3(300, 5, 300)
			w.debug_swing(sc, spec[2])
			var mx := 0.0
			for i in 60:
				await get_tree().physics_frame
				mx = maxf(mx, (w as MeleeWeapon).tip_speed)
			speeds.append(snappedf(mx, 0.01))
			w.queue_free()
		_lmb[spec[0]] = speeds
		print("INFO|measured %s speeds at scale 0.5/1.0/1.5: %s m/s" % [spec[0], str(speeds)])
	# hard guard: a failed measurement would make every melee case a limp swing
	for m in ["stab", "slash", "blunt"]:
		for i in 3:
			if float(_lmb[m][i]) <= 0.1:
				push_warning("lmb speed measurement failed for %s, using nominal" % m)
				_lmb[m] = [3.0, 6.0, 9.0] if m != "blunt" else [5.0, 10.0, 15.0]
				break


func _speed_for(mech: String, inten: int) -> float:
	if mech == "bullet":
		return BULLET_SPEEDS[inten]
	return float(_lmb[mech][inten])


# ------------------------------------------------------------------ shots

func _zone_aim(npc: Npc, z: Dictionary) -> Vector3:
	var xf := npc.body.get_part_global_transform(z.part)
	var ext := npc.body.get_part_half_extents(z.part)
	return xf * Vector3(0.0, float(z.y) * ext.y, 0.0)


func _dir_candidates(z: Dictionary) -> Array[Vector3]:
	var out: Array[Vector3] = [Vector3(0, 0, -1)]      # front first: the NPC faces +Z, the attacker travels -Z
	var side := BodyIds.side_of(z.part)
	if side == "l":
		out.append(Vector3(-1, 0, 0))
	elif side == "r":
		out.append(Vector3(1, 0, 0))
	out.append_array([Vector3(0, 0, 1), Vector3(-1, 0, 0), Vector3(1, 0, 0), Vector3(0, -1, 0)])
	return out


## Finds an unobstructed straight line onto the zone. Returns {} if none; else {dir, from, to, pos, normal}.
func _find_shot(npc: Npc, z: Dictionary) -> Dictionary:
	var aim := _zone_aim(npc, z)
	var space := get_world_3d().direct_space_state
	for d in _dir_candidates(z):
		var from := aim - d * 1.0
		var to := aim + d * 1.0
		var q := PhysicsRayQueryParameters3D.create(from, to, Weapon.hit_mask())
		var r := space.intersect_ray(q)
		if r.is_empty():
			continue
		if BodyIds.npc_from_collider(r.collider) != npc or BodyIds.part_from_collider(r.collider) != z.part:
			continue
		if z.part == P.TORSO:
			var loc: Vector3 = npc.body.get_part_global_transform(P.TORSO).affine_inverse() * r.position
			var ey := npc.body.get_part_half_extents(P.TORSO).y
			if (loc.y / maxf(ey, 0.001) > 0.0) != (float(z.y) > 0.0):
				continue
		return {"dir": d, "from": from, "to": to, "pos": r.position, "normal": r.normal}
	return {}


## Fires the real weapon path. mech in MECHS; speed = muzzle velocity (bullet) or tip speed (melee).
## weapon_override = key in _weapons to use instead of the default for the mechanism.
func _fire(npc: Npc, z: Dictionary, shot: Dictionary, mech: String, speed: float, weapon_override := "") -> DamageEvent:
	if mech == "bullet":
		var g: HitscanWeapon = _gun_for_speed(speed)
		return g.fire_ray(shot.from, shot.dir)
	var wid := weapon_override if weapon_override != "" else ("knife" if mech != "blunt" else "bat")
	var w: MeleeWeapon = _weapons[wid]
	var d: Vector3 = shot.dir
	var axis := d                                    # stab: blade axis along travel
	if mech != "stab":                               # slash / blunt: blade axis perpendicular to travel
		axis = d.cross(Vector3.UP)
		if axis.length() < 0.1:
			axis = d.cross(Vector3.RIGHT)
		axis = axis.normalized()
	var up := Vector3.UP if absf(axis.dot(Vector3.UP)) < 0.9 else Vector3.RIGHT
	w.global_transform = Transform3D(Basis.looking_at(axis, up), shot.pos)
	w._hit_keys.clear()
	w.last_event = null
	var seg: Vector3 = shot.to - shot.from
	w._sweep(shot.from, shot.to, seg.length() / maxf(speed, 0.001))   # v = seg / delta = dir * speed
	return w.last_event


func _gun_for_speed(speed: float) -> HitscanWeapon:
	for i in BULLET_SPEEDS.size():
		if is_equal_approx(BULLET_SPEEDS[i], speed):
			return _weapons["gun%d" % i]
	var key := "gunx%d" % int(speed)
	if not _weapons.has(key):
		var d: Dictionary = WeaponDefs.get_def("handgun").duplicate(true)
		d["muzzle_velocity"] = speed
		var g := WeaponFactory.create(d, null)
		_weapons["handgun"].get_parent().add_child(g)
		g.set_physics_process(false)
		_weapons[key] = g
	return _weapons[key]


# ------------------------------------------------------------------ recording

func _new_listeners(npc: Npc) -> Dictionary:
	var r := {"broken": [], "severed": [], "stuns": [], "lethal": [], "died": "", "died_t": -1.0,
		"states": [], "wounded": 0, "t0": tick}
	npc.part_broken.connect(func(p: int): r.broken.append(p))
	npc.part_severed.connect(func(p: int, _root, _ev): r.severed.append(p))
	npc.stunned.connect(func(d: float, cause: StringName): r.stuns.append([d, String(cause)]))
	npc.lethal_injury.connect(func(cause: StringName): r.lethal.append(String(cause)))
	npc.died.connect(func(cause: StringName):
		r.died = String(cause)
		r.died_t = (tick - r.t0) * DT)
	npc.state_changed.connect(func(_o: int, n: int): r.states.append(n))
	npc.wounded.connect(func(_w: Wound, _e: DamageEvent): r.wounded += 1)
	return r


## Metrics readable immediately after the hit (no simulation needed).
func _metrics(npc: Npc, z: Dictionary, ev: DamageEvent, l: Dictionary) -> Dictionary:
	var m := {"ok": ev != null, "delivered": false}
	if ev == null:
		return m
	var part := npc.damage.get_part(z.part)
	m["type"] = DamageEvent.Type.keys()[ev.type]
	m["amount"] = ev.amount
	m["pen"] = ev.penetration
	m["can_dis"] = ev.can_dismember
	m["ev_part"] = ev.part_id
	m["delivered"] = ev.amount > 0.0 and l.wounded > 0
	var ext := 0.0
	var inn := 0.0
	var ext_all := 0.0
	var sev_max := 0.0
	var art := false
	var exitw := false
	var stump := false
	var frac := false
	var bruise := false
	var nw := 0
	var finite := true
	for w in npc.wounds.get_wounds():
		nw += 1
		ext_all += w.bleed_rate
		finite = finite and is_finite(w.bleed_rate) and is_finite(w.internal_bleed_rate) and is_finite(w.severity)
		if not w.detached:
			ext += w.bleed_rate
			inn += w.internal_bleed_rate
		art = art or (w.is_arterial and not w.detached)
		exitw = exitw or w.is_exit
		stump = stump or w.is_stump
		frac = frac or w.is_fracture
		bruise = bruise or w.is_bruise
		if not w.is_fracture and not w.is_stump:
			sev_max = maxf(sev_max, w.severity)
	m["hp_lost"] = part.max_hp - part.hp
	m["hp"] = part.hp
	m["ext"] = ext
	m["int"] = inn
	m["bleed"] = ext + inn
	m["n_wounds"] = nw
	m["art"] = art
	m["exit"] = exitw
	m["stump"] = stump
	m["fracture"] = frac or part.broken or z.part in l.broken
	m["severed"] = ",".join(l.severed.map(func(p): return BodyIds.key(p)))
	m["sever"] = not l.severed.is_empty()
	m["sev_max"] = sev_max
	var st := 0.0
	var sc := ""
	for s in l.stuns:
		if float(s[0]) > st:
			st = float(s[0])
			sc = s[1]
	m["stun"] = st
	m["stun_cause"] = sc
	m["lethal"] = l.lethal[0] if not l.lethal.is_empty() else ""
	m["destroyed"] = part.destroyed
	m["bruise"] = part.bruise
	m["finite"] = finite and is_finite(part.hp) and is_finite(ev.amount) and is_finite(part.bruise) \
		and is_finite(ext) and is_finite(inn) and is_finite(st)
	return m


func _cell_pos(i: int, per_row: int, spacing: float) -> Vector3:
	var half := (per_row - 1) * 0.5
	return Vector3((float(i % per_row) - half) * spacing, 0.02, (float(i / per_row) - half) * spacing)


func _spawn_batch(n: int, per_row: int, spacing: float, root: Node3D) -> Array[Npc]:
	var out: Array[Npc] = []
	for i in n:
		out.append(Npc.spawn(root, Transform3D(Basis.IDENTITY, _cell_pos(i, per_row, spacing)), SEED))
	return out


func _new_root(tag: String) -> Node3D:
	var r := Node3D.new()
	r.name = tag
	_arena.add_child(r)
	return r


# ------------------------------------------------------------------ section: table (full sim)

func _sec_table() -> void:
	for mech in MECHS:
		for z in _zones:
			for i in 3:
				var c := {"mech": mech, "zone": z, "inten": i, "speed": _speed_for(mech, i)}
				_cases.append(c)
				_case_by_key["%s|%s|%d" % [mech, z.key, i]] = c
	var per_batch := 16
	var bi := 0
	while bi < _cases.size():
		var batch := _cases.slice(bi, bi + per_batch)
		await _run_table_batch(batch)
		bi += per_batch
	_report_table()
	_check_table()


func _run_table_batch(batch: Array) -> void:
	var root := _new_root("TableBatch")
	var npcs := _spawn_batch(batch.size(), 4, 9.0, root)     # 9 m > alert_radius: neighbours never alert each other
	await frames(10)
	for i in batch.size():
		var c: Dictionary = batch[i]
		var npc := npcs[i]
		c["npc"] = npc
		c["l"] = _new_listeners(npc)
		c["shot"] = _find_shot(npc, c.zone)
	for c in batch:
		if c.shot.is_empty():
			continue
		c["ev"] = _fire(c.npc, c.zone, c.shot, c.mech, c.speed)
	await seconds(1.0)
	for c in batch:
		c["state1"] = BodyIds.state_name(c.npc.get_state())
	await seconds(19.0)
	for c in batch:
		var npc: Npc = c.npc
		var m := _metrics(npc, c.zone, c.get("ev", null), c.l)
		for k in m:
			c[k] = m[k]
		c["state20"] = BodyIds.state_name(npc.get_state())
		c["vol20"] = npc.blood.state.volume
		c["level20"] = BodyIds.BloodLevel.keys()[npc.blood.state.level]
		c["died"] = c.l.died
		c["died_t"] = c.l.died_t
		c["sane"] = _npc_sane(npc)
		c["hit_part"] = c.get("ev_part", -1)
	root.queue_free()
	await frames(2)


func _npc_sane(npc: Npc) -> String:
	for pid in BodyIds.KEYS:
		var node := npc.body.get_part_node(pid)
		if node == null or not is_instance_valid(node):
			continue
		var p: Vector3 = node.global_position
		if not (is_finite(p.x) and is_finite(p.y) and is_finite(p.z)) or p.length() > 500.0:
			return "%s pos=%s" % [BodyIds.key(pid), p]
	return ""


func _tsv_line(c: Dictionary) -> String:
	var f := func(v) -> String:
		if v is float:
			return "%.3f" % v
		if v is bool:
			return "1" if v else "0"
		return str(v)
	var keys := ["mech", "zone", "inten", "speed", "type", "amount", "pen", "can_dis", "delivered", "hp_lost", "ext", "int",
		"art", "exit", "stump", "fracture", "severed", "stun", "stun_cause", "lethal", "destroyed", "state1", "state20",
		"vol20", "level20", "died", "died_t", "sev_max", "bruise", "n_wounds"]
	var cells: Array[String] = []
	for k in keys:
		if k == "zone":
			cells.append(c.zone.key)
		else:
			cells.append(f.call(c.get(k, "")))
	return "\t".join(cells)


func _report_table() -> void:
	var lines: Array[String] = ["mech\tzone\tinten\tspeed\ttype\tamount\tpen\tcan_dis\tdelivered\thp_lost\text\tint\tart\texit\tstump\tfracture\tsevered\tstun\tstun_cause\tlethal\tdestroyed\tstate1\tstate20\tvol20\tlevel20\tdied\tdied_t\tsev_max\tbruise\tn_wounds"]
	for c in _cases:
		lines.append(_tsv_line(c))
	for l in lines:
		print("TSV|" + l)
	if _out_path != "":
		var fa := FileAccess.open(_out_path, FileAccess.WRITE)
		if fa:
			fa.store_string("\n".join(lines) + "\n")
			fa.close()
			print("INFO|table written to " + _out_path)


func _cs(mech: String, zone_key: String, inten: int) -> Dictionary:
	return _case_by_key["%s|%s|%d" % [mech, zone_key, inten]]


## lethality score: instant kill beats any bleed; otherwise nominal attached bleed (mL/s, ext + internal)
func _score(c: Dictionary) -> float:
	if String(c.get("lethal", "")) != "":
		return 1e9
	return float(c.get("bleed", 0.0))


func _check_table() -> void:
	# C1 coverage / crash / NaN
	var miss: Array[String] = []
	var nan: Array[String] = []
	var wrong_part: Array[String] = []
	var insane: Array[String] = []
	var undelivered: Array[String] = []
	for c in _cases:
		var tag := "%s/%s/%s" % [c.mech, c.zone.key, INTEN[c.inten]]
		if c.shot.is_empty() or c.get("ev", null) == null:
			miss.append(tag)
			continue
		if not bool(c.finite):
			nan.append(tag)
		if int(c.ev_part) != int(c.zone.part):
			wrong_part.append(tag)
		if String(c.sane) != "":
			insane.append(tag + ":" + c.sane)
		if not bool(c.delivered):
			undelivered.append(tag)
	chk("T1", "all %d cases got an unobstructed shot and an event" % _cases.size(), miss.is_empty(), "missing=%s" % str(miss))
	chk("T2", "no NaN/inf in any wound/HP/stun value", nan.is_empty(), str(nan))
	chk("T3", "every event resolved to the intended part", wrong_part.is_empty(), str(wrong_part))
	chk("T4", "NPC bodies stay finite and inside 500 m for 20 s", insane.is_empty(), str(insane))
	var normal_undelivered := undelivered.filter(func(t: String): return not t.ends_with("/slow"))
	chk("T5", "every normal/fast event is delivered (amount > 0, wounds created)", normal_undelivered.is_empty(), str(normal_undelivered))
	if not undelivered.is_empty():
		print("INFO|undelivered (limp swing / below min_velocity or no wound): %s" % str(undelivered))

	# C2 does something: every delivered normal/fast case changes HP and creates a wound
	var nothing: Array[String] = []
	for c in _cases:
		if c.inten == 0 or not bool(c.get("delivered", false)):
			continue
		var effect: bool = float(c.hp_lost) > EPS or bool(c.fracture) or bool(c.sever) or float(c.stun) > 0.0 or String(c.lethal) != ""
		if not effect or int(c.n_wounds) == 0:
			nothing.append("%s/%s/%s" % [c.mech, c.zone.key, INTEN[c.inten]])
	chk("T6", "no mechanism x part does nothing at normal/fast intensity", nothing.is_empty(), str(nothing))

	# C3 relative lethality, bullet, per intensity
	_check_ordering("bullet", 2, "T7")       # shipped handgun muzzle velocity (380 m/s)
	for inten in [0, 1]:
		_info_ordering("bullet", inten)

	# C4 left/right identical
	_check_symmetry()

	# C5 table intensities monotonic slow <= normal <= fast
	var mono: Array[String] = []
	for mech in MECHS:
		for z in _zones:
			for i in 2:
				var a := _cs(mech, z.key, i)
				var b := _cs(mech, z.key, i + 1)
				if not bool(a.get("delivered", false)):
					continue
				var why := _worse(a, b)
				if why != "":
					mono.append("%s/%s %s->%s: %s" % [mech, z.key, INTEN[i], INTEN[i + 1], why])
	chk("T9", "table intensities are monotonic (slow <= normal <= fast) for every mechanism x part", mono.is_empty(), str(mono))

	# only head/neck may report lethal injury from a single table hit
	var odd: Array[String] = []
	for c in _cases:
		if String(c.get("lethal", "")) != "" and not (c.zone.part in [P.HEAD, P.NECK]):
			odd.append("%s/%s/%s=%s" % [c.mech, c.zone.key, INTEN[c.inten], c.lethal])
	chk("T10", "lethal_injury only comes from head/neck hits", odd.is_empty(), str(odd))

	# stun within bounds, only from head / torso rules
	var stun_bad: Array[String] = []
	for c in _cases:
		var s := float(c.get("stun", 0.0))
		if s < 0.0 or s > 8.01 or (s > 0.0 and not (c.zone.part in [P.HEAD, P.TORSO, P.HAND_L, P.HAND_R])):
			stun_bad.append("%s/%s/%s stun=%.2f" % [c.mech, c.zone.key, INTEN[c.inten], s])
	chk("T11", "stun durations are within 0..8 s and only from head / torso / hand rules", stun_bad.is_empty(), str(stun_bad))

	# sever bookkeeping: each sever has an attached stump wound on the parent and a notification per subtree root
	var bad_sever: Array[String] = []
	for c in _cases:
		if bool(c.get("sever", false)):
			var roots := String(c.severed).split(",")
			if roots.size() != 1 or not bool(c.stump):
				bad_sever.append("%s/%s/%s severed=%s stump=%s" % [c.mech, c.zone.key, INTEN[c.inten], c.severed, c.stump])
	chk("T12", "every sever notifies exactly once and leaves a stump wound", bad_sever.is_empty(), str(bad_sever))

	# AI consequences line up with the injury facts (stun >= knockdown threshold, leg breaks, foot limp)
	var kd := float(DataDB.table("ai").knockdown_min_duration)
	var ai_bad: Array[String] = []
	for c in _cases:
		if not bool(c.get("delivered", false)):
			continue
		var tag2 := "%s/%s/%s" % [c.mech, c.zone.key, INTEN[c.inten]]
		var st1: String = c.state1
		if String(c.lethal) == "" and float(c.stun) >= kd and not (st1 in ["UNCONSCIOUS", "CRAWL", "DEAD"]):
			ai_bad.append("%s stun %.2f >= %.1f but state1=%s" % [tag2, c.stun, kd, st1])
		if String(c.lethal) == "" and float(c.stun) < kd and st1 == "UNCONSCIOUS" and c.state20 != "DEAD":
			ai_bad.append("%s stun %.2f < %.1f but state1=UNCONSCIOUS" % [tag2, c.stun, kd])
		var leg_lost: bool = (BodyIds.is_leg(c.zone.part) and not BodyIds.is_foot(c.zone.part) and (bool(c.fracture) or bool(c.sever))) \
			or (BodyIds.is_foot(c.zone.part) and bool(c.sever))
		if leg_lost and st1 != "CRAWL":
			ai_bad.append("%s leg/foot lost but state1=%s (DECISIONS: crawl)" % [tag2, st1])
		if BodyIds.is_foot(c.zone.part) and bool(c.fracture) and not bool(c.sever) and st1 == "CRAWL":
			ai_bad.append("%s foot fracture crawls (DECISIONS: limp)" % tag2)
		if c.zone.part == P.NECK and bool(c.art) and String(c.lethal) == "" and st1 != "CLUTCH_WOUND":
			ai_bad.append("%s arterial neck but state1=%s (DECISIONS: clutch)" % [tag2, st1])
	chk("T14", "AI state after 1 s matches the injury (knockdown stun, leg/foot loss -> crawl, foot break -> limp not crawl, neck artery -> clutch)", ai_bad.is_empty(), str(ai_bad.slice(0, 8)))

	# exit wound iff a bullet's penetration exceeds the part thickness (DECISIONS: Damage / blood)
	var exit_bad: Array[String] = []
	for c in _cases:
		if not bool(c.get("delivered", false)):
			continue
		var thick := float(_row_for(c.zone.part).get("thickness", 0.1))
		var want: bool = c.mech == "bullet" and float(c.pen) > thick
		if bool(c.exit) != want:
			exit_bad.append("%s/%s pen=%.2f thick=%.2f exit=%s" % [c.mech, c.zone.key, c.pen, thick, c.exit])
	chk("T15", "exit wound only for bullets whose penetration exceeds the part thickness", exit_bad.is_empty(), str(exit_bad.slice(0, 8)))

	# wound value ranges
	var range_bad: Array[String] = []
	for c in _cases:
		if not bool(c.get("delivered", false)):
			continue
		if float(c.sev_max) < 0.0 or float(c.sev_max) > 1.0 or float(c.ext) < 0.0 or float(c.int) < 0.0 or float(c.hp_lost) < -EPS \
				or float(c.hp_lost) > float(_row_for(c.zone.part).max_hp) + EPS:
			range_bad.append("%s/%s/%s sev=%.2f ext=%.1f int=%.1f hp_lost=%.1f" % [c.mech, c.zone.key, INTEN[c.inten], c.sev_max, c.ext, c.int, c.hp_lost])
	chk("T2b", "wound severity in 0..1, bleed rates >= 0, HP lost within 0..max_hp", range_bad.is_empty(), str(range_bad.slice(0, 8)))

	# dead NPC is DEAD at 20 s; DEAD never reverses; a lethal report ends in DEAD
	var notdead: Array[String] = []
	for c in _cases:
		if String(c.get("lethal", "")) != "" and String(c.get("state20", "")) != "DEAD":
			notdead.append("%s/%s/%s state20=%s" % [c.mech, c.zone.key, INTEN[c.inten], c.get("state20", "?")])
	chk("T13", "every lethal_injury ends in DEAD", notdead.is_empty(), str(notdead))


func _info_ordering(mech: String, inten: int) -> void:
	var parts: Array[String] = []
	for k in ["head", "neck", "chest", "abdomen", "upper_arm_l", "hand_l", "foot_l"]:
		var sc := _score(_cs(mech, k, inten))
		parts.append("%s=%s" % [k, "LETHAL" if sc >= 1e8 else "%.1f" % sc])
	print("INFO|%s %s (%.0f m/s) lethality score (bleed mL/s, nominal): %s" % [mech, INTEN[inten], _speed_for(mech, inten), ", ".join(parts)])


## Orders: head > neck > chest > abdomen > limbs > hands/feet (non-strict ties are reported as a failure on purpose:
## the spec wants hands/feet strictly below limbs).
func _check_ordering(mech: String, inten: int, id: String) -> void:
	var sc := func(key: String) -> float: return _score(_cs(mech, key, inten))
	var limbs := ["upper_arm_l", "lower_arm_l", "upper_arm_r", "lower_arm_r", "upper_leg_l", "lower_leg_l", "upper_leg_r", "lower_leg_r"]
	var ends := ["hand_l", "hand_r", "foot_l", "foot_r"]
	var min_limb := 1e18
	var max_limb := -1.0
	for k in limbs:
		min_limb = minf(min_limb, sc.call(k))
		max_limb = maxf(max_limb, sc.call(k))
	var max_end := -1.0
	var worst_end := ""
	for k in ends:
		if sc.call(k) > max_end:
			max_end = sc.call(k)
			worst_end = k
	var pairs := [
		["head > neck", sc.call("head"), sc.call("neck")],
		["neck > chest", sc.call("neck"), sc.call("chest")],
		["chest > abdomen", sc.call("chest"), sc.call("abdomen")],
		["abdomen > limbs", sc.call("abdomen"), max_limb],
		["limbs > hands/feet", min_limb, max_end],
	]
	for p in pairs:
		var ok: bool = float(p[1]) > float(p[2]) + EPS
		var ev := "%.1f vs %.1f" % [minf(float(p[1]), 99999.0), minf(float(p[2]), 99999.0)]
		if p[0] == "limbs > hands/feet" and not ok:
			ev += " (highest end part: %s)" % worst_end
		chk("%s.%s" % [id, str(p[0]).replace(" ", "").replace(">", "gt").replace("/", "_")],
			"%s %s: relative lethality %s" % [mech, INTEN[inten], p[0]], ok, ev)


## Returns "" when `b` (the faster/stronger hit) did at least as much as `a`, else a description.
## A stronger outcome class (lethal, sever) supersedes the lesser metrics it replaces by design.
func _worse(a: Dictionary, b: Dictionary) -> String:
	if not bool(b.get("ok", true)) or not bool(a.get("ok", true)):
		return ""
	if String(a.lethal) != "" and String(b.lethal) == "":
		return "lethal lost"
	if bool(a.sever) and not bool(b.sever):
		return "sever lost"
	if String(b.lethal) != "":
		return ""        # lethal supersedes stun / bleed bookkeeping
	if float(b.hp_lost) + EPS < float(a.hp_lost):
		return "hp_lost %.2f -> %.2f" % [a.hp_lost, b.hp_lost]
	if bool(a.fracture) and not bool(b.fracture) and not bool(b.sever):
		return "fracture lost"
	if bool(b.sever) and not bool(a.sever):
		return ""        # cut-through replaces wound / fracture
	if float(b.bleed) + EPS < float(a.bleed):
		return "bleed %.2f -> %.2f" % [a.bleed, b.bleed]
	if float(b.stun) + EPS < float(a.stun):
		return "stun %.2f -> %.2f" % [a.stun, b.stun]
	if float(b.sev_max) + EPS < float(a.sev_max):
		return "wound severity %.2f -> %.2f" % [a.sev_max, b.sev_max]
	return ""


func _check_symmetry() -> void:
	var diffs: Array[String] = []
	var soft: Array[String] = []
	var pairs := [["upper_arm_l", "upper_arm_r"], ["lower_arm_l", "lower_arm_r"], ["hand_l", "hand_r"],
		["upper_leg_l", "upper_leg_r"], ["lower_leg_l", "lower_leg_r"], ["foot_l", "foot_r"]]
	var keys := ["hp_lost", "ext", "int", "art", "exit", "stump", "fracture", "sev", "sev_max", "stun", "stun_cause", "lethal", "n_wounds", "bruise"]
	for mech in MECHS:
		for p in pairs:
			for i in 3:
				var a := _cs(mech, p[0], i)
				var b := _cs(mech, p[1], i)
				var tag := "%s/%s/%s" % [mech, str(p[0]).trim_suffix("_l"), INTEN[i]]
				for k in keys:
					var va = a.get(k, null)
					var vb = b.get(k, null)
					var same: bool = absf(float(va) - float(vb)) < EPS if (va is float or va is int) and (vb is float or vb is int) else va == vb
					if not same:
						diffs.append("%s %s: %s vs %s" % [tag, k, str(va), str(vb)])
				var sa := String(a.severed).replace("_l", "")
				var sb := String(b.severed).replace("_r", "")
				if sa != sb:
					diffs.append("%s severed: %s vs %s" % [tag, a.severed, b.severed])
				if a.state1 != b.state1:
					soft.append("%s state1 %s vs %s" % [tag, a.state1, b.state1])
				if absf(float(a.vol20) - float(b.vol20)) > 0.02 * float(a.vol20):
					soft.append("%s vol20 %.0f vs %.0f" % [tag, a.vol20, b.vol20])
	chk("T8", "left and right limbs give identical injury outcomes (HP, wounds, bleed, fracture, sever, stun, lethal)", diffs.is_empty(),
		"%d diffs, first: %s" % [diffs.size(), str(diffs.slice(0, 6))])
	chk("T8b", "left and right match in AI state after 1 s and blood after 20 s (within 2 %)", soft.is_empty(),
		"%d diffs, first: %s" % [soft.size(), str(soft.slice(0, 6))])
	# zone-level symmetry of the static rows
	var data_diffs: Array[String] = []
	for tname in ["injury/arms", "injury/legs"]:
		var t := DataDB.table(tname)
		for k in t.parts:
			if k.ends_with("_l"):
				var rk: String = k.trim_suffix("_l") + "_r"
				if t.parts[k] != t.parts[rk]:
					data_diffs.append("%s %s != %s" % [tname, k, rk])
	chk("T8c", "data rows for left/right parts are identical (arms.json, legs.json)", data_diffs.is_empty(), str(data_diffs))


# ------------------------------------------------------------------ section: sweep (monotonic scaling, instant metrics)

func _sec_sweep() -> void:
	var specs: Array[Dictionary] = []
	for mech in MECHS:
		for z in _zones:
			for s in SWEEP_SPEEDS[mech]:
				specs.append({"mech": mech, "zone": z, "speed": float(s)})
	var bi := 0
	var per_batch := 64
	while bi < specs.size():
		var batch := specs.slice(bi, bi + per_batch)
		await _run_instant_batch(batch)
		bi += per_batch
	for sp in specs:
		var k := "%s|%s" % [sp.mech, sp.zone.key]
		if not _sweep_res.has(k):
			_sweep_res[k] = []
		_sweep_res[k].append(sp)
	await _check_sweep()
	await _sweep_variant("S3b", "no_dismemberment ON", ["slash", "stab", "bullet", "blunt"], false, true)
	await _sweep_variant("S3c", "immortal dummy", ["slash", "stab", "bullet", "blunt"], true, false)


## Monotonic-scaling check repeated under a gate setting (the gates change what a stronger hit does).
func _sweep_variant(id: String, label: String, mechs: Array, immortal: bool, nodis: bool) -> void:
	var specs: Array[Dictionary] = []
	for mech in mechs:
		for z in _zones:
			for s in SWEEP_SPEEDS[mech]:
				specs.append({"mech": mech, "zone": z, "speed": float(s)})
	var bi := 0
	while bi < specs.size():
		await _run_instant_batch(specs.slice(bi, bi + 64), immortal, nodis)
		bi += 64
	var by := {}
	for sp in specs:
		var k := "%s|%s" % [sp.mech, sp.zone.key]
		if not by.has(k):
			by[k] = []
		by[k].append(sp)
	var viol: Array[String] = []
	for k in by:
		var arr: Array = by[k]
		if _dump and (k.ends_with("|neck") or k.ends_with("|head")):
			for m in arr:
				print("SWV|%s|%s|%.1f|amt=%.1f hp=%.1f bleed=%.1f sev=%s stun=%.2f lethal=%s" % [id, k, m.speed, m.get("amount", 0.0), m.get("hp_lost", 0.0), m.get("bleed", 0.0), m.get("sever", false), m.get("stun", 0.0), m.get("lethal", "")])
		for i in range(1, arr.size()):
			if bool(arr[i - 1].get("delivered", false)) and bool(arr[i].get("ok", false)):
				var why := _worse(arr[i - 1], arr[i])
				if why != "":
					viol.append("%s %.1f->%.1f m/s: %s" % [k, arr[i - 1].speed, arr[i].speed, why])
	chk(id, "sweep with %s: faster never does less" % label, viol.is_empty(), "%d violations, first: %s" % [viol.size(), str(viol.slice(0, 8))])


## Spawn, fire, read in the same tick (no physics step between: pure injury-pipeline metrics).
func _run_instant_batch(batch: Array, immortal := false, nodis := false) -> void:
	var root := _new_root("SweepBatch")
	GameSettings.immortal_dummy = immortal
	GameSettings.no_dismemberment = nodis
	var npcs := _spawn_batch(batch.size(), 8, 3.0, root)
	GameSettings.immortal_dummy = false      # Npc.immortal is fixed at spawn
	await frames(8)
	for i in batch.size():
		var sp: Dictionary = batch[i]
		var npc := npcs[i]
		var l := _new_listeners(npc)
		var shot := _find_shot(npc, sp.zone)
		var ev: DamageEvent = null
		if not shot.is_empty():
			ev = _fire(npc, sp.zone, shot, sp.mech, sp.speed)
		var m := _metrics(npc, sp.zone, ev, l)
		sp["shot_ok"] = not shot.is_empty()
		for k in m:
			sp[k] = m[k]
	GameSettings.no_dismemberment = false
	root.queue_free()
	await frames(2)


func _check_sweep() -> void:
	var viol: Array[String] = []
	var nan: Array[String] = []
	var missing: Array[String] = []
	var thr := {}      # "mech|zone" -> {fracture, sever, lethal, stun} first speed
	for k in _sweep_res:
		var arr: Array = _sweep_res[k]
		var first := {}
		for i in arr.size():
			var m: Dictionary = arr[i]
			if not bool(m.get("shot_ok", false)) or not bool(m.get("ok", false)):
				missing.append("%s@%.0f" % [k, m.speed])
				continue
			if not bool(m.finite):
				nan.append("%s@%.0f" % [k, m.speed])
			if not first.has("any") and bool(m.delivered):
				first["any"] = m.speed
			if bool(m.fracture) and not first.has("fracture"):
				first["fracture"] = m.speed
			if bool(m.sever) and not first.has("sever"):
				first["sever"] = m.speed
			if String(m.lethal) != "" and not first.has("lethal"):
				first["lethal"] = m.speed
			if float(m.stun) > 0.0 and not first.has("stun"):
				first["stun"] = m.speed
			if i > 0:
				var prev: Dictionary = arr[i - 1]
				if bool(prev.get("delivered", false)):
					var why := _worse(prev, m)
					if why != "":
						viol.append("%s %.1f->%.1f m/s: %s" % [k, prev.speed, m.speed, why])
		thr[k] = first
	if _dump:
		for k in _sweep_res:
			for m in _sweep_res[k]:
				print("SW|%s|%.1f|amt=%.1f hp=%.1f bleed=%.1f frac=%s sev=%s stun=%.2f %s lethal=%s" % [k, m.speed, m.get("amount", 0.0), m.get("hp_lost", 0.0), m.get("bleed", 0.0), m.get("fracture", false), m.get("sever", false), m.get("stun", 0.0), m.get("stun_cause", ""), m.get("lethal", "")])
	chk("S1", "sweep: every mechanism x part x speed produced an event", missing.is_empty(), str(missing.slice(0, 8)))
	chk("S2", "sweep: no NaN/inf anywhere", nan.is_empty(), str(nan.slice(0, 8)))
	chk("S3", "sweep: faster never does less (HP, bleed, fracture, sever, stun, lethal) for every mechanism x part", viol.is_empty(),
		"%d violations, first: %s" % [viol.size(), str(viol.slice(0, 8))])
	for k in thr:
		print("INFO|threshold %s %s" % [k, JSON.stringify(thr[k])])
	_check_bleed_vs_intensity()
	await _check_mass()
	_check_reach()


## Bleed that does not respond to intensity at all is allowed by "monotonic" but is an outlier: report which.
func _check_bleed_vs_intensity() -> void:
	var flat: Array[String] = []
	for mech in ["bullet", "stab", "slash"]:
		for z in _zones:
			var arr: Array = _sweep_res["%s|%s" % [mech, z.key]]
			var lo := 1e18
			var hi := -1.0
			var lo_amt := 1e18
			var hi_amt := 0.0
			for m in arr:
				if not bool(m.get("delivered", false)):
					continue
				lo = minf(lo, m.bleed)
				hi = maxf(hi, m.bleed)
				lo_amt = minf(lo_amt, m.amount)
				hi_amt = maxf(hi_amt, m.amount)
			if hi >= 0.0 and hi - lo < 1e-6 and hi_amt > lo_amt * 1.5 and hi > 0.5 and not (mech == "stab" and z.part == P.TORSO):
				flat.append("%s/%s bleed=%.1f for amount %.1f..%.1f" % [mech, z.key, hi, lo_amt, hi_amt])
	sug("S4", "bleed responds to hit strength (amount varies >1.5x but nominal bleed does not change = outlier)", flat.is_empty(),
		"%d flat combos, first: %s" % [flat.size(), str(flat.slice(0, 10))])


## Heavier impactor, same speed: injury must not be weaker, and (by design here) is identical.
func _check_mass() -> void:
	var root := _new_root("MassBatch")
	var cases: Array[Dictionary] = []
	for z in _zones:
		for wid in ["bat_light", "bat_heavy"]:
			cases.append({"zone": z, "wid": wid})
	var npcs := _spawn_batch(cases.size(), 8, 3.0, root)
	await frames(8)
	for i in cases.size():
		var c: Dictionary = cases[i]
		var l := _new_listeners(npcs[i])
		var shot := _find_shot(npcs[i], c.zone)
		var ev := _fire(npcs[i], c.zone, shot, "blunt", 12.0, c.wid)
		c["m"] = _metrics(npcs[i], c.zone, ev, l)
		c["mass"] = ev.impactor_mass if ev else -1.0
	var weaker: Array[String] = []
	var differ: Array[String] = []
	for i in range(0, cases.size(), 2):
		var lo: Dictionary = cases[i].m
		var hi: Dictionary = cases[i + 1].m
		var why := _worse(lo, hi)
		if why != "":
			weaker.append("%s: %s" % [cases[i].zone.key, why])
		if absf(float(lo.hp_lost) - float(hi.hp_lost)) > EPS or absf(float(lo.bleed) - float(hi.bleed)) > EPS or lo.fracture != hi.fracture:
			differ.append(cases[i].zone.key)
	chk("S5", "mass scaling: a 90x heavier impactor (same speed) never does less", weaker.is_empty(), str(weaker))
	print("INFO|mass 0.1 kg vs 9 kg bat at 12 m/s: injury identical on %d/%d zones (impactor_mass only feeds the physics impulse)" % [
		_zones.size() - differ.size(), _zones.size()])
	root.queue_free()
	await frames(2)


## Shipped-weapon reach: lowest *measured-weapon* speed for fracture / sever / lethal per zone (INFO only).
func _check_reach() -> void:
	var knife := WeaponDefs.get_def("knife")
	var lmb: Array = _lmb["slash"]
	print("INFO|scripted LMB tip speeds: knife thrust %s, knife swing %s, bat swing %s (scale 0.5/1/1.5)" % [
		str(_lmb["stab"]), str(_lmb["slash"]), str(_lmb["blunt"])])
	print("INFO|knife slash dismember gate: can_dismember needs tip speed > %.1f m/s (weapons.json dismember_min_velocity); a normal LMB swing is %.1f m/s" % [
		float(knife.dismember_min_velocity), float(lmb[1])])


# ------------------------------------------------------------------ section: gates

func _overkill(type: int, z: Dictionary, shot: Dictionary, amount := 500.0) -> DamageEvent:
	var ev := DamageEvent.new()
	ev.type = type
	ev.amount = amount
	ev.penetration = 0.6 if type != DamageEvent.Type.BLUNT else 0.0
	ev.can_dismember = true
	ev.hit_position = shot.pos
	ev.hit_normal = shot.normal
	ev.direction = shot.dir
	ev.impactor_velocity = shot.dir * 20.0
	ev.impactor_mass = 1.0
	ev.part_id = z.part
	ev.weapon_id = &"synthetic_overkill"
	return ev


const TYPES := [DamageEvent.Type.BULLET, DamageEvent.Type.BLADE_STAB, DamageEvent.Type.BLADE_SLASH, DamageEvent.Type.BLUNT]


## Runs 4 types x 16 zones of synthetic overkill events under the given settings. Returns aggregated facts.
func _gate_run(tag: String, immortal: bool, no_dis: bool, gore_low: bool) -> Dictionary:
	GameSettings.immortal_dummy = immortal
	GameSettings.no_dismemberment = no_dis
	GameSettings.gore_intensity = GameSettings.Gore.LOW if gore_low else GameSettings.Gore.HIGH
	var root := _new_root("Gate_" + tag)
	var specs: Array[Dictionary] = []
	for t in TYPES:
		for z in _zones:
			specs.append({"type": t, "zone": z})
	var npcs := _spawn_batch(specs.size(), 8, 3.0, root)
	GameSettings.immortal_dummy = false     # Npc.immortal was fixed at spawn; no_dismemberment / gore stay set while firing
	await frames(8)
	var res := {"severed": [], "lethal": [], "destroyed": [], "head_sev": [], "died": [], "wounds0": [], "hp_low": [], "nan": [],
		"n": specs.size(), "stumps": 0, "sever_cue": 0}
	for i in specs.size():
		var sp: Dictionary = specs[i]
		var npc := npcs[i]
		var l := _new_listeners(npc)
		var shot := _find_shot(npc, sp.zone)
		if shot.is_empty():
			res.nan.append("noshot " + sp.zone.key)
			continue
		var cues := []
		var cb := func(n, cue, _p, _i): if n == npc: cues.append(cue)
		GameEvents.audio_cue.connect(cb)
		npc.apply_damage(_overkill(sp.type, sp.zone, shot))
		GameEvents.audio_cue.disconnect(cb)
		var t := "%s/%s" % [DamageEvent.Type.keys()[sp.type], sp.zone.key]
		if not l.severed.is_empty():
			res.severed.append("%s->%s" % [t, ",".join(l.severed.map(func(p): return BodyIds.key(p)))])
		if &"sever" in cues:
			res.sever_cue += 1
		if not l.lethal.is_empty():
			res.lethal.append("%s=%s" % [t, l.lethal[0]])
		if npc.damage.get_part(P.HEAD).destroyed:
			res.destroyed.append(t)
		if P.HEAD in l.severed or P.NECK in l.severed or npc.damage.get_part(P.HEAD).severed or npc.damage.get_part(P.NECK).severed:
			res.head_sev.append(t)
		if npc.wounds.get_wounds().is_empty():
			res.wounds0.append(t)
		if npc.damage.get_part(P.HEAD).hp < 1.0:
			res.hp_low.append(t)
		for w in npc.wounds.get_wounds():
			if w.is_stump:
				res.stumps += 1
		if not l.died.is_empty() or npc.get_state() == S.DEAD:
			res.died.append(t)
		res["npc_" + str(i)] = npc
	res["root"] = root
	_restore_settings()
	return res


func _sec_gates() -> void:
	# control: everything on
	var ctl := await _gate_run("control", false, false, false)
	chk("G0", "control: overkill events sever limbs and kill via head/neck when no gate is active (test is effective)",
		ctl.severed.size() >= 40 and not ctl.lethal.is_empty() and not ctl.head_sev.is_empty(),
		"severed=%d lethal=%d head/neck sever=%d" % [ctl.severed.size(), ctl.lethal.size(), ctl.head_sev.size()])
	ctl.root.queue_free()
	# no_dismemberment setting
	var nd := await _gate_run("nodis", false, true, false)
	chk("G1", "no_dismemberment: nothing is severed by any mechanism x part (incl. 500-damage overkill)", nd.severed.is_empty() and nd.stumps == 0,
		"severed=%s stumps=%d" % [str(nd.severed.slice(0, 6)), nd.stumps])
	var nd_decap: Array[String] = []
	for l in nd.lethal:
		if "decapitated" in l:
			nd_decap.append(l)
	chk("G1b", "no_dismemberment: no 'decapitated' lethal cause without a decapitation", nd_decap.is_empty(), str(nd_decap))
	chk("G1c", "no_dismemberment: dropped cuts still leave a wound (no silent no-op)", nd.wounds0.is_empty(), str(nd.wounds0))
	chk("G1d", "no_dismemberment: no 'sever' audio cue is played", nd.sever_cue == 0, "cues=%d" % nd.sever_cue)
	nd.root.queue_free()
	# gore LOW implies no dismemberment
	var gl := await _gate_run("goreLOW", false, false, true)
	chk("G2", "gore LOW implies no severing (dismemberment_allowed() == false)", gl.severed.is_empty() and gl.stumps == 0,
		"severed=%s" % str(gl.severed.slice(0, 6)))
	gl.root.queue_free()
	# immortal
	var im := await _gate_run("immortal", true, false, false)
	chk("G3", "immortal: no lethal_injury reported by any overkill hit", im.lethal.is_empty(), str(im.lethal.slice(0, 6)))
	chk("G3b", "immortal: head is never destroyed and keeps hp >= 1", im.destroyed.is_empty() and im.hp_low.is_empty(),
		"destroyed=%s low=%s" % [str(im.destroyed), str(im.hp_low)])
	chk("G3c", "immortal: head and neck are never severed", im.head_sev.is_empty(), str(im.head_sev))
	chk("G3d", "immortal: no NPC enters DEAD from overkill hits", im.died.is_empty(), str(im.died.slice(0, 6)))
	chk("G3e", "immortal: wounds are still created (gates only stop lethal / head loss)", im.wounds0.is_empty(), str(im.wounds0))
	var limb_sev: int = im.severed.size()
	print("INFO|immortal overkill still severs %d limb combos (contract only protects head/neck): %s" % [limb_sev, str(im.severed.slice(0, 4))])
	await seconds(2.0)
	var dead_after := 0
	for i in im.n:
		var npc: Npc = im.get("npc_" + str(i), null)
		if npc and npc.get_state() == S.DEAD:
			dead_after += 1
	chk("G3f", "immortal: no NPC DEAD 2 s after overkill", dead_after == 0, "dead=%d" % dead_after)
	im.root.queue_free()
	# immortal + 25 s of the worst bleeds
	await _gate_immortal_bleed()
	# both
	var both := await _gate_run("both", true, true, false)
	chk("G4", "immortal + no_dismemberment: nothing severed, nothing lethal", both.severed.is_empty() and both.lethal.is_empty(),
		"severed=%d lethal=%d" % [both.severed.size(), both.lethal.size()])
	both.root.queue_free()
	_restore_settings()


func _gate_immortal_bleed() -> void:
	GameSettings.immortal_dummy = true
	var root := _new_root("ImmBleed")
	var specs: Array[Dictionary] = []
	for mech in ["bullet", "stab", "slash"]:
		for zk in ["neck", "head", "chest"]:
			specs.append({"mech": mech, "zone": _zone(zk)})
	var npcs := _spawn_batch(specs.size(), 3, 9.0, root)
	_restore_settings()
	await frames(10)
	for i in specs.size():
		var sp: Dictionary = specs[i]
		sp["l"] = _new_listeners(npcs[i])
		var shot := _find_shot(npcs[i], sp.zone)
		sp["ev"] = _fire(npcs[i], sp.zone, shot, sp.mech, _speed_for(sp.mech, 2))
	await seconds(30.0)
	var bad: Array[String] = []
	var floor_frac := float(DataDB.table("blood").levels.heavy)
	var min_frac := 1.0
	for i in specs.size():
		var npc: Npc = npcs[i]
		var sp: Dictionary = specs[i]
		var frac := npc.blood.state.fraction()
		min_frac = minf(min_frac, frac)
		var lvl := int(npc.brain.get_debug_info().blood_level)
		if npc.get_state() == S.DEAD or not sp.l.lethal.is_empty() or sp.l.died != "" or frac < floor_frac \
				or lvl > BodyIds.BloodLevel.HEAVY or npc.damage.get_part(P.HEAD).destroyed:
			bad.append("%s/%s state=%s frac=%.2f lvl=%d" % [sp.mech, sp.zone.key, BodyIds.state_name(npc.get_state()), frac, lvl])
	chk("G5", "immortal: after 30 s of neck/head/chest bullet+stab+slash bleeding: not DEAD, volume >= HEAVY floor, brain blood level <= HEAVY",
		bad.is_empty(), "min volume fraction %.3f; bad=%s" % [min_frac, str(bad)])
	# control: the same neck wounds do kill a non-immortal NPC
	GameSettings.immortal_dummy = false
	var root2 := _new_root("MortalBleed")
	var npc2 := Npc.spawn(root2, Transform3D(Basis.IDENTITY, Vector3(0, 0.02, 40)), SEED)
	await frames(10)
	var z := _zone("neck")
	var shot2 := _find_shot(npc2, z)
	_fire(npc2, z, shot2, "bullet", 380.0)
	await seconds(30.0)
	chk("G5b", "control: the same neck bullet kills a mortal NPC within 30 s", npc2.get_state() == S.DEAD,
		"state=%s frac=%.2f" % [BodyIds.state_name(npc2.get_state()), npc2.blood.state.fraction()])
	root.queue_free()
	root2.queue_free()
	await frames(2)


# ------------------------------------------------------------------ section: repeat / severed-part hits

func _sec_repeat() -> void:
	var root := _new_root("Repeat")
	var severable: Array[Dictionary] = []
	for z in _zones:
		var row := _row_for(z.part)
		if float(row.get("dismember", 0.0)) > 0.0:
			severable.append(z)
	# 1) hit a part that was already severed, and a descendant of it
	var cases: Array[Dictionary] = []
	for z in severable:
		cases.append({"zone": z})
	var npcs := _spawn_batch(cases.size(), 5, 4.0, root)
	await frames(8)
	var problems: Array[String] = []
	for i in cases.size():
		var z: Dictionary = cases[i].zone
		var npc := npcs[i]
		var l := _new_listeners(npc)
		var shot := _find_shot(npc, z)
		npc.apply_damage(_overkill(DamageEvent.Type.BLADE_SLASH, z, shot))
		if l.severed.size() != 1:
			problems.append("%s: severed notifications=%d" % [z.key, l.severed.size()])
			continue
		var stumps_before := 0
		for w in npc.wounds.get_wounds():
			if w.is_stump:
				stumps_before += 1
		# second and third hit on the detached part itself (collider is now on the severed piece)
		for t in TYPES:
			var shot2 := _find_shot(npc, z)
			if shot2.is_empty():
				shot2 = shot
			npc.apply_damage(_overkill(t, z, shot2, 60.0))
		var stumps_after := 0
		var attached_on_part := 0
		for w in npc.wounds.get_wounds():
			if w.is_stump:
				stumps_after += 1
			if w.part_id == z.part and not w.detached:
				attached_on_part += 1
		var p := npc.damage.get_part(z.part)
		if stumps_after != stumps_before:
			problems.append("%s: extra stump wound on re-hit (%d -> %d)" % [z.key, stumps_before, stumps_after])
		if l.severed.size() != 1:
			problems.append("%s: re-hit re-severed (%d notifications)" % [z.key, l.severed.size()])
		if attached_on_part > 0:
			problems.append("%s: %d attached (bleeding) wounds on a severed part" % [z.key, attached_on_part])
		if not is_finite(p.hp) or p.hp < 0.0:
			problems.append("%s: hp=%s" % [z.key, p.hp])
		if z.part != P.NECK and not l.lethal.is_empty():
			problems.append("%s: lethal=%s from re-hitting a severed part" % [z.key, l.lethal])
		for d in BodyIds.descendants_of(z.part):
			if not npc.damage.get_part(d).severed:
				problems.append("%s: descendant %s not severed with it" % [z.key, BodyIds.key(d)])
	chk("R1", "re-hitting a severed part: one sever notification, no extra stump, wounds detached, no lethal, descendants severed with it",
		problems.is_empty(), str(problems.slice(0, 8)))
	root.queue_free()
	await frames(2)

	# 2) repeated identical hits: part_broken once, lethal once, hp never negative, bruise <= 1
	var root2 := _new_root("Repeat2")
	var reps: Array[Dictionary] = []
	for mech in ["bullet", "blunt", "slash"]:
		for z in _zones:
			reps.append({"mech": mech, "zone": z})
	var npcs2 := _spawn_batch(reps.size(), 8, 4.0, root2)
	await frames(8)
	var bad2: Array[String] = []
	for i in reps.size():
		var sp: Dictionary = reps[i]
		var npc2 := npcs2[i]
		var l2 := _new_listeners(npc2)
		for n in 8:
			var shot := _find_shot(npc2, sp.zone)
			if shot.is_empty():
				break
			_fire(npc2, sp.zone, shot, sp.mech, _speed_for(sp.mech, 1))
		var p2 := npc2.damage.get_part(sp.zone.part)
		var tag := "%s/%s" % [sp.mech, sp.zone.key]
		var occurrences: int = l2.broken.filter(func(x): return x == sp.zone.part).size()
		if occurrences > 1:
			bad2.append("%s: part_broken x%d" % [tag, occurrences])
		if l2.lethal.size() > 1:
			bad2.append("%s: lethal x%d" % [tag, l2.lethal.size()])
		if not is_finite(p2.hp) or p2.hp < 0.0 or p2.bruise > 1.0 + EPS or p2.bruise < 0.0:
			bad2.append("%s: hp=%.2f bruise=%.2f" % [tag, p2.hp, p2.bruise])
		var fr := 0
		for w in npc2.wounds.get_wounds_on(sp.zone.part):
			if w.is_fracture:
				fr += 1
		if fr > 1:
			bad2.append("%s: %d fracture wounds" % [tag, fr])
	chk("R2", "8 repeated normal hits per mechanism x part: fracture and lethal reported once, HP/bruise stay in range", bad2.is_empty(), str(bad2.slice(0, 8)))
	root2.queue_free()
	await frames(2)


func _row_for(part: int) -> Dictionary:
	for t in ["injury/head_neck", "injury/torso", "injury/arms", "injury/legs"]:
		var parts: Dictionary = DataDB.table(t).get("parts", {})
		if parts.has(BodyIds.key(part)):
			return parts[BodyIds.key(part)]
	return {}


# ------------------------------------------------------------------ section: data / duplicated logic

func _sec_data() -> void:
	# every part has an injury row, a pain weight and a body row
	var missing: Array[String] = []
	var ai := DataDB.table("ai")
	var bp: Dictionary = DataDB.table("body_parts").get("parts", {})
	for id in BodyIds.KEYS:
		var k: String = BodyIds.key(id)
		if _row_for(id).is_empty():
			missing.append("injury row " + k)
		if not ai.part_pain_weight.has(k):
			missing.append("ai.part_pain_weight " + k)
		if not bp.has(k):
			missing.append("body_parts " + k)
	chk("D1", "every one of the 15 parts has an injury row, a pain weight and a body row", missing.is_empty(), str(missing))

	# the same constant in several files
	var mults := {}
	for t in ["injury/head_neck", "injury/arms", "injury/legs"]:
		mults[t] = DataDB.table(t).get("high_damage_sever_mult", null)
	var uniq := {}
	for t in mults:
		uniq[str(mults[t])] = true
	chk("D2", "high_damage_sever_mult is the same in head_neck / arms / legs (it is repeated per file by design)", uniq.size() == 1, str(mults))

	# type key vocabularies: core.type_mult, penetrating bleed tables, ai.type_pain_weight must cover the same types
	var core := DataDB.table("injury/core")
	var pen := DataDB.table("injury/penetrating")
	var tm: Array = core.type_mult.keys()
	var vocab_bad: Array[String] = []
	for t in ["bullet", "stab", "slash"]:
		if not pen.bleed.has(t):
			vocab_bad.append("penetrating.bleed." + t)
	for t in tm:
		if not (t in ["bullet", "stab", "slash", "blunt"]):
			vocab_bad.append("core.type_mult." + t)
	for tn in DamageEvent.Type.keys():
		if not ai.type_pain_weight.has(String(tn).to_lower()):
			vocab_bad.append("ai.type_pain_weight." + String(tn).to_lower())
	chk("D3", "damage-type keys line up across core.json / penetrating.json / ai.json", vocab_bad.is_empty(), str(vocab_bad))

	# bleed tables cover every region for every penetrating type
	var reg_bad: Array[String] = []
	for t in ["bullet", "stab", "slash"]:
		for r in ["head", "neck", "chest", "abdomen", "limb"]:
			if not pen.bleed[t].has(r):
				reg_bad.append("%s.%s" % [t, r])
	chk("D4", "penetrating.json has a bleed row for every type x region", reg_bad.is_empty(), str(reg_bad))

	# weapon-side vs rule-side sever gates
	_report_sever_reach()
	# brain scream list vs head causes
	var src := FileAccess.get_file_as_string("res://scripts/ai/npc_brain.gd")
	var hn := DataDB.table("injury/head_neck")
	var causes: Array[String] = []
	for k in hn.head.lethal_causes:
		causes.append(String(hn.head.lethal_causes[k]))
	causes.append(String(hn.head.destroyed_cause))
	causes.append(String(hn.neck.decapitated_cause))
	var silent_list: Array[String] = []
	var idx := src.find("cause not in [")
	if idx >= 0:
		var end := src.find("]", idx)
		var seg := src.substr(idx, end - idx)
		for c in causes:
			if seg.find("&\"%s\"" % c) >= 0:
				silent_list.append(c)
	var unmatched: Array[String] = []
	for c in causes:
		if not (c in silent_list):
			unmatched.append(c)
	print("INFO|brain _on_lethal skips the death scream for causes %s; head/neck causes that still scream: %s" % [str(silent_list), str(unmatched)])
	# the brain's cause list must only contain causes the damage side can actually emit
	var stale: Array[String] = []
	if idx >= 0:
		var end2 := src.find("]", idx)
		var seg2 := src.substr(idx, end2 - idx)
		var rx := RegEx.new()
		rx.compile("&\"([a-z_]+)\"")
		for m in rx.search_all(seg2):
			if not (m.get_string(1) in causes):
				stale.append(m.get_string(1))
	chk("D5", "every cause named in npc_brain's no-scream list exists in head_neck.json (no stale / misspelled cause)", stale.is_empty(), str(stale))


func _report_sever_reach() -> void:
	# the rule threshold is on ev.amount; the weapon additionally gates can_dismember on tip speed
	var knife := WeaponDefs.get_def("knife")
	var base := float(knife.base_damage)
	var ref := float(knife.velocity_ref)
	var exp_ := float(knife.damage_velocity_exponent)
	var mx := float(knife.max_damage_scale)
	var gate := float(knife.dismember_min_velocity)
	for z in _zones:
		var row := _row_for(z.part)
		var th := float(row.get("dismember", 0.0))
		if th <= 0.0 or z.key == "chest" or z.key == "abdomen":
			continue
		var ratio := th / base
		var v_amt := -1.0
		if ratio <= mx:
			v_amt = ref * pow(maxf(ratio, 0.0), 1.0 / exp_)
		var binding := "amount" if v_amt > gate else "weapon gate"
		var need := ("%.1f m/s" % v_amt) if v_amt >= 0.0 else "unreachable (max amount %.0f)" % (base * mx)
		var eff := ("%.1f m/s" % maxf(v_amt, gate)) if v_amt >= 0.0 else "unreachable"
		print("INFO|sever reach %s: threshold amount %.0f -> knife needs %s from damage scaling, %.1f m/s from dismember_min_velocity => binding: %s (effective %s)" % [
			z.key, th, need, gate, binding, eff])
