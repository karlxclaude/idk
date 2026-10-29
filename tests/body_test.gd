## Body acceptance test. Run: godot --headless --path . res://tests/body_test.tscn
extends Node3D

var _fails := 0


func _check(name: String, ok: bool, info := "") -> void:
	print("%s %s %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _ready() -> void:
	var fl := StaticBody3D.new()
	fl.collision_layer = BodyIds.LAYER_WORLD
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(200, 1, 200)
	col.shape = box; fl.add_child(col); fl.position.y = -0.5
	add_child(fl)
	var npc := Npc.spawn(self, Transform3D(Basis(), Vector3(0, 0.02, 0)), 7)
	await _frames(5)
	var body := npc.body

	# 1. segments
	var ok := true
	var total_mass := 0.0
	for p in BodyIds.PART_COUNT:
		var n := body.get_part_node(p) as RigidBody3D
		if n == null or not body.has_part(p):
			ok = false; continue
		total_mass += n.mass
		ok = ok and BodyIds.part_from_collider(n) == p and BodyIds.npc_from_collider(n) == npc \
			and n.collision_layer == BodyIds.LAYER_NPC_PARTS
		var h := body.get_part_half_extents(p)
		ok = ok and h.x > 0.02 and h.y > 0.03 and h.x < 0.5 and h.y < 0.5
	_check("1a 15 segments/metas/layers", ok and BodyIds.PART_COUNT == 15 and absf(total_mass - 75.0) < 1.5,
		"mass=%.1f" % total_mass)
	var foot_y := 99.0
	for f in [BodyIds.Part.FOOT_L, BodyIds.Part.FOOT_R]:
		foot_y = minf(foot_y, body.get_part_global_transform(f).origin.y)
	var head_top: float = body.get_part_global_transform(BodyIds.Part.HEAD).origin.y + body.get_part_half_extents(BodyIds.Part.HEAD).y
	_check("1a2 feet on floor, height ~1.8", foot_y < 0.08 and absf(head_top - 0.02 - 1.8) < 0.1,
		"foot_y=%.3f head_top=%.3f" % [foot_y, head_top])
	var q := PhysicsRayQueryParameters3D.create(Vector3(0, 1.3, 2), Vector3(0, 1.3, 0), BodyIds.LAYER_NPC_PARTS)
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	var hit_ok := false
	var info := "no hit"
	if hit:
		var pid := BodyIds.part_from_collider(hit.collider)
		var local: Vector3 = body.get_part_global_transform(pid).affine_inverse() * hit.position
		hit_ok = pid == BodyIds.Part.TORSO and local.z > 0.0
		info = "part=%s local=%s" % [BodyIds.key(pid), local]
	_check("1b front raycast hits torso, z>0", hit_ok, info)

	# 2. run
	var start := body.get_center()
	for i in 120:
		body.set_locomotion(Vector3(2, 0, 0), &"run")
		await get_tree().physics_frame
	var moved := body.get_center() - start
	var up: float = body.get_part_global_transform(BodyIds.Part.TORSO).basis.y.dot(Vector3.UP)
	_check("2 run moves ~4 m, upright", absf(moved.x - 4.0) < 0.9 and absf(moved.z) < 0.3 and up > 0.9 \
		and body.get_center().y > 1.0, "moved=%s up=%.2f" % [moved, up])
	body.set_locomotion(Vector3.ZERO, &"idle")
	await _frames(20)

	# poses must not crash and keep everything finite
	var pose_ok := true
	for pose in [&"walk", &"clutch", &"stagger", &"crawl", &"idle"]:
		body.set_clutch_target(BodyIds.Part.UPPER_LEG_R)
		for i in 40:
			body.set_locomotion(Vector3(0.5, 0, 0), pose)
			await get_tree().physics_frame
		var c := body.get_center()
		pose_ok = pose_ok and is_finite(c.x) and is_finite(c.y) and c.y > 0.1 and c.y < 2.0
	_check("2b poses finite", pose_ok)
	body.set_locomotion(Vector3.ZERO, &"idle")

	# 3. ragdoll stability (fresh NPC)
	var npc2 := Npc.spawn(self, Transform3D(Basis(), Vector3(10, 0.02, 0)), 3)
	await _frames(5)
	var b2 := npc2.body
	for i in 30:
		b2.set_locomotion(Vector3(0, 0, 2), &"walk")
		await get_tree().physics_frame
	b2.set_ragdoll(true)
	var stable := true
	var max_dist := 0.0
	var max_speed := 0.0
	var max_ang := 0.0
	var late_peak := 0.0  # max speed over the last 1 s: must have settled
	for i in 300:  # 5 s
		await get_tree().physics_frame
		var tc := b2.get_center()
		for p in BodyIds.PART_COUNT:
			var pp := b2.get_part_global_transform(p).origin
			var rbp := b2.get_part_node(p) as RigidBody3D
			var sp := rbp.linear_velocity.length()
			if not (is_finite(pp.x) and is_finite(pp.y) and is_finite(pp.z) and is_finite(sp)
					and is_finite(rbp.angular_velocity.length())):
				stable = false
			else:
				max_dist = maxf(max_dist, pp.distance_to(tc))
				max_speed = maxf(max_speed, sp)
				if i >= 240:
					late_peak = maxf(late_peak, sp)
					max_ang = maxf(max_ang, rbp.angular_velocity.length())
	_check("3 ragdoll stable 5 s, no NaN, no jitter", stable and max_dist < 3.0 and late_peak < 0.3 \
		and max_ang < 1.5 and b2.is_ragdoll(),
		"max_dist=%.2f peak_v=%.2f late_peak_v=%.3f late_ang=%.3f" % [max_dist, max_speed, late_peak, max_ang])
	b2.set_ragdoll(false)
	await _frames(60)
	var up2: float = b2.get_part_global_transform(BodyIds.Part.TORSO).basis.y.dot(Vector3.UP)
	_check("3b get up", not b2.is_ragdoll() and up2 > 0.9 and b2.get_center().y > 1.0, "up=%.2f y=%.2f" % [up2, b2.get_center().y])

	# 4. sever
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BLADE_SLASH
	ev.part_id = BodyIds.Part.UPPER_ARM_L
	ev.impactor_velocity = Vector3(8, 0, 0)
	ev.impactor_mass = 1.0
	ev.can_dismember = true
	ev.hit_position = body.get_part_global_transform(ev.part_id).origin
	var piece := body.sever_part(BodyIds.Part.UPPER_ARM_L, ev)
	await _frames(180)
	var lower := body.get_part_node(BodyIds.Part.LOWER_ARM_L) as RigidBody3D
	var s_ok := piece != null and not body.has_part(BodyIds.Part.UPPER_ARM_L) \
		and not body.has_part(BodyIds.Part.LOWER_ARM_L) and body.has_part(BodyIds.Part.UPPER_ARM_R)
	if s_ok:
		s_ok = piece.global_position.y < 0.35 and lower.global_position.y < 0.35 \
			and BodyIds.part_from_collider(piece) == BodyIds.Part.UPPER_ARM_L \
			and BodyIds.npc_from_collider(lower) == npc and piece.collision_layer == BodyIds.LAYER_NPC_PARTS \
			and piece.get_parent() != body
	_check("4 sever upper arm", s_ok, "piece_y=%.2f lower_y=%.2f" % [
		piece.global_position.y if piece else -1.0, lower.global_position.y if lower else -1.0])
	var still_ok := absf(body.get_center().y - 1.18) < 0.3
	_check("4b body still standing after sever", still_ok, str(body.get_center()))

	# 4b2. broken arm hangs: while running the broken left hand stays lower than the swinging right hand
	# (idle dy is only logged: both arms hang, the difference is a few cm either way)
	var npc6 := Npc.spawn(self, Transform3D(Basis(), Vector3(-60, 0.02, 0)), 6)
	await _frames(5)
	npc6.emit_part_broken(BodyIds.Part.LOWER_ARM_L)
	npc6.body.set_locomotion(Vector3.ZERO, &"idle")
	await _frames(30)
	var idle_dy: float = npc6.body.get_part_global_transform(BodyIds.Part.HAND_L).origin.y \
		- npc6.body.get_part_global_transform(BodyIds.Part.HAND_R).origin.y
	var run_dy := 0.0
	for i in 90:
		npc6.body.set_locomotion(Vector3(0, 0, 4), &"run")
		await get_tree().physics_frame
		if i >= 30:
			run_dy += npc6.body.get_part_global_transform(BodyIds.Part.HAND_L).origin.y \
				- npc6.body.get_part_global_transform(BodyIds.Part.HAND_R).origin.y
	run_dy /= 60.0
	_check("4b2 broken LOWER_ARM_L: left hand lower than right (running)", run_dy < -0.03,
		"run mean dy=%.3f idle dy=%.3f" % [run_dy, idle_dy])
	npc6.queue_free()

	# 4e. piecewise cut (hand, forearm, upper arm): every piece ends in its own Severed_* container
	var npc7 := Npc.spawn(self, Transform3D(Basis(), Vector3(-90, 0.02, 0)), 7)
	await _frames(5)
	var pieces: Array = []
	for pid in [BodyIds.Part.HAND_L, BodyIds.Part.LOWER_ARM_L, BodyIds.Part.UPPER_ARM_L]:
		var evp := DamageEvent.new()
		evp.type = DamageEvent.Type.BLADE_SLASH
		evp.part_id = pid
		evp.impactor_velocity = Vector3(2, 0, 0)
		evp.impactor_mass = 1.0
		evp.can_dismember = true
		evp.hit_position = npc7.body.get_part_global_transform(pid).origin
		pieces.append(npc7.body.sever_part(pid, evp))
		await _frames(10)
	var pc_ok := true
	var holders: Array = []
	for i in 3:
		var seg := pieces[i] as RigidBody3D
		if seg == null or not (seg.get_parent().name as String).begins_with("Severed_") \
				or holders.has(seg.get_parent()):
			pc_ok = false
		else:
			holders.append(seg.get_parent())
	# each earlier piece was not dragged into a later container
	pc_ok = pc_ok and (npc7.body.get_part_node(BodyIds.Part.HAND_L).get_parent() == pieces[0].get_parent()) \
		and (npc7.body.get_part_node(BodyIds.Part.LOWER_ARM_L).get_parent() == pieces[1].get_parent()) \
		and not npc7.body.has_part(BodyIds.Part.UPPER_ARM_L) and npc7.body.has_part(BodyIds.Part.UPPER_ARM_R)
	_check("4e piecewise sever hand -> forearm -> upper arm keeps separate containers", pc_ok)
	npc7.queue_free()

	# 4f. play_action: animated returns >= 0, ragdolled returns 0; auto_cleanup_time frees a severed hand
	var npc8 := Npc.spawn(self, Transform3D(Basis(), Vector3(-120, 0.02, 0)), 8)
	await _frames(5)
	var pa := npc8.body.play_action(&"punch")
	await _frames(10)
	var pu := npc8.body.play_action(&"no_such_action")
	npc8.body.set_ragdoll(true)
	var pr := npc8.body.play_action(&"punch")
	await _frames(5)
	_check("4f play_action animated >= 0, ragdolled 0", pa >= 0.0 and pu == 0.0 and pr == 0.0 and is_finite(pa),
		"animated=%.2f unknown=%.2f ragdoll=%.2f" % [pa, pu, pr])
	npc8.body.set_ragdoll(false)
	await _frames(5)
	var old_cleanup: float = GameSettings.auto_cleanup_time
	GameSettings.auto_cleanup_time = 1.0
	var evc := DamageEvent.new()
	evc.type = DamageEvent.Type.BLADE_SLASH
	evc.part_id = BodyIds.Part.HAND_L
	evc.impactor_velocity = Vector3(2, 0, 0)
	evc.impactor_mass = 1.0
	evc.can_dismember = true
	evc.hit_position = npc8.body.get_part_global_transform(evc.part_id).origin
	var ch := npc8.body.sever_part(BodyIds.Part.HAND_L, evc)
	GameSettings.auto_cleanup_time = old_cleanup
	var alive_early := ch != null and is_instance_valid(ch)
	var t0 := Time.get_ticks_msec()
	while is_instance_valid(ch) and Time.get_ticks_msec() - t0 < 3000:
		await get_tree().process_frame
	var freed_after := (Time.get_ticks_msec() - t0) / 1000.0
	_check("4f2 auto_cleanup_time=1 frees a severed hand within ~1.5 s", alive_early
		and freed_after < 1.5, "freed after %.2f s" % freed_after)
	npc8.queue_free()

	# 4c. sever a hand, and a lower leg takes its foot
	var evh := DamageEvent.new()
	evh.type = DamageEvent.Type.BLADE_SLASH
	evh.part_id = BodyIds.Part.HAND_L
	evh.impactor_velocity = Vector3(3, 0, 0)
	evh.impactor_mass = 1.0
	evh.can_dismember = true
	var npc5 := Npc.spawn(self, Transform3D(Basis(), Vector3(-30, 0.02, 0)), 5)
	await _frames(5)
	evh.hit_position = npc5.body.get_part_global_transform(evh.part_id).origin
	var hand := npc5.body.sever_part(BodyIds.Part.HAND_L, evh)
	_check("4c sever HAND_L returns a body", hand != null and not npc5.body.has_part(BodyIds.Part.HAND_L)
		and BodyIds.part_from_collider(hand) == BodyIds.Part.HAND_L and npc5.body.has_part(BodyIds.Part.HAND_R)
		and npc5.body.has_part(BodyIds.Part.LOWER_ARM_L))
	var evl := DamageEvent.new()
	evl.type = DamageEvent.Type.BLADE_SLASH
	evl.part_id = BodyIds.Part.LOWER_LEG_R
	evl.impactor_velocity = Vector3(-3, 0, 0)
	evl.impactor_mass = 1.0
	evl.can_dismember = true
	evl.hit_position = body.get_part_global_transform(evl.part_id).origin
	var leg := body.sever_part(BodyIds.Part.LOWER_LEG_R, evl)
	await _frames(120)
	var foot_r := body.get_part_node(BodyIds.Part.FOOT_R) as RigidBody3D
	var l_ok := leg != null and not body.has_part(BodyIds.Part.LOWER_LEG_R) and not body.has_part(BodyIds.Part.FOOT_R) \
		and body.has_part(BodyIds.Part.FOOT_L) and body.has_part(BodyIds.Part.UPPER_LEG_R)
	if l_ok:
		l_ok = foot_r.get_parent() == leg.get_parent() and foot_r.global_position.y < 0.3 \
			and BodyIds.npc_from_collider(foot_r) == npc
	_check("4d sever LOWER_LEG_R takes FOOT_R", l_ok)

	# 5. held item (in hand_r)
	var phone_in_hand := body.get_part_node(BodyIds.Part.HAND_R).get_node_or_null("Phone") != null
	var d1 := body.drop_held_item("r")
	var d2 := body.drop_held_item("r")
	await _frames(60)
	var dropped: RigidBody3D = null
	for c in get_children():
		if c is RigidBody3D and c.name == "DroppedPhone":
			dropped = c
	_check("5 phone in hand_r drops (true then false)", phone_in_hand and d1 and not d2 and dropped != null
		and dropped.global_position.y < 0.3, "y=%s" % (dropped.global_position.y if dropped else -1.0))
	# a severed HAND_R takes the phone along
	var evr := DamageEvent.new()
	evr.type = DamageEvent.Type.BLADE_SLASH
	evr.part_id = BodyIds.Part.HAND_R
	evr.impactor_velocity = Vector3(-2, 0, 0)
	evr.impactor_mass = 1.0
	evr.can_dismember = true
	evr.hit_position = npc5.body.get_part_global_transform(evr.part_id).origin
	var hr := npc5.body.sever_part(BodyIds.Part.HAND_R, evr)
	_check("5b severed HAND_R takes the phone", hr != null and hr.get_node_or_null("Phone") != null
		and not npc5.body.drop_held_item("r"))
	npc5.queue_free()
	print(body.get_debug_info())

	# 7. spawn with rotated transform: position and facing follow the Npc transform
	var yaw_ok := true
	var yinfo := ""
	var zi := 0
	for yaw in [0.0, PI * 0.5, PI, -PI * 0.5]:
		zi += 1
		var xf := Transform3D(Basis(Vector3.UP, yaw), Vector3(3 + 40 * zi, 0.02, 5))
		var rn := Npc.spawn(self, xf, 20 + zi)
		await _frames(5)
		var cen := rn.body.get_center()
		var want: Vector3 = xf.basis * Vector3.BACK
		var f0 := rn.body.get_forward()
		var good := Vector2(cen.x - xf.origin.x, cen.z - 5.0).length() < 0.1 and f0.dot(want) > 0.99
		for i in 60:
			rn.body.set_locomotion(Vector3(2, 0, 0), &"walk")
			await get_tree().physics_frame
		var f1 := rn.body.get_forward()
		good = good and f1.x > 0.9
		yinfo += " yaw%.2f:%s" % [yaw, "ok" if good else "BAD c=%s f0=%s f1=%s" % [cen, f0, f1]]
		yaw_ok = yaw_ok and good
		rn.queue_free()
	_check("7 rotated spawn position/facing", yaw_ok, yinfo)

	# 6. regression: runner passing through a corpse (and a fresh NPC spawning elsewhere) must not launch it
	for old in [npc, npc2]:
		old.queue_free()
	await _frames(3)
	# corpse lies at the world origin: bodies that first appear at the origin used to launch it
	var corpse := Npc.spawn(self, Transform3D(Basis(), Vector3(0, 0.02, 0)), 11)
	await _frames(5)
	corpse.body.set_ragdoll(true)
	await _frames(120)
	var c0 := corpse.body.get_center()
	var runner := Npc.spawn(self, Transform3D(Basis(), Vector3(-4, 0.02, 0)), 12)
	await _frames(5)
	var peak := 0.0
	for i in 150:
		runner.body.set_locomotion(Vector3(3, 0, 0.1), &"run")
		await get_tree().physics_frame
		for p in BodyIds.PART_COUNT:
			peak = maxf(peak, (corpse.body.get_part_node(p) as RigidBody3D).linear_velocity.length())
	var drift := corpse.body.get_center().distance_to(c0)
	_check("6 runner past corpse does not launch it", drift < 4.0 and peak <= 25.01 and is_finite(drift),
		"drift=%.2f peak_v=%.2f runner_x=%.1f" % [drift, peak, runner.body.get_center().x])

	get_tree().quit(1 if _fails > 0 else 0)
