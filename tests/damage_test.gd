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
	await _t6()
	await _t7()
	await _t8()
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


func _sever_slash(part: int) -> DamageEvent:
	return _ev(DamageEvent.Type.BLADE_SLASH, part, 150.0, 0.0, Vector3.ZERO, true)


func _t6() -> void:
	# 6a no_dismemberment: sever-level slash does not sever, still wounds
	GameSettings.no_dismemberment = true
	var n := _fresh()
	await get_tree().physics_frame
	var ws := n.damage.apply(_sever_slash(BodyIds.Part.UPPER_LEG_L))
	_check("6a no_dismemberment: no sever, deep non-stump wound",
		not n.damage.get_part(BodyIds.Part.UPPER_LEG_L).severed and ws.size() > 0 and not ws[0].is_stump and ws[0].bleed_rate > 0.0)
	GameSettings.no_dismemberment = false
	n.queue_free()
	# 6b gore LOW implies no severing
	GameSettings.gore_intensity = GameSettings.Gore.LOW
	n = _fresh()
	await get_tree().physics_frame
	n.damage.apply(_sever_slash(BodyIds.Part.LOWER_ARM_R))
	_check("6b gore LOW: no sever", not n.damage.get_part(BodyIds.Part.LOWER_ARM_R).severed)
	var lethal := []
	n.lethal_injury.connect(func(c): lethal.append(c))
	n.damage.apply(_sever_slash(BodyIds.Part.NECK))
	_check("6c gore LOW: neck cut neither severs nor decapitates", not n.damage.get_part(BodyIds.Part.NECK).severed and lethal.is_empty())
	GameSettings.gore_intensity = GameSettings.Gore.HIGH
	n.queue_free()

	# immortal
	n = _fresh()
	await get_tree().physics_frame
	n.immortal = true
	lethal = []
	n.lethal_injury.connect(func(c): lethal.append(c))
	n.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.HEAD, 200.0, 0.5))
	var head := n.damage.get_part(BodyIds.Part.HEAD)
	_check("6d immortal head bullet: no lethal, head not destroyed", lethal.is_empty() and not head.destroyed and head.hp >= 1.0)
	n.damage.apply(_sever_slash(BodyIds.Part.NECK))
	_check("6e immortal neck sever-level slash: no sever", not n.damage.get_part(BodyIds.Part.NECK).severed and not n.damage.get_part(BodyIds.Part.HEAD).severed and lethal.is_empty())
	n.damage.apply(_sever_slash(BodyIds.Part.UPPER_LEG_R))
	_check("6f immortal: limbs still sever", n.damage.get_part(BodyIds.Part.UPPER_LEG_R).severed)
	n.queue_free()

	n = _fresh()
	await get_tree().physics_frame
	n.immortal = true
	n.blood.set_physics_process(false)
	n.damage.apply(_ev(DamageEvent.Type.BULLET, BodyIds.Part.NECK, 25.0, 0.5))
	var floor_v := (0.7 + 0.02) * n.blood.state.max_volume
	var worst_level := 0
	var min_vol := 1e9
	var flow_ok := true
	for i in 2500:  # 40 s
		n.blood.step(0.016)
		worst_level = maxi(worst_level, n.blood.state.level)
		min_vol = minf(min_vol, n.blood.state.volume)
	for w in n.wounds.get_attached_wounds():
		flow_ok = flow_ok and w.current_flow > 0.0
	_check("6g immortal neck arterial 40 s: volume >= floor, never CRITICAL, still bleeding",
		min_vol >= floor_v - 0.01 and worst_level < BodyIds.BloodLevel.CRITICAL and flow_ok,
		"min=%.0f floor=%.0f worst=%d" % [min_vol, floor_v, worst_level])
	n.queue_free()


func _t7() -> void:
	# 7a monotonic under no_dismemberment: stronger cut on a hand-like bone part fractures + bleeds >= weaker
	GameSettings.no_dismemberment = true
	var weak := _fresh(); var strong := _fresh()
	await get_tree().physics_frame
	var ww := weak.damage.apply(_ev(DamageEvent.Type.BLADE_SLASH, BodyIds.Part.LOWER_ARM_R, 40.0, 0.0, Vector3.ZERO, true))
	var sw := strong.damage.apply(_sever_slash(BodyIds.Part.LOWER_ARM_R))
	var wb := 0.0; var sb := 0.0
	for w in ww: wb += w.bleed_rate
	for w in sw: sb += w.bleed_rate
	var wbroke: bool = weak.damage.get_part(BodyIds.Part.LOWER_ARM_R).broken
	var sbroke: bool = strong.damage.get_part(BodyIds.Part.LOWER_ARM_R).broken
	_check("7a no_dismemberment: stronger cut fractures if weaker did, bleeds >=",
		(sbroke or not wbroke) and sbroke and sb >= wb, "weak broke=%s bleed=%.1f | strong broke=%s bleed=%.1f" % [wbroke, wb, sbroke, sb])
	weak.queue_free(); strong.queue_free()
	# 7b neck: dropped sever bleeds at least like a normal neck slash
	var n1 := _fresh(); var n2 := _fresh()
	await get_tree().physics_frame
	var a1 := n1.damage.apply(_ev(DamageEvent.Type.BLADE_SLASH, BodyIds.Part.NECK, 40.0, 0.0, Vector3.ZERO, true))
	var a2 := n2.damage.apply(_sever_slash(BodyIds.Part.NECK))
	_check("7b no_dismemberment: neck cut-through bleeds >= normal slash, arterial",
		a2.size() > 0 and a1.size() > 0 and a2[0].bleed_rate >= a1[0].bleed_rate and a2[0].is_arterial,
		"normal=%.1f dropped=%.1f" % [a1[0].bleed_rate, a2[0].bleed_rate])
	GameSettings.no_dismemberment = false
	n1.queue_free(); n2.queue_free()
	# 7c immortal head: lethal-level hits knock down (>= 2 s concussion stun)
	for t in [DamageEvent.Type.BULLET, DamageEvent.Type.BLADE_SLASH, DamageEvent.Type.BLADE_STAB, DamageEvent.Type.BLUNT]:
		var n := _fresh()
		await get_tree().physics_frame
		n.immortal = true
		var stuns := []
		n.stunned.connect(func(d, c): stuns.append([d, c]))
		n.damage.apply(_ev(t, BodyIds.Part.HEAD, 300.0, 0.5))
		_check("7c immortal head %s: knockdown stun" % DamageEvent.Type.keys()[t],
			stuns.size() > 0 and stuns[-1][0] >= 2.0 and stuns[-1][1] == &"concussion", str(stuns))
		n.queue_free()


func _chunk_ctx(n: Npc, chunk: int, dmg: float, destroy: Array[int]) -> HitContext:
	var ctx := HitContext.new()
	ctx.npc = n
	ctx.ev = _ev(DamageEvent.Type.BULLET, BodyIds.Part.HEAD, 10.0)
	ctx.part = n.damage.get_part(BodyIds.Part.HEAD)
	ctx.part_cfg = {}
	ctx.region = HitContext.REGION_HEAD
	ctx.chunk = chunk
	ctx.chunk_damage = dmg
	ctx.destroy_chunks = destroy
	return ctx


func _t8() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var head := n.damage.get_part(BodyIds.Part.HEAD)
	_check("8a head chunk_hp initialised for all 4 chunks", head.chunk_hp.size() == 4 and head.chunk_hp[BodyIds.HeadChunk.JAW] > 0.0, str(head.chunk_hp))
	_check("8b chunk from hit_local_normalized matches BodyIds",
		BodyIds.head_chunk_from_local(Vector3(0, -0.8, 0.5)) == BodyIds.HeadChunk.JAW)
	var got := []
	n.head_chunk_destroyed.connect(func(c, _g, _e): got.append(c))
	var jaw0: float = head.chunk_hp[BodyIds.HeadChunk.JAW]
	n.damage._commit(_chunk_ctx(n, BodyIds.HeadChunk.JAW, 5.0, [BodyIds.HeadChunk.JAW]))
	n.damage._commit(_chunk_ctx(n, BodyIds.HeadChunk.JAW, 5.0, [BodyIds.HeadChunk.JAW]))
	_check("8c jaw destroyed: head_chunk_destroyed emitted exactly once, hp reduced",
		got == [BodyIds.HeadChunk.JAW] and head.chunks_destroyed == [BodyIds.HeadChunk.JAW] and head.chunk_hp[BodyIds.HeadChunk.JAW] <= jaw0 - 5.0, str(got))
	var dbg: Dictionary = n.damage.get_debug_info()
	_check("8d debug lists chunk hp and destroyed chunks", dbg.head.has("chunk_hp") and dbg.head.chunks_destroyed == ["jaw"], str(dbg.head))
	n.queue_free()

	var im := _fresh()
	await get_tree().physics_frame
	im.immortal = true
	var ih := im.damage.get_part(BodyIds.Part.HEAD)
	var got2 := []
	im.head_chunk_destroyed.connect(func(c, _g, _e): got2.append(c))
	im.damage._commit(_chunk_ctx(im, BodyIds.HeadChunk.CRANIUM, 9999.0,
		[BodyIds.HeadChunk.CRANIUM, BodyIds.HeadChunk.OCCIPUT, BodyIds.HeadChunk.JAW]))
	_check("8e immortal: jaw may break, cranium/occiput survive with hp >= 1",
		got2 == [BodyIds.HeadChunk.JAW] and ih.chunk_hp[BodyIds.HeadChunk.CRANIUM] >= 1.0 and ih.chunk_hp[BodyIds.HeadChunk.OCCIPUT] >= 1.0
		and not ih.chunks_destroyed.has(BodyIds.HeadChunk.CRANIUM), str(got2))
	im.queue_free()
