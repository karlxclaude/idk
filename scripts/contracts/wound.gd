## CONTRACT (orchestrator-owned, read-only for agents). See docs/CONTRACTS.md.
## A persistent injury. Created by WoundSystem, bled by BloodSystem, drawn by GoreFX.
class_name Wound
extends RefCounted

static var _next_id := 1

var id: int = 0
var part_id: int = -1
var type: int = DamageEvent.Type.BULLET
## Position/normal in the PART's local space (follows the part as it moves).
var local_position: Vector3 = Vector3.ZERO
var local_normal: Vector3 = Vector3.FORWARD
## Direction of the wound in part space (slash vector / bullet path). Zero if n/a.
var local_direction: Vector3 = Vector3.ZERO
var severity: float = 0.0        # 0..1
var bleed_rate: float = 0.0      # base EXTERNAL blood units / second
var internal_bleed_rate: float = 0.0  # base INTERNAL blood units / second (no visible flow)
var is_arterial: bool = false    # pulses with heartbeat
var is_exit: bool = false        # bullet exit wound
var is_stump: bool = false       # left behind by dismemberment
var is_fracture: bool = false    # bone break marker (may have zero bleed)
var is_bruise: bool = false      # blunt surface wound (zero/near-zero bleed)
var created_time: float = 0.0
## Written by BloodSystem every physics tick: current EXTERNAL flow incl. pulse (units/s).
## GoreFX reads this to size spurts. 0 once the NPC is out of blood or wound has clotted.
var current_flow: float = 0.0
## True once the wound's part has been severed from the body (wound travels with the limb,
## no longer drains the NPC's blood).
var detached: bool = false


func _init() -> void:
	id = _next_id
	_next_id += 1
	created_time = Time.get_ticks_msec() / 1000.0


func describe() -> String:
	var tags := ""
	if is_arterial: tags += " ART"
	if is_exit: tags += " EXIT"
	if is_stump: tags += " STUMP"
	if is_fracture: tags += " FX"
	if is_bruise: tags += " BRUISE"
	return "%s %s sev=%.2f ext=%.1f int=%.1f flow=%.1f%s" % [BodyIds.key(part_id),
		DamageEvent.Type.keys()[type], severity, bleed_rate, internal_bleed_rate, current_flow, tags]
