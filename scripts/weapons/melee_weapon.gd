## Melee weapon (knife, bat, ...). Tip velocity is tracked every physics frame from the global
## position delta; hits are found by sweeping sample points on the blade/head from their previous to
## current positions against world/npc_parts/debris. One hit per part per swing.
## TODO(roadmap: stuck blades) keep a stabbing knife embedded instead of ending the hit.
class_name MeleeWeapon
extends Weapon

const RECOVER_TIME := 0.3

var tip_velocity := Vector3.ZERO
var tip_speed := 0.0

var _phase := &"idle"          # idle | attack | recover
var _mode := &"swing"
var _t := 0.0
var _dur := 0.2
var _speed_scale := 1.0
var _recover_from := Transform3D.IDENTITY
var _hit_keys := {}
var _prev_samples: Array[Vector3] = []
var _prev_tip := Vector3.ZERO
var _have_prev := false
var _free := false
var _free_target := Vector2.ZERO   # x = yaw, y = pitch (rad)
var _free_cur := Vector2.ZERO


func primary_action() -> void:
	_start(&"swing", 1.0, true)


func secondary_action() -> void:
	if def.has("thrust"):
		_start(&"thrust", 1.0, true)


func debug_swing(speed_scale: float, mode: StringName = &"swing") -> void:
	_start(mode, speed_scale, false)


func is_busy() -> bool:
	return _phase != &"idle"


func set_free_swing(on: bool) -> void:
	_free = on
	if not on:
		_free_target = Vector2.ZERO


func free_swing_motion(rel: Vector2) -> void:
	if not _free:
		return
	var c := WeaponDefs.free_swing_cfg()
	var g := float(c.get("mouse_gain", 0.012))
	var my := deg_to_rad(float(c.get("max_yaw_deg", 80.0)))
	var mp := deg_to_rad(float(c.get("max_pitch_deg", 60.0)))
	_free_target.x = clampf(_free_target.x - rel.x * g, -my, my)
	_free_target.y = clampf(_free_target.y - rel.y * g, -mp, mp)


func _start(mode: StringName, speed_scale: float, respect_cooldown: bool) -> void:
	if not equipped:
		return
	if respect_cooldown and (_cooldown > 0.0 or _phase == &"attack"):
		return
	if mode == &"slash":
		mode = &"swing"
	elif mode == &"stab":
		mode = &"thrust"
	if mode == &"thrust" and not def.has("thrust"):
		mode = &"swing"
	_mode = mode
	_speed_scale = maxf(speed_scale, 0.01)
	var cfg: Dictionary = def.get(String(mode), {})
	_dur = float(cfg.get("duration", 0.2)) / _speed_scale
	_t = 0.0
	_phase = &"attack"
	_hit_keys.clear()
	_cooldown = 1.0 / maxf(float(def.get("fire_rate", 2.0)), 0.01)
	transform = rest_transform
	_have_prev = false


func _pose_attack(u: float) -> Transform3D:
	var cfg: Dictionary = def.get(String(_mode), {})
	var rt := rest_transform
	if _mode == &"thrust":
		var axis := (rt.basis * Vector3(0, 0, -1)).normalized()
		return Transform3D(rt.basis, rt.origin + axis * float(cfg.get("distance", 0.6)) * u)
	var yaw0 := deg_to_rad(float(cfg.get("arc_deg", 100.0))) * 0.5
	var b := Basis(Vector3.UP, lerpf(yaw0, -yaw0, u))
	return Transform3D(b * rt.basis, b * rt.origin)


func _samples_world() -> Array[Vector3]:
	var out: Array[Vector3] = []
	var len := float(def.get("length", 0.2))
	for f in def.get("hit_samples", [1.0]):
		out.append(to_global(Vector3(0, 0, -len * float(f))))
	return out


func _physics_process(delta: float) -> void:
	_cooldown = maxf(_cooldown - delta, 0.0)
	var attacking := false
	match _phase:
		&"attack":
			_t += delta
			var u := clampf(_t / _dur, 0.0, 1.0)
			transform = _pose_attack(u)
			attacking = true
			if _t >= _dur:
				_recover_from = transform
				_phase = &"recover"
				_t = 0.0
		&"recover":
			_t += delta
			var u2 := clampf(_t / RECOVER_TIME, 0.0, 1.0)
			transform = _recover_from.interpolate_with(rest_transform, u2)
			if u2 >= 1.0:
				_phase = &"idle"
				_hit_keys.clear()
		_:
			_update_free_pose(delta)

	var cur := _samples_world()
	var tip := get_tip_world()
	if _have_prev:
		tip_velocity = (tip - _prev_tip) / delta
	else:
		tip_velocity = Vector3.ZERO
	tip_speed = tip_velocity.length()
	var min_v := float(def.get("min_velocity", 0.0))
	var active := attacking and _have_prev
	if not active and _free and _phase == &"idle" and _have_prev:
		active = tip_speed >= min_v
	if _phase == &"idle" and tip_speed < min_v * 0.5:
		_hit_keys.clear()
	if active:
		for i in cur.size():
			if i < _prev_samples.size():
				_sweep(_prev_samples[i], cur[i], delta)
	_prev_samples = cur
	_prev_tip = tip
	_have_prev = true


func _update_free_pose(delta: float) -> void:
	if not _free and _free_cur.length_squared() < 1e-6:
		transform = rest_transform
		return
	var c := WeaponDefs.free_swing_cfg()
	_free_target = _free_target.move_toward(Vector2.ZERO, float(c.get("spring", 6.0)) * delta * 0.2)
	_free_cur = _free_cur.lerp(_free_target, 1.0 - exp(-25.0 * delta))
	if not _free:
		_free_cur = _free_cur.lerp(Vector2.ZERO, 1.0 - exp(-12.0 * delta))
	var b := Basis(Vector3.UP, _free_cur.x) * Basis(Vector3.RIGHT, _free_cur.y)
	transform = Transform3D(b * rest_transform.basis, b * rest_transform.origin)


func _sweep(from: Vector3, to: Vector3, delta: float) -> void:
	var seg := to - from
	if seg.length_squared() < 1e-8:
		return
	var res := _ray(from, to, hit_mask())
	if res.is_empty():
		return
	var collider: Object = res.collider
	var npc = BodyIds.npc_from_collider(collider)
	var key: int = collider.get_instance_id()
	if npc != null:
		key = (npc.get_instance_id() << 5) ^ BodyIds.part_from_collider(collider)
	if _hit_keys.has(key):
		return
	var v := seg / delta
	var ev := _build_event(v)
	if ev.amount <= 0.0:
		# limp swing: record it for tests/debug, deliver nothing, don't consume the hit
		_deliver(ev, collider, res.position, _normal_or(res, -ev.direction), false)
		return
	_hit_keys[key] = true
	_deliver(ev, collider, res.position, _normal_or(res, -ev.direction))


func _normal_or(res: Dictionary, fallback: Vector3) -> Vector3:
	var n: Vector3 = res.normal
	return n if n.length_squared() > 0.5 else fallback


func _build_event(v: Vector3) -> DamageEvent:
	var speed := v.length()
	var dir := v / speed if speed > 0.001 else -global_basis.z
	var axis := (-global_basis.z).normalized()
	var angle := rad_to_deg(axis.angle_to(dir))
	var type: int = _types[0] if _types.size() > 0 else DamageEvent.Type.BLUNT
	if _types.has(DamageEvent.Type.BLADE_STAB) and angle <= float(def.get("stab_cone_deg", 0.0)):
		type = DamageEvent.Type.BLADE_STAB
	elif _types.has(DamageEvent.Type.BLADE_SLASH):
		type = DamageEvent.Type.BLADE_SLASH
	var ev := _new_event(type)
	var scale_v := 0.0
	if speed >= float(def.get("min_velocity", 0.0)):
		scale_v = clampf(pow(speed / maxf(float(def.get("velocity_ref", 1.0)), 0.001),
			float(def.get("damage_velocity_exponent", 1.0))), 0.0, float(def.get("max_damage_scale", 2.0)))
	ev.amount = float(def.get("base_damage", 10.0)) * scale_v
	ev.direction = dir
	ev.impactor_velocity = v
	ev.impactor_mass = float(def.get("mass", 1.0))
	match type:
		DamageEvent.Type.BLADE_STAB:
			ev.penetration = minf(float(def.get("length", 0.2)), float(def.get("stab_depth_per_mps", 0.03)) * speed)
		DamageEvent.Type.BLADE_SLASH:
			ev.penetration = float(def.get("slash_penetration", 0.03))
			ev.can_dismember = bool(def.get("can_dismember", false)) \
				and speed > float(def.get("dismember_min_velocity", 1e9))
		_:
			ev.penetration = float(def.get("penetration", 0.0))
	if def.has("head_area_cm2"):
		ev.extra["head_area"] = float(def.head_area_cm2)  # contact area (cm2), read by the blunt mechanism
	ev.extra["swing_mode"] = _mode
	ev.extra["speed"] = speed
	ev.extra["angle_deg"] = angle
	return ev
