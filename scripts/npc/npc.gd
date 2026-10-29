## Shared wiring (orchestrator-owned). Composes one NPC from the decoupled systems and is
## the single hub for signals between them. Agents call the emit_* / notify_* helpers here;
## they never connect directly to each other's internals. See docs/CONTRACTS.md.
class_name Npc
extends Node3D

## --- local signals (also re-emitted on GameEvents with npc as first arg) ---
signal wounded(wound: Wound, ev: DamageEvent)
signal part_broken(part_id: int)
signal part_severed(part_id: int, severed_root: RigidBody3D, ev: DamageEvent)
signal state_changed(old_state: int, new_state: int)
signal died(cause: StringName)
signal stunned(duration: float, cause: StringName)
## DamageSystem -> brain: an injury that must kill (head destroyed, decapitation, ...).
signal lethal_injury(cause: StringName)
## BloodSystem -> brain: blood loss level crossed a threshold.
signal blood_level_changed(old_level: int, new_level: int)

static var _next_id := 1

var npc_id: int = 0
var rng := RandomNumberGenerator.new()

var body: NpcBody
var damage: DamageSystem
var wounds: WoundSystem
var blood: BloodSystem
var brain: NpcBrain


static func spawn(parent: Node, xform: Transform3D, seed_value: int = -1) -> Npc:
	var npc := Npc.new()
	npc.transform = xform
	if seed_value >= 0:
		npc.rng.seed = seed_value
	else:
		npc.rng.randomize()
	parent.add_child(npc)
	return npc


func _init() -> void:
	npc_id = _next_id
	_next_id += 1
	name = "Npc%d" % npc_id


func _ready() -> void:
	add_to_group(&"npc")
	body = NpcBody.new(); body.name = "Body"; add_child(body)
	wounds = WoundSystem.new(); wounds.name = "Wounds"; add_child(wounds)
	blood = BloodSystem.new(); blood.name = "Blood"; add_child(blood)
	damage = DamageSystem.new(); damage.name = "Damage"; add_child(damage)
	brain = NpcBrain.new(); brain.name = "Brain"; add_child(brain)
	# setup order: body first (colliders exist), brain last (sees everything)
	body.setup(self)
	wounds.setup(self)
	blood.setup(self)
	damage.setup(self)
	brain.setup(self)
	GameEvents.npc_spawned.emit(self)


## ENTRY POINT for all damage. Weapons call this; nothing else touches HP.
func apply_damage(ev: DamageEvent) -> void:
	if ev.part_id < 0 or not is_instance_valid(body):
		return
	ev.time = Time.get_ticks_msec() / 1000.0
	var xf := body.get_part_global_transform(ev.part_id)
	ev.hit_local = xf.affine_inverse() * ev.hit_position
	var ext := body.get_part_half_extents(ev.part_id)
	ev.hit_local_normalized = Vector3(
		ev.hit_local.x / maxf(ext.x, 0.001),
		ev.hit_local.y / maxf(ext.y, 0.001),
		ev.hit_local.z / maxf(ext.z, 0.001))
	damage.apply(ev)
	body.apply_hit_impulse(ev)


# ---------------- helpers called by systems (single emit point) ----------------

func emit_wounded(wound: Wound, ev: DamageEvent) -> void:
	wounded.emit(wound, ev)
	GameEvents.npc_wounded.emit(self, wound, ev)


func emit_part_broken(part_id: int) -> void:
	part_broken.emit(part_id)
	GameEvents.npc_part_broken.emit(self, part_id)


## DamageSystem calls this once per severed subtree root. Body physically detaches it.
func notify_part_severed(part_id: int, ev: DamageEvent) -> void:
	var severed_root := body.sever_part(part_id, ev)
	part_severed.emit(part_id, severed_root, ev)
	GameEvents.npc_part_severed.emit(self, part_id, severed_root, ev)


func emit_state_changed(old_state: int, new_state: int) -> void:
	state_changed.emit(old_state, new_state)
	GameEvents.npc_state_changed.emit(self, old_state, new_state)


func emit_died(cause: StringName) -> void:
	died.emit(cause)
	GameEvents.npc_died.emit(self, cause)


func emit_stunned(duration: float, cause: StringName) -> void:
	stunned.emit(duration, cause)
	GameEvents.npc_stunned.emit(self, duration, cause)


func report_lethal_injury(cause: StringName) -> void:
	lethal_injury.emit(cause)


func emit_blood_level_changed(old_level: int, new_level: int) -> void:
	blood_level_changed.emit(old_level, new_level)


func cue(cue_name: StringName, intensity: float = 1.0) -> void:
	GameEvents.audio_cue.emit(self, cue_name, get_center(), intensity)


# ---------------- convenience queries ----------------

func get_center() -> Vector3:
	return body.get_center() if is_instance_valid(body) else global_position


func get_state() -> int:
	return brain.state if brain else BodyIds.NpcState.IDLE


func is_dead() -> bool:
	return get_state() == BodyIds.NpcState.DEAD


func get_exertion() -> float:
	return brain.get_exertion() if brain else 0.0


func get_debug_info() -> Dictionary:
	return {
		"id": npc_id,
		"state": BodyIds.state_name(get_state()),
		"body": body.get_debug_info(),
		"damage": damage.get_debug_info(),
		"wounds": wounds.get_debug_info(),
		"blood": blood.get_debug_info(),
		"brain": brain.get_debug_info(),
	}
