## OWNER: ai-states-agent. NPC finite state machine, pain/shock model, toggles, reaction hooks.
## The brain is the ONLY writer of `state` and the only caller of body.set_ragdoll/set_locomotion/drop_held_item.
class_name NpcBrain
extends Node

const S := BodyIds.NpcState

var npc: Npc
var state: int = S.IDLE

var pain_tolerance := 1.0
var shock_tolerance := 1.0

var _cfg: Dictionary = {}
var _pain_raw := 0.0
var _shock := 0.0
var _state_time := 0.0
var _state_duration := 0.0     # <=0 means untimed
var _stagger_next: int = S.ALERT
var _wake_in := -1.0           # knockdown: seconds until get-up (<0: never)
var _ragdolled := false
var _blood_level: int = BodyIds.BloodLevel.NORMAL
var _flee_dir := Vector3.ZERO
var _panic_left := 0.0
var _scream_t := 0.0
var _stumble_t := 0.0
var _breath_t := 0.0
var _clutch_part := -1
var _leg_down := false
var _limp := {"l": false, "r": false}      # injured (non-crawl) foot/lower leg per side
var _arm_lost := {"l": false, "r": false}  # arm chain (upper/lower/hand) broken or severed per side
var _dead_cause: StringName = &""
var _last_cue_ev := 0


func setup(owner_npc: Npc) -> void:
	npc = owner_npc
	_cfg = DataDB.table("ai")
	var pr: Array = _cfg.get("pain_tolerance_range", [0.7, 1.3])
	var sr: Array = _cfg.get("shock_tolerance_range", [0.7, 1.3])
	pain_tolerance = npc.rng.randf_range(float(pr[0]), float(pr[1]))
	shock_tolerance = npc.rng.randf_range(float(sr[0]), float(sr[1]))
	npc.wounded.connect(_on_wounded)
	npc.part_broken.connect(_on_part_broken)
	npc.part_severed.connect(_on_part_severed)
	npc.stunned.connect(_on_stunned)
	npc.lethal_injury.connect(_on_lethal)
	npc.blood_level_changed.connect(_on_blood_level_changed)
	GameEvents.npc_wounded.connect(_on_other_wounded)
	GameSettings.changed.connect(_on_setting_changed)
	if is_instance_valid(npc.blood):
		_blood_level = npc.blood.state.level
	if GameSettings.ragdoll_only:
		_set_ragdoll(true)


## 0 (resting) .. 1 (sprinting). BloodSystem scales bleeding by this.
func get_exertion() -> float:
	var ex: Dictionary = _cfg.get("exertion", {})
	match state:
		S.PANIC_FLEE: return float(ex.get("run", 1.0))
		S.CRAWL: return float(ex.get("crawl", 0.6))
		S.CLUTCH_WOUND: return float(ex.get("clutch", 0.3))
		S.STAGGER: return float(ex.get("stagger", 0.2))
		S.ALERT: return float(ex.get("walk", 0.3))
		S.FIGHT: return float(ex.get("run", 1.0))  # TODO(roadmap: fight back)
	return float(ex.get("idle", 0.0))


## Current pain 0..1 (after tolerance).
func get_pain() -> float:
	return clampf(_pain_raw / pain_tolerance, 0.0, 1.0)


## Shock 0..1 (from blood loss, after tolerance).
func get_shock() -> float:
	return clampf(_shock / shock_tolerance, 0.0, 1.0)


## Which side limps: "l", "r", "both" or "" (not limping). The orchestrator wires this to the body/IK.
func get_limp_side() -> String:
	if _limp["l"] and _limp["r"]:
		return "both"
	if _limp["l"]:
		return "l"
	if _limp["r"]:
		return "r"
	return ""


func is_limping() -> bool:
	return not _leg_down and get_limp_side() != ""


## Exactly one usable arm (behaviour hook only; nothing branches on it yet).
func is_one_handed() -> bool:
	return _arm_lost["l"] != _arm_lost["r"]


## Debug/test hook: jump straight to a state (runs normal enter logic).
func force_state(new_state: int) -> void:
	if state == S.DEAD:
		return
	match new_state:
		S.PANIC_FLEE:
			if _flee_dir == Vector3.ZERO:
				_flee_dir = _random_dir()
			_panic_left = _rand_range("panic_duration")
		S.CLUTCH_WOUND:
			_clutch_part = BodyIds.Part.TORSO
		S.DEAD:
			_die(&"forced")
			return
	_change(new_state)


func get_debug_info() -> Dictionary:
	return {
		"state": BodyIds.state_name(state),
		"time_in_state": snappedf(_state_time, 0.01),
		"pain": snappedf(get_pain(), 0.01),
		"shock": snappedf(get_shock(), 0.01),
		"pain_tolerance": snappedf(pain_tolerance, 0.01),
		"shock_tolerance": snappedf(shock_tolerance, 0.01),
		"exertion": get_exertion(),
		"flee_dir": _flee_dir,
		"blood_level": _blood_level,
		"ragdolled": _ragdolled,
		"limp_side": get_limp_side(),
		"limping": is_limping(),
		"one_handed": is_one_handed(),
		"usable_arms": int(not _arm_lost["l"]) + int(not _arm_lost["r"]),
	}


# ------------------------------------------------------------------ helpers

func _rand_range(key: String) -> float:
	var r: Array = _cfg.get(key, [1.0, 1.0])
	return npc.rng.randf_range(float(r[0]), float(r[1]))


func _speed(key: String) -> float:
	return float(_cfg.get("speeds", {}).get(key, 1.0))


func _blood_scale() -> float:
	var k: String = BodyIds.BloodLevel.keys()[_blood_level].to_lower()
	return float(_cfg.get("blood_speed_scale", {}).get(k, 1.0))


## Pose + speed for upright movement: limp (reduced speed) when a foot/lower leg is hurt, else `pose`.
func _gait(pose: StringName, speed_key: String) -> Array:
	if is_limping() and (pose == &"run" or pose == &"walk"):
		var cap := float(_cfg.get("limp_speed", 1.6))
		var scale := float(_cfg.get("limp_walk_scale", 0.75)) if pose == &"walk" else 1.0
		return [&"limp", minf(_speed(speed_key), cap) * scale]
	return [pose, _speed(speed_key)]


func _random_dir() -> Vector3:
	var a := npc.rng.randf() * TAU
	return Vector3(cos(a), 0.0, sin(a))


func _flat(v: Vector3) -> Vector3:
	v.y = 0.0
	return v.normalized() if v.length() > 0.01 else Vector3.ZERO


func _set_ragdoll(on: bool) -> void:
	if on == _ragdolled:
		return
	_ragdolled = on
	if is_instance_valid(npc.body):
		npc.body.set_ragdoll(on)


func _inactive() -> bool:
	return state == S.DEAD or GameSettings.ragdoll_only


## Single place where `state` is written.
func _change(new_state: int) -> void:
	if state == S.DEAD:
		return
	var old := state
	if old == S.CLUTCH_WOUND and new_state != S.CLUTCH_WOUND and is_instance_valid(npc.body):
		npc.body.set_clutch_target(-1)
	state = new_state
	_state_time = 0.0
	_state_duration = 0.0
	_wake_in = -1.0
	var want_ragdoll := new_state == S.UNCONSCIOUS or new_state == S.DEAD or GameSettings.ragdoll_only
	_set_ragdoll(want_ragdoll)
	match new_state:
		S.ALERT:
			_state_duration = _rand_range("alert_duration")
		S.STAGGER:
			_state_duration = _rand_range("stagger_duration")
		S.CLUTCH_WOUND:
			_state_duration = _rand_range("clutch_duration")
			if _clutch_part == BodyIds.Part.NECK:
				_state_duration = float(_cfg.get("neck_clutch_duration", 60.0))
			if is_instance_valid(npc.body):
				npc.body.set_clutch_target(_clutch_part)
				_push_clutch_wound()
		S.PANIC_FLEE:
			_scream_t = _rand_range("scream_interval")
			_stumble_t = _rand_range("stumble_interval")
	if old != new_state:
		npc.emit_state_changed(old, new_state)


func _die(cause: StringName) -> void:
	if state == S.DEAD:
		return
	_dead_cause = cause
	_change(S.DEAD)
	npc.emit_died(cause)
	set_physics_process(false)


## After a hit: pick the reaction state. `dir` is the world direction away from the damage source.
func _react(w: Wound, ev: DamageEvent) -> void:
	var dir := _flat(ev.direction) if ev else Vector3.ZERO
	if dir == Vector3.ZERO:
		dir = _random_dir()
	_flee_dir = dir
	var neck_art := w.part_id == BodyIds.Part.NECK and w.is_arterial
	if neck_art:
		_clutch_part = BodyIds.Part.NECK
		if state != S.CLUTCH_WOUND:
			_change(S.CLUTCH_WOUND)
		_push_clutch_wound(w)
		return
	if state == S.CRAWL or state == S.CLUTCH_WOUND and _clutch_part == BodyIds.Part.NECK:
		return
	if w.is_bruise and w.severity < float(_cfg.get("bruise_severity_max", 0.3)):
		_stagger_next = S.ALERT
		_change(S.STAGGER)
		return
	if state == S.PANIC_FLEE:
		return
	if w.part_id == BodyIds.Part.TORSO and w.severity >= float(_cfg.get("clutch_severity_min", 0.6)):
		_clutch_part = w.part_id
		_change(S.CLUTCH_WOUND)
		_push_clutch_wound(w)
		return
	if GameSettings.panic_enabled:
		_panic_left = _rand_range("panic_duration")
		_change(S.PANIC_FLEE)
	else:
		_stagger_next = S.ALERT
		_change(S.STAGGER)


func _after_clutch() -> void:
	if GameSettings.panic_enabled:
		_panic_left = _rand_range("panic_duration")
		_change(S.PANIC_FLEE)
	else:
		_stagger_next = S.ALERT
		_change(S.STAGGER)


func _start_crawl() -> void:
	_leg_down = true
	if _inactive() or state == S.UNCONSCIOUS or state == S.CRAWL:
		return
	if _flee_dir == Vector3.ZERO:
		_flee_dir = _random_dir()
	_breath_t = _rand_range("crawl_breath_interval")
	_change(S.CRAWL)


func _get_up() -> void:
	if _blood_level >= BodyIds.BloodLevel.CRITICAL:
		_wake_in = -1.0
		return
	if _leg_down:
		_start_crawl_from_unconscious()
	elif GameSettings.panic_enabled:
		_flee_dir = _random_dir() if _flee_dir == Vector3.ZERO else _flee_dir
		_panic_left = _rand_range("panic_duration")
		_change(S.PANIC_FLEE)
	else:
		_change(S.ALERT)


func _start_crawl_from_unconscious() -> void:
	if _flee_dir == Vector3.ZERO:
		_flee_dir = _random_dir()
	_breath_t = _rand_range("crawl_breath_interval")
	_change(S.CRAWL)


# ------------------------------------------------------------------ signal handlers

func _on_wounded(w: Wound, ev: DamageEvent) -> void:
	if _inactive() or w.detached:
		return  # wounds on severed pieces (GoreFX still wants them) do not hurt the living NPC
	var tw: Dictionary = _cfg.get("type_pain_weight", {})
	var pw: Dictionary = _cfg.get("part_pain_weight", {})
	var tkey: String = DamageEvent.Type.keys()[w.type].to_lower()
	var add := w.severity * float(tw.get(tkey, 1.0)) * float(pw.get(BodyIds.key(w.part_id), 1.0))
	if w.is_fracture:
		add += float(_cfg.get("fracture_pain", 0.35))
	_pain_raw = minf(_pain_raw + add, float(_cfg.get("pain_cap_raw", 2.0)))
	_note_lower_wound(w)
	if state == S.UNCONSCIOUS:
		return
	# Vocal cues: once per DamageEvent (entry+exit wounds share one ev), brain is the only source.
	var ev_id := ev.get_instance_id() if ev else 0
	if ev == null or ev_id != _last_cue_ev:
		_last_cue_ev = ev_id
		var neck_hit := w.part_id == BodyIds.Part.NECK or (ev != null and ev.part_id == BodyIds.Part.NECK) \
				or (is_instance_valid(npc.wounds) and not npc.wounds.get_wounds_on(BodyIds.Part.NECK).is_empty())
		npc.cue(&"grunt", clampf(w.severity + 0.2, 0.2, 1.0))
		if neck_hit:
			npc.cue(&"gurgle", clampf(w.severity + 0.3, 0.3, 1.0))  # cannot scream effectively
		elif GameSettings.scream_enabled and (get_pain() >= float(_cfg.get("scream_pain_threshold", 0.35))
				or w.severity >= float(_cfg.get("scream_severity_threshold", 0.5))):
			npc.cue(&"scream", maxf(get_pain(), w.severity))
	_react(w, ev)


func _on_part_broken(part_id: int) -> void:
	if _inactive():
		return
	_note_limb_loss(part_id)


func _on_part_severed(part_id: int, _root: RigidBody3D, _ev: DamageEvent) -> void:
	if _inactive():
		return
	_note_limb_loss(part_id, true)


func _note_limb_loss(part_id: int, severed := false) -> void:
	if BodyIds.is_leg(part_id):
		# Broken foot only -> limp. Broken upper/lower leg, or any severed leg/foot -> crawl.
		if BodyIds.is_foot(part_id) and not severed:
			_set_limp(BodyIds.side_of(part_id))
		else:
			_start_crawl()
	elif BodyIds.is_arm(part_id):
		_arm_lost[BodyIds.side_of(part_id)] = true
		if is_instance_valid(npc.body):
			npc.body.drop_held_item(BodyIds.side_of(part_id))


## A real (non-trivial) wound on a foot or lower leg makes the NPC limp without breaking anything.
func _note_lower_wound(w: Wound) -> void:
	if w.part_id in [BodyIds.Part.FOOT_L, BodyIds.Part.FOOT_R, BodyIds.Part.LOWER_LEG_L, BodyIds.Part.LOWER_LEG_R] \
			and w.severity >= float(_cfg.get("limp_wound_severity_min", 0.3)):
		_set_limp(BodyIds.side_of(w.part_id))


func _set_limp(side: String) -> void:
	if side == "" or _limp[side]:
		return
	_limp[side] = true
	if is_instance_valid(npc.body) and npc.body.has_method("set_limp_side"):
		npc.body.set_limp_side(get_limp_side())


## Prefer entry wounds over exit wounds (the hand cannot reach the back), then front-facing, then severity.
func _clutch_better(a: Wound, b: Wound) -> bool:
	if a.is_exit != b.is_exit:
		return not a.is_exit
	var af := a.local_normal.z > 0.0
	var bf := b.local_normal.z > 0.0
	if af != bf:
		return af
	return a.severity > b.severity


## Tell the body where the hand goes: the most severe attached wound on the clutched part.
func _push_clutch_wound(fallback: Wound = null) -> void:
	if not is_instance_valid(npc.body) or not npc.body.has_method("set_clutch_wound") or _clutch_part < 0:
		return
	var best: Wound = null
	if is_instance_valid(npc.wounds):
		for cw in npc.wounds.get_wounds_on(_clutch_part):
			if not cw.detached and (best == null or _clutch_better(cw, best)):
				best = cw
	if best == null and fallback != null and fallback.part_id == _clutch_part:
		best = fallback
	if best != null:
		npc.body.set_clutch_wound(_clutch_part, best.local_position, best.local_normal)


func _on_stunned(duration: float, _cause: StringName) -> void:
	if _inactive() or state == S.UNCONSCIOUS or state == S.CRAWL:
		return
	if duration >= float(_cfg.get("knockdown_min_duration", 2.0)):
		_change(S.UNCONSCIOUS)
		_wake_in = duration
	else:
		_state_duration = duration
		_stagger_next = S.PANIC_FLEE if state == S.PANIC_FLEE else S.ALERT
		if state != S.STAGGER:
			_change(S.STAGGER)
		_state_duration = duration


func _on_lethal(cause: StringName) -> void:
	if state != S.DEAD and GameSettings.scream_enabled and cause not in [&"head_destroyed", &"decapitation", &"headshot", &"decapitated"]:
		npc.cue(&"scream", 1.0)  # single death cue (no head left to scream with -> skipped)
	_die(cause)


func _on_blood_level_changed(_old: int, new_level: int) -> void:
	_blood_level = new_level
	if state == S.DEAD:
		return
	if new_level >= BodyIds.BloodLevel.FATAL:
		_die(&"blood_loss")
	elif new_level >= BodyIds.BloodLevel.CRITICAL and not GameSettings.ragdoll_only:
		if state != S.UNCONSCIOUS:
			_change(S.UNCONSCIOUS)
		_wake_in = -1.0  # collapsed from blood loss: no get-up


func _on_other_wounded(other: Node, _w: Wound, ev: DamageEvent) -> void:
	if other == npc or state != S.IDLE or _inactive():
		return
	var o := other as Node3D
	if o == null or not is_instance_valid(npc):
		return
	var away := _flat(npc.global_position - o.global_position)
	if npc.global_position.distance_to(o.global_position) > float(_cfg.get("alert_radius", 8.0)):
		return
	_flee_dir = away if away != Vector3.ZERO else _random_dir()
	_change(S.ALERT)


func _on_setting_changed(setting: StringName, value) -> void:
	if state == S.DEAD:
		return
	if setting == &"ragdoll_only":
		if value:
			_set_ragdoll(true)
		elif state != S.UNCONSCIOUS:
			_set_ragdoll(false)
	elif setting == &"panic_enabled" and not value and state == S.PANIC_FLEE:
		_stagger_next = S.ALERT
		_change(S.STAGGER)


# ------------------------------------------------------------------ per-frame

func _physics_process(delta: float) -> void:
	if _inactive() or not is_instance_valid(npc):
		return
	_state_time += delta
	_pain_raw = maxf(0.0, _pain_raw - float(_cfg.get("pain_decay_per_s", 0.06)) * delta)
	var frac := 1.0
	if is_instance_valid(npc.blood):
		frac = npc.blood.state.fraction()
	_shock = maxf((1.0 - frac) * float(_cfg.get("shock_gain", 1.6)), 0.0)
	var bs := _blood_scale()
	var body := npc.body
	var pos := npc.global_position
	match state:
		S.IDLE, S.FIGHT:  # TODO(roadmap: fight back)
			body.set_locomotion(Vector3.ZERO, &"idle")
		S.ALERT:
			var g := _gait(&"walk", "walk")
			body.set_locomotion(_flee_dir * g[1] * (bs if g[0] == &"limp" else 1.0), g[0])
			if _state_time >= _state_duration:
				_change(S.IDLE)
		S.PANIC_FLEE:
			_panic_left -= delta
			_flee_dir = _steer_in_arena(pos, _flee_dir)
			if GameSettings.scream_enabled:
				_scream_t -= delta
				if _scream_t <= 0.0:
					_scream_t = _rand_range("scream_interval")
					npc.cue(&"scream", maxf(0.4, get_pain()))
			if _blood_level >= BodyIds.BloodLevel.HEAVY:
				_stumble_t -= delta
				if _stumble_t <= 0.0:
					_stagger_next = S.PANIC_FLEE
					_change(S.STAGGER)
					_state_duration = _rand_range("stumble_duration")
					return
			var g := _gait(&"run", "run")
			body.set_locomotion(_flee_dir * g[1] * bs, g[0])
			if _panic_left <= 0.0:
				_change(S.ALERT)
		S.CLUTCH_WOUND:
			_flee_dir = _steer_in_arena(pos, _flee_dir)
			body.set_locomotion(_flee_dir * _speed("clutch") * bs, &"clutch")
			if _state_time >= _state_duration:
				_after_clutch()
		S.STAGGER:
			var wob := _flee_dir.rotated(Vector3.UP, sin(_state_time * 7.0) * 1.2)
			body.set_locomotion(wob * _speed("stagger") * bs, &"stagger")
			if _state_time >= _state_duration:
				if _stagger_next == S.PANIC_FLEE and _panic_left > 0.0 and GameSettings.panic_enabled:
					_change(S.PANIC_FLEE)
				else:
					_change(S.ALERT)
		S.CRAWL:
			_flee_dir = _steer_in_arena(pos, _flee_dir)
			body.set_locomotion(_flee_dir * _speed("crawl") * bs, &"crawl")
			_breath_t -= delta
			if _breath_t <= 0.0:
				_breath_t = _rand_range("crawl_breath_interval")
				npc.cue(&"pain_breath", maxf(0.3, get_pain()))
		S.UNCONSCIOUS:
			# Ragdolled: no locomotion. Twitching intentionally skipped (body exposes no helper).
			if _wake_in >= 0.0:
				_wake_in -= delta
				if _wake_in < 0.0:
					_get_up()


## Keep inside the arena: reflect the heading when it points outward near the edge.
func _steer_in_arena(pos: Vector3, dir: Vector3) -> Vector3:
	var limit := float(_cfg.get("arena_half_extent", 20.0)) - float(_cfg.get("arena_margin", 2.0))
	if absf(pos.x) > limit and signf(dir.x) == signf(pos.x):
		dir.x = -dir.x
	if absf(pos.z) > limit and signf(dir.z) == signf(pos.z):
		dir.z = -dir.z
	return dir.normalized() if dir.length() > 0.01 else _random_dir()
