## Damage/wound/bleed acceptance test. Run: godot --headless --path . res://tests/damage_test.tscn
extends Node3D

var _fails := 0
var _npcs_lethal: Dictionary = {}


func _check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s  %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _fresh() -> Npc:
	var n := Npc.spawn(self, Transform3D(Basis(), Vector3.ZERO), 1)
	return n


func _ev(type: int, part: int, amount: float, pen := 0.0, norm := Vector3.ZERO, dismember := false) -> DamageEvent:
	var e := DamageEvent.new()
	e.type = type
	e.part_id = part
	e.amount = amount
	e.penetration = pen
	e.hit_local_normalized = norm
	e.direction = Vector3(0, 0, -1)
	e.hit_normal = Vector3(0, 0, 1)
	e.can_dismember = dismember
	return e


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	await get_tree().physics_frame

	await _t1()
	await _t2()
	await _t3()
	await _t4()
	await _t5()
	print("DAMAGE TEST ", "FAILED" if _fails > 0 else "OK")
	get_tree().quit(1 if _fails > 0 else 0)


func _t1() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	n.blood.set_physics_process(false)
	var ws := n.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.NECK, 25.0, 0.5))
	var art := false
	for w in ws:
		art = art or w.is_arterial
	_check("1a neck bullet arterial wound", art)
	var t := 0.0
	while n.blood.state.level != BodyIds.BloodLevel.FATAL and t < 120.0:
		n.blood.step(0.016)
		t += 0.016
	_check("1b neck bleed-out to FATAL in 10-25 s", t >= 10.0 and t <= 25.0, "t=%.1fs" % t)
	n.queue_free()


func _t2() -> void:
	var chest := _fresh(); var abd := _fresh()
	await get_tree().physics_frame
	chest.blood.set_physics_process(false); abd.blood.set_physics_process(false)
	chest.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.TORSO, 30.0, 0.1, Vector3(0, 0.5, 0)))
	abd.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.TORSO, 30.0, 0.1, Vector3(0, -0.5, 0)))
	for i in 600:
		chest.blood.step(0.016); abd.blood.step(0.016)
	var cs := chest.blood.state
	_check("2a torso internal > external", cs.internal_rate > cs.external_rate, "int=%.1f ext=%.1f" % [cs.internal_rate, cs.external_rate])
	_check("2b chest bleeds faster than abdomen", chest.blood.state.volume < abd.blood.state.volume,
		"chest=%.0f abd=%.0f" % [chest.blood.state.volume, abd.blood.state.volume])
	chest.queue_free(); abd.queue_free()


func _t3() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var stab := n.damage.apply(_ev(DamageEvent.Type.BLADE_STAB, BodyIds.Part.TORSO, 25.0, 0.12, Vector3(0, 0.5, 0)))[0]
	var sl := n.damage.apply(_ev(DamageEvent.Type.BLADE_SLASH, BodyIds.Part.TORSO, 25.0, 0.02, Vector3(0, 0.5, 0)))[0]
	_check("3a stab: internal bleed, low external", stab.internal_bleed_rate > stab.bleed_rate and stab.internal_bleed_rate > 0.0,
		"int=%.1f ext=%.1f" % [stab.internal_bleed_rate, stab.bleed_rate])
	_check("3b slash: external bleed, no internal, direction set", sl.bleed_rate > stab.bleed_rate and sl.internal_bleed_rate == 0.0 and sl.local_direction.length() > 0.5,
		"ext=%.1f dir=%s" % [sl.bleed_rate, sl.local_direction])
	_check("3c wounds differ by type", stab.type != sl.type and stab.bleed_rate != sl.bleed_rate)
	n.queue_free()


func _t4() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var ev := _ev(DamageEvent.Type.BLADE_SLASH, BodyIds.Part.UPPER_LEG_L, 150.0, 0.0, Vector3.ZERO, true)
	var severed: Array = []
	n.part_severed.connect(func(pid, _r, _e): severed.append(pid))
	var ws := n.damage.apply(ev)
	_check("4a upper_leg_l severed", n.damage.get_part(BodyIds.Part.UPPER_LEG_L).severed)
	_check("4b lower_leg_l severed", n.damage.get_part(BodyIds.Part.LOWER_LEG_L).severed)
	_check("4c one sever notification", severed == [BodyIds.Part.UPPER_LEG_L], str(severed))
	var stump: Wound = null
	for w in ws:
		if w.is_stump: stump = w
	_check("4d stump on torso, arterial", stump != null and stump.part_id == BodyIds.Part.TORSO and stump.is_arterial)
	_check("4e other leg untouched", not n.damage.get_part(BodyIds.Part.UPPER_LEG_R).severed)
	# wounds on a severed part detach and do not bleed the NPC; hits on it never kill
	var late := n.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.LOWER_LEG_L, 30.0))
	_check("4f wound on severed part is detached", late.size() > 0 and late[0].detached)
	n.queue_free()


func _t5() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var broke := []
	n.part_broken.connect(func(p): broke.append(p))
	n.damage.apply(_ev(DamageEvent.Type.BLUNT, BodyIds.Part.LOWER_ARM_R, 80.0))
	_check("5a blunt breaks lower_arm_r", n.damage.get_part(BodyIds.Part.LOWER_ARM_R).broken and broke == [BodyIds.Part.LOWER_ARM_R])
	var stuns := []
	n.stunned.connect(func(d, c): stuns.append(c))
	n.damage.apply(_ev(DamageEvent.Type.BLUNT, BodyIds.Part.HEAD, 20.0))
	_check("5b non-lethal head blunt stuns", stuns == [&"concussion"], str(stuns))
	var lethal := []
	n.lethal_injury.connect(func(c): lethal.append(c))
	n.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.HEAD, 80.0, 0.5))
	_check("5c head bullet lethal", lethal == [&"headshot"] and n.damage.get_part(BodyIds.Part.HEAD).destroyed, str(lethal))
	n.queue_free()
