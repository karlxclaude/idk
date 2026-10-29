## Grab / drag / throw: hold E (or middle mouse) to grab the rigid body under the crosshair within reach.
## The body is pulled to a hold point in front of the camera by a clamped spring-damper force applied at the
## grab point, so it swings physically. Release drops it; throw() launches it along the view direction.
## Living, animated NPCs cannot be grabbed; ragdolled NPC segments, severed pieces, gibs, props and
## dropped items can. Tunables: data/weapons.json "grab".
class_name Grabber
extends Node

var camera: Camera3D
var source: CollisionObject3D
var held: RigidBody3D = null
var hold_dist := 2.0
var cfg: Dictionary = {}
var _local_grab := Vector3.ZERO
var _saved_damp := Vector2.ZERO


func setup(cam: Camera3D, src: CollisionObject3D) -> void:
	camera = cam
	source = src
	cfg = DataDB.table("weapons").get("grab", {})


func is_holding() -> bool:
	return held != null and is_instance_valid(held)


func hold_point() -> Vector3:
	return camera.global_position - camera.global_basis.z * hold_dist


## Can this collider be grabbed right now?
func can_grab(c: Object) -> bool:
	if not (c is RigidBody3D):
		return false
	var npc = BodyIds.npc_from_collider(c)
	if npc != null:
		var pid := BodyIds.part_from_collider(c)
		var body = npc.get("body")
		if body != null and is_instance_valid(body):
			return body.is_ragdoll() or not body.has_part(pid)  # ragdolled NPC or severed piece
		return false
	return true


func try_grab() -> bool:
	if is_holding() or camera == null:
		return false
	var reach := float(cfg.get("reach", 3.0))
	var from := camera.global_position
	var mask := BodyIds.LAYER_WORLD | BodyIds.LAYER_NPC_PARTS | BodyIds.LAYER_DEBRIS
	var q := PhysicsRayQueryParameters3D.create(from, from - camera.global_basis.z * reach, mask)
	if source:
		q.exclude = [source.get_rid()]
	var res := camera.get_world_3d().direct_space_state.intersect_ray(q)
	if res.is_empty() or not can_grab(res.collider):
		return false
	held = res.collider
	_local_grab = held.to_local(res.position)
	hold_dist = clampf(from.distance_to(res.position), float(cfg.get("min_hold", 1.0)), reach)
	_saved_damp = Vector2(held.linear_damp, held.angular_damp)
	held.angular_damp = maxf(held.angular_damp, float(cfg.get("angular_damp", 2.0)))
	held.sleeping = false
	return true


func release() -> void:
	if is_holding():
		held.linear_damp = _saved_damp.x
		held.angular_damp = _saved_damp.y
	held = null


## Throw along the view direction; speed falls with mass, clamped.
func throw() -> void:
	if not is_holding():
		return
	var b := held
	release()
	var speed := clampf(float(cfg.get("throw_impulse", 60.0)) / maxf(b.mass, 0.1), float(cfg.get("throw_min", 4.0)), float(cfg.get("throw_max", 14.0)))
	b.linear_velocity = -camera.global_basis.z * speed
	b.angular_velocity = Vector3.ZERO


func _physics_process(_delta: float) -> void:
	if held != null and not is_instance_valid(held):
		held = null
	if not is_holding():
		return
	var arm := held.global_basis * _local_grab                 # grab point offset from the body origin
	var p := held.global_position + arm
	var vp := held.linear_velocity + held.angular_velocity.cross(arm)
	var f := (hold_point() - p) * float(cfg.get("stiffness", 60.0)) - vp * float(cfg.get("damping", 12.0))
	var fmax := float(cfg.get("max_accel", 90.0)) * held.mass
	if f.length() > fmax:
		f = f.normalized() * fmax
	held.apply_force(f, arm)
	var vmax := float(cfg.get("max_speed", 12.0))
	if held.linear_velocity.length() > vmax:
		held.linear_velocity = held.linear_velocity.normalized() * vmax
	if held.angular_velocity.length() > 15.0:
		held.angular_velocity = held.angular_velocity.normalized() * 15.0
