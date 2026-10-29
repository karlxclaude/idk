## Leg/foot region test (milestone 2). Run: godot --headless --path . res://tests/legs_test.tscn
## Uses real NPCs and weapon-style DamageEvents routed through Npc.apply_damage.
extends Node3D

var _fails := 0


func _check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s  %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _fresh(seed_: int = 1) -> Npc:
	var n := Npc.spawn(self, Transform3D(Basis(), Vector3.ZERO), seed_)
	n.blood.set_physics_process(false)
	return n


## Weapon-style event aimed at the centre of the given part.
func _hit(n: Npc, type: int, part: int, amount: float, pen := 0.0, dismember := false) -> DamageEvent:
	var e := DamageEvent.new()
	e.type = type
	e.part_id = part
	e.amount = amount
	e.penetration = pen
	e.can_dismember = dismember
	e.direction = Vector3(0, 0, -1)
	e.hit_normal = Vector3(0, 0, 1)
	e.hit_position = n.body.get_part_global_transform(part).origin
	e.weapon_id = &"legs_test"
	return e


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	await get_tree().physics_frame

	await _t_data()
	await _t_bullet()
	await _t_blunt()
	await _t_sever()
	await _t_legs_unchanged()
	print("LEGS TEST ", "FAILED" if _fails > 0 else "OK")
	get_tree().quit(1 if _fails > 0 else 0)


func _t_data() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	for p in [BodyIds.Part.FOOT_L, BodyIds.Part.FOOT_R]:
		var bp := n.damage.get_part(p)
		_check("0 %s has BodyPart (bone)" % BodyIds.key(p), bp != null and bp.tissue == BodyIds.Tissue.BONE and bp.max_hp > 0.0)
		_check("0 %s routes to leg region" % BodyIds.key(p),
			n.damage.region_of(_hit(n, DamageEvent.Type.BLUNT, p, 1.0)) == HitContext.REGION_LEG)
	n.queue_free()


func _t_bullet() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var wounded := []
	n.wounded.connect(func(w, _e): wounded.append(w))
	n.apply_damage(_hit(n, DamageEvent.Type.BULLET, BodyIds.Part.FOOT_L, 15.0, 0.02))
	var ws := n.wounds.get_wounds_on(BodyIds.Part.FOOT_L)
	_check("1a foot bullet creates a wound", ws.size() > 0 and wounded.size() > 0, "wounds=%d" % ws.size())
	var bleeds := false
	for w in ws:
		bleeds = bleeds or w.bleed_rate > 0.0
	_check("1b foot bullet wound bleeds", bleeds)
	_check("1c foot bullet does not sever, no lethal", not n.damage.get_part(BodyIds.Part.FOOT_L).severed)
	# a through-and-through (penetration > thickness) leaves an exit wound
	var n2 := _fresh(2)
	await get_tree().physics_frame
	var ws2 := n2.damage.apply(_hit(n2, DamageEvent.Type.BULLET, BodyIds.Part.FOOT_R, 15.0, 0.5))
	var exit := false
	for w in ws2:
		exit = exit or w.is_exit
	_check("1d overpenetrating foot bullet has exit wound", exit)
	n.queue_free(); n2.queue_free()


func _t_blunt() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var broke := []
	n.part_broken.connect(func(p): broke.append(p))
	n.apply_damage(_hit(n, DamageEvent.Type.BLUNT, BodyIds.Part.FOOT_R, 40.0))
	var bp := n.damage.get_part(BodyIds.Part.FOOT_R)
	_check("2a blunt hit fractures foot_r (broken + part_broken)", bp.broken and broke == [BodyIds.Part.FOOT_R], str(broke))
	var frac := false
	for w in n.wounds.get_wounds_on(BodyIds.Part.FOOT_R):
		frac = frac or w.is_fracture
	_check("2b fracture wound recorded", frac)
	_check("2c foot break does not break shin/thigh", not n.damage.get_part(BodyIds.Part.LOWER_LEG_R).broken
		and not n.damage.get_part(BodyIds.Part.UPPER_LEG_R).broken)
	n.apply_damage(_hit(n, DamageEvent.Type.BLUNT, BodyIds.Part.FOOT_R, 40.0))
	_check("2d part_broken emitted once", broke.size() == 1)
	# a gentle tap does not break it
	var m := _fresh(3)
	await get_tree().physics_frame
	m.apply_damage(_hit(m, DamageEvent.Type.BLUNT, BodyIds.Part.FOOT_L, 8.0))
	_check("2e light blunt tap leaves foot intact", not m.damage.get_part(BodyIds.Part.FOOT_L).broken)
	n.queue_free(); m.queue_free()


func _t_sever() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var severed := []
	n.part_severed.connect(func(pid, _r, _e): severed.append(pid))
	n.apply_damage(_hit(n, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.FOOT_L, 120.0, 0.0, true))
	_check("3a high-force slash severs foot_l", n.damage.get_part(BodyIds.Part.FOOT_L).severed and severed == [BodyIds.Part.FOOT_L], str(severed))
	_check("3b shin attached", not n.damage.get_part(BodyIds.Part.LOWER_LEG_L).severed)
	var stump: Wound = null
	for w in n.wounds.get_wounds_on(BodyIds.Part.LOWER_LEG_L):
		if w.is_stump:
			stump = w
	_check("3c stump on lower_leg_l, not arterial", stump != null and not stump.is_arterial)
	_check("3d clean cut skips fracture", not n.damage.get_part(BodyIds.Part.FOOT_L).broken)
	# without can_dismember a slash never severs
	var m := _fresh(2)
	await get_tree().physics_frame
	m.apply_damage(_hit(m, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.FOOT_R, 120.0, 0.0, false))
	_check("3e slash without can_dismember does not sever", not m.damage.get_part(BodyIds.Part.FOOT_R).severed)
	# low-force slash below threshold does not sever
	var k := _fresh(4)
	await get_tree().physics_frame
	k.apply_damage(_hit(k, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.FOOT_R, 20.0, 0.0, true))
	_check("3f weak slash below threshold does not sever", not k.damage.get_part(BodyIds.Part.FOOT_R).severed)
	n.queue_free(); m.queue_free(); k.queue_free()


func _t_legs_unchanged() -> void:
	# mirrors tests/damage_test expectations for upper/lower leg
	var n := _fresh()
	await get_tree().physics_frame
	var severed := []
	n.part_severed.connect(func(pid, _r, _e): severed.append(pid))
	var ws := n.damage.apply(_hit(n, DamageEvent.Type.BLADE_SLASH, BodyIds.Part.UPPER_LEG_L, 150.0, 0.0, true))
	_check("4a upper_leg_l severed with whole chain", n.damage.get_part(BodyIds.Part.UPPER_LEG_L).severed
		and n.damage.get_part(BodyIds.Part.LOWER_LEG_L).severed and n.damage.get_part(BodyIds.Part.FOOT_L).severed)
	_check("4b one sever notification", severed == [BodyIds.Part.UPPER_LEG_L], str(severed))
	var stump: Wound = null
	for w in ws:
		if w.is_stump:
			stump = w
	_check("4c stump on torso, arterial", stump != null and stump.part_id == BodyIds.Part.TORSO and stump.is_arterial)
	_check("4d other leg untouched", not n.damage.get_part(BodyIds.Part.UPPER_LEG_R).severed
		and not n.damage.get_part(BodyIds.Part.FOOT_R).severed)
	var late := n.damage.apply(_hit(n, DamageEvent.Type.BULLET, BodyIds.Part.LOWER_LEG_L, 30.0))
	_check("4e wound on severed shin is detached", late.size() > 0 and late[0].detached)

	var m := _fresh(2)
	await get_tree().physics_frame
	var broke := []
	m.part_broken.connect(func(p): broke.append(p))
	m.apply_damage(_hit(m, DamageEvent.Type.BLUNT, BodyIds.Part.LOWER_LEG_R, 80.0))
	_check("4f blunt breaks lower_leg_r", m.damage.get_part(BodyIds.Part.LOWER_LEG_R).broken and broke == [BodyIds.Part.LOWER_LEG_R], str(broke))
	_check("4g shin break does not break foot", not m.damage.get_part(BodyIds.Part.FOOT_R).broken)
	m.apply_damage(_hit(m, DamageEvent.Type.BLUNT, BodyIds.Part.UPPER_LEG_R, 100.0))
	_check("4h blunt breaks upper_leg_r", m.damage.get_part(BodyIds.Part.UPPER_LEG_R).broken)
	var k := _fresh(3)
	await get_tree().physics_frame
	k.apply_damage(_hit(k, DamageEvent.Type.BLUNT, BodyIds.Part.LOWER_LEG_L, 30.0))
	_check("4i moderate blunt (30) does not break shin", not k.damage.get_part(BodyIds.Part.LOWER_LEG_L).broken)
	n.queue_free(); m.queue_free(); k.queue_free()
