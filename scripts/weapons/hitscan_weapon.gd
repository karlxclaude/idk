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


## All events produced by the last shot (one per pellet per body hit; rifles may pass through bodies).
var last_events: Array[DamageEvent] = []
var rng := RandomNumberGenerator.new()


## Fire along dir from origin. Returns the first DamageEvent (hit_position set) or null on a total miss.
## Optional data: `pellets` + `spread_deg` (shotgun), `max_penetrations` (ray continues through bodies,
## losing energy per part thickness), `falloff` {start, end, min_mult} damage vs. distance.
func fire_ray(origin: Vector3, dir: Vector3) -> DamageEvent:
	dir = dir.normalized()
	_cooldown = 1.0 / maxf(float(def.get("fire_rate", 4.0)), 0.01)
	_kick = 1.0
	last_events.clear()
	GameEvents.audio_cue.emit(null, StringName(def.get("fire_cue", "gunshot")), origin, 1.0)
	var pellets := maxi(int(def.get("pellets", 1)), 1)
	var spread := float(def.get("spread_deg", 0.0))
	for i in pellets:
		_trace(origin, _spread_dir(dir, spread) if (pellets > 1 or spread > 0.0) else dir, pellets > 1)
	return last_events[0] if last_events.size() > 0 else null


## Uniform random direction inside a cone of half-angle `spread_deg` around dir.
func _spread_dir(dir: Vector3, spread_deg: float) -> Vector3:
	if spread_deg <= 0.0:
		return dir
	var ang := deg_to_rad(spread_deg) * sqrt(rng.randf())
	var rot := rng.randf() * TAU
	var up := Vector3.UP if absf(dir.dot(Vector3.UP)) < 0.99 else Vector3.RIGHT
	var right := dir.cross(up).normalized()
	var upv := right.cross(dir).normalized()
	return (dir * cos(ang) + (right * cos(rot) + upv * sin(rot)) * sin(ang)).normalized()


func _trace(origin: Vector3, dir: Vector3, is_pellet: bool) -> void:
	var mv := float(def.get("muzzle_velocity", 300.0))
	var mass := float(def.get("mass", 0.008))
	var e0 := 0.5 * mass * mv * mv
	var energy := e0
	var max_hits := maxi(int(def.get("max_penetrations", 1)), 1)
	var loss_per_m := float(def.get("energy_loss_per_m", 2.0))
	var max_range := float(def.get("max_range", 100.0))
	var fo: Dictionary = def.get("falloff", {})
	var skip: Array[RID] = []
	var pos := origin
	var travelled := 0.0
	var bodies := 0
	while bodies < max_hits and energy > e0 * 0.05:
		var res := _ray(pos, pos + dir * (max_range - travelled), hit_mask(), skip)
		if res.is_empty():
			return
		travelled += pos.distance_to(res.position)
		var frac := energy / e0
		var ev := _new_event(DamageEvent.Type.BULLET)
		var v := mv * sqrt(frac)
		ev.direction = dir
		ev.impactor_velocity = dir * v
		ev.impactor_mass = mass
		ev.penetration = float(def.get("penetration", 0.0)) * frac
		ev.can_dismember = bool(def.get("can_dismember", false))
		var ratio := v / maxf(float(def.get("velocity_ref", mv)), 0.001)
		var amt := float(def.get("base_damage", 10.0)) * clampf(
			pow(ratio, float(def.get("damage_velocity_exponent", 1.0))), 0.0, float(def.get("max_damage_scale", 1.0)))
		if not fo.is_empty():
			var t := clampf((travelled - float(fo.get("start", 0.0))) / maxf(float(fo.get("end", 1.0)) - float(fo.get("start", 0.0)), 0.001), 0.0, 1.0)
			amt *= lerpf(1.0, float(fo.get("min_mult", 0.2)), t)
		ev.amount = amt
		ev.extra["caliber"] = def.get("caliber", "")
		ev.extra["pellet"] = is_pellet
		ev.extra["energy"] = energy
		var collider: Object = res.collider
		var npc = BodyIds.npc_from_collider(collider)
		_deliver(ev, collider, res.position, res.normal)
		last_events.append(ev)
		if npc == null:
			return  # world / debris stops the bullet
		bodies += 1
		# pass through: energy lost per metre of part thickness along the ray
		var thick := _thickness(npc, BodyIds.part_from_collider(collider), dir)
		energy -= e0 * loss_per_m * thick
		skip.append((collider as CollisionObject3D).get_rid())
		pos = res.position + dir * 0.001


## Approximate distance the ray spends inside a part box (2x centre-to-surface along dir).
func _thickness(npc: Node, part_id: int, dir: Vector3) -> float:
	if npc.get("body") == null or not is_instance_valid(npc.body):
		return 0.15
	var xf: Transform3D = npc.body.get_part_global_transform(part_id)
	var h: Vector3 = npc.body.get_part_half_extents(part_id)
	var d := xf.basis.orthonormalized().inverse() * dir
	var k := maxf(maxf(absf(d.x) / maxf(h.x, 0.001), absf(d.y) / maxf(h.y, 0.001)), absf(d.z) / maxf(h.z, 0.001))
	return 2.0 / maxf(k, 0.001)


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
