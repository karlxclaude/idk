## Orchestrator tool: renders the main scene under Xvfb and saves screenshots of a scripted
## scenario. Run: xvfb-run -s "-screen 0 1600x900x24" godot --path . --rendering-driver opengl3 res://tools/visual_capture.tscn
extends Node

const OUT := "res://tools/captures/"
var main: Node3D


func _ready() -> void:
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await _frames(10)
	main.player.capture_mouse(false)
	var npc: Npc = main.spawn_npc()
	await _wait(1.5)
	await _shot("01_spawned")
	var cam: Camera3D = main.player.camera
	var neck := npc.body.get_part_global_transform(BodyIds.Part.NECK).origin
	main.player.current.fire_ray(cam.global_position, (neck - cam.global_position).normalized())
	await _wait(0.4)
	await _shot("02_neck_hit")
	await _wait(3.0)
	await _shot("03_neck_bleeding")
	await _wait(12.0)
	await _shot("04_after_bleedout")
	print("corpse before npc2 ", npc.get_center())
	var npc2: Npc = main.spawn_npc()
	npc2.global_position += Vector3(1.5, 0, 0)
	await _wait(1.0)
	var arm := npc2.body.get_part_global_transform(BodyIds.Part.LOWER_ARM_L).origin
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BLADE_SLASH; ev.amount = 80; ev.can_dismember = true
	ev.part_id = BodyIds.Part.LOWER_ARM_L; ev.hit_position = arm
	ev.direction = Vector3.RIGHT; ev.impactor_velocity = Vector3.RIGHT * 8; ev.impactor_mass = 0.3
	npc2.apply_damage(ev)
	await _wait(2.5)
	print("corpse ", npc.get_center(), " npc2 ", npc2.get_center(), " ", BodyIds.state_name(npc2.get_state()))
	await _shot("05_arm_severed")
	get_tree().quit(0)


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout


func _shot(name: String) -> void:
	await RenderingServer.frame_post_draw
	var img := get_viewport().get_texture().get_image()
	img.save_png(OUT + name + ".png")
	print("captured ", name)
