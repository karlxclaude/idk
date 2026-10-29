## Shared (orchestrator-owned). Runtime toggles. UI writes, systems read.
extends Node

signal changed(setting: StringName, value)

## V1 toggles
var panic_enabled := true     # OFF = NPC staggers/stands in place instead of fleeing
var scream_enabled := true    # OFF = no scream audio cues (grunts/gurgles still fire)
var ragdoll_only := false     # ON = no AI, NPCs spawn as pure physics dummies
var debug_overlay := true

## Milestone 3 toggles
enum Gore { LOW, MED, HIGH }
var fight_back := false        # hit NPCs that are able may attack the player (NpcState.FIGHT)
var slow_mo_on_kill := false   # brief slow motion when an NPC dies
var slow_mo_scale := 0.3
var slow_mo_duration := 1.5    # real-time seconds
var immortal_dummy := false    # NPCs spawned while ON never die (Npc.immortal)
var gore_intensity: int = Gore.HIGH  # LOW: decals only, no severing; MED: reduced particles
var no_dismemberment := false  # severing disabled (also implied by gore LOW)
var auto_cleanup_time := 0.0   # seconds before corpses/severed parts are removed; 0 = keep (severed default 120)
var time_scale := 1.0          # user time-scale slider (slow-mo multiplies on top)


## True when severing is allowed under the current settings.
func dismemberment_allowed() -> bool:
	return not no_dismemberment and gore_intensity != Gore.LOW


func set_setting(setting: StringName, value) -> void:
	set(setting, value)
	changed.emit(setting, value)
