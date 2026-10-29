## First-person player: WASD + mouse look, jump, keys 1/2/3 pick weapons (by slot order in
## weapons.json), LMB primary, RMB secondary, Shift = free swing (mouse drives the weapon), Esc frees mouse.
class_name Player
extends CharacterBody3D

signal weapon_changed(weapon: Weapon)

const SPEED := 5.0
const JUMP := 4.5
const SENS := 0.0025

var camera: Camera3D
var hand: Node3D
var weapons: Array[Weapon] = []
var current: Weapon = null
var _pitch := 0.0
var _free_swing := false


func _ready() -> void:
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
	if event is InputEventKey and event.pressed and not event.echo:
		match event.physical_keycode:
			KEY_ESCAPE:
				capture_mouse(false)
			KEY_1, KEY_2, KEY_3, KEY_4, KEY_5:
				select_weapon(event.physical_keycode - KEY_1)
	elif event is InputEventMouseButton and event.pressed:
		if Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			capture_mouse(true)
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
	var shift := Input.is_physical_key_pressed(KEY_SHIFT) and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED
	if shift != _free_swing:
		_free_swing = shift
		if current:
			current.set_free_swing(shift)
	var dir := Vector2.ZERO
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
