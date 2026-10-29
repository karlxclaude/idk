## weapons-fx-agent acceptance test. Run: godot --headless --path . res://tests/weapons_fx_test.tscn
extends Node3D

class FakeNpc extends Node:
	var events: Array[DamageEvent] = []
	func apply_damage(ev: DamageEvent) -> void:
		events.append(ev)

var _fails := 0
var _holder: Node3D


func _check(name: String, ok: bool, info := "") -> void:
	print("%s: %s %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _target(pos: Vector3, size: Vector3, part: int, npc: Node) -> StaticBody3D:
	var b := StaticBody3D.new()
	b.collision_layer = BodyIds.LAYER_NPC_PARTS
	var c := CollisionShape3D.new()
	var s := BoxShape3D.new(); s.size = size
	c.shape = s
	b.add_child(c)
	b.set_meta(BodyIds.META_NPC, npc)
	b.set_meta(BodyIds.META_PART_ID, part)
	b.position = pos
	add_child(b)
	return b


func _wait_swing(w: Weapon, max_frames := 240) -> void:
	for i in max_frames:
		await get_tree().physics_frame
		if not w.is_busy():
			break
	await get_tree().physics_frame


func _melee(id: String) -> MeleeWeapon:
	var w := WeaponFactory.create(WeaponDefs.get_def(id), null) as MeleeWeapon
	_holder.add_child(w)
	return w


## Swing a melee weapon with a fresh target; returns the FakeNpc's events + weapon last_event.
func _run_swing(id: String, scale_v: float, mode: StringName, tpos: Vector3, tsize: Vector3) -> Dictionary:
	var npc := FakeNpc.new(); add_child(npc)
	var t := _target(tpos, tsize, BodyIds.Part.TORSO, npc)
	var w := _melee(id)
	await get_tree().physics_frame
	await get_tree().physics_frame
	w.debug_swing(scale_v, mode)
	await _wait_swing(w)
	var out := {"events": npc.events.duplicate(), "last": w.last_event, "tip": w.tip_speed}
	w.queue_free(); t.queue_free(); npc.queue_free()
	await get_tree().physics_frame
	return out


func _ready() -> void:
	_holder = Node3D.new()
	_holder.position = Vector3(0, 5, 0)   # away from the floor/arena
	add_child(_holder)
	await get_tree().physics_frame

	# 1. data + handgun
	var defs := WeaponDefs.all()
	_check("1a weapons.json has 3 weapons", defs.size() == 3, str(defs.map(func(d): return d.id)))
	var gun := WeaponFactory.create(WeaponDefs.get_def("handgun"), null) as HitscanWeapon
	_holder.add_child(gun)
	var fnpc := FakeNpc.new(); add_child(fnpc)
	var tgt := _target(Vector3(0, 5, -10), Vector3(1, 1, 0.5), BodyIds.Part.HEAD, fnpc)
	await get_tree().physics_frame
	await get_tree().physics_frame
	var ev := gun.fire_ray(Vector3(0, 5, 0), Vector3(0, 0, -1))
	_check("1b handgun yields BULLET at tagged part", ev != null and ev.type == DamageEvent.Type.BULLET
		and ev.part_id == BodyIds.Part.HEAD and fnpc.events.size() == 1 and fnpc.events[0].amount > 0.0
		and ev.impactor_velocity.length() > 100.0, ev.describe() if ev else "miss")
	tgt.queue_free(); fnpc.queue_free(); gun.queue_free()

	# 2. knife
	var thrust := await _run_swing("knife", 1.0, &"thrust", Vector3(0.2, 4.8, -1.0), Vector3(0.3, 0.3, 0.4))
	var tev: DamageEvent = thrust.last
	_check("2a knife thrust -> BLADE_STAB", tev != null and tev.type == DamageEvent.Type.BLADE_STAB and thrust.events.size() == 1,
		tev.describe() if tev else "no hit")
	var slash := await _run_swing("knife", 1.0, &"swing", Vector3(0, 4.8, -0.7), Vector3(0.2, 0.6, 0.3))
	var sev: DamageEvent = slash.last
	_check("2b knife sideways swing -> BLADE_SLASH", sev != null and sev.type == DamageEvent.Type.BLADE_SLASH,
		sev.describe() if sev else "no hit")
	var kslow := await _run_swing("knife", 0.1, &"swing", Vector3(0, 4.8, -0.7), Vector3(0.2, 0.6, 0.3))
	var kslow_amt: float = kslow.last.amount if kslow.last else -1.0
	var kfast_amt: float = sev.amount if sev else 0.0
	_check("2c knife slow ~0, fast >> slow", kslow.last != null and kslow_amt < 1.0 and kfast_amt > 10.0 and kslow.events.is_empty(),
		"slow=%.2f fast=%.2f" % [kslow_amt, kfast_amt])

	# 3. bat
	var bpos := Vector3(0, 5.3, -1.1)
	var bsize := Vector3(1.0, 1.0, 0.6)
	var b1 := await _run_swing("bat", 1.0, &"swing", bpos, bsize)
	var b2 := await _run_swing("bat", 0.6, &"swing", bpos, bsize)
	var b3 := await _run_swing("bat", 0.1, &"swing", bpos, bsize)
	var a1: float = b1.last.amount if b1.last else -1.0
	var a2: float = b2.last.amount if b2.last else -1.0
	var a3: float = b3.last.amount if b3.last else -1.0
	_check("3 bat BLUNT, amount scales with speed", b1.last != null and b1.last.type == DamageEvent.Type.BLUNT
		and a1 > a2 and a2 > a3 and a3 < 1.0, "fast=%.1f mid=%.1f slow=%.1f" % [a1, a2, a3])
	_check("3b one hit per part per swing", b1.events.size() == 1, str(b1.events.size()))

	# 4. decal cap
	var gore := GoreFX.new()
	add_child(gore)
	await get_tree().physics_frame
	var cap := gore.max_decals
	for i in cap * 3:
		GameEvents.world_impact.emit(Vector3(randf() * 10, 0, randf() * 10), Vector3.UP, DamageEvent.new())
	await get_tree().physics_frame
	_check("4 decal cap respected", gore.decal_count() == cap and gore.get_child_count() <= cap + 20,
		"decals=%d cap=%d children=%d" % [gore.decal_count(), cap, gore.get_child_count()])
	var w := Wound.new()
	w.part_id = BodyIds.Part.TORSO; w.bleed_rate = 10.0; w.current_flow = 12.0; w.severity = 0.6
	var wev := DamageEvent.new(); wev.hit_position = Vector3(0, 1, 0); wev.direction = Vector3.FORWARD
	GameEvents.npc_wounded.emit(null, w, wev)
	for i in 5:
		await get_tree().physics_frame
	_check("4b wound emitter created and runs", gore.emitter_count() == 1)
	var ecount := gore.emitter_count()
	gore._emitters[0].node.free()
	for i in 10:
		await get_tree().physics_frame
	_check("4c freed emitter node is dropped without errors", ecount == 1 and gore.emitter_count() == 0)
	gore.queue_free()

	# 5. main scene
	var main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	for i in 5:
		await get_tree().physics_frame
	var npc = main.spawn_npc()
	for i in 10:
		await get_tree().physics_frame
	_check("5a main.tscn loads, player + 3 weapons", main.player != null and main.player.weapons.size() == 3 and is_instance_valid(npc))
	main.player.select_weapon(2)
	_check("5b weapon switch", main.player.current.weapon_id() == &"bat")
	main.overlay._t = 0.0
	await get_tree().process_frame
	await get_tree().process_frame
	_check("5c overlay describes npc", main.overlay.describe_npc(npc).begins_with("Npc"))
	main.queue_free()
	await get_tree().physics_frame

	print("RESULT: %s (%d failures)" % ["PASS" if _fails == 0 else "FAIL", _fails])
	get_tree().quit(0 if _fails == 0 else 1)
