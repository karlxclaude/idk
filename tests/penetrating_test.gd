## Ballistics realism test (bullet/stab/slash mechanisms, data/injury/penetrating.json).
## Run: godot --headless --path . res://tests/penetrating_test.tscn
## Real NPCs, weapon-style events (ev.extra caliber / pellet / energy built here, like the weapons do).
extends Node3D

const P := BodyIds.Part
const E_9MM := 577.6      # J, handgun at 380 m/s (0.5 * 0.008 * 380^2)
const E_RIFLE := 1620.0   # J, rifle reference (0.5 * 0.004 * 900^2)
const E_PELLET := 280.0   # J, 00 buck pellet reference

var _fails := 0


func _check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s  %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _fresh() -> Npc:
	var n := Npc.spawn(self, Transform3D(Basis(), Vector3.ZERO), 1)
	await get_tree().physics_frame
	n.blood.set_physics_process(false)
	return n


## Weapon-style bullet event. extra: caliber / pellet / energy (any may be absent).
func _hit(part: int, amount: float, pen: float, extra := {}, speed := 0.0, type := DamageEvent.Type.BULLET,
		norm := Vector3.ZERO) -> Dictionary:
	var n := await _fresh()
	var ev := DamageEvent.new()
	ev.type = type
	ev.part_id = part
	ev.amount = amount
	ev.penetration = pen
	ev.direction = Vector3(0, 0, -1)
	ev.hit_normal = Vector3(0, 0, 1)
	ev.impactor_velocity = ev.direction * speed
	ev.impactor_mass = 0.008
	ev.weapon_id = "test"
	ev.extra = extra.duplicate()
	ev.hit_position = n.body.get_part_global_transform(part).origin
	if norm != Vector3.ZERO:
		ev.hit_position += n.body.get_part_global_transform(part).basis * (norm * n.body.get_part_half_extents(part))
	var before: int = n.wounds.get_wounds().size()
	n.apply_damage(ev)
	var all: Array = n.wounds.get_wounds()
	var out := {"entry": null, "exit": null, "ext": 0.0, "int": 0.0, "n": 0}
	for i in range(before, all.size()):
		var w: Wound = all[i]
		if w.is_fracture:
			continue
		out.n += 1
		out.ext += w.bleed_rate
		out.int += w.internal_bleed_rate
		if w.is_exit:
			out.exit = w
		else:
			out.entry = w
	n.queue_free()
	return out


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	await get_tree().physics_frame

	await _low_vs_full()
	await _monotonic()
	await _calibers()
	await _pellets()
	await _baseline()
	await _exit_gate()
	await _stab_slash()
	print("PENETRATING TEST ", "FAILED" if _fails > 0 else "OK")
	get_tree().quit(1 if _fails > 0 else 0)


func _low_vs_full() -> void:
	var lo := await _hit(P.UPPER_LEG_L, 34.0, 0.45, {"caliber": "9mm", "energy": 40.0}, 80.0)
	var hi := await _hit(P.UPPER_LEG_L, 34.0, 0.45, {"caliber": "9mm", "energy": E_9MM}, 380.0)
	_check("1a low-energy bullet: smaller entry wound", lo.entry.severity < hi.entry.severity,
		"%.3f < %.3f" % [lo.entry.severity, hi.entry.severity])
	_check("1b low-energy bullet: less bleed", lo.ext < hi.ext, "%.2f < %.2f" % [lo.ext, hi.ext])
	_check("1c low-energy bullet: smaller exit wound", lo.exit != null and hi.exit != null and lo.exit.severity < hi.exit.severity)
	# torso: internal bleed too
	var lo_c := await _hit(P.TORSO, 34.0, 0.1, {"caliber": "9mm", "energy": 40.0}, 80.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	var hi_c := await _hit(P.TORSO, 34.0, 0.1, {"caliber": "9mm", "energy": E_9MM}, 380.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	_check("1d low-energy chest hit: less internal bleed", lo_c.int < hi_c.int, "%.2f < %.2f" % [lo_c.int, hi_c.int])
	# neck: arterial flow also scales with strength
	var lo_n := await _hit(P.NECK, 34.0, 0.5, {"caliber": "9mm", "energy": 40.0}, 80.0)
	var hi_n := await _hit(P.NECK, 34.0, 0.5, {"caliber": "9mm", "energy": E_9MM}, 380.0)
	_check("1e low-energy neck hit bleeds less", lo_n.ext < hi_n.ext, "%.1f < %.1f" % [lo_n.ext, hi_n.ext])
	# 20 m/s bullet without energy (speed fallback) must not bleed like a 380 m/s one
	var slow := await _hit(P.TORSO, 1.8, 0.1, {}, 20.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	_check("1f speed fallback: 20 m/s bleeds far less than 380 m/s", slow.int < hi_c.int * 0.2, "%.2f vs %.2f" % [slow.int, hi_c.int])


func _monotonic() -> void:
	var energies := [50.0, 150.0, 300.0, 450.0, E_9MM]
	for part in [P.UPPER_LEG_L, P.NECK, P.TORSO]:
		var prev_sev := -1.0
		var prev_ext := -1.0
		var prev_int := -1.0
		var prev_xs := -1.0
		var prev_xe := -1.0
		var ok := true
		var info := ""
		for e in energies:
			var r := await _hit(part, 34.0, 0.6, {"caliber": "9mm", "energy": e}, 0.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0) if part == P.TORSO else Vector3.ZERO)
			var xs: float = r.exit.severity if r.exit else 0.0
			var xe: float = r.exit.bleed_rate if r.exit else 0.0
			if r.entry.severity < prev_sev or r.ext < prev_ext or r.int < prev_int or xs < prev_xs or xe < prev_xe:
				ok = false
			if r.entry.severity == prev_sev and r.ext == prev_ext:
				ok = false  # must actually grow over this range
			info += "%.0fJ:sev%.2f/ext%.1f " % [e, r.entry.severity, r.ext]
			prev_sev = r.entry.severity; prev_ext = r.ext; prev_int = r.int; prev_xs = xs; prev_xe = xe
		_check("2 monotonic over 5 energies on %s" % BodyIds.key(part), ok, info)
	# same by impactor speed
	var prev := -1.0
	var ok2 := true
	for v in [60.0, 120.0, 200.0, 300.0, 380.0]:
		var r := await _hit(P.UPPER_LEG_L, 34.0, 0.0, {}, v)
		if r.ext < prev or r.entry.severity < 0.0:
			ok2 = false
		prev = r.ext
	_check("2b monotonic over 5 speeds (no energy given)", ok2)


func _calibers() -> void:
	var nine := await _hit(P.UPPER_LEG_L, 34.0, 0.6, {"caliber": "9mm", "energy": E_9MM}, 380.0)
	var rifle := await _hit(P.UPPER_LEG_L, 34.0, 0.6, {"caliber": "rifle", "energy": E_RIFLE}, 900.0)
	_check("3a rifle exit wound larger than 9mm exit", nine.exit != null and rifle.exit != null and rifle.exit.severity > nine.exit.severity,
		"%.2f > %.2f" % [rifle.exit.severity, nine.exit.severity])
	_check("3b rifle exit bleeds more than 9mm exit", rifle.exit.bleed_rate > nine.exit.bleed_rate,
		"%.1f > %.1f" % [rifle.exit.bleed_rate, nine.exit.bleed_rate])
	var nine_c := await _hit(P.TORSO, 34.0, 0.6, {"caliber": "9mm", "energy": E_9MM}, 380.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	var rifle_c := await _hit(P.TORSO, 34.0, 0.6, {"caliber": "rifle", "energy": E_RIFLE}, 900.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	_check("3c rifle chest hit bleeds internally more", rifle_c.int > nine_c.int, "%.1f > %.1f" % [rifle_c.int, nine_c.int])
	# an unknown / empty caliber falls back to the 9mm profile
	var unk := await _hit(P.UPPER_LEG_L, 34.0, 0.6, {"caliber": "", "energy": E_9MM}, 380.0)
	_check("3d empty caliber behaves like 9mm", is_equal_approx(unk.exit.severity, nine.exit.severity) and is_equal_approx(unk.ext, nine.ext))
	# a weak rifle round (spent) is smaller than the full one
	var weak := await _hit(P.UPPER_LEG_L, 34.0, 0.6, {"caliber": "rifle", "energy": 200.0}, 300.0)
	_check("3e spent rifle round makes a smaller exit", weak.exit.severity < rifle.exit.severity)


func _pellets() -> void:
	var nine := await _hit(P.TORSO, 34.0, 0.1, {"caliber": "9mm", "energy": E_9MM}, 380.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	var pel := await _hit(P.TORSO, 9.0, 0.1, {"caliber": "buckshot", "pellet": true, "energy": E_PELLET}, 400.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	_check("4a buckshot pellet makes a small wound", pel.entry.severity < 0.15 and pel.entry.severity < nine.entry.severity,
		"sev %.3f (9mm %.3f)" % [pel.entry.severity, nine.entry.severity])
	_check("4b a pellet bleeds far less than a 9mm bullet", pel.int < nine.int * 0.3 and pel.ext < nine.ext, "int %.1f vs %.1f" % [pel.int, nine.int])
	# pellet detection without a caliber name (flag only)
	var flag := await _hit(P.TORSO, 9.0, 0.1, {"pellet": true, "energy": E_PELLET}, 400.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	_check("4c pellet flag alone selects the buckshot profile", is_equal_approx(flag.entry.severity, pel.entry.severity))
	# many small wounds: one full spread (9 pellets) leaves 9 wounds on a torso, each small, and the sum clearly bleeds
	var n := await _fresh()
	var hits := 0
	for i in 9:
		var ev := DamageEvent.new()
		ev.type = DamageEvent.Type.BULLET
		ev.part_id = P.TORSO
		ev.amount = 9.0
		ev.penetration = 0.1
		ev.direction = Vector3(0, 0, -1)
		ev.hit_normal = Vector3(0, 0, 1)
		ev.extra = {"caliber": "buckshot", "pellet": i, "energy": E_PELLET}
		ev.hit_position = n.body.get_part_global_transform(P.TORSO).origin + Vector3(0.02 * (i - 4), 0.05, 0)
		n.apply_damage(ev)
		hits += 1
	var ws := n.wounds.get_wounds_on(P.TORSO)
	var small := true
	var total_int := 0.0
	for w in ws:
		small = small and w.severity < 0.15
		total_int += w.internal_bleed_rate
	_check("4d spread of 9 pellets: 9 small wounds that add up", ws.size() == 9 and small and total_int > nine.int * 0.5,
		"n=%d total_int=%.1f vs 9mm %.1f" % [ws.size(), total_int, nine.int])
	n.queue_free()


## Handgun at its normal velocity must match the pre-ballistics results (+-10%), with or without energy.
func _baseline() -> void:
	# constants from the old hard-coded rule: sev = amount*dmg_mult/60, bleed straight from the table
	var neck_old := 260.0
	var chest_int_old := 30.0
	var limb_ext_old := 4.0
	var limb_exit_old := 10.0
	for variant in ["energy", "speed", "plain"]:
		var extra := {"caliber": "9mm"}
		var speed := 0.0
		if variant == "energy":
			extra["energy"] = E_9MM
			speed = 380.0
		elif variant == "speed":
			speed = 380.0
		var nk := await _hit(P.NECK, 34.0, 0.5, extra, speed)
		var ch := await _hit(P.TORSO, 34.0, 0.1, extra, speed, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
		var lg := await _hit(P.UPPER_LEG_L, 34.0, 0.6, extra, speed)
		_check("5a baseline neck bleed (%s)" % variant, absf(nk.entry.bleed_rate / neck_old - 1.0) <= 0.1, "%.1f" % nk.entry.bleed_rate)
		_check("5b baseline chest internal bleed (%s)" % variant, absf(ch.int / chest_int_old - 1.0) <= 0.1, "%.1f" % ch.int)
		_check("5c baseline limb entry+exit bleed (%s)" % variant, absf(lg.ext / (limb_ext_old + limb_exit_old) - 1.0) <= 0.1, "%.1f" % lg.ext)
		var sev_old := clampf(34.0 * 0.8 / 60.0, 0.1, 1.0)
		_check("5d baseline limb severity (%s)" % variant, absf(lg.entry.severity / sev_old - 1.0) <= 0.1, "%.3f vs %.3f" % [lg.entry.severity, sev_old])
		_check("5e baseline exit severity (%s)" % variant, absf(lg.exit.severity / clampf(sev_old * 1.5, 0.2, 1.0) - 1.0) <= 0.1, "%.3f" % lg.exit.severity)
	# neck bleed-out time with the data-driven rule: still 10-25 s
	var n := await _fresh()
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BULLET
	ev.part_id = P.NECK
	ev.amount = 34.0
	ev.penetration = 0.5
	ev.direction = Vector3(0, 0, -1)
	ev.hit_normal = Vector3(0, 0, 1)
	ev.impactor_velocity = ev.direction * 380.0
	ev.extra = {"caliber": "9mm", "energy": E_9MM}
	ev.hit_position = n.body.get_part_global_transform(P.NECK).origin
	n.apply_damage(ev)
	var t := 0.0
	while n.blood.state.level != BodyIds.BloodLevel.FATAL and t < 120.0:
		n.blood.step(0.016)
		t += 0.016
	_check("5f neck bleed-out to FATAL in 10-25 s", t >= 10.0 and t <= 25.0, "t=%.1fs" % t)
	n.queue_free()


func _exit_gate() -> void:
	# exit wounds stay gated on ev.penetration vs thickness, however strong the bullet is
	var no := await _hit(P.UPPER_LEG_L, 60.0, 0.05, {"caliber": "rifle", "energy": 4000.0}, 900.0)
	_check("6a no exit wound when penetration < thickness (rifle, huge energy)", no.exit == null)
	var yes := await _hit(P.UPPER_LEG_L, 5.0, 0.5, {"caliber": "9mm", "energy": 30.0}, 60.0)
	_check("6b exit wound when penetration > thickness (even weak)", yes.exit != null)
	# the rule uses the penetration the weapon set; it does not change with energy
	var a := await _hit(P.TORSO, 34.0, 0.3, {"caliber": "9mm", "energy": 100.0}, 0.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	var b := await _hit(P.TORSO, 34.0, 0.3, {"caliber": "9mm", "energy": E_9MM}, 0.0, DamageEvent.Type.BULLET, Vector3(0, 0.5, 0))
	_check("6c exit presence independent of energy", (a.exit != null) == (b.exit != null), str(a.exit != null))


func _stab_slash() -> void:
	var weak := await _hit(P.UPPER_LEG_L, 6.0, 0.06, {}, 2.5, DamageEvent.Type.BLADE_STAB)
	var norm := await _hit(P.UPPER_LEG_L, 20.0, 0.06, {}, 5.0, DamageEvent.Type.BLADE_STAB)
	var fast := await _hit(P.UPPER_LEG_L, 30.0, 0.06, {}, 7.5, DamageEvent.Type.BLADE_STAB)
	_check("7a weak stab bleeds less than a normal thrust", weak.ext < norm.ext, "%.2f < %.2f" % [weak.ext, norm.ext])
	_check("7b normal thrust bleed unchanged (limb 1.5)", absf(norm.ext - 1.5) < 0.01 and fast.ext >= norm.ext, "%.2f / %.2f" % [norm.ext, fast.ext])
	var nk_weak := await _hit(P.NECK, 6.0, 0.06, {}, 2.5, DamageEvent.Type.BLADE_STAB)
	var nk_norm := await _hit(P.NECK, 20.0, 0.06, {}, 5.0, DamageEvent.Type.BLADE_STAB)
	_check("7c weak neck stab bleeds less", nk_weak.ext < nk_norm.ext)
	# slash: values from the old formula (sev = dmg/40, ext = table * clamp(0.5 + sev, 0.5, 1.5))
	var sl := await _hit(P.UPPER_LEG_L, 28.0, 0.02, {}, 7.1, DamageEvent.Type.BLADE_SLASH)
	var sev := clampf(28.0 * 0.8 * 0.8 / 40.0, 0.1, 1.0)
	var want := 6.0 * clampf(0.5 + sev, 0.5, 1.5)
	_check("7d slash severity and bleed unchanged", absf(sl.ext - want) < 0.01 and absf(sl.entry.severity - sev) < 0.01,
		"ext %.2f want %.2f, sev %.3f want %.3f" % [sl.ext, want, sl.entry.severity, sev])
