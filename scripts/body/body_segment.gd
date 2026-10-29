## One rigid body part of an NpcBody (attached or severed). Kinematic while animated, dynamic when ragdolled.
class_name BodySegment
extends RigidBody3D

var part_id: int = -1
var npc: Node
var half := Vector3(0.1, 0.1, 0.1)
var attached := true
## Velocity inferred from procedural posing, handed to the physics body when it goes dynamic.
var tracked_lin := Vector3.ZERO
var tracked_ang := Vector3.ZERO
var flinch := Vector3.ZERO
var flinch_t := 0.0
var held_item: MeshInstance3D = null
var _has_prev := false
var max_speed := 25.0
var max_ang_speed := 40.0


static func _v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func build(pid: int, owner_npc: Node, d: Dictionary, mat: Material, cfg: Dictionary) -> void:
	part_id = pid
	npc = owner_npc
	name = BodyIds.key(pid)
	half = _v3(d["half"])
	mass = float(d["mass"])
	collision_layer = BodyIds.LAYER_NPC_PARTS
	collision_mask = BodyIds.LAYER_WORLD | BodyIds.LAYER_NPC_PARTS | BodyIds.LAYER_DEBRIS
	set_meta(BodyIds.META_NPC, owner_npc)
	set_meta(BodyIds.META_PART_ID, pid)
	top_level = true
	max_speed = float(cfg.get("max_segment_speed", 25.0))
	max_ang_speed = float(cfg.get("max_segment_ang_speed", 40.0))
	linear_damp = float(cfg.get("linear_damp", 0.3))
	angular_damp = float(cfg.get("angular_damp", 4.0))
	var pm := PhysicsMaterial.new()
	pm.friction = float(cfg.get("friction", 0.9))
	pm.bounce = 0.0
	physics_material_override = pm
	var shape: Shape3D
	var mesh: Mesh
	if String(d.get("shape", "capsule")) == "box":
		var bs := BoxShape3D.new(); bs.size = half * 2.0
		var bm := BoxMesh.new(); bm.size = half * 2.0
		shape = bs; mesh = bm
	else:
		var cs := CapsuleShape3D.new(); cs.radius = half.x; cs.height = half.y * 2.0
		var cm := CapsuleMesh.new(); cm.radius = half.x; cm.height = half.y * 2.0
		shape = cs; mesh = cm
	var col := CollisionShape3D.new()
	col.shape = shape
	col.set_meta(BodyIds.META_NPC, owner_npc)
	col.set_meta(BodyIds.META_PART_ID, pid)
	add_child(col)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	add_child(mi)
	freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	freeze = true


## Pose the (kinematic) segment and track its velocity.
func snap(xf: Transform3D, dt: float) -> void:
	if _has_prev and dt > 0.0:
		var lin := (xf.origin - global_transform.origin) / dt
		var dq := (xf.basis * global_transform.basis.inverse()).orthonormalized().get_rotation_quaternion()
		if dq.w < 0.0:
			dq = -dq
		var ang := dq.get_axis() * (dq.get_angle() / dt)
		tracked_lin = tracked_lin.lerp(lin.limit_length(15.0), 0.6)
		tracked_ang = tracked_ang.lerp(ang.limit_length(20.0), 0.6)
	global_transform = xf
	_has_prev = true


func make_dynamic() -> void:
	freeze = false
	linear_velocity = tracked_lin
	angular_velocity = tracked_ang
	sleeping = false


func make_kinematic() -> void:
	linear_velocity = Vector3.ZERO
	angular_velocity = Vector3.ZERO
	freeze_mode = RigidBody3D.FREEZE_MODE_KINEMATIC
	freeze = true
	tracked_lin = Vector3.ZERO
	tracked_ang = Vector3.ZERO
	_has_prev = false


## Safety net: no dynamic/severed segment may exceed the data-driven speed caps.
func _integrate_forces(state: PhysicsDirectBodyState3D) -> void:
	if state.linear_velocity.length_squared() > max_speed * max_speed:
		state.linear_velocity = state.linear_velocity.limit_length(max_speed)
	if state.angular_velocity.length_squared() > max_ang_speed * max_ang_speed:
		state.angular_velocity = state.angular_velocity.limit_length(max_ang_speed)
