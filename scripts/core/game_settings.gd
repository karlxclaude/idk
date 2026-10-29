## Shared (orchestrator-owned). Runtime toggles. UI writes, systems read.
extends Node

signal changed(setting: StringName, value)

## V1 toggles
var panic_enabled := true     # OFF = NPC staggers/stands in place instead of fleeing
var scream_enabled := true    # OFF = no scream audio cues (grunts/gurgles still fire)
var ragdoll_only := false     # ON = no AI, NPCs spawn as pure physics dummies
var debug_overlay := true

## TODO(roadmap: extra toggles) fight_back, slow_mo_on_kill, immortal_dummy, gore_intensity,
## no_dismemberment, auto_cleanup_time. See docs/ROADMAP.md.


func set_setting(setting: StringName, value) -> void:
	set(setting, value)
	changed.emit(setting, value)
