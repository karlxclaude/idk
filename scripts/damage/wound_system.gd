## OWNER: damage-wounds-bleed-agent. Stores persistent wounds per part.
class_name WoundSystem
extends Node

var npc: Npc
var _wounds: Array[Wound] = []


func setup(owner_npc: Npc) -> void:
	npc = owner_npc


func get_wounds() -> Array[Wound]:
	return _wounds.duplicate()


func get_wounds_on(part_id: int) -> Array[Wound]:
	var out: Array[Wound] = []
	for w in _wounds:
		if w.part_id == part_id:
			out.append(w)
	return out


## Wounds still on the body (not on severed parts).
func get_attached_wounds() -> Array[Wound]:
	var out: Array[Wound] = []
	for w in _wounds:
		if not w.detached:
			out.append(w)
	return out


## Internal API (DamageSystem). Stacking allowed. detached = part already severed.
func add_wound(w: Wound, detached: bool = false) -> Wound:
	w.detached = detached
	_wounds.append(w)
	return w


## Mark every wound on part_id as detached (part was severed; wound travels with the limb).
func detach_part(part_id: int) -> void:
	for w in _wounds:
		if w.part_id == part_id:
			w.detached = true
			w.current_flow = 0.0


func get_debug_info() -> Dictionary:
	var lines: Array[String] = []
	for w in _wounds:
		lines.append(w.describe() + (" DETACHED" if w.detached else ""))
	return {"count": _wounds.size(), "attached": get_attached_wounds().size(), "wounds": lines}
