## First-person player: WASD + mouse look, jump, keys 1/2/3 pick weapons (by slot order in
## weapons.json), LMB primary, RMB secondary, Shift = free swing (mouse drives the weapon), Esc frees mouse.
class_name Player
extends CharacterBody3D

signal weapon_changed(weapon: Weapon)
signal health_changed(hp: float, max_hp: float)
signal damaged(amount: float)
## Health hit 0: UI fades to black over `duration`, health is restored when the fade is done.
signal fainted(duration: float)
signal revived

const SPEED := 5.0
const JUMP := 4.5
const SENS := 0.0025

var camera: Camera3D
var hand: Node3D
var weapons: Array[Weapon] = []
var current: Weapon = null
var _pitch := 0.0
var _free_swing := false
var input_enabled := true      # false while the content warning is up
var grabber: Grabber
var cfg: Dictionary = {}
var max_health := 100.0
var health := 100.0
var _since_hit := 0.0
var _kick := 0.0
var _faint_left := 0.0
var _start_pos := Vector3.ZERO


func _ready() -> void:
	add_to_group(&"player")
	cfg = DataDB.table("weapons").get("player", {})
	max_health = float(cfg.get("max_health", 100.0))
	health = max_health
	_start_pos = position
	GameEvents.player_hit.connect(_on_player_hit)
	collision_layer = BodyIds.LAYER_PLAYER
	collision_mask = BodyIds.LAYER_WORLD
	var col := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.35
	cap.height = 1.8
	col.shape = cap
	col.position.y = 0.9
	add_child(col)
	camera = Camera3D.new()
	camera.name = "Camera"
	camera.position.y = 1.6
	camera.current = true
	add_child(camera)
	grabber = Grabber.new()
	grabber.name = "Grabber"
	add_child(grabber)
	grabber.setup(camera, self)
	hand = Node3D.new()
	hand.name = "Hand"
	camera.add_child(hand)
	for d in WeaponDefs.all():
		var w := WeaponFactory.create(d, self)
		if w == null:
			continue
		w.aim_node = camera
		hand.add_child(w)
		w.set_equipped(false)
		weapons.append(w)
	if weapons.size() > 0:
		select_weapon(0)


## Apply damage (also reached through GameEvents.player_hit). Sandbox: at 0 -> fade, reset to full health.
func take_damage(amount: float) -> void:
	if _faint_left > 0.0 or amount <= 0.0:
		return
	health = maxf(health - amount, 0.0)
	_since_hit = 0.0
	_kick = deg_to_rad(float(cfg.get("kick_deg", 3.0))) * clampf(amount / 20.0, 0.4, 2.0)
	damaged.emit(amount)
	health_changed.emit(health, max_health)
	if health <= 0.0:
		_faint_left = float(cfg.get("faint_time", 1.2))
		fainted.emit(_faint_left)


func _on_player_hit(_npc: Node, amount: float, _pos: Vector3) -> void:
	take_damage(amount)


func select_weapon(index: int) -> void:
	if index < 0 or index >= weapons.size() or weapons[index] == current:
		return
	if current:
		current.set_free_swing(false)
		current.set_equipped(false)
	current = weapons[index]
	current.set_equipped(true)
	current.set_free_swing(_free_swing)
	weapon_changed.emit(current)


func capture_mouse(on: bool) -> void:
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED if on else Input.MOUSE_MODE_VISIBLE


func _unhandled_input(event: InputEvent) -> void:
	if not input_enabled:
		return
	if event is InputEventKey and event.physical_keycode == KEY_E and not event.echo:
		if event.pressed:
			grabber.try_grab()
		else:
			grabber.release()
		return
	if event is InputEventMouseButton and event.button_index == MOUSE_BUTTON_MIDDLE:
		if event.pressed:
			grabber.try_grab()
		else:
			grabber.release()
		return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_ESCAPE:
				capture_mouse(false)
			KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6, KEY_7, KEY_8, KEY_9:
				select_weapon(event.physical_keycode - KEY_1)
	elif event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			capture_mouse(true)
		elif grabber.is_holding():
			if event.button_index == MOUSE_BUTTON_LEFT:
				grabber.throw()
		elif current:
			if event.button_index == MOUSE_BUTTON_LEFT:
				current.primary_action()
			elif event.button_index == MOUSE_BUTTON_RIGHT:
				current.secondary_action()
	elif event is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		if _free_swing and current:
			current.free_swing_motion(event.relative)
		else:
			rotate_y(-event.relative.x * SENS)
			_pitch = clampf(_pitch - event.relative.y * SENS, -1.5, 1.5)
			camera.rotation.x = _pitch


func _physics_process(delta: float) -> void:
	_update_health(delta)
	var shift := Input.is_physical_key_pressed(KEY_SHIFT) and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	if shift != _free_swing:
		_free_swing = shift
		if current:
			current.set_free_swing(shift)
	var dir := Vector2.ZERO
	if not input_enabled:
		velocity.x = 0.0
		velocity.z = 0.0
		velocity.y = 0.0 if is_on_floor() else velocity.y - 9.8 * delta
		move_and_slide()
		return
	if Input.is_physical_key_pressed(KEY_W): dir.y -= 1
	if Input.is_physical_key_pressed(KEY_S): dir.y += 1
	if Input.is_physical_key_pressed(KEY_A): dir.x -= 1
	if Input.is_physical_key_pressed(KEY_D): dir.x += 1
	var wish := (global_basis * Vector3(dir.x, 0, dir.y)).normalized() * SPEED
	velocity.x = wish.x
	velocity.z = wish.z
	if is_on_floor():
		velocity.y = JUMP if Input.is_physical_key_pressed(KEY_SPACE) else 0.0
	else:
		velocity.y -= 9.8 * delta
	move_and_slide()


func _update_health(delta: float) -> void:
	if _faint_left > 0.0:
		_faint_left -= delta
		if _faint_left <= 0.0:
			health = max_health
			position = _start_pos
			velocity = Vector3.ZERO
			health_changed.emit(health, max_health)
			revived.emit()
	elif health < max_health:
		_since_hit += delta
		if _since_hit >= float(cfg.get("regen_delay", 5.0)):
			health = minf(health + float(cfg.get("regen_rate", 10.0)) * delta, max_health)
			health_changed.emit(health, max_health)
	_kick = move_toward(_kick, 0.0, float(cfg.get("kick_recover", 8.0)) * delta * 0.1 + _kick * 6.0 * delta)
	camera.rotation.x = _pitch + _kick
