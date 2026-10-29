## OWNER: damage-wounds-bleed-agent. STUB: public API is contractual (docs/CONTRACTS.md).
## Blood volume, bleed rates, arterial pulse, loss levels.
class_name BloodSystem
extends Node

var npc: Npc
var state := BloodState.new()


func setup(owner_npc: Npc) -> void:
	npc = owner_npc


func get_debug_info() -> Dictionary:
	return {}
