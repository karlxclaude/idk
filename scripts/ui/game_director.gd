## Game layer: Engine.time_scale (user slider x kill slow-mo) and corpse auto-cleanup.
## Slow-mo timing uses real clock ticks, so it is not stretched by the time scale it sets.
class_name GameDirector
extends Node

var gore: GoreFX = null
var _slow_until_ms := 0
var _dead: Dictionary = {}   # Npc -> real msec of death


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	GameEvents.npc_died.connect(_on_died)


func _exit_tree() -> void:
	Engine.time_scale = 1.0


func slow_mo_active() -> bool:
	return Time.get_ticks_msec() < _slow_until_ms


func _on_died(npc: Node, _cause: StringName) -> void:
	var now := Time.get_ticks_msec()
	_dead[npc] = now
	if GameSettings.slow_mo_on_kill:
		_slow_until_ms = now + int(GameSettings.slow_mo_duration * 1000.0)


func _process(_delta: float) -> void:
	var f := GameSettings.slow_mo_scale if slow_mo_active() else 1.0
	Engine.time_scale = clampf(GameSettings.time_scale, 0.05, 1.0) * f
	var limit := GameSettings.auto_cleanup_time
	if limit <= 0.0 or _dead.is_empty():
		return
	var now := Time.get_ticks_msec()
	for npc in _dead.keys():
		if not is_instance_valid(npc):
			_dead.erase(npc)
		elif float(now - _dead[npc]) / 1000.0 >= limit:
			_dead.erase(npc)
			if gore:
				gore.forget_npc(npc)
			npc.queue_free()
