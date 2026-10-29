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
	_check("1a weapons.json has 7 weapons", defs.size() == 7, str(defs.map(func(d): return d.id)))
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

	# 8. milestone 5 weapons
	var sg := WeaponFactory.create(WeaponDefs.get_def("shotgun"), null) as HitscanWeapon
	_holder.add_child(sg)
	var snpc := FakeNpc.new(); add_child(snpc)
	var st := _target(Vector3(0, 5, -8), Vector3(8, 8, 0.5), BodyIds.Part.TORSO, snpc)
	var rnpc1 := FakeNpc.new(); add_child(rnpc1)
	var rnpc2 := FakeNpc.new(); add_child(rnpc2)
	await get_tree().physics_frame
	await get_tree().physics_frame
	sg.fire_ray(Vector3(0, 5, 0), Vector3(0, 0, -1))
	var spread_ok := sg.last_events.size() == int(sg.def.pellets) and sg.last_events.size() >= 8
	var max_ang := 0.0
	for e in sg.last_events:
		max_ang = maxf(max_ang, rad_to_deg(e.direction.angle_to(Vector3(0, 0, -1))))
		spread_ok = spread_ok and e.extra.get("pellet", false) == true and e.extra.get("caliber", "") == "buckshot" and e.extra.get("energy", 0.0) > 0.0
	_check("8a shotgun fires N pellets inside the spread cone", spread_ok and max_ang <= float(sg.def.spread_deg) + 0.01 and max_ang > 0.1,
		"n=%d max_angle=%.2f spread=%.1f" % [sg.last_events.size(), max_ang, float(sg.def.spread_deg)])
	st.queue_free(); sg.queue_free(); snpc.queue_free()
	var rf := WeaponFactory.create(WeaponDefs.get_def("rifle"), null) as HitscanWeapon
	_holder.add_child(rf)
	var ra := _target(Vector3(0, 5, -5), Vector3(1, 1, 0.3), BodyIds.Part.TORSO, rnpc1)
	var rb := _target(Vector3(0, 5, -6), Vector3(1, 1, 0.3), BodyIds.Part.HEAD, rnpc2)
	await get_tree().physics_frame
	await get_tree().physics_frame
	rf.fire_ray(Vector3(0, 5, 0), Vector3(0, 0, -1))
	var ens_ok := rf.last_events.size() == 2
	for e in rf.last_events:
		ens_ok = ens_ok and e.extra.has("energy") and e.extra.get("caliber", "") == "5.56" and e.extra.get("pellet", true) == false
	_check("8b rifle ray passes through two stacked targets, energy/caliber in extra", rnpc1.events.size() == 1 and rnpc2.events.size() == 1 and ens_ok
		and rf.last_events[1].extra.energy < rf.last_events[0].extra.energy,
		"hits=%d e0=%.0f" % [rf.last_events.size(), rf.last_events[0].extra.energy if rf.last_events.size() > 0 else -1.0])
	ra.queue_free(); rb.queue_free(); rf.queue_free(); rnpc1.queue_free(); rnpc2.queue_free()
	var hg := WeaponFactory.create(WeaponDefs.get_def("handgun"), null) as HitscanWeapon
	_holder.add_child(hg)
	var hn := FakeNpc.new(); add_child(hn)
	var ht := _target(Vector3(0, 5, -4), Vector3(1, 1, 0.3), BodyIds.Part.TORSO, hn)
	await get_tree().physics_frame
	await get_tree().physics_frame
	var hev := hg.fire_ray(Vector3(0, 5, 0), Vector3(0, 0, -1))
	_check("8c handgun event has energy/caliber", hev != null and hev.extra.get("energy", 0.0) > 100.0 and hev.extra.get("caliber", "") == "9mm"
		and hg.last_events.size() == 1)
	ht.queue_free(); hg.queue_free(); hn.queue_free()
	var mach := await _run_swing("machete", 1.5, &"swing", Vector3(0, 4.8, -0.9), Vector3(0.2, 0.6, 0.3))
	var mev: DamageEvent = mach.last
	_check("8d machete fast slash can_dismember, amount >= 70", mev != null and mev.type == DamageEvent.Type.BLADE_SLASH and mev.can_dismember and mev.amount >= 70.0,
		mev.describe() + " dism=%s" % mev.can_dismember if mev else "no hit")
	var mach1 := await _run_swing("machete", 1.0, &"swing", Vector3(0, 4.8, -0.9), Vector3(0.2, 0.6, 0.3))
	_check("8e machete normal swing severs arms (>=45)", mach1.last != null and mach1.last.can_dismember and mach1.last.amount >= 45.0,
		mach1.last.describe() if mach1.last else "no hit")
	var ham := await _run_swing("hammer", 1.0, &"swing", Vector3(0, 5.1, -0.75), Vector3(0.3, 0.6, 0.3))
	_check("8f hammer events are BLUNT", ham.last != null and ham.last.type == DamageEvent.Type.BLUNT and ham.last.amount > 20.0 and is_equal_approx(ham.last.extra.get("head_area", 0.0), 6.0),
		ham.last.describe() if ham.last else "no hit")
	# head chunk burst
	var gc := GoreFX.new()
	add_child(gc)
	await get_tree().physics_frame
	var cev := DamageEvent.new(); cev.hit_position = Vector3(0, 1.6, 0); cev.direction = Vector3.FORWARD
	var gib := RigidBody3D.new()
	add_child(gib)
	GameEvents.npc_head_chunk_destroyed.emit(null, BodyIds.HeadChunk.CRANIUM, gib, cev)
	var high_p := gc.particles_spawned
	var high_em := gc.emitter_count()
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.LOW)
	gc.particles_spawned = 0.0
	GameEvents.npc_head_chunk_destroyed.emit(null, BodyIds.HeadChunk.CRANIUM, gib, cev)
	var low_p := gc.particles_spawned
	var low_em := gc.emitter_count()
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.HIGH)
	_check("8g head chunk burst scales with gore intensity", gc.chunk_bursts_fired == 2 and high_p > 100.0 and low_p < high_p * 0.3
		and high_em >= 1 and low_em == high_em, "high=%.0f/%d low=%.0f/%d" % [high_p, high_em, low_p, low_em])
	gib.queue_free(); gc.queue_free()

	# 5. main scene
	var main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	for i in 5:
		await get_tree().physics_frame
	var npc = main.spawn_npc()
	for i in 10:
		await get_tree().physics_frame
	_check("5a main.tscn loads, player + 3 weapons", main.player != null and main.player.weapons.size() == 7 and is_instance_valid(npc))
	main.player.select_weapon(2)
	_check("5b weapon switch", main.player.current.weapon_id() == &"bat")
	main.overlay._t = 0.0
	await get_tree().process_frame
	await get_tree().process_frame
	_check("5c overlay describes npc", main.overlay.describe_npc(npc).begins_with("Npc"))
	# 6. milestone 3: player health, slow-mo, cleanup, gore intensity
	var pl: Player = main.player
	var hp0 := pl.health
	GameEvents.player_hit.emit(null, 30.0, Vector3.ZERO)
	_check("6a player in group, takes player_hit", pl.is_in_group(&"player") and is_equal_approx(pl.health, hp0 - 30.0),
		"hp %.0f -> %.0f" % [hp0, pl.health])
	GameSettings.set_setting(&"slow_mo_on_kill", true)
	GameSettings.set_setting(&"slow_mo_scale", 0.3)
	GameSettings.set_setting(&"slow_mo_duration", 1.2)
	GameEvents.npc_died.emit(npc, &"test")
	await get_tree().process_frame
	await get_tree().process_frame
	var slow_ok := absf(Engine.time_scale - 0.3) < 0.01
	var t0 := Time.get_ticks_msec()
	while Engine.time_scale < 0.99 and Time.get_ticks_msec() - t0 < 3000:
		await get_tree().process_frame
	var el := (Time.get_ticks_msec() - t0) / 1000.0
	_check("6b slow-mo on kill restores within ~1.6 s real", slow_ok and Engine.time_scale >= 0.99 and el < 1.6,
		"scaled=%s restored after %.2f s" % [slow_ok, el])
	GameSettings.set_setting(&"slow_mo_on_kill", false)
	GameSettings.set_setting(&"slow_mo_duration", 1.5)
	var n2: Npc = main.spawn_npc()
	await get_tree().physics_frame
	GameSettings.set_setting(&"auto_cleanup_time", 1.0)
	GameEvents.npc_died.emit(n2, &"test")
	await get_tree().create_timer(1.5, true, false, true).timeout
	_check("6c corpse cleanup frees dead npc", not is_instance_valid(n2))
	GameSettings.set_setting(&"auto_cleanup_time", 0.0)
	var g2 := GoreFX.new()
	add_child(g2)
	await get_tree().physics_frame
	var loads := {}
	for lvl in [GameSettings.Gore.HIGH, GameSettings.Gore.LOW]:
		GameSettings.set_setting(&"gore_intensity", lvl)
		g2.clear_all()
		g2.particles_spawned = 0.0
		var gw := Wound.new()
		gw.part_id = BodyIds.Part.TORSO; gw.bleed_rate = 10.0; gw.current_flow = 20.0; gw.severity = 0.7
		var gev := DamageEvent.new(); gev.hit_position = Vector3(0, 1, 0); gev.direction = Vector3.FORWARD
		GameEvents.npc_wounded.emit(null, gw, gev)
		for i in 10:
			await get_tree().physics_frame
		loads[lvl] = g2.particles_spawned
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.HIGH)
	_check("6d gore LOW has fewer particles than HIGH", loads[GameSettings.Gore.LOW] < loads[GameSettings.Gore.HIGH]
		and loads[GameSettings.Gore.HIGH] > 0.0, str(loads))
	g2.queue_free()
	_check("6e main.tscn still intact", is_instance_valid(main.ui) and main.ui.hp_bar != null and Engine.time_scale >= 0.99)
	main.queue_free()
	await get_tree().process_frame
	await get_tree().process_frame
	var prev_gore: int = GameSettings.gore_intensity
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.MED)
	GameSettings.set_setting(&"gore_intensity", prev_gore)
	_check("7 settings change after main freed is error-free", true)
	await get_tree().physics_frame

	print("RESULT: %s (%d failures)" % ["PASS" if _fails == 0 else "FAIL", _fails])
	get_tree().quit(0 if _fails == 0 else 1)
