## OWNER: damage-wounds-bleed-agent. Blood volume, bleed rates, arterial pulse, loss levels.
## Tunables: data/blood.json
class_name BloodSystem
extends Node

var npc: Npc
var state := BloodState.new()

var _cfg: Dictionary
var _sim_time := 0.0
var _clot_start: Dictionary = {}  # wound id -> sim time first seen


func setup(owner_npc: Npc) -> void:
	npc = owner_npc
	_cfg = DataDB.table("blood")
	state.max_volume = float(_cfg.get("max_volume", 5000.0))
	state.volume = state.max_volume
	state.heart_rate = float(_cfg.get("base_heart_rate", 70.0))
	set_physics_process(true)


func _physics_process(delta: float) -> void:
	step(delta)


## One simulation step (also callable directly by tests with the node's processing disabled).
func step(delta: float) -> void:
	if _cfg.is_empty():
		_cfg = DataDB.table("blood")
	_sim_time += delta
	var dead := is_instance_valid(npc) and npc.is_dead()
	var frac := state.fraction()
	var taper := pow(frac, float(_cfg.get("taper_power", 1.0)))
	var ex_mult := 1.0
	if is_instance_valid(npc):
		ex_mult += float(_cfg.get("exertion_k", 1.0)) * npc.get_exertion()
	var dead_mult := float(_cfg.get("dead_flow_mult", 0.35)) if dead else 1.0

	# heart: rises with blood loss; stops at death or when almost empty
	var hr_base := float(_cfg.get("base_heart_rate", 70.0))
	var hr_max := float(_cfg.get("max_heart_rate", 160.0))
	state.heart_rate = lerpf(hr_base, hr_max, clampf((1.0 - frac) / 0.6, 0.0, 1.0))
	var pulse := 1.0
	if not dead:
		state.pulse_phase = fposmod(state.pulse_phase + state.heart_rate / 60.0 * delta, 1.0)
		pulse = 1.0 + float(_cfg.get("pulse_amplitude", 0.7)) * sin(TAU * state.pulse_phase)

	var ext_total := 0.0
	var int_total := 0.0
	if is_instance_valid(npc) and state.volume > float(_cfg.get("min_volume", 0.0)):
		for w in npc.wounds.get_attached_wounds():
			var clot := _clot_factor(w)
			var ext := w.bleed_rate * clot * taper * ex_mult * dead_mult
			if w.is_arterial and not dead:
				ext *= pulse
			var inn := w.internal_bleed_rate * taper * ex_mult * dead_mult
			w.current_flow = ext
			ext_total += ext
			int_total += inn
	elif is_instance_valid(npc):
		for w in npc.wounds.get_wounds():
			w.current_flow = 0.0

	state.external_rate = ext_total
	state.internal_rate = int_total
	state.volume = maxf(float(_cfg.get("min_volume", 0.0)), state.volume - (ext_total + int_total) * delta)
	_update_level()


func _clot_factor(w: Wound) -> float:
	if w.is_arterial or w.is_stump or w.is_exit or w.severity >= float(_cfg.get("clot_max_severity", 0.35)):
		return 1.0
	if not _clot_start.has(w.id):
		_clot_start[w.id] = _sim_time
	var age: float = _sim_time - float(_clot_start[w.id])
	return maxf(float(_cfg.get("clot_floor", 0.15)), 1.0 - age / float(_cfg.get("clot_time", 45.0)))


func _level_for(frac: float) -> int:
	var lv: Dictionary = _cfg.get("levels", {})
	if frac < float(lv.get("fatal", 0.4)): return BodyIds.BloodLevel.FATAL
	if frac < float(lv.get("critical", 0.55)): return BodyIds.BloodLevel.CRITICAL
	if frac < float(lv.get("heavy", 0.7)): return BodyIds.BloodLevel.HEAVY
	if frac < float(lv.get("light", 0.85)): return BodyIds.BloodLevel.LIGHT
	return BodyIds.BloodLevel.NORMAL


func _update_level() -> void:
	var nl := _level_for(state.fraction())
	if nl != state.level:
		var old := state.level
		state.level = nl
		if is_instance_valid(npc):
			npc.emit_blood_level_changed(old, nl)


func get_debug_info() -> Dictionary:
	return {
		"volume": snappedf(state.volume, 0.1),
		"fraction": snappedf(state.fraction(), 0.001),
		"external_rate": snappedf(state.external_rate, 0.01),
		"internal_rate": snappedf(state.internal_rate, 0.01),
		"level": BodyIds.BloodLevel.keys()[state.level],
		"heart_rate": snappedf(state.heart_rate, 0.1),
	}
