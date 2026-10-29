## Arms/hands injury test. Run: godot --headless --path . res://tests/arms_test.tscn
extends Node3D

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


## Event built like the weapons do (world hit_position on the part, direction + normal), applied via Npc.apply_damage.
func _hit(n: Npc, type: int, part: int, amount: float, pen := 0.0, dismember := false, speed := 8.0) -> Array[Wound]:
	var ev := DamageEvent.new()
	ev.type = type
	ev.part_id = part
	ev.amount = amount
	ev.penetration = pen
	ev.can_dismember = dismember
	ev.direction = Vector3(0, 0, -1) if type != DamageEvent.Type.BLADE_SLASH else Vector3(1, 0, 0)
	ev.hit_normal = -ev.direction
	ev.impactor_velocity = ev.direction * speed
	ev.impactor_mass = 0.25
	ev.weapon_id = "test"
	ev.hit_position = n.body.get_part_global_transform(part).origin
	var out: Array[Wound] = []
	var before: int = n.wounds.get_wounds().size()
	n.apply_damage(ev)
	var all: Array = n.wounds.get_wounds()
	for i in range(before, all.size()):
		out.append(all[i])
	return out


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	await get_tree().physics_frame

	await _hand_bullet()
	await _hand_blunt()
	await _hand_slash()
	await _hand_slow_slash()
	await _arm_unchanged()
	print("ARMS TEST ", "FAILED" if _fails > 0 else "OK")
	get_tree().quit(1 if _fails > 0 else 0)


func _hand_bullet() -> void:
	for pid in [BodyIds.Part.HAND_L, BodyIds.Part.HAND_R]:
		var n := await _fresh()
		var ws := _hit(n, DamageEvent.Type.BULLET, pid, 34.0, 0.45)
		var entry := 0
		var exit_w := 0
		var ext_total := 0.0
		for w in ws:
			if w.is_exit: exit_w += 1
			elif not w.is_fracture: entry += 1
			ext_total += w.bleed_rate
		var tag := BodyIds.key(pid)
		_check("1 %s bullet: entry + exit wound" % tag, entry == 1 and exit_w == 1, "entry=%d exit=%d" % [entry, exit_w])
		# modest bleed: below the same hit on the lower arm
		var la := await _fresh()
		var la_ws := _hit(la, DamageEvent.Type.BULLET, BodyIds.Part.LOWER_ARM_L, 34.0, 0.45)
		var la_ext := 0.0
		for w in la_ws: la_ext += w.bleed_rate
		_check("1 %s bleeds less than lower arm" % tag, ext_total < la_ext and ext_total > 0.0, "hand=%.1f arm=%.1f" % [ext_total, la_ext])
		_check("1 %s not severed by bullet" % tag, not n.damage.get_part(pid).severed)
		la.queue_free(); n.queue_free()


func _hand_blunt() -> void:
	var n := await _fresh()
	var broke := []
	var stuns := []
	n.part_broken.connect(func(p): broke.append(p))
	n.stunned.connect(func(_d, c): stuns.append(c))
	_hit(n, DamageEvent.Type.BLUNT, BodyIds.Part.HAND_R, 28.0)
	_check("2a blunt fractures hand_r", n.damage.get_part(BodyIds.Part.HAND_R).broken and broke == [BodyIds.Part.HAND_R], str(broke))
	_check("2b hand fracture stuns (hand_injury)", stuns == [&"hand_injury"], str(stuns))
	_check("2c lower arm untouched", not n.damage.get_part(BodyIds.Part.LOWER_ARM_R).broken)
	var n2 := await _fresh()
	_hit(n2, DamageEvent.Type.BLUNT, BodyIds.Part.HAND_L, 3.0)
	_check("2d light tap does not fracture", not n2.damage.get_part(BodyIds.Part.HAND_L).broken)
	n.queue_free(); n2.queue_free()


func _hand_slash() -> void:
	var n := await _fresh()
	var sev := []
	n.part_severed.connect(func(pid, _r, _e): sev.append(pid))
	var ws := _hit(n, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.HAND_R, 28.0, 0.02, true, 8.0)
	_check("3a fast knife slash severs hand_r", n.damage.get_part(BodyIds.Part.HAND_R).severed)
	_check("3b one part_severed(HAND_R)", sev == [BodyIds.Part.HAND_R], str(sev))
	_check("3c lower arm still attached", not n.damage.get_part(BodyIds.Part.LOWER_ARM_R).severed)
	var stump: Wound = null
	for w in ws:
		if w.is_stump: stump = w
	_check("3d stump on lower_arm_r", stump != null and stump.part_id == BodyIds.Part.LOWER_ARM_R)
	_check("3e sever without can_dismember does not cut", not (await _slash_no_dismember()))
	n.queue_free()


func _slash_no_dismember() -> bool:
	var n := await _fresh()
	_hit(n, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.HAND_L, 28.0, 0.02, false)
	var r: bool = n.damage.get_part(BodyIds.Part.HAND_L).severed
	n.queue_free()
	return r


func _hand_slow_slash() -> void:
	var n := await _fresh()
	_hit(n, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.HAND_L, 10.0, 0.02, true, 3.0)
	_check("3f slow slash does not sever", not n.damage.get_part(BodyIds.Part.HAND_L).severed)
	n.queue_free()


## Mirrors tests/damage_test.tscn expectations plus unchanged arm sever threshold behaviour.
func _arm_unchanged() -> void:
	var n := await _fresh()
	var broke := []
	n.part_broken.connect(func(p): broke.append(p))
	_hit(n, DamageEvent.Type.BLUNT, BodyIds.Part.LOWER_ARM_R, 80.0)
	_check("4a blunt breaks lower_arm_r (damage_test 5a)", n.damage.get_part(BodyIds.Part.LOWER_ARM_R).broken and broke == [BodyIds.Part.LOWER_ARM_R])
	var sev := []
	n.part_severed.connect(func(pid, _r, _e): sev.append(pid))
	_hit(n, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.UPPER_ARM_L, 60.0, 0.02, true)
	_check("4b upper_arm_l slash sever takes whole arm incl hand", n.damage.get_part(BodyIds.Part.UPPER_ARM_L).severed
		and n.damage.get_part(BodyIds.Part.LOWER_ARM_L).severed and n.damage.get_part(BodyIds.Part.HAND_L).severed and sev == [BodyIds.Part.UPPER_ARM_L], str(sev))
	var ws := _hit(n, DamageEvent.Type.BULLET, BodyIds.Part.UPPER_ARM_R, 34.0, 0.45)
	var exits := 0
	var bleed := 0.0
	for w in ws:
		if w.is_exit: exits += 1
		bleed += w.bleed_rate
	_check("4c upper_arm_r bullet passes through, full bleed (4+10)", exits == 1 and absf(bleed - 14.0) < 0.01, "bleed=%.1f" % bleed)
	_check("4d arm tags not hand-modified", n.damage.get_part(BodyIds.Part.UPPER_ARM_R).max_hp == 60.0)
	n.queue_free()
