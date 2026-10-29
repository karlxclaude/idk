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
