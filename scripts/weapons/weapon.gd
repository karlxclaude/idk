## Base class for all weapons. Data-driven from data/weapons.json (see WeaponDefs).
## Subclasses: HitscanWeapon, MeleeWeapon. Tests can read `last_event` / `hit_resolved`.
class_name Weapon
extends Node3D

## ev = the DamageEvent built; applied = false when it was too weak to deliver (limp swing).
signal hit_resolved(ev: DamageEvent, applied: bool)

var def: Dictionary = {}
var source: Node = null          # player (or any node) credited in ev.source
var aim_node: Node3D = null      # camera: hitscan aims from here
var last_event: DamageEvent = null
var equipped := true
var rest_transform := Transform3D.IDENTITY
var _cooldown := 0.0
var _types: Array[int] = []


func setup(d: Dictionary, src: Node = null) -> void:
	def = d
	source = src
	_types.clear()
	for tn in d.get("damage_types", []):
		if DamageEvent.Type.has(tn):
			_types.append(DamageEvent.Type[tn])
	var r: Dictionary = d.get("rest", {})
	var p: Array = r.get("pos", [0, 0, 0])
	var rot: Array = r.get("rot_deg", [0, 0, 0])
	rest_transform = Transform3D(
		Basis.from_euler(Vector3(deg_to_rad(rot[0]), deg_to_rad(rot[1]), deg_to_rad(rot[2]))),
		Vector3(p[0], p[1], p[2]))
	transform = rest_transform
	_build_viewmodel()


func weapon_id() -> StringName:
	return StringName(def.get("id", ""))


func get_weapon_name() -> String:
	return String(def.get("name", weapon_id()))


func set_equipped(on: bool) -> void:
	equipped = on
	visible = on
	set_physics_process(on)


## World position of the business end (muzzle / blade tip / bat head end).
func get_tip_world() -> Vector3:
	return to_global(Vector3(0, 0, -float(def.get("length", 0.2))))


## Primary action (LMB). Subclasses override.
func primary_action() -> void:
	pass


## Secondary action (RMB). Subclasses override.
func secondary_action() -> void:
	pass


## Shift-held mouse driving (melee only).
func set_free_swing(_on: bool) -> void:
	pass


func free_swing_motion(_rel: Vector2) -> void:
	pass


## Test hook: perform a swing at speed_scale x full speed. mode: &"swing" | &"thrust".
func debug_swing(_speed_scale: float, _mode: StringName = &"swing") -> void:
	pass


func is_busy() -> bool:
	return false


# ---------------- shared helpers ----------------

func _ray(from: Vector3, to: Vector3, mask: int, also_exclude: Array[RID] = []) -> Dictionary:
	if not is_inside_tree():
		return {}
	var q := PhysicsRayQueryParameters3D.create(from, to, mask)
	var ex: Array[RID] = also_exclude.duplicate()
	if source is CollisionObject3D:
		ex.append((source as CollisionObject3D).get_rid())
	q.exclude = ex
	return get_world_3d().direct_space_state.intersect_ray(q)


static func hit_mask() -> int:
	return BodyIds.LAYER_WORLD | BodyIds.LAYER_NPC_PARTS | BodyIds.LAYER_DEBRIS


func _new_event(type: int) -> DamageEvent:
	var ev := DamageEvent.new()
	ev.type = type
	ev.weapon_id = weapon_id()
	ev.source = source if source else self
	ev.can_dismember = false
	ev.extra = {
		"impulse_scale": float(def.get("impulse_scale", 1.0)),
		"caliber": def.get("caliber", ""),
		"edge_length": float(def.get("length", 0.0)),
	}
	return ev


## Deliver to the NPC under `collider` or announce a world impact. Returns true if damage was applied.
func _deliver(ev: DamageEvent, collider: Object, pos: Vector3, normal: Vector3, allow_apply := true) -> bool:
	ev.hit_position = pos
	ev.hit_normal = normal
	last_event = ev
	var npc = BodyIds.npc_from_collider(collider)
	var applied := false
	if npc != null:
		ev.part_id = BodyIds.part_from_collider(collider)
		if allow_apply and ev.amount > 0.0 and ev.part_id >= 0:
			npc.apply_damage(ev)
			applied = true
	elif allow_apply and ev.amount > 0.0:
		GameEvents.world_impact.emit(pos, normal, ev)
		applied = true
	hit_resolved.emit(ev, applied)
	var cue := String(def.get("hit_cue", ""))
	if applied and cue != "":
		GameEvents.audio_cue.emit(npc, StringName(cue), pos, clampf(ev.amount / 30.0, 0.2, 1.5))
	return applied


func _build_viewmodel() -> void:
	for c in get_children():
		c.queue_free()
	for part in def.get("viewmodel", []):
		var mi := MeshInstance3D.new()
		var s: Array = part.get("size", [0.1, 0.1, 0.1])
		match String(part.get("mesh", "box")):
			"cylinder":
				var cm := CylinderMesh.new()
				cm.top_radius = s[0]; cm.bottom_radius = s[0]; cm.height = s[1]
				mi.mesh = cm
			_:
				var bm := BoxMesh.new()
				bm.size = Vector3(s[0], s[1], s[2])
				mi.mesh = bm
		var p: Array = part.get("pos", [0, 0, 0])
		mi.position = Vector3(p[0], p[1], p[2])
		var r: Array = part.get("rot_deg", [0, 0, 0])
		mi.rotation = Vector3(deg_to_rad(r[0]), deg_to_rad(r[1]), deg_to_rad(r[2]))
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color(String(part.get("color", "#888888")))
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
