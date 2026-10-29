## Main scene root: builds the arena, lighting, player, FX, audio, overlay and UI in code.
extends Node3D

const ARENA := 20.0

var player: Player
var gore: GoreFX
var audio: AudioCues
var overlay: DebugOverlay
var director: GameDirector
var ui: GameUI
var npc_root: Node3D
var prop_root: Node3D
var warning: ContentWarning = null
var warning_active := false
## Tests may set these before add_child(). The notice is skipped in headless runs and when GORE_SKIP_WARNING is set.
var warning_enabled := DisplayServer.get_name() != "headless" and not OS.has_environment("GORE_SKIP_WARNING")
var warning_store := "user://settings.cfg"
var _spawn_count := 0


func _ready() -> void:
	GameSettings.set_setting(&"debug_overlay", false)  # off by default (perf); F1 toggles
	_build_arena()
	npc_root = Node3D.new()
	npc_root.name = "Npcs"
	add_child(npc_root)
	prop_root = Node3D.new()
	prop_root.name = "Props"
	add_child(prop_root)
	player = Player.new()
	player.name = "Player"
	player.position = Vector3(0, 0.05, 8)
	add_child(player)
	gore = GoreFX.new(); gore.name = "GoreFX"; add_child(gore)
	audio = AudioCues.new(); audio.name = "AudioCues"; add_child(audio)
	overlay = DebugOverlay.new(); overlay.name = "DebugOverlay"; overlay.audio = audio; add_child(overlay)
	director = GameDirector.new(); director.name = "Director"; director.gore = gore; add_child(director)
	ui = GameUI.new(); ui.name = "UI"; add_child(ui)
	ui.bind_player(player)
	ui.spawn_requested.connect(spawn_npc)
	ui.clear_requested.connect(clear_all)
	ui.spawn_n_requested.connect(spawn_npcs)
	ui.prop_requested.connect(spawn_prop)
	ui.clear_npcs_requested.connect(clear_npcs)
	ui.clear_props_requested.connect(clear_props)
	ui.clear_gore_requested.connect(clear_gore)
	ui.show_warning_again.connect(func(): ContentWarning.remember_at(warning_store, false))
	player.weapon_changed.connect(func(w: Weapon): ui.set_weapon_name(w.get_weapon_name()))
	if player.current:
		ui.set_weapon_name(player.current.get_weapon_name())
	if warning_enabled and ContentWarning.needs_show_at(warning_store):
		warning = ContentWarning.new()
		warning.store_path = warning_store
		warning_active = true
		player.input_enabled = false
		player.capture_mouse(false)
		add_child(warning)
		warning.accepted.connect(_on_warning_accepted)
	else:
		player.capture_mouse(true)


func _on_warning_accepted() -> void:
	warning_active = false
	player.input_enabled = true
	player.capture_mouse(true)


func _unhandled_input(event: InputEvent) -> void:
	if warning_active:
		return
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
	var basis := Basis.looking_at(to_player.normalized() if to_player.length() > 0.1 else Vector3.FORWARD, Vector3.UP, true)  # +Z = body front
	_spawn_count += 1
	return Npc.spawn(npc_root, Transform3D(basis, pos), 1000 + _spawn_count)


## Spawn n NPCs in an arc ring in front of the player (radius grows with n), facing the player.
func spawn_npcs(n: int) -> Array[Npc]:
	var out: Array[Npc] = []
	if n <= 1:
		out.append(spawn_npc())
		return out
	var fwd := -player.global_basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var radius := 3.0 + 0.5 * n
	var arc := deg_to_rad(110.0)
	for i in n:
		var a := lerpf(-arc * 0.5, arc * 0.5, float(i) / float(n - 1))
		var dir := fwd.rotated(Vector3.UP, a)
		var pos := player.global_position + dir * radius
		pos.x = clampf(pos.x, -ARENA + 1.5, ARENA - 1.5)
		pos.z = clampf(pos.z, -ARENA + 1.5, ARENA - 1.5)
		pos.y = 0.05
		var to_player := player.global_position - pos
		to_player.y = 0.0
		var basis := Basis.looking_at(to_player.normalized(), Vector3.UP, true)
		_spawn_count += 1
		out.append(Npc.spawn(npc_root, Transform3D(basis, pos), 1000 + _spawn_count))
	return out


## Props: RigidBody3D on the world layer so weapons hit them as world impacts.
func spawn_prop(kind: String) -> RigidBody3D:
	var fwd := -player.camera.global_basis.z
	fwd.y = 0.0
	fwd = fwd.normalized()
	var b := RigidBody3D.new()
	b.name = kind.capitalize()
	b.collision_layer = BodyIds.LAYER_WORLD
	b.collision_mask = BodyIds.LAYER_WORLD | BodyIds.LAYER_NPC_PARTS | BodyIds.LAYER_DEBRIS
	b.add_to_group(&"prop")
	b.set_meta(&"prop", kind)
	var shape: Shape3D
	var mesh: Mesh
	var col := Color(0.55, 0.38, 0.2)
	match kind:
		"barrel":
			var cs := CylinderShape3D.new(); cs.radius = 0.3; cs.height = 0.9
			var cm := CylinderMesh.new(); cm.top_radius = 0.3; cm.bottom_radius = 0.3; cm.height = 0.9
			shape = cs; mesh = cm; b.mass = 25.0; col = Color(0.2, 0.3, 0.55)
		"plank":
			var bs := BoxShape3D.new(); bs.size = Vector3(1.5, 0.08, 0.25)
			var bm := BoxMesh.new(); bm.size = bs.size
			shape = bs; mesh = bm; b.mass = 5.0; col = Color(0.7, 0.55, 0.32)
		_:
			var bs2 := BoxShape3D.new(); bs2.size = Vector3(0.6, 0.6, 0.6)
			var bm2 := BoxMesh.new(); bm2.size = bs2.size
			shape = bs2; mesh = bm2; b.mass = 15.0
	var cs3 := CollisionShape3D.new()
	cs3.shape = shape
	b.add_child(cs3)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	mi.material_override = m
	b.add_child(mi)
	prop_root.add_child(b)
	var pos := player.global_position + fwd * 2.5
	pos.x = clampf(pos.x, -ARENA + 1.0, ARENA - 1.0)
	pos.z = clampf(pos.z, -ARENA + 1.0, ARENA - 1.0)
	b.global_position = Vector3(pos.x, 1.2, pos.z)
	return b


func clear_npcs() -> void:
	for n in get_tree().get_nodes_in_group(&"npc"):
		gore.forget_npc(n)
		n.queue_free()


func clear_props() -> void:
	for p in get_tree().get_nodes_in_group(&"prop"):
		p.queue_free()


func clear_gore() -> void:
	gore.clear_all()


func clear_all() -> void:
	clear_npcs()
	clear_props()
	clear_gore()


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
