## Orchestrator tool: a scripted "playthrough" of the real game for recording a video.
## The script drives the actual Player node (aim, weapon select, fire/swing, grab/throw) in the real main scene.
## Record (Godot Movie Maker under xvfb, then convert with ffmpeg):
##   xvfb-run -a -s "-screen 0 1280x720x24" godot --path . --rendering-driver opengl3 \
##     --write-movie out.avi --fixed-fps 30 --resolution 1280x720 res://tools/demo_playthrough.tscn
extends Node

const FPS := 30.0
const MACHETE_ARM := BodyIds.Part.UPPER_ARM_R
var main: Node3D
var player: Player
var caption: Label
var severed_piece: RigidBody3D


func _ready() -> void:
	OS.set_environment("GORE_SKIP_WARNING", "1")
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await _frames(3)
	player = main.player
	player.capture_mouse(true)
	_build_caption()
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("only="):
			only = a.substr(5)
	if only == "" or only == "A": await _scene_neck_shot()
	if only == "" or only == "B": await _scene_machete_and_throw()
	if only == "" or only == "C": await _scene_shotgun_rifle()
	if only == "" or only == "D": await _scene_hammer()
	_say("")
	await _wait(1.0)
	get_tree().quit(0)


# ---------------------------------------------------------------- scenes

func _scene_neck_shot() -> void:
	_say("Handgun: neck shot")
	_place_player(Vector3(0, 0.05, 6.0), 0.0)
	player.select_weapon(0)
	var npc := _spawn(Vector3(0, 0.05, 3.2))
	await _wait(1.2)
	await _aim(_part(npc, BodyIds.Part.NECK), 1.0)
	player.current.primary_action()
	await _track(npc, 16.0)
	_say("")
	await _wait(0.5)
	main.clear_all()
	await _wait(0.5)


func _scene_machete_and_throw() -> void:
	_say("Machete: arm slash, grab, throw")
	player.select_weapon(5)
	_place_player(Vector3(3.0, 0.05, 4.0), 0.0)
	var npc := _spawn(Vector3(3.0, 0.05, 2.0))
	_log(npc, "machete target")
	npc.part_severed.connect(func(_id, root, _ev): if root: severed_piece = root)
	await _wait(1.2)
	await _aim(_part(npc, MACHETE_ARM), 0.8)
	await _tip_on(_part(npc, MACHETE_ARM))
	player.current.debug_swing(1.0, &"swing")
	await _wait(0.4)
	await _track(npc, 3.0)
	if is_instance_valid(severed_piece):
		_say("Grab and throw the severed arm")
		await _walk_toward(severed_piece, 1.7, 1.6)
		await _aim(severed_piece.global_position, 0.6)
		var cam := player.camera
		var q := PhysicsRayQueryParameters3D.create(cam.global_position, cam.global_position - cam.global_basis.z * 3.0, 1 | 2 | 16)
		q.exclude = [player.get_rid()]
		var res := cam.get_world_3d().direct_space_state.intersect_ray(q)
		print("DEMO|ray hit=%s dist_to_piece=%.2f cam=%s fwd=%s" % [res.get("collider"), cam.global_position.distance_to(severed_piece.global_position), cam.global_position, -cam.global_basis.z])
		player.grabber.try_grab()
		print("DEMO|grab holding=%s piece=%s" % [player.grabber.is_holding(), severed_piece.global_position])
		await _wait(0.5)
		player._pitch = 0.25
		await _wait(1.5)
		player._pitch = 0.1
		await _wait(0.5)
		player.grabber.throw()
		await _wait(0.3)
		print("DEMO|thrown speed=%.1f" % severed_piece.linear_velocity.length())
		await _wait(2.2)
	await _track(npc, 4.0)
	main.clear_all()
	await _wait(0.5)


func _scene_shotgun_rifle() -> void:
	_say("Shotgun: close range")
	_place_player(Vector3(0, 0.05, 4.5), 0.0)
	player.select_weapon(4)
	var a := _spawn(Vector3(0.0, 0.05, 2.2))
	_log(a, "shotgun target")
	await _wait(1.0)
	await _aim(_part(a, BodyIds.Part.TORSO), 0.8)
	player.current.primary_action()
	await _track(a, 6.0)
	main.clear_all()
	_say("Rifle: through two targets")
	player.select_weapon(3)
	_place_player(Vector3(0, 0.05, 6.5), 0.0)
	var b := _spawn(Vector3(0, 0.05, 3.2))
	var c := _spawn(Vector3(0, 0.05, 1.6))
	_log(b, "rifle front")
	_log(c, "rifle behind")
	await _wait(1.0)
	await _aim(_part(b, BodyIds.Part.TORSO), 0.8)
	player.current.primary_action()
	await _wait(5.0)
	await _track(b, 4.0)
	main.clear_all()
	await _wait(0.5)


func _scene_hammer() -> void:
	_say("Hammer: head blow")
	player.select_weapon(6)
	_place_player(Vector3(0, 0.05, 4.5), 0.0)
	var npc := _spawn(Vector3(0, 0.05, 2.0))
	_log(npc, "hammer target")
	await _wait(1.2)
	_place_player(_stand_near(npc, 0.8), 0.0)
	await _aim(_part(npc, BodyIds.Part.HEAD), 0.9)
	player.current.debug_swing(1.2, &"swing")
	await _wait(0.4)
	await _track(npc, 6.0)
	main.clear_all()
	await _wait(0.3)


# ---------------------------------------------------------------- helpers

func _spawn(pos: Vector3) -> Npc:
	var to_player := player.global_position - pos
	to_player.y = 0.0
	var basis := Basis.looking_at(to_player.normalized(), Vector3.UP, true)
	return Npc.spawn(main.npc_root, Transform3D(basis, pos), randi())


## A spot `dist` metres in front of the NPC (toward the player's side, +Z), at floor level.
func _stand_near(npc: Npc, dist: float) -> Vector3:
	var c := npc.get_center()
	return Vector3(c.x, 0.05, c.z + dist)


## Walk the player so the held weapon's tip rests on `target` (the swing then carries through it).
func _tip_on(target: Vector3) -> void:
	for i in 5:
		var a := _aim_angles(target)
		player.rotation.y = a.x
		player._pitch = a.y
		await _frames(3)
		var d := target - player.current.get_tip_world()
		d.y = clampf(d.y, -0.1, 0.1)
		player.global_position += d
		await _frames(2)


func _log(npc: Npc, label: String) -> void:
	npc.part_severed.connect(func(id, _r, _e): print("DEMO|%s|severed %s" % [label, BodyIds.key(id)]))
	npc.head_chunk_destroyed.connect(func(ch, _g, _e): print("DEMO|%s|head chunk %s destroyed" % [label, BodyIds.head_chunk_key(ch)]))
	npc.wounded.connect(func(w, _e): print("DEMO|%s|wound %s" % [label, w.describe()]))
	npc.died.connect(func(cause): print("DEMO|%s|died %s" % [label, cause]))


func _part(npc: Npc, part: int) -> Vector3:
	return npc.body.get_part_global_transform(part).origin


func _place_player(pos: Vector3, yaw: float) -> void:
	player.global_position = pos
	player.rotation.y = yaw
	player._pitch = 0.0


func _aim_angles(p: Vector3) -> Vector2:
	var d := (p - player.camera.global_position).normalized()
	return Vector2(atan2(-d.x, -d.z), asin(clampf(d.y, -1.0, 1.0)))


func _aim(p: Vector3, secs: float) -> void:
	var n := int(secs * FPS)
	for i in n:
		var a := _aim_angles(p)
		player.rotation.y = lerp_angle(player.rotation.y, a.x, 0.18)
		player._pitch = lerpf(player._pitch, a.y, 0.18)
		await get_tree().process_frame


## Walk (smoothly) until within `dist` metres of `body`, looking at it.
func _walk_toward(body: Node3D, dist: float, secs: float) -> void:
	var n := int(secs * FPS)
	for i in n:
		var to := body.global_position - player.global_position
		to.y = 0.0
		var a := _aim_angles(body.global_position)
		player.rotation.y = lerp_angle(player.rotation.y, a.x, 0.12)
		player._pitch = lerpf(player._pitch, a.y, 0.12)
		if to.length() > dist:
			player.global_position += to.normalized() * minf(5.0 / FPS, to.length() - dist)
		await get_tree().process_frame


func _track(npc: Npc, secs: float) -> void:
	var n := int(secs * FPS)
	for i in n:
		if is_instance_valid(npc):
			var a := _aim_angles(npc.get_center())
			player.rotation.y = lerp_angle(player.rotation.y, a.x, 0.07)
			player._pitch = lerpf(player._pitch, clampf(a.y, -0.9, 0.5), 0.07)
		await get_tree().process_frame


func _wait(secs: float) -> void:
	await _frames(int(secs * FPS))


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _build_caption() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 100
	add_child(layer)
	caption = Label.new()
	caption.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	caption.grow_horizontal = Control.GROW_DIRECTION_BOTH
	caption.grow_vertical = Control.GROW_DIRECTION_BEGIN
	caption.offset_bottom = -34
	caption.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	caption.add_theme_font_size_override("font_size", 30)
	caption.add_theme_color_override("font_outline_color", Color.BLACK)
	caption.add_theme_constant_override("outline_size", 8)
	layer.add_child(caption)


func _say(text: String) -> void:
	if caption:
		caption.text = text
