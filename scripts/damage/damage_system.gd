## OWNER: damage-wounds-bleed-agent. STUB: public API is contractual (docs/CONTRACTS.md).
## Applies injury rules per damage type/part. The only code that mutates BodyPart HP.
class_name DamageSystem
extends Node

var npc: Npc


func setup(owner_npc: Npc) -> void:
	npc = owner_npc


## Apply one DamageEvent (already localized by Npc.apply_damage). Returns wounds created.
func apply(ev: DamageEvent) -> Array[Wound]:
	return []


func get_part(part_id: int) -> BodyPart:
	return null


func get_parts() -> Array[BodyPart]:
	return []


func get_debug_info() -> Dictionary:
	return {}
