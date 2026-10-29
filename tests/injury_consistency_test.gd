## injury-consistency overseer: headless sweep of every weapon family x body part x intensity (docs/INJURY_CONSISTENCY.md).
## Run: godot --headless --path . res://tests/injury_consistency_test.tscn [-- out=/abs/table.tsv] [only=<section>] [dump=1]
##   sections: table, wtable, sweep, chunks, gates, repeat, data   (default: all, about 12 min wall)
## Output lines:  CHK|<id>|PASS/FAIL|<name>|<evidence>   SUG|... (design observation, never fails)   INFO|...   TSV|... (one row per table case)
## Exit code 1 when any CHK fails.
##
## Events come from the real weapon code, never from hand-written numbers:
##   hitscan -> HitscanWeapon.fire_ray (real raycast, energy / pellets / pass-through from data/weapons.json)
##   melee   -> MeleeWeapon._sweep (the per-frame hit path: ray, _build_event, _deliver) driven with a chosen tip velocity
## Every case uses a fresh Npc.spawn() NPC. "table" and "wtable" simulate 1 s (AI state) and 20 s (blood) with the real
## brain / blood systems running. Sweeps read the injury result in the same tick. Only the gate / repeat sections use clearly
## marked synthetic overkill events.
extends Node3D

const P := BodyIds.Part
const S := BodyIds.NpcState
const HC := BodyIds.HeadChunk

const SEED := 7
const DT := 1.0 / 60.0
const INTEN: Array[String] = ["slow", "normal", "fast"]
const SCALES: Array[float] = [0.5, 1.0, 1.5]       # melee: debug_swing speed scale
const EPS := 1e-4

## Weapon families. kind: bullet (1 ray), pellet (shotgun with pellets forced to 1), shot (whole shotgun blast), melee.
## table: intensity values (bullet = muzzle m/s, shot / pellet = range in m (far, mid, near), melee = measured tip speed).
## sweep: values for the instant monotonic sweep (muzzle velocity, or melee tip speed).
const FAMS := {
	"handgun": {"kind": "bullet", "weapon": "handgun", "mech": "bullet", "table": [120.0, 250.0, 380.0],
		"sweep": [20.0, 60.0, 100.0, 150.0, 200.0, 250.0, 300.0, 380.0]},
	"rifle": {"kind": "bullet", "weapon": "rifle", "mech": "bullet", "table": [450.0, 700.0, 900.0],
		"sweep": [100.0, 200.0, 300.0, 400.0, 500.0, 600.0, 700.0, 800.0, 900.0]},
	"shotgun_pellet": {"kind": "pellet", "weapon": "shotgun", "mech": "bullet", "table": [14.0, 7.0, 2.0],
		"sweep": [50.0, 100.0, 150.0, 200.0, 250.0, 300.0, 350.0, 400.0]},
	"shotgun_shot": {"kind": "shot", "weapon": "shotgun", "mech": "bullet", "table": [14.0, 7.0, 2.0], "sweep": []},
	"knife_stab": {"kind": "melee", "weapon": "knife", "mech": "stab", "mode": &"thrust",
		"sweep": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0]},
	"knife_slash": {"kind": "melee", "weapon": "knife", "mech": "slash", "mode": &"swing",
		"sweep": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0]},
	"machete_stab": {"kind": "melee", "weapon": "machete", "mech": "stab", "mode": &"thrust",
		"sweep": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0]},
	"machete_slash": {"kind": "melee", "weapon": "machete", "mech": "slash", "mode": &"swing",
		"sweep": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 16.0, 18.0]},
	"bat": {"kind": "melee", "weapon": "bat", "mech": "blunt", "mode": &"swing",
		"sweep": [3.0, 5.0, 7.0, 9.0, 11.0, 13.0, 15.0, 17.0, 19.0, 21.0]},
	"hammer": {"kind": "melee", "weapon": "hammer", "mech": "blunt", "mode": &"swing",
		"sweep": [2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 12.0, 14.0]},
}
const BASE_FAMS: Array[String] = ["handgun", "knife_stab", "knife_slash", "bat"]
const NEW_FAMS: Array[String] = ["rifle", "shotgun_pellet", "shotgun_shot", "machete_stab", "machete_slash", "hammer"]
const ALL_FAMS: Array[String] = ["handgun", "rifle", "shotgun_pellet", "knife_stab", "knife_slash", "machete_stab", "machete_slash", "bat", "hammer"]

var failures := 0
var checks := 0
var tick := 0
var _only := ""
var _out_path := ""
var _dump := false
var _arena: Node3D
var _zones: Array[Dictionary] = []
var _chunk_zones: Array[Dictionary] = []
var _weapons := {}          # cache key -> Weapon (in tree, physics off)
var _lmb := {}              # melee family -> [slow, normal, fast] measured tip speeds
var _cases: Array[Dictionary] = []
var _case_by_key := {}
var _chunk_cases: Array[Dictionary] = []
var _sweep_res := {}        # "fam|zone" -> Array of metric dicts, one per sweep value
var _saved_settings := {}


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
	for sec in ["table", "wtable", "sweep", "chunks", "gates", "repeat", "data"]:
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
	bs.size = Vector3(600, 1, 600)
	cs.shape = bs
	cs.position = Vector3(0, -0.5, 0)
	fb.add_child(cs)
	_arena.add_child(fb)
	var holder := Node3D.new()
	holder.name = "Weapons"
	_arena.add_child(holder)
	for id in ["handgun", "knife", "bat", "rifle", "shotgun", "machete", "hammer"]:
		_weapons[id] = _make_weapon(WeaponDefs.get_def(id))


func _make_weapon(def: Dictionary) -> Weapon:
	var w := WeaponFactory.create(def, null)
	_arena.get_node("Weapons").add_child(w)
	w.set_physics_process(false)
	return w


func _build_zones() -> void:
	# order = BodyIds.Part order with the torso split into the chest / abdomen zones the rules use
	var defs := [["head", P.HEAD, 0.0], ["neck", P.NECK, 0.0], ["chest", P.TORSO, 0.5], ["abdomen", P.TORSO, -0.5],
		["upper_arm_l", P.UPPER_ARM_L, 0.0], ["lower_arm_l", P.LOWER_ARM_L, 0.0], ["hand_l", P.HAND_L, 0.0],
		["upper_arm_r", P.UPPER_ARM_R, 0.0], ["lower_arm_r", P.LOWER_ARM_R, 0.0], ["hand_r", P.HAND_R, 0.0],
		["upper_leg_l", P.UPPER_LEG_L, 0.0], ["lower_leg_l", P.LOWER_LEG_L, 0.0], ["foot_l", P.FOOT_L, 0.0],
		["upper_leg_r", P.UPPER_LEG_R, 0.0], ["lower_leg_r", P.LOWER_LEG_R, 0.0], ["foot_r", P.FOOT_R, 0.0]]
	for d in defs:
		_zones.append({"key": d[0], "part": d[1], "y": d[2]})
	# head chunk zones: aim point in head-local normalized space + approach directions (travel direction of the hit)
	var front := Vector3(0, 0, -1)
	var back := Vector3(0, 0, 1)
	_chunk_zones = [
		{"key": "h_jaw", "part": P.HEAD, "y": 0.0, "chunk": HC.JAW, "aim_n": Vector3(0, -0.7, 0.5), "dirs": [front]},
		{"key": "h_face", "part": P.HEAD, "y": 0.0, "chunk": HC.FACE, "aim_n": Vector3(0, 0.1, 0.7), "dirs": [front]},
		{"key": "h_cranium", "part": P.HEAD, "y": 0.0, "chunk": HC.CRANIUM, "aim_n": Vector3(0, 0.3, 0.0),
			"dirs": [Vector3(0, -1, 0)]},     # from above: lanes along Z/X would cross other NPCs
		{"key": "h_occiput", "part": P.HEAD, "y": 0.0, "chunk": HC.OCCIPUT, "aim_n": Vector3(0, 0.1, -0.7), "dirs": [back]},
	]


func _zone(key: String) -> Dictionary:
	for z in _zones:
		if z.key == key:
			return z
	for z in _chunk_zones:
		if z.key == key:
			return z
	return {}


func _all_zones() -> Array[Dictionary]:
	var out: Array[Dictionary] = []
	out.append_array(_zones)
	out.append_array(_chunk_zones)
	return out


## Tip speed of the scripted swing / thrust at speed_scale 0.5, 1.0, 1.5 (what debug_swing(scale) produces) per melee family.
func _measure_lmb() -> void:
	for fam in ALL_FAMS:
		var f: Dictionary = FAMS[fam]
		if f.kind != "melee":
			continue
		var speeds: Array = []
		for sc in SCALES:
			var w := WeaponFactory.create(WeaponDefs.get_def(f.weapon), null)
			_arena.add_child(w)
			w.global_position = Vector3(300, 5, 300)
			w.debug_swing(sc, f.mode)
			var mx := 0.0
			for i in 60:
				await get_tree().physics_frame
				mx = maxf(mx, (w as MeleeWeapon).tip_speed)
			speeds.append(snappedf(mx, 0.01))
			w.queue_free()
		if float(speeds[0]) <= 0.1 or float(speeds[2]) <= 0.1:
			push_warning("lmb speed measurement failed for %s, using nominal" % fam)
			speeds = [3.0, 6.0, 9.0]
		_lmb[fam] = speeds
		print("INFO|measured %s speeds at scale 0.5/1.0/1.5: %s m/s" % [fam, str(speeds)])


## Table intensity value (muzzle velocity / range / tip speed).
func _val_for(fam: String, inten: int) -> float:
	var f: Dictionary = FAMS[fam]
	if f.kind == "melee":
		return float(_lmb[fam][inten])
	return float(f.table[inten])


## Muzzle velocity and range of a hitscan table case.
func _gun_args(fam: String, inten: int) -> Array:
	var f: Dictionary = FAMS[fam]
	if f.kind == "bullet":
		return [float(f.table[inten]), 1.0]
	return [float(WeaponDefs.get_def("shotgun").muzzle_velocity), float(f.table[inten])]


# ------------------------------------------------------------------ shots

func _zone_aim(npc: Npc, z: Dictionary) -> Vector3:
	var xf := npc.body.get_part_global_transform(z.part)
	var ext := npc.body.get_part_half_extents(z.part)
	if z.has("aim_n"):
		return xf * (z.aim_n * ext)
	return xf * Vector3(0.0, float(z.y) * ext.y, 0.0)


func _dir_candidates(z: Dictionary) -> Array[Vector3]:
	var out: Array[Vector3] = []
	if z.has("dirs"):
		for d in z.dirs:
			out.append(d)
		return out
	out.append(Vector3(0, 0, -1))      # front first: the NPC faces +Z, the attacker travels -Z
	var side := BodyIds.side_of(z.part)
	if side == "l":
		out.append(Vector3(-1, 0, 0))
	elif side == "r":
		out.append(Vector3(1, 0, 0))
	out.append_array([Vector3(0, 0, 1), Vector3(-1, 0, 0), Vector3(1, 0, 0), Vector3(0, -1, 0)])
	return out


## Finds an unobstructed straight line onto the zone. Returns {} if none; else {dir, from, to, pos, normal}.
## `from` is 1 m in front of the aim point along the line.
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
		var loc: Vector3 = npc.body.get_part_global_transform(z.part).affine_inverse() * r.position
		var ext := npc.body.get_part_half_extents(z.part)
		if z.part == P.TORSO:
			if (loc.y / maxf(ext.y, 0.001) > 0.0) != (float(z.y) > 0.0):
				continue
		if z.has("chunk"):
			var n := Vector3(loc.x / maxf(ext.x, 0.001), loc.y / maxf(ext.y, 0.001), loc.z / maxf(ext.z, 0.001))
			if BodyIds.head_chunk_from_local(n) != int(z.chunk):
				continue
		return {"dir": d, "from": from, "to": to, "pos": r.position, "normal": r.normal}
	return {}


## Fires the real weapon path for family `fam` at tip speed / muzzle velocity `speed`; `dist` = range for hitscan.
## `variant` {mass, area} swaps in a melee clone with that mass (kg) / head_area_cm2.
func _fire(npc: Npc, shot: Dictionary, fam: String, speed: float, dist := 1.0, variant := {}) -> DamageEvent:
	var f: Dictionary = FAMS[fam]
	if f.kind != "melee":
		var g := _gun(f.weapon, speed, f.kind == "pellet")
		g.rng.seed = SEED
		var origin: Vector3 = shot.from + shot.dir * 1.0 - shot.dir * dist
		return g.fire_ray(origin, shot.dir)
	var w: MeleeWeapon = _melee(f.weapon, variant)
	var d: Vector3 = shot.dir
	var axis := d                                    # stab: blade axis along travel
	if f.mech != "stab":                             # slash / blunt: blade axis perpendicular to travel
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


func _gun(wid: String, speed: float, single_pellet: bool) -> HitscanWeapon:
	var key := "g|%s|%.1f|%s" % [wid, speed, single_pellet]
	if not _weapons.has(key):
		var d: Dictionary = WeaponDefs.get_def(wid).duplicate(true)
		d["muzzle_velocity"] = speed
		if single_pellet:
			d["pellets"] = 1
			d["spread_deg"] = 0.0
		_weapons[key] = _make_weapon(d)
	return _weapons[key]


func _melee(wid: String, variant: Dictionary) -> MeleeWeapon:
	if variant.is_empty():
		return _weapons[wid]
	var key := "m|%s|%s" % [wid, str(variant)]
	if not _weapons.has(key):
		var d: Dictionary = WeaponDefs.get_def(wid).duplicate(true)
		if variant.has("mass"):
			d["mass"] = variant.mass
		if variant.has("area"):
			d["head_area_cm2"] = variant.area
		_weapons[key] = _make_weapon(d)
	return _weapons[key]


# ------------------------------------------------------------------ recording

func _new_listeners(npc: Npc) -> Dictionary:
	var r := {"broken": [], "severed": [], "stuns": [], "lethal": [], "died": "", "died_t": -1.0,
		"states": [], "wounded": 0, "t0": tick, "chunks": []}
	npc.part_broken.connect(func(p: int): r.broken.append(p))
	npc.part_severed.connect(func(p: int, _root, _ev): r.severed.append(p))
	npc.stunned.connect(func(d: float, cause: StringName): r.stuns.append([d, String(cause)]))
	npc.lethal_injury.connect(func(cause: StringName): r.lethal.append(String(cause)))
	npc.head_chunk_destroyed.connect(func(c: int, _g, _e): r.chunks.append(c))
	npc.died.connect(func(cause: StringName):
		r.died = String(cause)
		r.died_t = (tick - r.t0) * DT)
	npc.state_changed.connect(func(_o: int, n: int): r.states.append(n))
	npc.wounded.connect(func(_w: Wound, _e: DamageEvent): r.wounded += 1)
	return r


## Metrics readable immediately after the hit (no simulation needed). `evs` = every event the shot produced (hitscan).
func _metrics(npc: Npc, z: Dictionary, ev: DamageEvent, l: Dictionary, evs: Array = []) -> Dictionary:
	var m := {"ok": ev != null, "delivered": false}
	if ev == null:
		return m
	var part := npc.damage.get_part(z.part)
	m["type"] = DamageEvent.Type.keys()[ev.type]
	m["amount"] = ev.amount
	m["pen"] = ev.penetration
	m["can_dis"] = ev.can_dismember
	m["ev_part"] = ev.part_id
	m["energy"] = float(ev.extra.get("energy", -1.0))
	m["n_events"] = maxi(evs.size(), 1)
	var on_target := 0
	for e in evs:
		if e.part_id == z.part:
			on_target += 1
	m["on_target"] = on_target if not evs.is_empty() else (1 if ev.part_id == z.part else 0)
	m["delivered"] = ev.amount > 0.0 and l.wounded > 0
	var ext := 0.0
	var inn := 0.0
	var sev_max := 0.0
	var art := false
	var exitw := false
	var stump := false
	var frac := false
	var nw := 0
	var finite := true
	for w in npc.wounds.get_wounds():
		nw += 1
		finite = finite and is_finite(w.bleed_rate) and is_finite(w.internal_bleed_rate) and is_finite(w.severity)
		if not w.detached:
			ext += w.bleed_rate
			inn += w.internal_bleed_rate
		art = art or (w.is_arterial and not w.detached)
		exitw = exitw or w.is_exit
		stump = stump or w.is_stump
		frac = frac or w.is_fracture
		if not w.is_fracture and not w.is_stump:
			sev_max = maxf(sev_max, w.severity)
	var bleed_part := 0.0
	for w in npc.wounds.get_wounds_on(z.part):
		if not w.detached:
			bleed_part += w.bleed_rate + w.internal_bleed_rate
	m["bleed_part"] = bleed_part
	var hp_total := 0.0
	for p in npc.damage.get_parts():
		hp_total += p.max_hp - p.hp
	m["hp_total"] = hp_total
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
	var cn: Array = l.chunks.duplicate()
	cn.sort()
	m["chunks"] = cn
	m["chunk_names"] = "+".join(cn.map(func(c): return BodyIds.head_chunk_key(c)))
	m["finite"] = finite and is_finite(part.hp) and is_finite(ev.amount) and is_finite(part.bruise) \
		and is_finite(ext) and is_finite(inn) and is_finite(st)
	return m


## Lanes: along-Z shots from a different NPC never cross another NPC (x lanes are >= off apart, rows >= sz apart).
func _lane_pos(i: int, per_row: int, sx: float, sz: float, off: float) -> Vector3:
	var c := i % per_row
	var r := i / per_row
	return Vector3((float(c) - (per_row - 1) * 0.5) * sx + (float(r) - 1.5) * off, 0.02, (float(r) - 1.5) * sz)


func _spawn_batch(n: int, per_row: int, sx: float, sz: float, off: float, root: Node3D) -> Array[Npc]:
	var out: Array[Npc] = []
	for i in n:
		out.append(Npc.spawn(root, Transform3D(Basis.IDENTITY, _lane_pos(i, per_row, sx, sz, off)), SEED))
	return out


func _new_root(tag: String) -> Node3D:
	var r := Node3D.new()
	r.name = tag
	_arena.add_child(r)
	return r


# ------------------------------------------------------------------ section: table (full sim), base and new weapons

func _sec_table() -> void:
	await _run_table(BASE_FAMS)
	_report_table(BASE_FAMS)
	_check_table(BASE_FAMS, "T")


func _sec_wtable() -> void:
	await _run_table(NEW_FAMS)
	_report_table(NEW_FAMS)
	_check_table(NEW_FAMS, "W")


func _run_table(fams: Array[String]) -> void:
	var todo: Array[Dictionary] = []
	for fam in fams:
		for z in _zones:
			for i in 3:
				var c := {"fam": fam, "mech": FAMS[fam].mech, "zone": z, "inten": i, "speed": _val_for(fam, i)}
				todo.append(c)
				_cases.append(c)
				_case_by_key["%s|%s|%d" % [fam, z.key, i]] = c
	var bi := 0
	while bi < todo.size():
		await _run_table_batch(todo.slice(bi, bi + 16))
		bi += 16


func _fire_case(c: Dictionary) -> void:
	var f: Dictionary = FAMS[c.fam]
	var speed := float(c.speed)
	var dist := 1.0
	if f.kind != "melee":
		var ga := _gun_args(c.fam, c.inten)
		speed = ga[0]
		dist = ga[1]
	c["ev"] = _fire(c.npc, c.shot, c.fam, speed, dist)
	var g = _weapons.get("g|%s|%.1f|%s" % [f.weapon, speed, f.kind == "pellet"], null)
	c["evs"] = g.last_events.duplicate() if g != null else []


func _run_table_batch(batch: Array) -> void:
	var root := _new_root("TableBatch")
	var npcs := _spawn_batch(batch.size(), 4, 9.0, 9.0, 2.25, root)     # 9 m > alert_radius: neighbours never alert each other
	await frames(10)
	for i in batch.size():
		var c: Dictionary = batch[i]
		c["npc"] = npcs[i]
		c["l"] = _new_listeners(npcs[i])
		c["shot"] = _find_shot(npcs[i], c.zone)
	for c in batch:
		if not c.shot.is_empty():
			_fire_case(c)
	await seconds(1.0)
	for c in batch:
		c["state1"] = BodyIds.state_name(c.npc.get_state())
	await seconds(19.0)
	for c in batch:
		var npc: Npc = c.npc
		var m := _metrics(npc, c.zone, c.get("ev", null), c.l, c.get("evs", []))
		for k in m:
			c[k] = m[k]
		c["state20"] = BodyIds.state_name(npc.get_state())
		c["vol20"] = npc.blood.state.volume
		c["level20"] = BodyIds.BloodLevel.keys()[npc.blood.state.level]
		c["died"] = c.l.died
		c["died_t"] = c.l.died_t
		c["sane"] = _npc_sane(npc)
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


const TSV_KEYS := ["fam", "mech", "zone", "inten", "speed", "type", "amount", "pen", "energy", "can_dis", "delivered", "hp_lost", "hp_total",
	"ext", "int", "art", "exit", "stump", "fracture", "severed", "stun", "stun_cause", "lethal", "destroyed", "state1", "state20",
	"vol20", "level20", "died", "died_t", "sev_max", "bruise", "n_wounds", "n_events", "on_target", "chunk_names"]


func _tsv_line(c: Dictionary) -> String:
	var cells: Array[String] = []
	for k in TSV_KEYS:
		var v = c.zone.key if k == "zone" else c.get(k, "")
		if v is float:
			cells.append("%.3f" % v)
		elif v is bool:
			cells.append("1" if v else "0")
		else:
			cells.append(str(v))
	return "\t".join(cells)


func _report_table(fams: Array[String]) -> void:
	var lines: Array[String] = ["\t".join(TSV_KEYS)]
	for c in _cases:
		if c.fam in fams:
			lines.append(_tsv_line(c))
	for l in lines:
		print("TSV|" + l)
	if _out_path != "":
		var path := _out_path if fams == BASE_FAMS else _out_path.replace(".tsv", "_w.tsv")
		var fa := FileAccess.open(path, FileAccess.WRITE)
		if fa:
			fa.store_string("\n".join(lines) + "\n")
			fa.close()
			print("INFO|table written to " + path)


func _cs(fam: String, zone_key: String, inten: int) -> Dictionary:
	return _case_by_key["%s|%s|%d" % [fam, zone_key, inten]]


## lethality score: instant kill beats any bleed; otherwise nominal attached bleed (mL/s, ext + internal)
func _score(c: Dictionary) -> float:
	if String(c.get("lethal", "")) != "":
		return 1e9
	if c.get("fam", "") == "shotgun_shot":
		return float(c.get("bleed_part", 0.0))     # a scattered blast also wounds the neighbouring parts: judge the aimed part only
	return float(c.get("bleed", 0.0))


func _check_table(fams: Array[String], pre: String) -> void:
	var mine := _cases.filter(func(c): return c.fam in fams)
	var miss: Array[String] = []
	var nan: Array[String] = []
	var wrong_part: Array[String] = []
	var insane: Array[String] = []
	var undelivered: Array[String] = []
	for c in mine:
		var tag := "%s/%s/%s" % [c.fam, c.zone.key, INTEN[c.inten]]
		if c.shot.is_empty() or c.get("ev", null) == null:
			if c.fam != "shotgun_shot":
				miss.append(tag)
			continue
		if not bool(c.finite):
			nan.append(tag)
		if c.fam != "shotgun_shot" and int(c.ev_part) != int(c.zone.part):
			wrong_part.append(tag)
		if String(c.sane) != "":
			insane.append(tag + ":" + c.sane)
		if not bool(c.delivered):
			undelivered.append(tag)
	chk(pre + "1", "%s: every case got an unobstructed shot and an event" % str(fams), miss.is_empty(), "missing=%s" % str(miss))
	chk(pre + "2", "%s: no NaN/inf in any wound/HP/stun value" % str(fams), nan.is_empty(), str(nan))
	chk(pre + "3", "%s: every event resolved to the intended part" % str(fams), wrong_part.is_empty(), str(wrong_part))
	chk(pre + "4", "%s: bodies stay finite and inside 500 m for 20 s" % str(fams), insane.is_empty(), str(insane))
	var nd := undelivered.filter(func(t: String): return not t.ends_with("/slow") and not t.begins_with("shotgun_shot"))
	chk(pre + "5", "%s: every normal/fast event is delivered (amount > 0, wounds created)" % str(fams), nd.is_empty(), str(nd))
	if not undelivered.is_empty():
		print("INFO|undelivered (limp swing / below min_velocity / whole-shot all pellets missed): %s" % str(undelivered))

	var nothing: Array[String] = []
	for c in mine:
		if c.inten == 0 or not bool(c.get("delivered", false)) or c.fam == "shotgun_shot":
			continue
		var effect: bool = float(c.hp_lost) > EPS or bool(c.fracture) or bool(c.sever) or float(c.stun) > 0.0 or String(c.lethal) != ""
		if not effect or int(c.n_wounds) == 0:
			nothing.append("%s/%s/%s" % [c.fam, c.zone.key, INTEN[c.inten]])
	chk(pre + "6", "%s: no weapon x part does nothing at normal/fast intensity" % str(fams), nothing.is_empty(), str(nothing))

	# relative lethality for the firearms (shipped / full power): head > neck > chest > abdomen > limbs > hands/feet
	for fam in fams:
		if FAMS[fam].kind in ["bullet", "shot"]:
			_check_ordering(fam, 2, "%s7.%s" % [pre, fam], fam == "shotgun_shot")
			if fam != "shotgun_shot":
				for inten in [0, 1]:
					_info_ordering(fam, inten)

	_check_symmetry(fams, pre)

	var mono: Array[String] = []
	for fam in fams:
		for z in _zones:
			for i in 2:
				var a := _cs(fam, z.key, i)
				var b := _cs(fam, z.key, i + 1)
				if not bool(a.get("delivered", false)) or fam == "shotgun_shot":
					continue
				var why := _worse(a, b)
				if why != "":
					mono.append("%s/%s %s->%s: %s" % [fam, z.key, INTEN[i], INTEN[i + 1], why])
	chk(pre + "9", "%s: table intensities are monotonic (slow <= normal <= fast) for every weapon x part" % str(fams), mono.is_empty(), str(mono))

	var odd: Array[String] = []
	for c in mine:
		if String(c.get("lethal", "")) != "" and not (c.zone.part in [P.HEAD, P.NECK]):
			odd.append("%s/%s/%s=%s" % [c.fam, c.zone.key, INTEN[c.inten], c.lethal])
	chk(pre + "10", "%s: lethal_injury only comes from head/neck hits" % str(fams), odd.is_empty(), str(odd))

	var stun_bad: Array[String] = []
	for c in mine:
		var s := float(c.get("stun", 0.0))
		if c.fam == "shotgun_shot":
			continue         # scattered pellets can land on the head or hands: stun source is not attributable
		if s < 0.0 or s > 8.01 or (s > 0.0 and not (c.zone.part in [P.HEAD, P.TORSO, P.HAND_L, P.HAND_R])):
			stun_bad.append("%s/%s/%s stun=%.2f" % [c.fam, c.zone.key, INTEN[c.inten], s])
	chk(pre + "11", "%s: stun 0..8 s and only from head / torso / hand rules" % str(fams), stun_bad.is_empty(), str(stun_bad))

	var bad_sever: Array[String] = []
	for c in mine:
		if bool(c.get("sever", false)):
			var roots := String(c.severed).split(",")
			if roots.size() != 1 or not bool(c.stump):
				bad_sever.append("%s/%s/%s severed=%s stump=%s" % [c.fam, c.zone.key, INTEN[c.inten], c.severed, c.stump])
	chk(pre + "12", "%s: every sever notifies exactly once and leaves a stump wound" % str(fams), bad_sever.is_empty(), str(bad_sever))

	var notdead: Array[String] = []
	for c in mine:
		if String(c.get("lethal", "")) != "" and String(c.get("state20", "")) != "DEAD":
			notdead.append("%s/%s/%s state20=%s" % [c.fam, c.zone.key, INTEN[c.inten], c.get("state20", "?")])
	chk(pre + "13", "%s: every lethal_injury ends in DEAD" % str(fams), notdead.is_empty(), str(notdead))

	var kd := float(DataDB.table("ai").knockdown_min_duration)
	var ai_bad: Array[String] = []
	for c in mine:
		if not bool(c.get("delivered", false)) or c.fam == "shotgun_shot":
			continue
		var tag2 := "%s/%s/%s" % [c.fam, c.zone.key, INTEN[c.inten]]
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
	chk(pre + "14", "%s: AI state after 1 s matches the injury" % str(fams), ai_bad.is_empty(), str(ai_bad.slice(0, 8)))

	var exit_bad: Array[String] = []
	for c in mine:
		if not bool(c.get("delivered", false)) or c.fam == "shotgun_shot":
			continue
		var thick := float(_row_for(c.zone.part).get("thickness", 0.1))
		var want: bool = c.mech == "bullet" and float(c.pen) > thick
		# a rifle ray may also hit other parts behind the target: only judge the intended part's own event
		if bool(c.exit) != want and not (c.fam == "rifle" and bool(c.exit)):
			exit_bad.append("%s/%s pen=%.2f thick=%.2f exit=%s" % [c.fam, c.zone.key, c.pen, thick, c.exit])
	chk(pre + "15", "%s: exit wound only for bullets whose penetration exceeds the part thickness" % str(fams), exit_bad.is_empty(), str(exit_bad.slice(0, 8)))

	var range_bad: Array[String] = []
	for c in mine:
		if not bool(c.get("delivered", false)):
			continue
		if float(c.sev_max) < 0.0 or float(c.sev_max) > 1.0 or float(c.ext) < 0.0 or float(c.int) < 0.0 or float(c.hp_lost) < -EPS \
				or float(c.hp_lost) > float(_row_for(c.zone.part).max_hp) + EPS:
			range_bad.append("%s/%s/%s sev=%.2f ext=%.1f int=%.1f hp_lost=%.1f" % [c.fam, c.zone.key, INTEN[c.inten], c.sev_max, c.ext, c.int, c.hp_lost])
	chk(pre + "16", "%s: wound severity 0..1, bleed >= 0, HP lost within 0..max_hp" % str(fams), range_bad.is_empty(), str(range_bad.slice(0, 8)))

	if "shotgun_shot" in fams:
		_report_shot()


## Whole-shot vs per-pellet: how many pellets land and how much one blast does compared with one pellet.
func _report_shot() -> void:
	var lines: Array[String] = []
	var worse: Array[String] = []
	for inten in 3:
		var landed := 0
		var total := 0
		var blast_hp := 0.0
		var pellet_hp := 0.0
		for z in _zones:
			var sh := _cs("shotgun_shot", z.key, inten)
			var pe := _cs("shotgun_pellet", z.key, inten)
			landed += int(sh.get("on_target", 0))
			total += 9
			blast_hp += float(sh.get("hp_total", 0.0))
			pellet_hp += float(pe.get("hp_total", 0.0))
			# the whole blast must never do less total damage to the body than one pellet of it aimed at the same place
			if bool(pe.get("delivered", false)) and bool(sh.get("delivered", false)) and float(sh.hp_total) + EPS < float(pe.hp_total) * 0.5 \
					and int(sh.on_target) > 0:
				worse.append("%s/%s blast hp_total %.1f < pellet %.1f" % [z.key, INTEN[inten], sh.hp_total, pe.hp_total])
		lines.append("%s (%.0f m): %d/%d pellets on the aimed part, mean body HP lost blast %.1f vs single pellet %.1f" % [
			INTEN[inten], FAMS.shotgun_shot.table[inten], landed, total, blast_hp / _zones.size(), pellet_hp / _zones.size()])
	for l in lines:
		print("INFO|shotgun " + l)
	var hd := _cs("shotgun_shot", "head", 2)
	sug("W18", "a point-blank (2 m) blast with >= 4 pellets on the head is lethal (a single 9mm headshot is)",
		not (int(hd.get("on_target", 0)) >= 4 and String(hd.get("lethal", "")) == "" and not hd.get("chunks", []).is_empty()),
		"pellets on head=%s, head HP lost=%.1f/60, chunks destroyed=%s, lethal='%s', state at 1 s=%s" % [hd.get("on_target"), float(hd.get("hp_lost", 0.0)), hd.get("chunk_names"), hd.get("lethal"), hd.get("state1")])
	chk("W17", "shotgun: a whole blast that lands on the aimed part never does less body damage than half of one pellet", worse.is_empty(), str(worse.slice(0, 6)))


func _info_ordering(fam: String, inten: int) -> void:
	var parts: Array[String] = []
	for k in ["head", "neck", "chest", "abdomen", "upper_arm_l", "hand_l", "foot_l"]:
		var sc := _score(_cs(fam, k, inten))
		parts.append("%s=%s" % [k, "LETHAL" if sc >= 1e8 else "%.1f" % sc])
	print("INFO|%s %s lethality score (bleed mL/s, nominal): %s" % [fam, INTEN[inten], ", ".join(parts)])


## Orders: head > neck > chest > abdomen > limbs > hands/feet. Ties between limbs and hands/feet count as failures.
func _check_ordering(fam: String, inten: int, id: String, as_sug := false) -> void:
	var sc := func(key: String) -> float: return _score(_cs(fam, key, inten))
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
		var cid := "%s.%s" % [id, str(p[0]).replace(" ", "").replace(">", "gt").replace("/", "_")]
		if as_sug:
			sug(cid, "%s %s: relative lethality %s" % [fam, INTEN[inten], p[0]], ok, ev)
		else:
			chk(cid, "%s %s: relative lethality %s" % [fam, INTEN[inten], p[0]], ok, ev)


## Returns "" when `b` (the faster/stronger/heavier hit) did at least as much as `a`, else a description.
## A stronger outcome class (lethal, sever) supersedes the lesser metrics it replaces by design, except stun and
## destroyed head chunks, which never go down.
func _worse(a: Dictionary, b: Dictionary) -> String:
	if not bool(b.get("ok", true)) or not bool(a.get("ok", true)):
		return ""
	if String(a.lethal) != "" and String(b.lethal) == "":
		return "lethal lost"
	if bool(a.sever):
		for pn in String(a.severed).split(","):
			if not (pn in String(b.severed).split(",")):
				return "sever of %s lost" % pn
	for c in a.chunks:
		if not (c in b.chunks):
			return "head chunk %s no longer destroyed" % BodyIds.head_chunk_key(c)
	if float(b.stun) + EPS < float(a.stun):
		return "stun %.2f -> %.2f" % [a.stun, b.stun]
	if String(b.lethal) != "":
		return ""        # lethal supersedes the remaining bleed / HP bookkeeping
	if float(b.hp_lost) + EPS < float(a.hp_lost):
		return "hp_lost %.2f -> %.2f" % [a.hp_lost, b.hp_lost]
	if bool(a.fracture) and not bool(b.fracture) and not bool(b.sever):
		return "fracture lost"
	if bool(b.sever) and not bool(a.sever):
		return ""        # cut-through replaces wound / fracture
	if float(b.bleed) + EPS < float(a.bleed):
		return "bleed %.2f -> %.2f" % [a.bleed, b.bleed]
	if float(b.sev_max) + EPS < float(a.sev_max):
		return "wound severity %.2f -> %.2f" % [a.sev_max, b.sev_max]
	return ""


func _check_symmetry(fams: Array[String], pre: String) -> void:
	var diffs: Array[String] = []
	var soft: Array[String] = []
	var pairs := [["upper_arm_l", "upper_arm_r"], ["lower_arm_l", "lower_arm_r"], ["hand_l", "hand_r"],
		["upper_leg_l", "upper_leg_r"], ["lower_leg_l", "lower_leg_r"], ["foot_l", "foot_r"]]
	var keys := ["hp_lost", "ext", "int", "art", "exit", "stump", "fracture", "sever", "sev_max", "stun", "stun_cause", "lethal", "n_wounds", "bruise"]
	for fam in fams:
		if fam == "shotgun_shot":
			continue          # pellet scatter is random per lane: compared through the per-pellet family instead
		for p in pairs:
			for i in 3:
				var a := _cs(fam, p[0], i)
				var b := _cs(fam, p[1], i)
				var tag := "%s/%s/%s" % [fam, str(p[0]).trim_suffix("_l"), INTEN[i]]
				for k in keys:
					var va = a.get(k, null)
					var vb = b.get(k, null)
					var same: bool = absf(float(va) - float(vb)) < EPS if (va is float or va is int) and (vb is float or vb is int) else va == vb
					if not same:
						diffs.append("%s %s: %s vs %s" % [tag, k, str(va), str(vb)])
				var sa := (String(a.severed).split(",") if String(a.severed) != "" else PackedStringArray()).duplicate()
				var sb := (String(b.severed).split(",") if String(b.severed) != "" else PackedStringArray()).duplicate()
				for q in sa.size():
					sa[q] = sa[q].trim_suffix("_l")
				for q in sb.size():
					sb[q] = sb[q].trim_suffix("_r")
				if sa != sb:
					diffs.append("%s severed: %s vs %s" % [tag, a.severed, b.severed])
				if a.state1 != b.state1:
					soft.append("%s state1 %s vs %s" % [tag, a.state1, b.state1])
				if absf(float(a.vol20) - float(b.vol20)) > 0.02 * float(a.vol20):
					soft.append("%s vol20 %.0f vs %.0f" % [tag, a.vol20, b.vol20])
	chk(pre + "8", "%s: left and right limbs give identical injury outcomes" % str(fams), diffs.is_empty(),
		"%d diffs, first: %s" % [diffs.size(), str(diffs.slice(0, 6))])
	chk(pre + "8b", "%s: left and right match in AI state after 1 s and blood after 20 s (within 2 %%)" % str(fams), soft.is_empty(),
		"%d diffs, first: %s" % [soft.size(), str(soft.slice(0, 6))])
	if pre == "T":
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

## Runs fams x zones x sweep values with fresh NPCs, reading results in the same tick. Returns "fam|zone" -> [metrics...].
func _sweep_run(fams: Array, zones: Array, immortal := false, nodis := false) -> Dictionary:
	var specs: Array[Dictionary] = []
	for fam in fams:
		for z in zones:
			for s in FAMS[fam].sweep:
				specs.append({"fam": fam, "zone": z, "speed": float(s)})
	var bi := 0
	while bi < specs.size():
		await _run_instant_batch(specs.slice(bi, bi + 64), immortal, nodis)
		bi += 64
	var by := {}
	for sp in specs:
		var k := "%s|%s" % [sp.fam, sp.zone.key]
		if not by.has(k):
			by[k] = []
		by[k].append(sp)
	return by


## Spawn, fire, read in the same tick (no physics step between: pure injury-pipeline metrics).
func _run_instant_batch(batch: Array, immortal := false, nodis := false) -> void:
	var root := _new_root("SweepBatch")
	GameSettings.immortal_dummy = immortal
	GameSettings.no_dismemberment = nodis
	var npcs := _spawn_batch(batch.size(), 8, 9.0, 9.0, 1.1, root)
	GameSettings.immortal_dummy = false      # Npc.immortal is fixed at spawn
	await frames(8)
	for i in batch.size():
		var sp: Dictionary = batch[i]
		var npc := npcs[i]
		var l := _new_listeners(npc)
		var shot := _find_shot(npc, sp.zone)
		var ev: DamageEvent = null
		var evs: Array = []
		if not shot.is_empty():
			var dist := float(sp.get("dist", 1.0))
			ev = _fire(npc, shot, sp.fam, sp.speed, dist, sp.get("variant", {}))
			if FAMS[sp.fam].kind != "melee":
				evs = _gun(FAMS[sp.fam].weapon, sp.speed, FAMS[sp.fam].kind == "pellet").last_events.duplicate()
		var m := _metrics(npc, sp.zone, ev, l, evs)
		sp["shot_ok"] = not shot.is_empty()
		for k in m:
			sp[k] = m[k]
	GameSettings.no_dismemberment = false
	root.queue_free()
	await frames(2)


func _violations(by: Dictionary) -> Array[String]:
	var viol: Array[String] = []
	for k in by:
		var arr: Array = by[k]
		for i in range(1, arr.size()):
			if bool(arr[i - 1].get("delivered", false)) and bool(arr[i].get("ok", false)):
				var why := _worse(arr[i - 1], arr[i])
				if why != "":
					viol.append("%s %.1f->%.1f: %s" % [k, arr[i - 1].speed, arr[i].speed, why])
	return viol


func _sec_sweep() -> void:
	var fams := ALL_FAMS.filter(func(f): return not FAMS[f].sweep.is_empty())
	_sweep_res = await _sweep_run(fams, _zones)
	if _dump:
		for k in _sweep_res:
			for m in _sweep_res[k]:
				print("SW|%s|%.1f|amt=%.1f en=%.0f hp=%.1f bleed=%.1f frac=%s sev=%s stun=%.2f %s lethal=%s chunks=%s" % [k, m.speed, m.get("amount", 0.0),
					m.get("energy", -1.0), m.get("hp_lost", 0.0), m.get("bleed", 0.0), m.get("fracture", false), m.get("sever", false), m.get("stun", 0.0), m.get("stun_cause", ""), m.get("lethal", ""), m.get("chunk_names", "")])
	var missing: Array[String] = []
	var nan: Array[String] = []
	for k in _sweep_res:
		for m in _sweep_res[k]:
			if not bool(m.get("shot_ok", false)) or not bool(m.get("ok", false)):
				missing.append("%s@%.0f" % [k, m.speed])
			elif not bool(m.finite):
				nan.append("%s@%.0f" % [k, m.speed])
	chk("S1", "sweep: every weapon x part x speed produced an event", missing.is_empty(), str(missing.slice(0, 8)))
	chk("S2", "sweep: no NaN/inf anywhere", nan.is_empty(), str(nan.slice(0, 8)))
	var viol_all := _violations(_sweep_res)
	for group in [["bullets (energy per caliber: 9mm, 5.56, buckshot pellet)", ["handgun", "rifle", "shotgun_pellet"]],
			["blades (stab / slash, knife and machete)", ["knife_stab", "knife_slash", "machete_stab", "machete_slash"]],
			["blunt (bat, hammer)", ["bat", "hammer"]]]:
		var sub := viol_all.filter(func(v: String): return v.split("|")[0] in group[1])
		chk("S3." + str(group[1][0]), "sweep %s: faster never does less (HP, bleed, fracture, sever, stun, lethal, chunks)" % group[0], sub.is_empty(),
			"%d violations, first: %s" % [sub.size(), str(sub.slice(0, 8))])
	_print_thresholds(fams)
	_check_bleed_vs_intensity()
	await _check_distance()
	await _check_mass_area()
	await _check_penetration_chain()
	_check_reach()
	var by_chunk := await _sweep_run(fams, _chunk_zones)
	var vc := _violations(by_chunk)
	chk("C1", "head chunks: a faster hit never destroys fewer chunks and never causes less stun (all weapon families x 4 chunk zones)", vc.is_empty(),
		"%d violations, first: %s" % [vc.size(), str(vc.slice(0, 8))])
	await _sweep_variant("S3b", "no_dismemberment ON", fams, true, false, true)
	await _sweep_variant("S3c", "immortal dummy", fams, true, true, false)


func _print_thresholds(fams: Array) -> void:
	for k in _sweep_res:
		var first := {}
		for m in _sweep_res[k]:
			if not bool(m.get("ok", false)):
				continue
			if bool(m.delivered) and not first.has("any"):
				first["any"] = m.speed
			if bool(m.fracture) and not first.has("fracture"):
				first["fracture"] = m.speed
			if bool(m.sever) and not first.has("sever"):
				first["sever"] = m.speed
			if String(m.lethal) != "" and not first.has("lethal"):
				first["lethal"] = m.speed
			if float(m.stun) > 0.0 and not first.has("stun"):
				first["stun"] = m.speed
		print("INFO|threshold %s %s" % [k, JSON.stringify(first)])


## Monotonic sweep repeated under a gate setting (the gates change what a stronger hit does).
func _sweep_variant(id: String, label: String, fams: Array, with_chunks: bool, immortal: bool, nodis: bool) -> void:
	var zones := _all_zones() if with_chunks else _zones
	var by := await _sweep_run(fams, zones, immortal, nodis)
	var viol := _violations(by)
	if immortal:
		var bad: Array[String] = []
		for k in by:
			for m in by[k]:
				if m.get("ok", false) and (CHUNK_VAULT.any(func(c): return c in m.chunks) or String(m.lethal) != ""):
					bad.append("%s@%.0f chunks=%s lethal=%s" % [k, m.speed, m.chunk_names, m.lethal])
		chk(id + "b", "immortal sweep: skull vault chunks (cranium, occiput) are never destroyed and nothing is lethal", bad.is_empty(), str(bad.slice(0, 6)))
	chk(id, "sweep with %s (incl. head chunks): faster never does less" % label, viol.is_empty(), "%d violations, first: %s" % [viol.size(), str(viol.slice(0, 8))])


const CHUNK_VAULT := [HC.CRANIUM, HC.OCCIPUT]


## Bleed that does not respond to hit strength is allowed by "monotonic" but is an outlier (regression guard for milestone 5).
func _check_bleed_vs_intensity() -> void:
	var flat: Array[String] = []
	for fam in ["handgun", "rifle", "shotgun_pellet", "knife_stab", "machete_stab", "knife_slash", "machete_slash"]:
		for z in _zones:
			var arr: Array = _sweep_res["%s|%s" % [fam, z.key]]
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
			if hi >= 0.0 and hi - lo < 1e-6 and hi_amt > lo_amt * 1.5 and hi > 0.5 and not (FAMS[fam].mech == "stab" and z.part == P.TORSO):
				flat.append("%s/%s bleed=%.1f for amount %.1f..%.1f" % [fam, z.key, hi, lo_amt, hi_amt])
	chk("S4", "bleed responds to hit strength for every firearm and blade (amount varies >1.5x => nominal bleed varies)", flat.is_empty(),
		"%d flat combos, first: %s" % [flat.size(), str(flat.slice(0, 10))])


## Shotgun pellets: farther never does more (falloff) in HP, severity and bleed.
func _check_distance() -> void:
	var specs: Array[Dictionary] = []
	var dists: Array[float] = [24.0, 20.0, 16.0, 12.0, 8.0, 6.0, 4.0, 2.0]       # decreasing range = increasing strength
	for z in _all_zones():
		for d in dists:
			specs.append({"fam": "shotgun_pellet", "zone": z, "speed": 400.0, "dist": d})
	var bi := 0
	while bi < specs.size():
		await _run_instant_batch(specs.slice(bi, bi + 64))
		bi += 64
	var by := {}
	for sp in specs:
		var k := "pellet|%s" % sp.zone.key
		if not by.has(k):
			by[k] = []
		by[k].append(sp)
	var viol: Array[String] = []
	var flat: Array[String] = []
	for k in by:
		var arr: Array = by[k]
		for i in range(1, arr.size()):
			if bool(arr[i - 1].get("delivered", false)) and bool(arr[i].get("ok", false)):
				var why := _worse(arr[i - 1], arr[i])
				if why != "":
					viol.append("%s %.0f m -> %.0f m: %s" % [k, arr[i - 1].dist, arr[i].dist, why])
		if bool(arr[0].get("ok", false)) and bool(arr[-1].get("ok", false)):
			if float(arr[-1].amount) > float(arr[0].amount) * 1.5 and absf(float(arr[-1].bleed) - float(arr[0].bleed)) < 1e-6 and float(arr[0].bleed) > 0.5:
				flat.append("%s bleed=%.2f at 24 m and 2 m (amount %.1f -> %.1f)" % [k, arr[0].bleed, arr[0].amount, arr[-1].amount])
	chk("S6", "shotgun pellet: closer never does less than farther (falloff 4-25 m)", viol.is_empty(), "%d violations, first: %s" % [viol.size(), str(viol.slice(0, 6))])
	chk("S6b", "shotgun pellet bleed also falls off with range (amount falls >1.5x => bleed changes)", flat.is_empty(),
		"%d flat zones, first: %s" % [flat.size(), str(flat.slice(0, 6))])


## Blunt: more momentum (mass at equal speed) and smaller contact area never do less, for bat and hammer.
func _check_mass_area() -> void:
	for fam in ["bat", "hammer"]:
		var speed := 10.0 if fam == "bat" else 8.0
		for dim in ["mass", "area"]:
			var variants: Array = []
			if dim == "mass":
				for m in [0.1, 0.3, 0.9, 2.0, 5.0, 12.0]:
					variants.append({"mass": m})
			else:
				for a in [80.0, 40.0, 20.0, 10.0, 5.0, 2.0, 1.0]:
					variants.append({"area": a})
			var specs: Array[Dictionary] = []
			for z in _all_zones():
				for v in variants:
					specs.append({"fam": fam, "zone": z, "speed": speed, "variant": v})
			var bi := 0
			while bi < specs.size():
				await _run_instant_batch(specs.slice(bi, bi + 64))
				bi += 64
			var by := {}
			for sp in specs:
				var k := "%s|%s" % [fam, sp.zone.key]
				if not by.has(k):
					by[k] = []
				by[k].append(sp)
			var viol: Array[String] = []
			var same := 0
			for k in by:
				var arr: Array = by[k]
				for i in range(1, arr.size()):
					if bool(arr[i - 1].get("delivered", false)) and bool(arr[i].get("ok", false)):
						var why := _worse(arr[i - 1], arr[i])
						if why != "":
							viol.append("%s %s -> %s: %s" % [k, str(arr[i - 1].variant), str(arr[i].variant), why])
				if bool(arr[0].ok) and bool(arr[-1].ok) and absf(float(arr[0].hp_lost) - float(arr[-1].hp_lost)) < EPS and absf(float(arr[0].stun) - float(arr[-1].stun)) < EPS \
						and arr[0].fracture == arr[-1].fracture and arr[0].chunk_names == arr[-1].chunk_names:
					same += 1
			chk("S5.%s.%s" % [fam, dim], "%s: %s never does less (HP, fracture, stun, chunks)" % [fam, "more momentum (heavier, same speed)" if dim == "mass" else "smaller contact area"],
				viol.is_empty(), "%d violations, first: %s; zones where the full range changes nothing: %d/%d" % [viol.size(), str(viol.slice(0, 5)), same, by.size()])


## Rifle: the ray continues through bodies with less energy; the second body is hurt no more than the first.
func _check_penetration_chain() -> void:
	var root := _new_root("Chain")
	GameSettings.immortal_dummy = false
	var a := Npc.spawn(root, Transform3D(Basis.IDENTITY, Vector3(0, 0.02, -40)), SEED)
	var b := Npc.spawn(root, Transform3D(Basis.IDENTITY, Vector3(0, 0.02, -41.4)), SEED)
	await frames(10)
	var z := _zone("chest")
	var shot := _find_shot(a, z)
	var g := _gun("rifle", 900.0, false)
	var la := _new_listeners(a)
	var lb := _new_listeners(b)
	g.fire_ray(shot.from, shot.dir)
	var evs := g.last_events.duplicate()
	var ok_chain := evs.size() >= 2
	var energies: Array[float] = []
	for e in evs:
		energies.append(float(e.extra.get("energy", -1.0)))
	var dec := true
	for i in range(1, energies.size()):
		dec = dec and energies[i] < energies[i - 1]
	var wa := 0.0
	var wb := 0.0
	for w in a.wounds.get_wounds():
		wa += w.bleed_rate + w.internal_bleed_rate
	for w in b.wounds.get_wounds():
		wb += w.bleed_rate + w.internal_bleed_rate
	chk("S7", "rifle pass-through: 2+ bodies hit, energy strictly decreases per body, the second body bleeds no more than the first",
		ok_chain and dec and wb <= wa + EPS, "events=%d energies=%s bleed first=%.1f second=%.1f" % [evs.size(), str(energies), wa, wb])
	root.queue_free()
	await frames(2)


## Melee reach found by the sweep per family (INFO), plus the weapon-side sever gate.
func _check_reach() -> void:
	for fam in ["knife_slash", "machete_slash"]:
		var def := WeaponDefs.get_def(FAMS[fam].weapon)
		var lmb: Array = _lmb[fam]
		print("INFO|%s: can_dismember needs tip speed > %.1f m/s (dismember_min_velocity); scripted LMB %s m/s" % [fam, float(def.dismember_min_velocity), str(lmb)])


# ------------------------------------------------------------------ section: chunks

## Head chunk table (instant): every family x chunk zone x intensity; ordering, destroyed-vs-lethal, spill.
func _sec_chunks() -> void:
	var specs: Array[Dictionary] = []
	for fam in ALL_FAMS + ["shotgun_shot"]:
		for z in _chunk_zones:
			for i in 3:
				var sp := {"fam": fam, "zone": z, "inten": i}
				if FAMS[fam].kind == "melee":
					sp["speed"] = _val_for(fam, i)
				else:
					var ga := _gun_args(fam, i)
					sp["speed"] = ga[0]
					sp["dist"] = ga[1]
				specs.append(sp)
	var bi := 0
	while bi < specs.size():
		await _run_instant_batch(specs.slice(bi, bi + 48))
		bi += 48
	_chunk_cases = specs
	var rows: Array[String] = []
	for sp in specs:
		rows.append("CHUNK|%s|%s|%s|amt=%.1f en=%.0f stun=%.2f %s lethal=%s destroyed=%s bleed=%.1f" % [sp.fam, sp.zone.key, INTEN[sp.inten],
			sp.get("amount", 0.0), sp.get("energy", -1.0), sp.get("stun", 0.0), sp.get("stun_cause", ""), sp.get("lethal", ""), sp.get("chunk_names", ""), sp.get("bleed", 0.0)])
	for r in rows:
		print(r)
	_check_chunks()


func _chunk_case(fam: String, key: String, inten: int) -> Dictionary:
	for sp in _chunk_cases:
		if sp.fam == fam and sp.zone.key == key and sp.inten == inten:
			return sp
	return {}


func _head_sev(c: Dictionary) -> float:
	return (100.0 if String(c.get("lethal", "")) != "" else 0.0) + float(c.get("stun", 0.0)) + 0.5 * c.get("chunks", []).size()


func _check_chunks() -> void:
	var missing: Array[String] = []
	var nan: Array[String] = []
	for sp in _chunk_cases:
		if not bool(sp.get("shot_ok", false)) or not bool(sp.get("ok", false)):
			if sp.fam != "shotgun_shot":
				missing.append("%s/%s/%s" % [sp.fam, sp.zone.key, INTEN[sp.inten]])
		elif not bool(sp.finite):
			nan.append("%s/%s/%s" % [sp.fam, sp.zone.key, INTEN[sp.inten]])
	chk("C2", "head chunks: every weapon family reaches every chunk zone with a finite result", missing.is_empty() and nan.is_empty(), "missing=%s nan=%s" % [str(missing), str(nan)])

	# lethality ordering: the jaw is the least lethal chunk (instant lethal_injury; stun / destroyed chunks are reported, not ranked)
	var order_bad: Array[String] = []
	var jaw_total := 0
	var lines3: Array[String] = []
	for fam in ALL_FAMS:
		var counts := {}
		for z in _chunk_zones:
			var n := 0
			for i in 3:
				var c := _chunk_case(fam, z.key, i)
				if String(c.get("lethal", "")) != "":
					n += 1
			counts[z.key] = n
		jaw_total += int(counts["h_jaw"])
		lines3.append("%s lethal intensities jaw/face/cranium/occiput = %d/%d/%d/%d" % [fam, counts.h_jaw, counts.h_face, counts.h_cranium, counts.h_occiput])
		for o in ["h_cranium", "h_occiput"]:
			if int(counts["h_face"]) > int(counts[o]):
				order_bad.append("%s: face lethal at %d intensities, %s only %d" % [fam, counts.h_face, o, counts[o]])
		for o in ["h_face", "h_cranium", "h_occiput"]:
			if int(counts["h_jaw"]) > int(counts[o]):
				order_bad.append("%s: jaw lethal at %d intensities, %s only %d" % [fam, counts.h_jaw, o, counts[o]])
		for i in 3:
			if String(_chunk_case(fam, "h_jaw", i).get("lethal", "")) != "":
				for o in ["h_face", "h_cranium", "h_occiput"]:
					if String(_chunk_case(fam, o, i).get("lethal", "")) == "":
						order_bad.append("%s/%s: jaw lethal but %s is not" % [fam, INTEN[i], o])
	for l in lines3:
		print("INFO|" + l)
	chk("C3", "head chunks: lethality order jaw < face <= cranium / occiput (jaw never lethal; face never lethal where the vault is not)", order_bad.is_empty() and jaw_total == 0,
		"jaw lethal total=%d; %s" % [jaw_total, str(order_bad.slice(0, 6))])

	# contract: destroying cranium / occiput kills, destroying the jaw alone does not
	var contract: Array[String] = []
	for sp in _chunk_cases:
		if not bool(sp.get("delivered", false)) or sp.fam == "shotgun_shot":
			continue
		var tag := "%s/%s/%s" % [sp.fam, sp.zone.key, INTEN[sp.inten]]
		var ch: Array = sp.chunks
		if (HC.CRANIUM in ch or HC.OCCIPUT in ch) and String(sp.lethal) == "":
			contract.append(tag + " vault destroyed but not lethal")
		if ch == [HC.JAW] and String(sp.lethal) != "":
			contract.append(tag + " jaw-only destruction is lethal: " + String(sp.lethal))
		if String(sp.lethal) != "" and ch.is_empty() and float(sp.hp) > 0.0:
			contract.append(tag + " lethal with no chunk destroyed (whole-head rule): " + String(sp.lethal))
	chk("C4", "head chunks: vault chunk destroyed => lethal; jaw alone => not lethal; stun set whenever a jaw/face is destroyed", contract.is_empty(), str(contract.slice(0, 8)))

	var stun_bad: Array[String] = []
	for sp in _chunk_cases:
		if not bool(sp.get("delivered", false)) or sp.fam == "shotgun_shot":
			continue
		var cfgc: Dictionary = DataDB.table("injury/head_neck").chunks
		for c in sp.chunks:
			var want := float(cfgc[BodyIds.head_chunk_key(c)].get("stun", 0.0))
			if float(sp.stun) + EPS < want:
				stun_bad.append("%s/%s/%s %s destroyed stun %.2f < %.2f" % [sp.fam, sp.zone.key, INTEN[sp.inten], BodyIds.head_chunk_key(c), sp.stun, want])
	chk("C5", "head chunks: a destroyed jaw / face always carries at least its configured stun", stun_bad.is_empty(), str(stun_bad.slice(0, 6)))

	# spill
	var spill_bad: Array[String] = []
	var spill_info: Array[String] = []
	var nb := {HC.JAW: HC.FACE, HC.FACE: HC.CRANIUM, HC.CRANIUM: HC.OCCIPUT, HC.OCCIPUT: HC.CRANIUM}
	for z in _chunk_zones:
		var r := _chunk_case("rifle", z.key, 2)
		var want_pair := [int(z.chunk), int(nb[z.chunk])]
		want_pair.sort()
		if r.get("chunks", []) != want_pair:
			spill_bad.append("rifle fast %s: destroyed %s, expected %s" % [z.key, r.get("chunk_names", "?"), str(want_pair)])
		for fam in ["handgun", "shotgun_pellet"]:
			for i in 3:
				var h := _chunk_case(fam, z.key, i)
				if h.get("chunks", []).size() > 1 or (not h.get("chunks", []).is_empty() and h.chunks != [int(z.chunk)]):
					spill_bad.append("%s %s %s: destroyed %s (no spill expected)" % [fam, INTEN[i], z.key, h.get("chunk_names", "?")])
		for i in 2:
			var rr := _chunk_case("rifle", z.key, i)
			spill_info.append("%s %s -> %s" % [INTEN[i], z.key, rr.get("chunk_names", "")])
	chk("C6", "head chunks: the full-power rifle spills into the neighbour chunk, the 9mm and buckshot never do", spill_bad.is_empty(), str(spill_bad.slice(0, 8)))
	print("INFO|rifle below full power (energy x 0.075 vs spill_energy): %s" % str(spill_info))

	# energy at which the rifle starts to spill and the hit chunk is destroyed per family at fast
	var lines: Array[String] = []
	for fam in ALL_FAMS + ["shotgun_shot"]:
		var parts: Array[String] = []
		for z in _chunk_zones:
			var c := _chunk_case(fam, z.key, 2)
			parts.append("%s: %s%s" % [z.key.trim_prefix("h_"), c.get("chunk_names", "-") if c.get("chunk_names", "") != "" else "-", " LETHAL" if String(c.get("lethal", "")) != "" else ""])
		lines.append("%s fast: %s" % [fam, "; ".join(parts)])
	for l in lines:
		print("INFO|chunks " + l)


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
	if type == DamageEvent.Type.BULLET:
		ev.extra["energy"] = 5000.0
		ev.extra["caliber"] = "5.56"
	return ev


const TYPES := [DamageEvent.Type.BULLET, DamageEvent.Type.BLADE_STAB, DamageEvent.Type.BLADE_SLASH, DamageEvent.Type.BLUNT]


## Runs 4 types x (16 zones + 4 head chunk zones) of synthetic overkill events under the given settings.
func _gate_run(tag: String, immortal: bool, no_dis: bool, gore_low: bool) -> Dictionary:
	GameSettings.immortal_dummy = immortal
	GameSettings.no_dismemberment = no_dis
	GameSettings.gore_intensity = GameSettings.Gore.LOW if gore_low else GameSettings.Gore.HIGH
	var root := _new_root("Gate_" + tag)
	var specs: Array[Dictionary] = []
	for t in TYPES:
		for z in _all_zones():
			specs.append({"type": t, "zone": z})
	var npcs := _spawn_batch(specs.size(), 10, 3.0, 3.0, 0.0, root)
	GameSettings.immortal_dummy = false     # Npc.immortal was fixed at spawn; no_dismemberment / gore stay set while firing
	await frames(8)
	var res := {"severed": [], "lethal": [], "destroyed": [], "head_sev": [], "died": [], "wounds0": [], "hp_low": [], "vault": [],
		"n": specs.size(), "stumps": 0, "sever_cue": 0, "chunks_any": 0}
	for i in specs.size():
		var sp: Dictionary = specs[i]
		var npc := npcs[i]
		var l := _new_listeners(npc)
		var shot := _find_shot(npc, sp.zone)
		var t := "%s/%s" % [DamageEvent.Type.keys()[sp.type], sp.zone.key]
		if shot.is_empty():
			res.wounds0.append("noshot " + t)
			continue
		var cues := []
		var cb := func(n, cue, _p, _i): if n == npc: cues.append(cue)
		GameEvents.audio_cue.connect(cb)
		npc.apply_damage(_overkill(sp.type, sp.zone, shot))
		GameEvents.audio_cue.disconnect(cb)
		if not l.severed.is_empty():
			res.severed.append("%s->%s" % [t, ",".join(l.severed.map(func(p): return BodyIds.key(p)))])
		if &"sever" in cues:
			res.sever_cue += 1
		if not l.lethal.is_empty():
			res.lethal.append("%s=%s" % [t, l.lethal[0]])
		var head := npc.damage.get_part(P.HEAD)
		if head.destroyed:
			res.destroyed.append(t)
		if P.HEAD in l.severed or P.NECK in l.severed or head.severed or npc.damage.get_part(P.NECK).severed:
			res.head_sev.append(t)
		if npc.wounds.get_wounds().is_empty():
			res.wounds0.append(t)
		if head.hp < 1.0:
			res.hp_low.append(t)
		if HC.CRANIUM in head.chunks_destroyed or HC.OCCIPUT in head.chunks_destroyed:
			res.vault.append(t)
		if not head.chunks_destroyed.is_empty():
			res.chunks_any += 1
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
	var ctl := await _gate_run("control", false, false, false)
	chk("G0", "control: overkill events sever limbs, destroy head chunks and kill via head/neck when no gate is active (test is effective)",
		ctl.severed.size() >= 40 and not ctl.lethal.is_empty() and not ctl.head_sev.is_empty() and not ctl.vault.is_empty(),
		"severed=%d lethal=%d head/neck sever=%d vault chunks=%d" % [ctl.severed.size(), ctl.lethal.size(), ctl.head_sev.size(), ctl.vault.size()])
	ctl.root.queue_free()
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
	chk("G1e", "no_dismemberment still allows head chunks to break (chunks are not severing)", nd.chunks_any > 0, "NPCs with a destroyed chunk: %d" % nd.chunks_any)
	nd.root.queue_free()
	var gl := await _gate_run("goreLOW", false, false, true)
	chk("G2", "gore LOW implies no severing (dismemberment_allowed() == false)", gl.severed.is_empty() and gl.stumps == 0,
		"severed=%s" % str(gl.severed.slice(0, 6)))
	gl.root.queue_free()
	var im := await _gate_run("immortal", true, false, false)
	chk("G3", "immortal: no lethal_injury reported by any overkill hit", im.lethal.is_empty(), str(im.lethal.slice(0, 6)))
	chk("G3b", "immortal: head is never destroyed and keeps hp >= 1", im.destroyed.is_empty() and im.hp_low.is_empty(),
		"destroyed=%s low=%s" % [str(im.destroyed), str(im.hp_low)])
	chk("G3c", "immortal: head and neck are never severed", im.head_sev.is_empty(), str(im.head_sev))
	chk("G3d", "immortal: no NPC enters DEAD from overkill hits", im.died.is_empty(), str(im.died.slice(0, 6)))
	chk("G3e", "immortal: wounds are still created (gates only stop lethal / head loss)", im.wounds0.is_empty(), str(im.wounds0))
	chk("G3g", "immortal: cranium / occiput chunks survive every overkill hit (jaw / face may break)", im.vault.is_empty(), str(im.vault.slice(0, 6)))
	print("INFO|immortal overkill still severs %d limb combos (contract only protects head/neck): %s" % [im.severed.size(), str(im.severed.slice(0, 4))])
	await seconds(2.0)
	var dead_after := 0
	for i in im.n:
		var npc: Npc = im.get("npc_" + str(i), null)
		if npc and npc.get_state() == S.DEAD:
			dead_after += 1
	chk("G3f", "immortal: no NPC DEAD 2 s after overkill", dead_after == 0, "dead=%d" % dead_after)
	im.root.queue_free()
	await _gate_immortal_bleed()
	var both := await _gate_run("both", true, true, false)
	chk("G4", "immortal + no_dismemberment: nothing severed, nothing lethal", both.severed.is_empty() and both.lethal.is_empty(),
		"severed=%d lethal=%d" % [both.severed.size(), both.lethal.size()])
	both.root.queue_free()
	_restore_settings()


func _gate_immortal_bleed() -> void:
	GameSettings.immortal_dummy = true
	var root := _new_root("ImmBleed")
	var specs: Array[Dictionary] = []
	for fam in ["handgun", "rifle", "shotgun_shot", "knife_stab", "machete_slash", "knife_slash"]:
		for zk in ["neck", "head", "chest", "h_jaw"]:
			specs.append({"fam": fam, "zone": _zone(zk)})
	var npcs := _spawn_batch(specs.size(), 4, 9.0, 9.0, 2.25, root)
	_restore_settings()
	await frames(10)
	for i in specs.size():
		var sp: Dictionary = specs[i]
		sp["l"] = _new_listeners(npcs[i])
		var shot := _find_shot(npcs[i], sp.zone)
		var ga := _gun_args(sp.fam, 2) if FAMS[sp.fam].kind != "melee" else [0.0, 1.0]
		sp["ev"] = _fire(npcs[i], shot, sp.fam, _val_for(sp.fam, 2) if FAMS[sp.fam].kind == "melee" else ga[0], ga[1])
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
		var head := npc.damage.get_part(P.HEAD)
		if npc.get_state() == S.DEAD or not sp.l.lethal.is_empty() or sp.l.died != "" or frac < floor_frac \
				or lvl > BodyIds.BloodLevel.HEAVY or head.destroyed or HC.CRANIUM in head.chunks_destroyed or HC.OCCIPUT in head.chunks_destroyed:
			bad.append("%s/%s state=%s frac=%.2f lvl=%d" % [sp.fam, sp.zone.key, BodyIds.state_name(npc.get_state()), frac, lvl])
	chk("G5", "immortal: after 30 s of neck/head/jaw/chest bleeding from rifle, shotgun, handgun, knife, machete: not DEAD, volume >= HEAVY floor, brain level <= HEAVY",
		bad.is_empty(), "min volume fraction %.3f; bad=%s" % [min_frac, str(bad)])
	GameSettings.immortal_dummy = false
	var root2 := _new_root("MortalBleed")
	var npc2 := Npc.spawn(root2, Transform3D(Basis.IDENTITY, Vector3(0, 0.02, 40)), SEED)
	await frames(10)
	var z := _zone("neck")
	var shot2 := _find_shot(npc2, z)
	_fire(npc2, shot2, "handgun", 380.0)
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
	var cases: Array[Dictionary] = []
	for z in severable:
		cases.append({"zone": z})
	var npcs := _spawn_batch(cases.size(), 5, 4.0, 4.0, 0.0, root)
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

	var root2 := _new_root("Repeat2")
	var reps: Array[Dictionary] = []
	for fam in ["handgun", "rifle", "shotgun_pellet", "bat", "hammer", "knife_slash", "machete_slash"]:
		for z in _all_zones():
			reps.append({"fam": fam, "zone": z})
	var bad2: Array[String] = []
	var bi := 0
	while bi < reps.size():
		var batch := reps.slice(bi, bi + 60)
		bi += 60
		var npcs2 := _spawn_batch(batch.size(), 10, 4.0, 4.0, 0.0, root2)
		await frames(8)
		for i in batch.size():
			var sp: Dictionary = batch[i]
			var npc2 := npcs2[i]
			var l2 := _new_listeners(npc2)
			var speed: float = _val_for(sp.fam, 1) if FAMS[sp.fam].kind == "melee" else float(_gun_args(sp.fam, 2)[0])
			var dist := 1.0 if FAMS[sp.fam].kind == "melee" else float(_gun_args(sp.fam, 2)[1])
			for n in 8:
				var shot := _find_shot(npc2, sp.zone)
				if shot.is_empty():
					break
				_fire(npc2, shot, sp.fam, speed, dist)
			var p2 := npc2.damage.get_part(sp.zone.part)
			var tag := "%s/%s" % [sp.fam, sp.zone.key]
			var occurrences: int = l2.broken.filter(func(x): return x == sp.zone.part).size()
			if occurrences > 1:
				bad2.append("%s: part_broken x%d" % [tag, occurrences])
			if l2.lethal.size() > 1:
				bad2.append("%s: lethal x%d" % [tag, l2.lethal.size()])
			var dup_chunks: int = l2.chunks.size() - _unique(l2.chunks).size()
			if dup_chunks > 0:
				bad2.append("%s: a head chunk was destroyed twice (%s)" % [tag, str(l2.chunks)])
			if not is_finite(p2.hp) or p2.hp < 0.0 or p2.bruise > 1.0 + EPS or p2.bruise < 0.0:
				bad2.append("%s: hp=%.2f bruise=%.2f" % [tag, p2.hp, p2.bruise])
			for cid in p2.chunk_hp:
				if not is_finite(float(p2.chunk_hp[cid])) or float(p2.chunk_hp[cid]) < 0.0:
					bad2.append("%s: chunk hp %s" % [tag, str(p2.chunk_hp)])
			var fr := 0
			for w in npc2.wounds.get_wounds_on(sp.zone.part):
				if w.is_fracture:
					fr += 1
			if fr > 1:
				bad2.append("%s: %d fracture wounds" % [tag, fr])
		for n2 in npcs2:
			n2.queue_free()
		await frames(2)
	chk("R2", "8 repeated normal hits per weapon x part (incl. head chunks): fracture / lethal / chunk destruction reported once, HP, bruise and chunk HP in range",
		bad2.is_empty(), str(bad2.slice(0, 8)))
	root2.queue_free()
	await frames(2)


func _unique(a: Array) -> Array:
	var out: Array = []
	for x in a:
		if not (x in out):
			out.append(x)
	return out


func _row_for(part: int) -> Dictionary:
	for t in ["injury/head_neck", "injury/torso", "injury/arms", "injury/legs"]:
		var parts: Dictionary = DataDB.table(t).get("parts", {})
		if parts.has(BodyIds.key(part)):
			return parts[BodyIds.key(part)]
	return {}


# ------------------------------------------------------------------ section: data / duplicated logic

func _sec_data() -> void:
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

	var mults := {}
	for t in ["injury/head_neck", "injury/arms", "injury/legs"]:
		mults[t] = DataDB.table(t).get("high_damage_sever_mult", null)
	var uniq := {}
	for t in mults:
		uniq[str(mults[t])] = true
	chk("D2", "high_damage_sever_mult is the same in head_neck / arms / legs (it is repeated per file by design)", uniq.size() == 1, str(mults))

	var core := DataDB.table("injury/core")
	var pen := DataDB.table("injury/penetrating")
	var vocab_bad: Array[String] = []
	for t in ["bullet", "stab", "slash"]:
		if not pen.bleed.has(t):
			vocab_bad.append("penetrating.bleed." + t)
	for t in core.type_mult.keys():
		if not (t in ["bullet", "stab", "slash", "blunt"]):
			vocab_bad.append("core.type_mult." + t)
	for tn in DamageEvent.Type.keys():
		if not ai.type_pain_weight.has(String(tn).to_lower()):
			vocab_bad.append("ai.type_pain_weight." + String(tn).to_lower())
	chk("D3", "damage-type keys line up across core.json / penetrating.json / ai.json", vocab_bad.is_empty(), str(vocab_bad))

	var reg_bad: Array[String] = []
	for t in ["bullet", "stab", "slash"]:
		for r in ["head", "neck", "chest", "abdomen", "limb"]:
			if not pen.bleed[t].has(r):
				reg_bad.append("%s.%s" % [t, r])
	chk("D4", "penetrating.json has a bleed row for every type x region", reg_bad.is_empty(), str(reg_bad))

	_report_sever_reach()
	var src := FileAccess.get_file_as_string("res://scripts/ai/npc_brain.gd")
	var hn := DataDB.table("injury/head_neck")
	var causes: Array[String] = []
	for k in hn.head.lethal_causes:
		causes.append(String(hn.head.lethal_causes[k]))
	causes.append(String(hn.head.destroyed_cause))
	causes.append(String(hn.neck.decapitated_cause))
	causes.append(String(hn.chunk_rules.skull_cause))
	var idx := src.find("cause not in [")
	var stale: Array[String] = []
	var silent_list: Array[String] = []
	if idx >= 0:
		var seg := src.substr(idx, src.find("]", idx) - idx)
		var rx := RegEx.new()
		rx.compile("&\"([a-z_]+)\"")
		for m in rx.search_all(seg):
			silent_list.append(m.get_string(1))
			if not (m.get_string(1) in causes):
				stale.append(m.get_string(1))
	var unmatched: Array[String] = []
	for c in causes:
		if not (c in silent_list):
			unmatched.append(c)
	print("INFO|brain _on_lethal skips the death scream for causes %s; head/neck causes that still scream: %s" % [str(silent_list), str(unmatched)])
	chk("D5", "every cause named in npc_brain's no-scream list exists in head_neck.json (no stale / misspelled cause)", stale.is_empty(), str(stale))

	# ---- milestone 5: duplicated head-chunk / lethality data
	var hn_parts: Dictionary = hn.parts.head
	var ch: Dictionary = hn.chunks
	var dup: Array[String] = []
	for ck in ["face", "cranium", "occiput"]:
		if float(ch[ck].get("lethal_damage", 0.0)) != float(hn_parts.lethal_damage):
			dup.append("chunks.%s.lethal_damage %s != parts.head.lethal_damage %s" % [ck, ch[ck].lethal_damage, hn_parts.lethal_damage])
	chk("D6", "head lethal_damage is defined once: chunk rows (face / cranium / occiput) equal parts.head.lethal_damage", dup.is_empty(), str(dup))
	var tm: Dictionary = core.type_mult
	var tcm: Dictionary = hn.chunk_rules.type_chunk_mult
	var eff: Array[String] = []
	for t in tcm:
		eff.append("%s: core %.2f x chunk %.2f = %.3f" % [t, tm.get(t, 1.0), tcm[t], float(tm.get(t, 1.0)) * float(tcm[t])])
	print("INFO|chunk damage per type is multiplied twice (core.type_mult, then head_neck chunk_rules.type_chunk_mult): %s" % "; ".join(eff))
	var cal_ref := {}
	for cal in pen.bullet.calibers:
		cal_ref[cal] = pen.bullet.calibers[cal].ref_energy_j
	print("INFO|energy units: penetrating.json ref_energy_j %s; head_neck chunk_rules energy_scale %.3f x J => spill when >= %.0f J-equivalent (%.0f J)" % [
		str(cal_ref), float(hn.chunk_rules.energy_scale), float(hn.chunk_rules.spill_energy), float(hn.chunk_rules.spill_energy) / float(hn.chunk_rules.energy_scale)])


func _report_sever_reach() -> void:
	for wid in ["knife", "machete"]:
		var w := WeaponDefs.get_def(wid)
		var base := float(w.base_damage)
		var ref := float(w.velocity_ref)
		var mx := float(w.max_damage_scale)
		var gate := float(w.dismember_min_velocity)
		for z in _zones:
			var row := _row_for(z.part)
			var th := float(row.get("dismember", 0.0))
			if th <= 0.0 or z.key == "chest" or z.key == "abdomen" or z.key.ends_with("_r"):
				continue
			var ratio := th / base
			var v_amt := -1.0
			if ratio <= mx:
				v_amt = ref * pow(maxf(ratio, 0.0), 1.0 / float(w.damage_velocity_exponent))
			var binding := "amount" if v_amt > gate else "weapon gate"
			var need := ("%.1f m/s" % v_amt) if v_amt >= 0.0 else "unreachable (max amount %.0f)" % (base * mx)
			var eff := ("%.1f m/s" % maxf(v_amt, gate)) if v_amt >= 0.0 else "unreachable"
			print("INFO|sever reach %s %s: threshold amount %.0f -> needs %s from damage scaling, %.1f m/s from dismember_min_velocity => binding: %s (effective %s)" % [
				wid, z.key, th, need, gate, binding, eff])
