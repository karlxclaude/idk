## OWNER: damage-wounds-bleed-agent. STUB: public API is contractual (docs/CONTRACTS.md).
## Stores persistent wounds per part.
class_name WoundSystem
extends Node

var npc: Npc


func setup(owner_npc: Npc) -> void:
	npc = owner_npc


func get_wounds() -> Array[Wound]:
	return []


func get_wounds_on(part_id: int) -> Array[Wound]:
	return []


## Wounds still on the body (not on severed parts).
func get_attached_wounds() -> Array[Wound]:
	return []


func get_debug_info() -> Dictionary:
	return {}
