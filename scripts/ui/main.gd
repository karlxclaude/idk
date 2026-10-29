## Main scene root: builds the arena, lighting, player, FX, audio, overlay and UI in code.
extends Node3D

const ARENA := 20.0

var player: Player
var gore: GoreFX
var audio: AudioCues
var overlay: DebugOverlay
var ui: GameUI
var npc_root: Node3D
var _spawn_count := 0


func _ready() -> void:
	_build_arena()
	npc_root = Node3D.new()
	npc_root.name = "Npcs"
	add_child(npc_root)
	player = Player.new()
	player.name = "Player"
	player.position = Vector3(0, 0.05, 8)
	add_child(player)
	gore = GoreFX.new(); gore.name = "GoreFX"; add_child(gore)
	audio = AudioCues.new(); audio.name = "AudioCues"; add_child(audio)
	overlay = DebugOverlay.new(); overlay.name = "DebugOverlay"; overlay.audio = audio; add_child(overlay)
	ui = GameUI.new(); ui.name = "UI"; add_child(ui)
	ui.spawn_requested.connect(spawn_npc)
	ui.clear_requested.connect(clear_all)
	player.weapon_changed.connect(func(w: Weapon): ui.set_weapon_name(w.get_weapon_name()))
	if player.current:
		ui.set_weapon_name(player.current.get_weapon_name())
	player.capture_mouse(true)


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_N:
		spawn_npc()


## Spawn an NPC about 3 m in front of the player, kept inside the arena, facing the player.
func spawn_npc() -> Npc:
	var fwd := -player.global_basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var pos := player.global_position + fwd * 3.0
	pos.x = clampf(pos.x, -ARENA + 1.5, ARENA - 1.5)
	pos.z = clampf(pos.z, -ARENA + 1.5, ARENA - 1.5)
	pos.y = 0.05
	var to_player := player.global_position - pos
	to_player.y = 0.0
	var basis := Basis.looking_at(to_player.normalized() if to_player.length() > 0.1 else Vector3.FORWARD)
	_spawn_count += 1
	return Npc.spawn(npc_root, Transform3D(basis, pos), 1000 + _spawn_count)


func clear_all() -> void:
	for n in get_tree().get_nodes_in_group(&"npc"):
		n.queue_free()
	gore.clear_all()


func _build_arena() -> void:
	var floor_body := StaticBody3D.new()
	floor_body.name = "Floor"
	floor_body.collision_layer = BodyIds.LAYER_WORLD
	floor_body.collision_mask = 0
	_add_box(floor_body, Vector3(ARENA * 2, 1, ARENA * 2), Vector3(0, -0.5, 0), Color(0.55, 0.55, 0.58))
	add_child(floor_body)
	var walls := StaticBody3D.new()
	walls.name = "Walls"
	walls.collision_layer = BodyIds.LAYER_WORLD
	walls.collision_mask = 0
	var wc := Color(0.4, 0.4, 0.45)
	_add_box(walls, Vector3(ARENA * 2, 1.2, 0.5), Vector3(0, 0.6, -ARENA), wc)
	_add_box(walls, Vector3(ARENA * 2, 1.2, 0.5), Vector3(0, 0.6, ARENA), wc)
	_add_box(walls, Vector3(0.5, 1.2, ARENA * 2), Vector3(-ARENA, 0.6, 0), wc)
	_add_box(walls, Vector3(0.5, 1.2, ARENA * 2), Vector3(ARENA, 0.6, 0), wc)
	add_child(walls)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 30, 0)
	sun.shadow_enabled = true
	add_child(sun)
	var sky := Sky.new()
	sky.sky_material = ProceduralSkyMaterial.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)


func _add_box(body: StaticBody3D, size: Vector3, pos: Vector3, color: Color) -> void:
	var col := CollisionShape3D.new()
	var shape := BoxShape3D.new()
	shape.size = size
	col.shape = shape
	col.position = pos
	body.add_child(col)
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.position = pos
	var m := StandardMaterial3D.new()
	m.albedo_color = color
	mi.material_override = m
	body.add_child(mi)
