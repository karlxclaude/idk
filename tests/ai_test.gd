## AI brain acceptance test. Run: godot --headless --path . res://tests/ai_test.tscn
extends Node3D

const S := BodyIds.NpcState
var failures := 0
var cues: Array = []   # [npc, cue]


func _ready() -> void:
	GameEvents.audio_cue.connect(func(n, c, _p, _i): cues.append([n, c]))
	await get_tree().physics_frame
	await _t1()
	await _t2()
	await _t3()
	await _t4()
	await _t5()
	await _t6()
	await _t7()
	await _t8()
	await _t9()
	await _t10()
	await _t11()
	await _t12()
	print("AI TEST ", "FAILED" if failures > 0 else "ALL PASSED")
	get_tree().quit(1 if failures > 0 else 0)


func _check(name: String, ok: bool, info := "") -> void:
	print(("PASS " if ok else "FAIL ") + name + (" " + info if info != "" else ""))
	if not ok:
		failures += 1


func _spawn() -> Npc:
	var n := Npc.spawn(self, Transform3D(), 7)
	return n


func _wound(part: int, sev: float, arterial := false) -> Array:
	var w := Wound.new()
	w.part_id = part
	w.severity = sev
	w.type = DamageEvent.Type.BULLET
	w.is_arterial = arterial
	var ev := DamageEvent.new()
	ev.part_id = part
	ev.direction = Vector3(1, 0, 0)
	return [w, ev]


func _reset() -> void:
	GameSettings.panic_enabled = true
	GameSettings.scream_enabled = true
	GameSettings.ragdoll_only = false
	cues.clear()


func _t1() -> void:
	_reset()
	var n := _spawn()
	var a := _wound(BodyIds.Part.TORSO, 0.4)
	n.wounded.emit(a[0], a[1])
	_check("1a panic on -> PANIC_FLEE", n.brain.state == S.PANIC_FLEE and n.get_exertion() > 0.8,
		BodyIds.state_name(n.brain.state))
	n.queue_free()
	GameSettings.panic_enabled = false
	var m := _spawn()
	var b := _wound(BodyIds.Part.TORSO, 0.4)
	m.wounded.emit(b[0], b[1])
	_check("1b panic off -> STAGGER/CLUTCH", (m.brain.state == S.STAGGER or m.brain.state == S.CLUTCH_WOUND)
		and m.get_exertion() < 0.4, BodyIds.state_name(m.brain.state))
	m.queue_free()
	await get_tree().physics_frame


func _t2() -> void:
	_reset()
	var n := _spawn()
	n.part_broken.emit(BodyIds.Part.LOWER_LEG_L)
	_check("2 broken leg -> CRAWL", n.brain.state == S.CRAWL, BodyIds.state_name(n.brain.state))
	for i in 5:
		await get_tree().physics_frame
	_check("2b crawl persists", n.brain.state == S.CRAWL)
	n.queue_free()


func _t3() -> void:
	_reset()
	var n := _spawn()
	var deaths := [0]
	n.died.connect(func(_c): deaths[0] += 1)
	n.blood_level_changed.emit(BodyIds.BloodLevel.NORMAL, BodyIds.BloodLevel.CRITICAL)
	_check("3a CRITICAL -> UNCONSCIOUS", n.brain.state == S.UNCONSCIOUS)
	n.blood_level_changed.emit(BodyIds.BloodLevel.CRITICAL, BodyIds.BloodLevel.FATAL)
	n.blood_level_changed.emit(BodyIds.BloodLevel.CRITICAL, BodyIds.BloodLevel.FATAL)
	_check("3b FATAL -> DEAD, died once", n.brain.state == S.DEAD and deaths[0] == 1, str(deaths[0]))
	n.queue_free()


func _t4() -> void:
	_reset()
	var n := _spawn()
	var deaths := [0]
	n.died.connect(func(_c): deaths[0] += 1)
	n.lethal_injury.emit(&"decapitation")
	n.lethal_injury.emit(&"decapitation")
	_check("4 lethal -> DEAD", n.brain.state == S.DEAD and deaths[0] == 1)
	n.queue_free()


func _t5() -> void:
	_reset()
	GameSettings.ragdoll_only = true
	var n := _spawn()
	var a := _wound(BodyIds.Part.TORSO, 0.9)
	n.wounded.emit(a[0], a[1])
	n.part_broken.emit(BodyIds.Part.LOWER_LEG_L)
	var held: bool = n.brain.state == S.IDLE
	n.lethal_injury.emit(&"head_destroyed")
	_check("5 ragdoll_only: no reaction, still dies", held and n.brain.state == S.DEAD)
	n.queue_free()
	GameSettings.ragdoll_only = false


func _t6() -> void:
	_reset()
	GameSettings.scream_enabled = false
	var n := _spawn()
	var a := _wound(BodyIds.Part.TORSO, 0.9)
	n.wounded.emit(a[0], a[1])
	for i in 30:
		await get_tree().physics_frame
	var screams := 0
	var grunts := 0
	for c in cues:
		if c[0] == n and c[1] == &"scream": screams += 1
		if c[0] == n and c[1] == &"grunt": grunts += 1
	_check("6 scream off -> no scream cues", screams == 0 and grunts > 0, "grunts=%d" % grunts)
	n.queue_free()
	_reset()


func _t7() -> void:
	_reset()
	var n := _spawn()
	n.brain.pain_tolerance = 1.0
	var a := _wound(BodyIds.Part.TORSO, 0.4)
	n.wounded.emit(a[0], a[1])
	var screamed := cues.any(func(c): return c[0] == n and c[1] == &"scream")
	_check("7a scream on -> scream cue", screamed)
	var m := _spawn()
	var b := _wound(BodyIds.Part.NECK, 0.8, true)
	cues.clear()
	m.wounded.emit(b[0], b[1])
	var gurgle := cues.any(func(c): return c[0] == m and c[1] == &"gurgle")
	var scr := cues.any(func(c): return c[0] == m and c[1] == &"scream")
	_check("7b neck arterial -> CLUTCH + gurgle, no scream", m.brain.state == S.CLUTCH_WOUND and gurgle and not scr)
	var k := _spawn()
	k.stunned.emit(3.0, &"concussion")
	var ko: bool = k.brain.state == S.UNCONSCIOUS
	for i in 200:
		await get_tree().physics_frame
	_check("7c knockdown wakes", ko and k.brain.state != S.UNCONSCIOUS, BodyIds.state_name(k.brain.state))
	n.queue_free(); m.queue_free(); k.queue_free()


func _pose_of(n: Npc) -> String:
	return str(n.body.get_debug_info().get("pose", ""))


func _t8() -> void:
	_reset()
	var n := _spawn()
	await get_tree().physics_frame
	var held_before: String = str(n.body.get_debug_info().get("held_item", ""))
	n.part_broken.emit(BodyIds.Part.HAND_R)
	var held_after: String = str(n.body.get_debug_info().get("held_item", ""))
	_check("8a broken HAND_R -> held item dropped", held_before != "" and held_after == "",
		"%s -> %s" % [held_before, held_after])
	var info: Dictionary = n.brain.get_debug_info()
	_check("8b one arm lost -> one_handed in debug info", info.get("one_handed") == true and info.get("usable_arms") == 1)
	n.part_broken.emit(BodyIds.Part.LOWER_ARM_L)
	_check("8c both arms lost -> not one_handed", n.brain.get_debug_info().get("one_handed") == false
		and n.brain.get_debug_info().get("usable_arms") == 0)
	_check("8d hand break does not change state", n.brain.state == S.IDLE)
	n.queue_free()
	var m := _spawn()
	await get_tree().physics_frame
	m.part_severed.emit(BodyIds.Part.HAND_R, null, null)
	_check("8e severed hand -> one_handed", m.brain.is_one_handed())
	m.queue_free()
	# hands are sensitive: same wound hurts more on a hand than on a thigh
	var h := _spawn()
	h.brain.pain_tolerance = 1.0
	var t := _spawn()
	t.brain.pain_tolerance = 1.0
	var wh := _wound(BodyIds.Part.HAND_L, 0.3)
	var wt := _wound(BodyIds.Part.UPPER_LEG_L, 0.3)
	h.wounded.emit(wh[0], wh[1])
	t.wounded.emit(wt[0], wt[1])
	_check("8f hand pain weight > thigh", h.brain.get_pain() > t.brain.get_pain(),
		"%.2f vs %.2f" % [h.brain.get_pain(), t.brain.get_pain()])
	h.queue_free(); t.queue_free()


func _t9() -> void:
	_reset()
	var n := _spawn()
	n.part_broken.emit(BodyIds.Part.FOOT_L)
	var a := _wound(BodyIds.Part.TORSO, 0.4)
	n.wounded.emit(a[0], a[1])
	for i in 3:
		await get_tree().physics_frame
	var st: int = n.brain.state
	_check("9a broken FOOT_L, fleeing -> PANIC_FLEE (not CRAWL)", st == S.PANIC_FLEE, BodyIds.state_name(st))
	_check("9b fleeing pose is limp, not run", _pose_of(n) == "limp", _pose_of(n))
	_check("9c limp_side == l", n.brain.get_limp_side() == "l" and n.brain.get_debug_info().get("limp_side") == "l")
	_check("9d exertion stays high", n.get_exertion() > 0.8)
	var fast := float(DataDB.table("ai").get("speeds", {}).get("run", 4.5))
	_check("9e limp speed reduced", float(DataDB.table("ai").get("limp_speed", fast)) < fast)
	n.queue_free()
	var m := _spawn()
	_check("9f no injury -> no limp side", m.brain.get_limp_side() == "")
	var w := _wound(BodyIds.Part.FOOT_R, 0.5)
	m.wounded.emit(w[0], w[1])
	_check("9g wounded FOOT_R -> limp_side r", m.brain.get_limp_side() == "r")
	for i in 3:
		await get_tree().physics_frame
	_check("9h wounded foot flee uses limp", m.brain.state == S.PANIC_FLEE and _pose_of(m) == "limp", _pose_of(m))
	m.queue_free()


func _t10() -> void:
	_reset()
	var n := _spawn()
	n.part_broken.emit(BodyIds.Part.LOWER_LEG_L)
	for i in 3:
		await get_tree().physics_frame
	_check("10 broken LOWER_LEG_L -> CRAWL, pose crawl", n.brain.state == S.CRAWL and _pose_of(n) == "crawl",
		"%s %s" % [BodyIds.state_name(n.brain.state), _pose_of(n)])
	n.queue_free()
	var m := _spawn()
	m.part_broken.emit(BodyIds.Part.UPPER_LEG_R)
	_check("10b broken UPPER_LEG_R -> CRAWL", m.brain.state == S.CRAWL)
	m.queue_free()


func _t11() -> void:
	_reset()
	var n := _spawn()
	n.part_severed.emit(BodyIds.Part.FOOT_R, null, null)
	_check("11 severed FOOT_R -> CRAWL", n.brain.state == S.CRAWL, BodyIds.state_name(n.brain.state))
	n.queue_free()
	# vocal cues unchanged: one grunt per DamageEvent even with hand/foot wounds
	_reset()
	var m := _spawn()
	var a := _wound(BodyIds.Part.HAND_R, 0.6)
	cues.clear()
	m.wounded.emit(a[0], a[1])
	m.wounded.emit(a[0], a[1])
	var grunts := cues.filter(func(c): return c[0] == m and c[1] == &"grunt").size()
	_check("11b one grunt per DamageEvent", grunts == 1, str(grunts))
	m.queue_free()


func _t12() -> void:
	_reset()
	# F2: a wound on a severed (detached) piece must not hurt the living NPC
	var n := _spawn()
	var a := _wound(BodyIds.Part.LOWER_ARM_L, 0.9)
	a[0].detached = true
	cues.clear()
	n.wounded.emit(a[0], a[1])
	_check("12a detached wound: no pain, no cues, no reaction",
		n.brain.get_pain() == 0.0 and cues.is_empty() and n.brain.state == S.IDLE,
		"pain=%.2f cues=%d %s" % [n.brain.get_pain(), cues.size(), BodyIds.state_name(n.brain.state)])
	n.queue_free()
	# F6: chest shot clutches the entry wound (front), not the stronger exit wound on the back
	var m := _spawn()
	var entry := Wound.new()
	entry.part_id = BodyIds.Part.TORSO
	entry.severity = 0.7
	entry.local_normal = Vector3(0, 0, 1)
	entry.local_position = Vector3(0, 0.1, 0.1)
	var exit := Wound.new()
	exit.part_id = BodyIds.Part.TORSO
	exit.severity = 1.05
	exit.is_exit = true
	exit.local_normal = Vector3(0, 0, -1)
	exit.local_position = Vector3(0, 0.1, -0.1)
	m.wounds.add_wound(entry)
	m.wounds.add_wound(exit)
	var ev := DamageEvent.new()
	ev.part_id = BodyIds.Part.TORSO
	ev.direction = Vector3(1, 0, 0)
	m.wounded.emit(entry, ev)
	m.wounded.emit(exit, ev)
	var cw = m.body._pose_driver._wound if m.body.get("_pose_driver") != null else null
	_check("12b clutch picks entry wound over exit", m.brain.state == S.CLUTCH_WOUND and cw != null
		and cw.get("n", Vector3.ZERO).z > 0.0, str(cw))
	m.queue_free()
