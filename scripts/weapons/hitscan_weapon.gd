## Hitscan weapon (handgun). One ray from the camera, BULLET damage, single hit in v1.
## TODO(roadmap: weapons) shotgun/rifle = more JSON entries (pellets, penetration chain).
class_name HitscanWeapon
extends Weapon

var _kick := 0.0


func primary_action() -> void:
	if _cooldown > 0.0 or not equipped:
		return
	var origin: Vector3
	var dir: Vector3
	if aim_node and is_instance_valid(aim_node):
		origin = aim_node.global_position
		dir = -aim_node.global_basis.z
	else:
		origin = global_position
		dir = -global_basis.z
	fire_ray(origin, dir)


## Fire along dir from origin. Returns the DamageEvent (hit_position set) or null on miss.
func fire_ray(origin: Vector3, dir: Vector3) -> DamageEvent:
	dir = dir.normalized()
	_cooldown = 1.0 / maxf(float(def.get("fire_rate", 4.0)), 0.01)
	_kick = 1.0
	GameEvents.audio_cue.emit(null, StringName(def.get("fire_cue", "gunshot")), origin, 1.0)
	var res := _ray(origin, origin + dir * float(def.get("max_range", 100.0)), hit_mask())
	if res.is_empty():
		return null
	var ev := _new_event(DamageEvent.Type.BULLET)
	var mv := float(def.get("muzzle_velocity", 300.0))
	ev.direction = dir
	ev.impactor_velocity = dir * mv
	ev.impactor_mass = float(def.get("mass", 0.008))
	ev.penetration = float(def.get("penetration", 0.0))
	ev.can_dismember = bool(def.get("can_dismember", false))
	var ratio := mv / maxf(float(def.get("velocity_ref", mv)), 0.001)
	ev.amount = float(def.get("base_damage", 10.0)) * clampf(
		pow(ratio, float(def.get("damage_velocity_exponent", 1.0))), 0.0, float(def.get("max_damage_scale", 1.0)))
	_deliver(ev, res.collider, res.position, res.normal)
	return ev


func debug_swing(_speed_scale: float, _mode: StringName = &"swing") -> void:
	primary_action()


func _physics_process(delta: float) -> void:
	_cooldown = maxf(_cooldown - delta, 0.0)
	var rc: Dictionary = def.get("recoil", {})
	_kick = move_toward(_kick, 0.0, delta * float(rc.get("recover", 12.0)) * 0.2) if _kick > 0.0 else 0.0
	var k := _kick
	transform = Transform3D(
		rest_transform.basis * Basis(Vector3.RIGHT, deg_to_rad(float(rc.get("kick_pitch_deg", 0.0))) * k),
		rest_transform.origin + Vector3(0, 0, float(rc.get("kick_back", 0.0)) * k))
