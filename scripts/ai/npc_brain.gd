## OWNER: ai-states-agent. STUB: public API is contractual (docs/CONTRACTS.md).
## NPC finite state machine, pain/shock model, toggles, reaction hooks.
class_name NpcBrain
extends Node

var npc: Npc
var state: int = BodyIds.NpcState.IDLE


func setup(owner_npc: Npc) -> void:
	npc = owner_npc


## 0 (resting) .. 1 (sprinting). BloodSystem scales bleeding by this.
func get_exertion() -> float:
	return 0.0


## Current pain 0..1 (after tolerance).
func get_pain() -> float:
	return 0.0


## Debug/test hook: jump straight to a state (runs normal enter logic).
func force_state(new_state: int) -> void:
	pass


func get_debug_info() -> Dictionary:
	return {}
