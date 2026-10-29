## fx-audio acceptance (milestone 6): body blood sim, mist, arterial spray, decal cap, audio synthesis.
## Run: godot --headless --path . res://tests/fx_test.tscn
extends Node3D

var _fails := 0


func _check(name: String, ok: bool, info := "") -> void:
	print("%s: %s %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _floor() -> void:
	var fb := StaticBody3D.new()
	fb.collision_layer = BodyIds.LAYER_WORLD
	var c := CollisionShape3D.new()
	var b := BoxShape3D.new(); b.size = Vector3(60, 1, 60)
	c.shape = b; fb.add_child(c); fb.position.y = -0.5
	add_child(fb)


func _shoot(npc: Npc, part: int, amount := 40.0, type := DamageEvent.Type.BULLET, energy := 600.0) -> void:
	var ev := DamageEvent.new()
	ev.type = type
	ev.amount = amount
	ev.part_id = part
	ev.hit_position = npc.body.get_part_global_transform(part).origin
	ev.direction = Vector3.FORWARD
	ev.impactor_velocity = Vector3.FORWARD * 380.0
	ev.impactor_mass = 0.008
	ev.penetration = 0.4
	ev.extra = {"energy": energy, "caliber": "9mm", "pellet": false}
	npc.apply_damage(ev)


func _ready() -> void:
	_floor()
	var gore := GoreFX.new()
	add_child(gore)
	await get_tree().physics_frame

	# 1+2. real NPC: wound -> set_part_blood push with stains; runs grow while bleeding upright
	var npc := Npc.spawn(self, Transform3D(Basis(), Vector3(0, 0.05, 0)), 5)
	var pushes: Array = []
	gore.part_blood_pushed.connect(func(_n, pid, w, s, r, wet): pushes.append({"t": Time.get_ticks_msec(), "pid": pid, "w": w, "s": s, "r": r, "wet": wet}))
	for i in 20:
		await get_tree().physics_frame
	var t0 := Time.get_ticks_msec()
	_shoot(npc, BodyIds.Part.TORSO, 45.0)
	while pushes.is_empty() and Time.get_ticks_msec() - t0 < 1000:
		await get_tree().physics_frame
	var first_ok: bool = not pushes.is_empty() and pushes[0].s.size() >= 1 and pushes[0].w.size() >= 1
	_check("1 wound on a real NPC -> set_part_blood push with >=1 stain within 1 s", first_ok,
		"pushes=%d stains=%d dt=%dms" % [pushes.size(), pushes[0].s.size() if first_ok else 0, Time.get_ticks_msec() - t0])
	if npc.body.has_method("set_part_blood"):
		print("INFO: NpcBody.set_part_blood present")
	await get_tree().create_timer(0.6).timeout
	var r1 := _run_sum(pushes)
	await get_tree().create_timer(2.0).timeout
	var r2 := _run_sum(pushes)
	_check("2 stain runs grow over time on a bleeding upright NPC", r2 > r1 and r2 > 0.0 and GameSettings.gore_intensity == GameSettings.Gore.HIGH,
		"run sum %.3f -> %.3f flow=%.1f" % [r1, r2, _flow(npc)])
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.LOW)
	var n_before := pushes.size()
	await get_tree().create_timer(0.8).timeout
	var low_runs := 0.0
	for i in range(n_before, pushes.size()):
		low_runs = maxf(low_runs, _sum(pushes[i].r))
	_check("2b gore LOW: body staining runs are zero", pushes.size() > n_before and low_runs == 0.0, "pushes=%d max run %.3f" % [pushes.size() - n_before, low_runs])
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.HIGH)
	npc.queue_free()

	# 3. mist
	var mw := Wound.new(); mw.part_id = BodyIds.Part.TORSO; mw.bleed_rate = 5.0; mw.severity = 0.5
	var mev := DamageEvent.new(); mev.type = DamageEvent.Type.BULLET; mev.hit_position = Vector3(0, 1, 0); mev.direction = Vector3.FORWARD
	mev.extra = {"energy": 300.0}
	GameEvents.npc_wounded.emit(null, mw, mev)
	var low_e := gore.mist_fired
	mev.extra = {"energy": 1600.0}
	GameEvents.npc_wounded.emit(null, mw, mev)
	var xw := Wound.new(); xw.part_id = BodyIds.Part.TORSO; xw.bleed_rate = 5.0; xw.severity = 0.8; xw.is_exit = true
	GameEvents.npc_wounded.emit(null, xw, mev)
	_check("3 high-energy bullet spawns mist (entry + bigger exit), low energy does not", low_e == 0 and gore.mist_fired == 2, "mist=%d" % gore.mist_fired)
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.LOW)
	GameEvents.npc_wounded.emit(null, mw, mev)
	_check("3b gore LOW: no mist", gore.mist_fired == 2)
	GameSettings.set_setting(&"gore_intensity", GameSettings.Gore.HIGH)

	# 4. arterial spray pulses with current_flow
	gore.clear_all()
	var aw := Wound.new(); aw.part_id = BodyIds.Part.NECK; aw.bleed_rate = 30.0; aw.is_arterial = true; aw.severity = 0.8; aw.current_flow = 30.0
	var aev := DamageEvent.new(); aev.hit_position = Vector3(0, 1.5, 0); aev.direction = Vector3.FORWARD
	GameEvents.npc_wounded.emit(null, aw, aev)
	var before := gore.spurts_fired
	var ratios := {}
	for beat in 6:
		aw.current_flow = 32.0
		for i in 3:
			await get_tree().physics_frame
		ratios[snappedf(gore._emitters[0].node.amount_ratio, 0.05)] = true
		aw.current_flow = 2.0
		for i in 4:
			await get_tree().physics_frame
		ratios[snappedf(gore._emitters[0].node.amount_ratio, 0.05)] = true
	_check("4 arterial spray emitter pulses with the flow", gore.spurts_fired - before >= 4 and ratios.size() >= 2,
		"spurts=%d ratios=%s" % [gore.spurts_fired - before, ratios.keys()])

	# 5. decal cap with entry/exit splatters and drips
	gore.clear_all()
	var cap := gore.decal_cap()
	for i in cap * 2:
		var w := Wound.new(); w.part_id = BodyIds.Part.TORSO; w.bleed_rate = 5.0; w.severity = 0.6; w.is_exit = (i % 2 == 0)
		var e := DamageEvent.new(); e.type = DamageEvent.Type.BULLET; e.hit_position = Vector3(randf() * 4, 0.5, 0); e.direction = Vector3.DOWN
		GameEvents.npc_wounded.emit(null, w, e)
		gore.spawn_drip(Vector3(randf() * 4, 1.0, 0))
	for i in 90:
		await get_tree().physics_frame
	_check("5 decal cap holds (splatters + drips)", gore.decal_count() <= cap and gore.decal_count() > cap / 2, "decals=%d cap=%d" % [gore.decal_count(), cap])

	# 6. audio synthesis
	var rng := RandomNumberGenerator.new()
	var bad: Array[String] = []
	for cue in AudioSynth.CUES:
		var s := AudioSynth.render(cue, rng)
		var st := AudioSynth.to_stream(s)
		if s.size() < 400 or AudioSynth.peak(s) < 0.1 or st.data.size() != s.size() * 2 or is_nan(AudioSynth.peak(s)):
			bad.append(String(cue))
	_check("6 every audio cue renders a non-silent stream", bad.is_empty(), "bad=%s" % [bad])
	var ac := AudioCues.new()
	add_child(ac)
	await get_tree().physics_frame
	for cue in AudioSynth.CUES:
		GameEvents.audio_cue.emit(null, cue, Vector3.ZERO, 1.0)
		await get_tree().create_timer(0.05).timeout
	_check("6b AudioCues plays all cues", ac.recent.size() >= 10 and ac._cache.size() >= 10, "cached=%d" % ac._cache.size())

	print("RESULT: %s (%d failures)" % ["PASS" if _fails == 0 else "FAIL", _fails])
	get_tree().quit(0 if _fails == 0 else 1)


func _sum(a: PackedFloat32Array) -> float:
	var t := 0.0
	for v in a:
		t += v
	return t


func _run_sum(pushes: Array) -> float:
	var best := 0.0
	for p in pushes:
		best = maxf(best, _sum(p.r))
	return best


func _flow(npc: Npc) -> float:
	var t := 0.0
	for w in npc.wounds.get_wounds():
		t += w.current_flow
	return t
