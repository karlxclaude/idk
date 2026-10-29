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
	_check("1a segments/metas/layers", ok, "mass=%.1f" % total_mass)
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
	for i in 300:
		await get_tree().physics_frame
		var tc := b2.get_center()
		for p in BodyIds.PART_COUNT:
			var pp := b2.get_part_global_transform(p).origin
			if not (is_finite(pp.x) and is_finite(pp.y) and is_finite(pp.z)):
				stable = false
			else:
				max_dist = maxf(max_dist, pp.distance_to(tc))
	var max_speed := 0.0
	for p in BodyIds.PART_COUNT:
		max_speed = maxf(max_speed, (b2.get_part_node(p) as RigidBody3D).linear_velocity.length())
	_check("3 ragdoll stable", stable and max_dist < 3.0 and max_speed < 0.5 and b2.is_ragdoll(),
		"max_dist=%.2f max_speed=%.3f" % [max_dist, max_speed])
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

	# 5. held item
	var d1 := body.drop_held_item("r")
	var d2 := body.drop_held_item("r")
	_check("5 drop_held_item true then false", d1 and not d2)
	print(body.get_debug_info())

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
	_check("6 runner past corpse does not launch it", drift < 2.0 and peak <= 25.01 and is_finite(drift),
		"drift=%.2f peak_v=%.2f runner_x=%.1f" % [drift, peak, runner.body.get_center().x])

	get_tree().quit(1 if _fails > 0 else 0)
