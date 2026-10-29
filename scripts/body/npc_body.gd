## OWNER: body-ragdoll-dismember-agent. STUB: public API is contractual (docs/CONTRACTS.md);
## implementation is the agent's. Builds segments, joints, ragdoll, impulses, dismemberment.
class_name NpcBody
extends Node3D

## Emitted after a part subtree is detached (Npc also re-emits part_severed).
signal part_detached(part_id: int, severed_root: RigidBody3D)

var npc: Npc


func setup(owner_npc: Npc) -> void:
	npc = owner_npc


## Global transform of a segment (attached or severed). Part-local axes per CONTRACTS.md.
func get_part_global_transform(part_id: int) -> Transform3D:
	return global_transform


func get_part_half_extents(part_id: int) -> Vector3:
	return Vector3(0.1, 0.1, 0.1)


## The physics node (BodySegment/RigidBody3D) for the part. Valid after severing too.
func get_part_node(part_id: int) -> Node3D:
	return null


## True while the part is still attached to the NPC.
func has_part(part_id: int) -> bool:
	return true


## World position of torso centre.
func get_center() -> Vector3:
	return global_position


## Horizontal facing direction (world).
func get_forward() -> Vector3:
	return -global_basis.z


## Physical hit reaction: impulse at ev.hit_position on ev.part_id's segment (even if severed).
func apply_hit_impulse(ev: DamageEvent) -> void:
	pass


## Detach part_id and all its descendants as rigid bodies keeping velocity. Returns the
## RigidBody3D of part_id (descendants stay jointed to it). Called only via Npc.notify_part_severed.
func sever_part(part_id: int, ev: DamageEvent) -> RigidBody3D:
	return null


## Full ragdoll ON (death/collapse/knockdown) or OFF (recover to animated, standing up).
func set_ragdoll(enabled: bool) -> void:
	pass


func is_ragdoll() -> bool:
	return false


## Called by the brain every physics frame while not ragdolled. velocity = desired horizontal
## world velocity (m/s). pose in: idle, walk, run, clutch, stagger, crawl.
## In crawl the body may be ragdoll-driven; the body decides how.
func set_locomotion(velocity: Vector3, pose: StringName) -> void:
	pass


## Pose hint: which part the NPC clutches with its free hand (-1 = none). IK is a stub in v1.
func set_clutch_target(part_id: int) -> void:
	pass


## Drop the held item from the given side ("l"/"r"). Returns true if something was dropped.
func drop_held_item(side: String) -> bool:
	return false


func get_debug_info() -> Dictionary:
	return {}
