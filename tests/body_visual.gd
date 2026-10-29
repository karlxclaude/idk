## Visual check for the baked body (dismember-agent). Renders under Xvfb and saves PNGs to tools/captures/.
## xvfb-run -a -s "-screen 0 1280x900x24" godot --path . --rendering-driver opengl3 res://tests/body_visual.tscn
extends Node3D

const OUT := "res://tools/captures/body_"
var cam: Camera3D


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path("res://tools/captures/"))
	var fl := StaticBody3D.new()
	fl.collision_layer = BodyIds.LAYER_WORLD
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(60, 1, 60)
	col.shape = box; fl.add_child(col); fl.position.y = -0.5
	var fm := MeshInstance3D.new()
	var pm := PlaneMesh.new(); pm.size = Vector2(60, 60)
	fm.mesh = pm
	var mt := StandardMaterial3D.new(); mt.albedo_color = Color(0.35, 0.37, 0.4)
	fm.material_override = mt
	fm.position.y = 0.5
	fl.add_child(fm)
	add_child(fl)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	sun.shadow_enabled = true
	add_child(sun)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.55, 0.62, 0.7)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.7, 0.72, 0.78)
	e.ambient_light_energy = 0.6
	env.environment = e
	add_child(env)
	cam = Camera3D.new()
	cam.fov = 40
	add_child(cam)
	cam.current = true

	var npc := Npc.spawn(self, Transform3D(Basis(), Vector3(0, 0.02, 0)), 7)
	await _wait(1.0)
	_look(Vector3(0, 0.9, 3.4), Vector3(0, 0.9, 0))
	await _shot("front")
	_look(Vector3(3.4, 0.9, 0), Vector3(0, 0.9, 0))
	await _shot("side")
	_look(Vector3(-2.4, 1.2, -2.6), Vector3(0, 0.95, 0))
	await _shot("back34")
	_look(Vector3(0.9, 1.5, 1.1), Vector3(0, 1.45, 0))
	await _shot("head")
	_look(Vector3(0.6, 0.35, 1.3), Vector3(0.05, 0.1, 0.05))
	await _shot("feet")
	_look(Vector3(1.0, 0.95, 1.1), Vector3(0.3, 0.8, 0.0))
	await _shot("hand")

	# severed forearm: stump on the upper arm and cut end on the piece
	var npc2 := Npc.spawn(self, Transform3D(Basis(), Vector3(6, 0.02, 0)), 3)
	await _wait(0.5)
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BLADE_SLASH
	ev.part_id = BodyIds.Part.LOWER_ARM_L
	ev.impactor_velocity = Vector3(0, 0, 1.5)
	ev.impactor_mass = 1.0
	ev.can_dismember = true
	ev.hit_position = npc2.body.get_part_global_transform(ev.part_id).origin
	var piece := npc2.body.sever_part(BodyIds.Part.LOWER_ARM_L, ev)
	var ev2 := DamageEvent.new()
	ev2.type = DamageEvent.Type.BLADE_SLASH
	ev2.part_id = BodyIds.Part.UPPER_LEG_R
	ev2.impactor_velocity = Vector3(0, 0, 0)
	ev2.impactor_mass = 1.0
	ev2.can_dismember = true
	ev2.hit_position = npc2.body.get_part_global_transform(ev2.part_id).origin
	var leg := npc2.body.sever_part(BodyIds.Part.UPPER_LEG_R, ev2)
	await _wait(0.12)
	var stump_pos: Vector3 = npc2.body.get_part_global_transform(BodyIds.Part.UPPER_ARM_L).origin + Vector3(0, -0.15, 0)
	_look(stump_pos + Vector3(0.35, -0.55, 0.55), stump_pos)
	await _shot("sever_stump_below")
	_look(stump_pos + Vector3(0.0, 0.1, 0.9), stump_pos)
	await _shot("sever_elbow_air")
	await _wait(2.5)
	var pp := piece.global_position
	_look(pp + Vector3(0.5, 0.45, 0.5), pp)
	await _shot("sever_piece")
	var lp := leg.global_position
	_look(lp + Vector3(0.9, 0.7, 0.9), lp)
	await _shot("sever_leg_piece")
	var c := npc2.body.get_part_global_transform(BodyIds.Part.TORSO).origin
	_look(c + Vector3(1.2, -0.3, 1.5), c + Vector3(0, -0.45, 0))
	await _shot("sever_hip")
	# head chunks: one NPC without a jaw, one without the cranium, and a gib on the floor
	var evh := DamageEvent.new()
	evh.type = DamageEvent.Type.BULLET
	evh.part_id = BodyIds.Part.HEAD
	evh.direction = Vector3(0.2, 0.0, -1.0).normalized()
	evh.impactor_velocity = evh.direction * 200.0
	evh.impactor_mass = 0.008
	var npc3 := Npc.spawn(self, Transform3D(Basis(), Vector3(12, 0.02, 0)), 5)
	var npc4 := Npc.spawn(self, Transform3D(Basis(), Vector3(15, 0.02, 0)), 9)
	await _wait(0.6)
	var jgib := npc3.body.destroy_head_chunk(BodyIds.HeadChunk.JAW, evh)
	var cgib := npc4.body.destroy_head_chunk(BodyIds.HeadChunk.CRANIUM, evh)
	await _wait(0.05)
	var h3 := npc3.body.get_part_global_transform(BodyIds.Part.HEAD).origin
	_look(h3 + Vector3(0, 0.0, 0.65), h3)
	await _shot("nojaw_front")
	_look(h3 + Vector3(0.45, 0.12, 0.45), h3)
	await _shot("nojaw_34")
	var h4 := npc4.body.get_part_global_transform(BodyIds.Part.HEAD).origin
	_look(h4 + Vector3(0, 0.0, 0.65), h4)
	await _shot("nocranium_front")
	_look(h4 + Vector3(-0.4, 0.45, 0.4), h4)
	await _shot("nocranium_34")
	await _wait(2.0)
	var gp := jgib.global_position
	_look(gp + Vector3(0.25, 0.22, 0.3), gp)
	await _shot("gib_jaw")
	var gp2 := cgib.global_position
	_look(gp2 + Vector3(0.25, 0.3, 0.3), gp2)
	await _shot("gib_cranium")
	# blood rendering (static test values via NpcBody.set_part_blood)
	var bn1 := Npc.spawn(self, Transform3D(Basis(), Vector3(20, 0.02, 0)), 7)
	var bn2 := Npc.spawn(self, Transform3D(Basis(), Vector3(22, 0.02, 0)), 7)
	var bn3 := Npc.spawn(self, Transform3D(Basis(), Vector3(24, 0.02, 0)), 7)
	await _wait(0.6)
	var down := Vector3(0, -1, 0)
	bn1.body.set_part_blood(BodyIds.Part.TORSO, PackedVector4Array([Vector4(0.04, 0.12, 0.108, 0.007)]),
		PackedVector4Array([Vector4(0.04, 0.12, 0.108, 0.05), Vector4(-0.08, 0.02, 0.1, 0.035)]), PackedFloat32Array([0.26, 0.12]), down, 1.0)
	bn2.body.set_part_blood(BodyIds.Part.TORSO, PackedVector4Array([Vector4(0.04, 0.12, 0.108, 0.007)]),
		PackedVector4Array([Vector4(0.04, 0.12, 0.108, 0.05), Vector4(-0.08, 0.02, 0.1, 0.035)]), PackedFloat32Array([0.26, 0.12]), down, 0.05)
	bn3.body.set_part_blood(BodyIds.Part.LOWER_ARM_L, PackedVector4Array([Vector4(0.0, 0.03, 0.04, 0.008), Vector4(0.0, -0.05, -0.04, 0.012)]),
		PackedVector4Array([Vector4(0.0, 0.03, 0.04, 0.035)]), PackedFloat32Array([0.12]), down, 1.0)
	bn3.body.set_part_blood(BodyIds.Part.TORSO, PackedVector4Array([Vector4(-0.05, 0.05, 0.108, 0.012)]),
		PackedVector4Array([Vector4(-0.05, 0.05, 0.108, 0.07)]), PackedFloat32Array([0.18]), down, 0.8)
	await _wait(0.1)
	var t1 := bn1.body.get_part_global_transform(BodyIds.Part.TORSO).origin
	_look(t1 + Vector3(0.0, 0.08, 0.75), t1 + Vector3(0, 0.0, 0))
	await _shot("blood_fresh_torso")
	var t2 := bn2.body.get_part_global_transform(BodyIds.Part.TORSO).origin
	_look(t2 + Vector3(0.0, 0.08, 0.75), t2 + Vector3(0, 0.0, 0))
	await _shot("blood_dry_torso")
	var a3 := bn3.body.get_part_global_transform(BodyIds.Part.LOWER_ARM_L).origin
	_look(a3 + Vector3(0.15, 0.02, 0.5), a3)
	await _shot("blood_forearm_skin")
	var t3 := bn3.body.get_part_global_transform(BodyIds.Part.TORSO).origin
	_look(t3 + Vector3(0.0, 0.08, 0.75), t3)
	await _shot("blood_torso_soaked")
	get_tree().quit(0)


func _look(from: Vector3, at: Vector3) -> void:
	cam.global_position = from
	cam.look_at(at, Vector3.UP)


func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OUT + name + ".png")
	print("captured ", name)
