## systems-review-agent: end-to-end acceptance test (milestone 2: 15 parts, hands/feet, limp) (real NPCs, real weapons where practical).
## Run: godot --headless --path . res://tests/acceptance_test.tscn
## Output: one "ACC|<id>|PASS/FAIL|<name>|<evidence>" line per check plus "INFO|" diagnostics.
## Exit code 1 if any check FAILs. Optional user arg:  -- only=<section prefix>[,<prefix>...]  (e.g. only=neck or only=hands,m3fight)
extends Node3D

const P := BodyIds.Part
const S := BodyIds.NpcState
const DT := 1.0 / 60.0

var failures := 0
var checks := 0
var _arena: Node3D            # holds floor + per-test "bay"
var _bay: Node3D
var _cues: Array = []         # [npc, cue, intensity]
var _only := ""
var tick := 0
var _samplers: Array[Callable] = []


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("only="):
			_only = a.substr(5)
	_arena = Node3D.new()
	add_child(_arena)
	_build_floor()
	GameEvents.audio_cue.connect(func(n, c, _p, i): _cues.append([n, c, i]))
	await get_tree().physics_frame
	var t0 := Time.get_ticks_msec()
	for sec in ["neck", "body", "knife", "bat", "sever", "hands", "feet", "m3fight", "m3cower", "m3immortal", "m3gore", "m3slowmo", "m3cleanup", "m3react", "m5rifle", "m5shotgun", "m5machete", "m5hammer", "m5jaw", "m5face", "m5regress", "m7", "debug", "sweep", "ragdoll", "seams"]:
		if _only != "" and not _only_match(sec):
			continue
		var s0 := Time.get_ticks_msec()
		_new_bay()
		await call("_sec_" + sec)
		_free_bay()
		print("INFO|section %s took %.1fs wall" % [sec, (Time.get_ticks_msec() - s0) / 1000.0])
	print("ACCEPTANCE %s (%d checks, %d failed, %.1fs wall)" % [
		"FAILED" if failures > 0 else "ALL PASSED", checks, failures, (Time.get_ticks_msec() - t0) / 1000.0])
	get_tree().quit(1 if failures > 0 else 0)


# ------------------------------------------------------------------ helpers

## `only=a,b` runs every section whose name starts with one of the comma-separated prefixes.
func _only_match(sec: String) -> bool:
	for pre in _only.split(","):
		if sec.begins_with(pre):
			return true
	return false


func check(id: String, name: String, ok: bool, evidence := "") -> void:
	checks += 1
	if not ok:
		failures += 1
	print("ACC|%s|%s|%s|%s" % [id, "PASS" if ok else "FAIL", name, evidence])


func info(msg: String) -> void:
	print("INFO|" + msg)


func _build_floor() -> void:
	var fb := StaticBody3D.new()
	fb.name = "Floor"
	fb.collision_layer = BodyIds.LAYER_WORLD
	fb.collision_mask = 0
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(200, 1, 200)
	cs.shape = bs
	cs.position = Vector3(0, -0.5, 0)
	fb.add_child(cs)
	_arena.add_child(fb)


func _new_bay() -> void:
	_bay = Node3D.new()
	_bay.name = "Bay"
	_arena.add_child(_bay)
	_cues.clear()
	_reset_settings()


func _free_bay() -> void:
	_bay.queue_free()
	_bay = null
	_reset_settings()


func _reset_settings() -> void:
	GameSettings.panic_enabled = true
	GameSettings.scream_enabled = true
	GameSettings.ragdoll_only = false
	# milestone 3 settings (defaults from scripts/core/game_settings.gd)
	GameSettings.fight_back = false
	GameSettings.slow_mo_on_kill = false
	GameSettings.slow_mo_scale = 0.3
	GameSettings.slow_mo_duration = 1.5
	GameSettings.immortal_dummy = false
	GameSettings.gore_intensity = GameSettings.Gore.HIGH
	GameSettings.no_dismemberment = false
	GameSettings.auto_cleanup_time = 0.0
	GameSettings.time_scale = 1.0
	Engine.time_scale = 1.0


## Physics ticks are counted here (one per _physics_process call) so durations stay exact even if the engine
## catches up several ticks in one rendered frame. (Do NOT use Engine.time_scale: it scales the physics step.)
func _physics_process(_delta: float) -> void:
	tick += 1
	for cb in _samplers:
		cb.call()


func now() -> float:
	return tick * DT


## Wait n physics ticks.
func frames(n: int) -> void:
	var target := tick + n
	while tick < target:
		await get_tree().physics_frame


func seconds(s: float) -> void:
	await frames(int(round(s / DT)))


## Wait until cond() is true or `limit` seconds of sim time passed. Returns elapsed sim seconds (limit if timeout).
func wait_until(cond: Callable, limit: float) -> float:
	var t0 := tick
	var max_t := t0 + int(limit / DT)
	while tick < max_t and not cond.call():
		await get_tree().physics_frame
	return (tick - t0) * DT


func _spawn(pos := Vector3(0, 0.05, 0), seed_value := 11) -> Npc:
	var n := Npc.spawn(_bay, Transform3D(Basis.IDENTITY, pos), seed_value)
	await frames(3)
	return n


## A holder node in the bay with a real weapon inside. holder transform is set by the caller.
func _weapon(id: String) -> Weapon:
	var holder := Node3D.new()
	holder.name = "Holder_" + id
	_bay.add_child(holder)
	var w := WeaponFactory.create(WeaponDefs.get_def(id), null)
	holder.add_child(w)
	return w


func _part_pos(npc: Npc, part: int) -> Vector3:
	return npc.body.get_part_global_transform(part).origin


## Real handgun, fired from `from_dir` side straight at the centre of `part`. Returns the DamageEvent
## the weapon built (or null on a miss).
func shoot_now(npc: Npc, part: int, from_dir := Vector3(0, 0, 1), dist := 3.0, aim_offset := Vector3.ZERO) -> DamageEvent:
	var gun := _weapon("handgun") as HitscanWeapon
	var target := _part_pos(npc, part) + aim_offset
	var origin := target + from_dir.normalized() * dist
	var ev := gun.fire_ray(origin, -from_dir.normalized())
	gun.get_parent().queue_free()
	return ev


func shoot(npc: Npc, part: int, from_dir := Vector3(0, 0, 1), dist := 3.0, aim_offset := Vector3.ZERO) -> DamageEvent:
	var gun := _weapon("handgun") as HitscanWeapon
	var target := _part_pos(npc, part) + aim_offset
	var origin := target + from_dir.normalized() * dist
	await frames(1)
	var ev := gun.fire_ray(origin, -from_dir.normalized())
	gun.get_parent().queue_free()
	return ev


## Position a melee weapon so its swing/thrust passes through `target` with blade/bat sample fraction f at
## mid-stroke, then fire debug_swing(scale, mode). Returns once the stroke is done. Weapon faces -Z.
func melee_through(w: MeleeWeapon, target: Vector3, scale_v: float, mode: StringName, f := 1.0, yaw_deg := 0.0) -> void:
	w.get_parent().rotation_degrees.y = yaw_deg
	var hb: Basis = w.get_parent().global_transform.basis
	var rt := w.rest_transform
	var len_ := float(w.def.get("length", 0.2))
	var tip_rest: Vector3 = hb * (rt * Vector3(0, 0, -len_ * f))
	var origin := target - tip_rest
	if mode == &"thrust":
		var axis: Vector3 = (hb * rt.basis * Vector3(0, 0, -1)).normalized()
		origin -= axis * float(w.def.get("thrust", {}).get("distance", 0.6)) * 0.5
	w.get_parent().global_position = origin
	await frames(3)
	w.debug_swing(scale_v, mode)
	for i in 240:
		await get_tree().physics_frame
		if not w.is_busy():
			break
	await frames(2)


func _record_hits(w: Weapon, into: Array) -> void:
	w.hit_resolved.connect(func(ev: DamageEvent, applied: bool): into.append([ev, applied]))


func _state_name(npc: Npc) -> String:
	return BodyIds.state_name(npc.get_state())


func _count_cues(npc: Npc, cue: StringName) -> int:
	var c := 0
	for x in _cues:
		if x[0] == npc and x[1] == cue:
			c += 1
	return c


func _vec_ok(v: Vector3, limit := 1e4) -> bool:
	return is_finite(v.x) and is_finite(v.y) and is_finite(v.z) and v.length() < limit


## All attached+severed segment nodes of an NPC are finite and inside a sane box.
func _npc_sane(npc: Npc) -> String:
	for pid in BodyIds.KEYS:
		var node := npc.body.get_part_node(pid)
		if node == null or not is_instance_valid(node):
			continue
		var p: Vector3 = node.global_position
		if not _vec_ok(p, 200.0):
			return "%s pos=%s" % [BodyIds.key(pid), p]
		if node is RigidBody3D:
			var rb := node as RigidBody3D
			if not _vec_ok(rb.linear_velocity, 80.0):
				return "%s lin_vel=%s" % [BodyIds.key(pid), rb.linear_velocity]
			if p.y > 4.0 or p.y < -1.0:
				return "%s y=%.2f" % [BodyIds.key(pid), p.y]
	return ""


# ------------------------------------------------------------------ 1. neck shot

func _sec_neck() -> void:
	var npc := await _spawn()
	var states: Array = []          # [t, name]
	var died_at := [-1.0]
	var t := [0.0]
	var t_shot0 := [0.0]
	npc.state_changed.connect(func(_o, n): states.append([now() - t_shot0[0], BodyIds.state_name(n)]))
	npc.died.connect(func(cause): died_at[0] = now() - t_shot0[0]; info("neck: died cause=%s at t=%.2f" % [cause, died_at[0]]))
	var start := npc.global_position
	t_shot0[0] = now()
	var ev := await shoot(npc, P.NECK)
	check("1.0", "handgun ray resolves to NECK", ev != null and ev.part_id == P.NECK,
		ev.describe() if ev else "miss")
	var neck_w: Wound = null
	for w in npc.wounds.get_wounds_on(P.NECK):
		if w.is_arterial:
			neck_w = w
	check("1.1", "neck bullet creates arterial wound", neck_w != null,
		str(npc.wounds.get_debug_info().wounds))
	if neck_w == null:
		return
	var flows: Array[float] = []
	var sampler := func() -> void:
		flows.append(neck_w.current_flow)
	_samplers.append(sampler)
	await wait_until(func(): return npc.is_dead(), 60.0)
	_samplers.erase(sampler)
	t[0] = now() - t_shot0[0]
	var dead := npc.is_dead()
	var names: Array = states.map(func(s): return s[1])
	check("1.2", "neck: stumbles (CLUTCH_WOUND, still moving) before collapse",
		"CLUTCH_WOUND" in names, "states=%s" % str(states.map(func(s): return "%.1fs:%s" % [s[0], s[1]])))
	var moved := (npc.body.get_center() - start).length()
	info("neck: moved %.2f m from start while bleeding" % moved)
	check("1.2b", "neck: NPC actually locomotes while clutching (>0.3 m)", moved > 0.3, "moved=%.2f m" % moved)
	check("1.3", "neck: dies of blood loss", dead, "dead=%s t=%.1fs state=%s" % [dead, t[0], _state_name(npc)])
	check("1.4", "neck: death time within 10-25 s", dead and died_at[0] >= 10.0 and died_at[0] <= 25.0,
		"t_death=%.1fs" % died_at[0])
	# pulsing: count local maxima of a lightly-smoothed flow trace
	var peaks := 0
	var n := flows.size()
	for i in range(2, n - 2):
		var a: float = flows[i]
		if a > flows[i - 1] and a >= flows[i + 1] and a > flows[i - 2] and a >= flows[i + 2]:
			peaks += 1
	# amplitude over a 1 s window in the first 5 s
	var win_min := 1e9
	var win_max := -1e9
	for i in range(30, mini(90, n)):
		win_min = minf(win_min, flows[i])
		win_max = maxf(win_max, flows[i])
	var secs := n * DT
	var bpm := peaks / maxf(secs, 0.1) * 60.0
	check("1.5", "neck: flow pulses (oscillates 1 s window, peak/min > 1.5; 60-170 bpm)",
		win_max > 1.5 * win_min and bpm > 60.0 and bpm < 170.0,
		"peaks=%d over %.1fs = %.0f bpm; 1s window min=%.1f max=%.1f" % [peaks, secs, bpm, win_min, win_max])
	# taper: mean of first 2 s vs mean of last 2 s while alive (exclude dead 0.35x phase)
	var first := _mean(flows, 0, 120)
	var last_end := n
	if died_at[0] > 0.0:
		last_end = mini(n, int(died_at[0] / DT))
	var last := _mean(flows, maxi(last_end - 120, 0), last_end)
	check("1.6", "neck: flow tapers as blood is lost (last 2 s mean < 0.75x first 2 s mean)",
		last < first * 0.75, "first2s=%.1f last2s=%.1f ratio=%.2f" % [first, last, last / maxf(first, 0.001)])
	# resting after death
	await seconds(2.0)
	var sane := _npc_sane(npc)
	check("1.7", "neck: corpse ragdoll sane (finite, bounded)", sane == "", sane)
	var corpse_speed := 0.0
	var tn := npc.body.get_part_node(P.TORSO) as RigidBody3D
	if tn:
		corpse_speed = tn.linear_velocity.length()
	info("neck: final volume %.0f of %.0f, corpse torso speed %.2f" % [npc.blood.state.volume, npc.blood.state.max_volume, corpse_speed])


func _mean(a: Array, from: int, to: int) -> float:
	var s := 0.0
	var c := 0
	for i in range(maxi(from, 0), mini(to, a.size())):
		s += float(a[i])
		c += 1
	return s / maxf(c, 1)


# ------------------------------------------------------------------ 2. body shot

func _sec_body() -> void:
	# Two NPCs side by side (x = -6 panic ON, x = +6 panic OFF) so both slow bleed-outs run concurrently.
	# GameSettings.panic_enabled is read when the NPC reacts, so it is flipped around each shot.
	var on := await _spawn(Vector3(-6, 0.05, 0), 21)
	var off := await _spawn(Vector3(6, 0.05, 0), 21)
	var start_on := on.body.get_center()
	var start_off := off.body.get_center()
	var seen_on: Dictionary = {}
	var seen_off: Dictionary = {}
	var max_ex_off := [0.0]
	var collapse := {"on": -1.0, "off": -1.0}
	var t_shot := [0.0]
	var smp := func() -> void:
		seen_on[_state_name(on)] = true
		seen_off[_state_name(off)] = true
		max_ex_off[0] = maxf(max_ex_off[0], off.get_exertion())
		if collapse.on < 0.0 and (on.get_state() == S.UNCONSCIOUS or on.is_dead()):
			collapse.on = now() - t_shot[0]
		if collapse.off < 0.0 and (off.get_state() == S.UNCONSCIOUS or off.is_dead()):
			collapse.off = now() - t_shot[0]
	_samplers.append(smp)
	t_shot[0] = now()
	GameSettings.panic_enabled = true
	var ev := await shoot(on, P.TORSO, Vector3(0, 0, 1), 4.0, Vector3(0, 0.12, 0))
	var st_on0 := _state_name(on)
	GameSettings.panic_enabled = false
	var ev2 := await shoot(off, P.TORSO, Vector3(0, 0, 1), 4.0, Vector3(0, 0.12, 0))
	var st_off0 := _state_name(off)
	check("2.0", "handgun rays resolve to TORSO", ev != null and ev.part_id == P.TORSO and ev2 != null and ev2.part_id == P.TORSO,
		"%s | %s" % [ev.describe() if ev else "miss", ev2.describe() if ev2 else "miss"])
	await seconds(2.0)
	var disp := on.body.get_center() - start_on
	disp.y = 0.0
	var away := disp.dot(Vector3(0, 0, -1))
	check("2.1", "panic ON: body shot -> PANIC_FLEE", st_on0 == "PANIC_FLEE" or seen_on.has("PANIC_FLEE"),
		"state@shot=%s states seen in 2 s=%s" % [st_on0, str(seen_on.keys())])
	check("2.2", "panic ON: NPC moves away from shooter (>2 m along fire direction in 2 s)", away > 2.0,
		"displacement=%.2f m (away component %.2f)" % [disp.length(), away])
	var disp2 := off.body.get_center() - start_off
	disp2.y = 0.0
	check("2.4", "panic OFF: no PANIC_FLEE; reacts STAGGER/CLUTCH_WOUND (stands/staggers)",
		not seen_off.has("PANIC_FLEE") and (seen_off.has("STAGGER") or seen_off.has("CLUTCH_WOUND")),
		"states seen in 2 s=%s first=%s" % [str(seen_off.keys()), st_off0])
	check("2.5", "panic OFF: NPC stays near (<2.5 m in 2 s) and exertion low (<0.5)", disp2.length() < 2.5 and max_ex_off[0] < 0.5,
		"displacement=%.2f m max_exertion=%.2f" % [disp2.length(), max_ex_off[0]])
	# panic stays OFF from here on: flipping it would change the OFF NPC's follow-up (_after_clutch -> flee). The ON NPC has
	# already chosen PANIC_FLEE; its later transitions do not read the flag (only a post-stumble flee resume does).
	await wait_until(func(): return collapse.on > 0.0 and collapse.off > 0.0, 150.0)
	_samplers.erase(smp)
	check("2.3", "panic ON: collapses from blood loss later (UNCONSCIOUS/DEAD)", collapse.on > 0.0,
		"collapse t=%.1fs state=%s level=%s vol=%.0f/%.0f" % [collapse.on, _state_name(on),
			BodyIds.BloodLevel.keys()[on.blood.state.level], on.blood.state.volume, on.blood.state.max_volume])
	check("2.3b", "panic ON: collapse is not instant (>10 s after the shot)", collapse.on > 10.0, "t=%.1fs" % collapse.on)
	check("2.6", "panic OFF: still collapses from blood loss later", collapse.off > 10.0,
		"collapse t=%.1fs state=%s vol=%.0f" % [collapse.off, _state_name(off), off.blood.state.volume])
	check("2.7", "panic ON bleeds out faster than panic OFF (running raises exertion)", collapse.on > 0.0 and collapse.on < collapse.off,
		"ON=%.1fs OFF=%.1fs" % [collapse.on, collapse.off])


# ------------------------------------------------------------------ 3. knife

func _fresh_torso_npc(seed_value := 31) -> Npc:
	return await _spawn(Vector3(0, 0.05, 0), seed_value)


## One knife stroke on a fresh NPC torso. Returns {npc, hits(all [ev,applied]), torso_hit (ev or null), ...}
func _knife_stroke(mode: StringName, scale_v: float, part := P.TORSO, f := 1.0, aim_offset := Vector3(0, 0.1, 0), seed_value := 31, yaw_deg := 0.0) -> Dictionary:
	var npc := await _spawn(Vector3(0, 0.05, 0), seed_value)
	var w := _weapon("knife") as MeleeWeapon
	var hits: Array = []
	_record_hits(w, hits)
	var tgt := _part_pos(npc, part) + aim_offset
	await melee_through(w, tgt, scale_v, mode, f, yaw_deg)
	var on_part: DamageEvent = null
	var applied := false
	for h in hits:
		if h[0].part_id == part:
			on_part = h[0]
			applied = h[1]
	return {"npc": npc, "hits": hits, "ev": on_part, "applied": applied, "w": w}


func _sec_knife() -> void:
	var stab := await _knife_stroke(&"thrust", 1.0)
	var slash := await _knife_stroke(&"swing", 1.0)
	var sev: DamageEvent = stab.ev
	var slv: DamageEvent = slash.ev
	check("3.1", "knife thrust -> BLADE_STAB on torso", sev != null and sev.type == DamageEvent.Type.BLADE_STAB and stab.applied,
		"hits=%s" % str(stab.hits.map(func(h): return h[0].describe())))
	check("3.2", "knife swing -> BLADE_SLASH on torso", slv != null and slv.type == DamageEvent.Type.BLADE_SLASH and slash.applied,
		"hits=%s" % str(slash.hits.map(func(h): return h[0].describe())))
	if sev == null or slv == null:
		return
	var sn: Npc = stab.npc
	var ln: Npc = slash.npc
	await frames(3)
	var sw: Wound = _first_wound(sn, P.TORSO, DamageEvent.Type.BLADE_STAB)
	var lw: Wound = _first_wound(ln, P.TORSO, DamageEvent.Type.BLADE_SLASH)
	check("3.3", "stab and slash wounds both exist", sw != null and lw != null,
		"stab=%s slash=%s" % [sw.describe() if sw else "none", lw.describe() if lw else "none"])
	if sw != null and lw != null:
		var differ := sw.type != lw.type and (sw.internal_bleed_rate != lw.internal_bleed_rate or sw.bleed_rate != lw.bleed_rate)
		check("3.4", "stab vs slash wounds differ (type, internal vs external bleed)", differ,
			"stab ext=%.1f int=%.1f sev=%.2f depth=%.3f dirlen=%.1f | slash ext=%.1f int=%.1f sev=%.2f dirlen=%.1f" % [
				sw.bleed_rate, sw.internal_bleed_rate, sw.severity, sev.penetration, sw.local_direction.length(),
				lw.bleed_rate, lw.internal_bleed_rate, lw.severity, lw.local_direction.length()])
		check("3.5", "stab = deep/internal (int > ext); slash = surface/external (int == 0, ext > stab ext)",
			sw.internal_bleed_rate > sw.bleed_rate and lw.internal_bleed_rate == 0.0 and lw.bleed_rate > sw.bleed_rate,
			"stab int=%.1f ext=%.1f | slash int=%.1f ext=%.1f" % [sw.internal_bleed_rate, sw.bleed_rate, lw.internal_bleed_rate, lw.bleed_rate])
	for d in [stab, slash]:
		(d.npc as Npc).queue_free()
		(d.w as Node).get_parent().queue_free()
	await frames(2)

	# slow vs fast (stroke speed -> amount), both modes
	var amounts := {}
	for mode in [&"swing", &"thrust"]:
		var row: Array = []
		for sc in [0.15, 0.5, 1.0, 1.5]:
			var r := await _knife_stroke(mode, sc)
			var ev: DamageEvent = r.ev
			var a: float = ev.amount if ev else -1.0
			row.append(snappedf(a, 0.1))
			amounts[str(mode) + str(sc)] = {"a": a, "speed": (ev.extra.get("speed", 0.0) if ev else 0.0), "applied": r.applied, "sev": null}
			if r.applied and ev:
				await frames(2)
			(r.npc as Npc).queue_free()
			(r.w as Node).get_parent().queue_free()
			await frames(2)
		var a0: float = amounts[str(mode) + "0.15"].a
		var a1: float = amounts[str(mode) + "0.5"].a
		var a2: float = amounts[str(mode) + "1.0"].a
		var a3: float = amounts[str(mode) + "1.5"].a
		check("3.6-" + str(mode), "knife %s: damage scales with speed (slow < medium < fast, slow not delivered)" % mode,
			a0 < a1 and a1 < a2 and a2 <= a3 and not amounts[str(mode) + "0.15"].applied and a2 > 5.0,
			"scale 0.15/0.5/1.0/1.5 -> amount %s speeds=%s" % [str(row), str([amounts[str(mode) + "0.15"].speed, amounts[str(mode) + "0.5"].speed, amounts[str(mode) + "1.0"].speed, amounts[str(mode) + "1.5"].speed].map(func(x): return snappedf(x, 0.1)))])


func _first_wound(npc: Npc, part: int, type: int) -> Wound:
	for w in npc.wounds.get_wounds_on(part):
		if w.type == type and not w.is_exit:
			return w
	return null


# ------------------------------------------------------------------ 4. bat

func _bat_stroke(part: int, scale_v: float, f := 0.75, aim_offset := Vector3.ZERO, seed_value := 41, yaw_deg := 0.0) -> Dictionary:
	var npc := await _spawn(Vector3(0, 0.05, 0), seed_value)
	var w := _weapon("bat") as MeleeWeapon
	var hits: Array = []
	_record_hits(w, hits)
	var stunned: Array = []
	npc.stunned.connect(func(d, c): stunned.append([d, c]))
	var broken: Array = []
	npc.part_broken.connect(func(p): broken.append(p))
	var states: Array = []
	npc.state_changed.connect(func(_o, n): states.append(BodyIds.state_name(n)))
	await melee_through(w, _part_pos(npc, part) + aim_offset, scale_v, &"swing", f, yaw_deg)
	var on_part: DamageEvent = null
	var applied := false
	for h in hits:
		if h[0].part_id == part:
			on_part = h[0]
			applied = h[1]
	return {"npc": npc, "hits": hits, "ev": on_part, "applied": applied, "stunned": stunned, "broken": broken, "states": states, "w": w}


func _cleanup_stroke(r: Dictionary) -> void:
	(r.npc as Npc).queue_free()
	(r.w as Node).get_parent().queue_free()


func _sec_bat() -> void:
	# --- head: heavy swing knocks down, weak swing does not
	var heavy := await _bat_stroke(P.HEAD, 2.0)
	var hev: DamageEvent = heavy.ev
	check("4.0", "bat swing connects with HEAD (BLUNT)", hev != null and hev.type == DamageEvent.Type.BLUNT and heavy.applied,
		"hits=%s" % str(heavy.hits.map(func(h): return h[0].describe())))
	if hev != null:
		await seconds(0.5)
		var hn: Npc = heavy.npc
		check("4.1", "bat heavy head hit knocks down (stun >= 2 s -> UNCONSCIOUS + ragdoll)",
			hn.get_state() == S.UNCONSCIOUS and hn.body.is_ragdoll(),
			"amount=%.1f stunned=%s state=%s ragdoll=%s" % [hev.amount, str(heavy.stunned), _state_name(hn), hn.body.is_ragdoll()])
		await seconds(3.0)
		check("4.1b", "knocked-down NPC wakes up after the stun (not stuck)", hn.get_state() != S.UNCONSCIOUS or hn.blood.state.level >= BodyIds.BloodLevel.CRITICAL,
			"state after 3.5 s=%s" % _state_name(hn))
	_cleanup_stroke(heavy)
	await frames(2)
	var weak := await _bat_stroke(P.HEAD, 0.45)
	var wev: DamageEvent = weak.ev
	if wev != null:
		await seconds(0.3)
		var wn: Npc = weak.npc
		check("4.2", "bat weak head hit does NOT knock down (stagger/stun < 2 s only)",
			wn.get_state() != S.UNCONSCIOUS and not wn.body.is_ragdoll(),
			"amount=%.1f applied=%s stunned=%s state=%s" % [wev.amount, weak.applied, str(weak.stunned), _state_name(wn)])
	else:
		check("4.2", "bat weak head hit connects", false, "no hit on head")
	_cleanup_stroke(weak)
	await frames(2)

	# --- limb: fracture depends on force (lower arm fracture_force 35)
	var hard := await _bat_stroke(P.LOWER_ARM_R, 2.0, 0.75)
	var hard_ev: DamageEvent = hard.ev
	var hard_np: Npc = hard.npc
	var hard_bp: BodyPart = hard_np.damage.get_part(P.LOWER_ARM_R)
	check("4.3", "bat hard hit on lower arm fractures it (part.broken, is_fracture wound, part_broken signal)",
		hard_ev != null and hard_bp.broken and P.LOWER_ARM_R in hard.broken,
		"amount=%s broken=%s signal=%s" % [("%.1f" % hard_ev.amount) if hard_ev else "no-hit", hard_bp.broken, str(hard.broken)])
	_cleanup_stroke(hard)
	await frames(2)
	var soft := await _bat_stroke(P.LOWER_ARM_R, 0.5, 0.75)
	var soft_ev: DamageEvent = soft.ev
	var soft_np: Npc = soft.npc
	var soft_bp: BodyPart = soft_np.damage.get_part(P.LOWER_ARM_R)
	check("4.4", "bat soft hit on lower arm does NOT fracture (bruise only)",
		soft_ev != null and soft.applied and not soft_bp.broken,
		"amount=%s broken=%s bruise=%.2f" % [("%.1f" % soft_ev.amount) if soft_ev else "no-hit", soft_bp.broken, soft_bp.bruise])
	_cleanup_stroke(soft)
	await frames(2)

	# --- data-level: every melee weapon in weapons.json declares velocity scaling
	var unscaled: Array = []
	for d in WeaponDefs.all():
		if d.get("kind", "") == "melee" and not (float(d.get("velocity_ref", 0.0)) > 0.0 and float(d.get("min_velocity", -1.0)) >= 0.0
				and float(d.get("max_damage_scale", 0.0)) > 1.0):
			unscaled.append(d.get("id"))
	check("4.6", "every melee weapon def has velocity_ref / min_velocity / max_damage_scale > 1 (data-driven velocity scaling)",
		unscaled.is_empty(), "melee ids=%s unscaled=%s" % [str(WeaponDefs.all().filter(func(d): return d.get("kind", "") == "melee").map(func(d): return d.id)), str(unscaled)])

	# --- velocity scaling for bat on torso
	var row: Array = []
	var amts: Array[float] = []
	for sc in [0.15, 0.5, 1.0, 1.5, 2.0]:
		var r := await _bat_stroke(P.TORSO, sc, 0.75)
		var ev: DamageEvent = r.ev
		amts.append(ev.amount if ev else -1.0)
		row.append(snappedf(amts[-1], 0.1))
		_cleanup_stroke(r)
		await frames(2)
	check("4.5", "bat damage scales with swing speed (strictly increasing; slowest ~0)",
		amts[0] >= 0.0 and amts[0] < amts[1] and amts[1] < amts[2] and amts[2] < amts[3] and amts[3] <= amts[4] + 0.01,
		"scale 0.15/0.5/1.0/1.5/2.0 -> amount %s" % str(row))


# ------------------------------------------------------------------ 5. dismemberment

func _sec_sever() -> void:
	# Real knife, fastest stroke (scale 2.5 -> tip > dismember_min_velocity 7 m/s) through the right lower arm.
	var r := await _knife_stroke(&"swing", 2.5, P.LOWER_ARM_R, 0.75, Vector3.ZERO, 51)
	var npc: Npc = r.npc
	var ev: DamageEvent = r.ev
	var severed_notes: Array = []
	info("sever: knife hits=%s" % str(r.hits.map(func(h): return h[0].describe() + " can_dismember=%s applied=%s" % [h[0].can_dismember, h[1]])))
	var arm_bp: BodyPart = npc.damage.get_part(P.LOWER_ARM_R)
	var real_ok: bool = ev != null and arm_bp.severed
	var used_real := real_ok
	if not real_ok:
		# Fallback: DamageEvent built exactly like MeleeWeapon._build_event for a fast slash.
		info("sever: real knife stroke did not sever (ev=%s) -> using weapon-equivalent DamageEvent" % (ev.describe() if ev else "none"))
		(r.w as Node).get_parent().queue_free()
		npc.queue_free()
		await frames(2)
		npc = await _spawn(Vector3(0, 0.05, 0), 51)
		var kdef := WeaponDefs.get_def("knife")
		var e := DamageEvent.new()
		e.type = DamageEvent.Type.BLADE_SLASH
		e.weapon_id = &"knife"
		var speed := 13.0
		e.impactor_velocity = Vector3(speed, 0, 0)
		e.direction = Vector3.RIGHT
		e.impactor_mass = float(kdef.mass)
		e.amount = float(kdef.base_damage) * clampf(speed / float(kdef.velocity_ref), 0.0, float(kdef.max_damage_scale))
		e.penetration = float(kdef.slash_penetration) if kdef.has("slash_penetration") else 0.03
		e.can_dismember = speed > float(kdef.dismember_min_velocity)
		e.part_id = P.LOWER_ARM_R
		e.hit_position = _part_pos(npc, P.LOWER_ARM_R)
		e.hit_normal = Vector3.BACK
		ev = e
		npc.part_severed.connect(func(p, root, _e): severed_notes.append([p, root]))
		npc.apply_damage(e)
		arm_bp = npc.damage.get_part(P.LOWER_ARM_R)
	else:
		(r.w as Node).get_parent().queue_free()
	var piece_info := await _sever_checks(npc, P.LOWER_ARM_R, severed_notes, used_real)
	info("sever: %s" % piece_info)


## Shared post-sever verification.
func _sever_checks(npc: Npc, part: int, notes: Array, used_real: bool, pfx := "5") -> String:
	var seg_node := npc.body.get_part_node(part) as RigidBody3D     # BodySegment kept in _segments after severing
	await seconds(3.0)
	var bp: BodyPart = npc.damage.get_part(part)
	var src := "REAL weapon stroke" if used_real else "weapon-equivalent DamageEvent"
	check(pfx + ".0", "limb severed (%s)" % src, bp.severed, "severed=%s" % bp.severed)
	var is_rb := seg_node != null and seg_node is RigidBody3D
	var detached_from_body: bool = seg_node != null and seg_node.get_parent() != npc.body
	check(pfx + ".1", "severed piece is a separate RigidBody3D no longer under NpcBody", is_rb and detached_from_body,
		"class=%s parent=%s attached=%s" % [seg_node.get_class() if seg_node else "null",
			seg_node.get_parent().name if seg_node and seg_node.get_parent() else "null",
			npc.body.has_part(part)])
	var y := 99.0
	var spd := 99.0
	if is_rb:
		var rb := seg_node as RigidBody3D
		y = rb.global_position.y
		spd = rb.linear_velocity.length()
	check(pfx + ".2", "piece rests on the floor (y < 0.35, speed < 0.3 after 3 s)", y < 0.35 and spd < 0.3,
		"y=%.3f speed=%.3f sleeping=%s" % [y, spd, str((seg_node as RigidBody3D).sleeping) if is_rb else "n/a"])
	var layer_ok: bool = is_rb and (seg_node.collision_layer & BodyIds.LAYER_NPC_PARTS) != 0 and seg_node.has_meta(BodyIds.META_NPC)
	check(pfx + ".3", "piece stays on npc_parts layer with npc/part_id metas (can still be hit)", layer_ok,
		"layer=%d meta_npc=%s" % [seg_node.collision_layer if is_rb else -1, str(seg_node.has_meta(BodyIds.META_NPC)) if is_rb else "n/a"])
	var parent_part := BodyIds.parent_of(part)
	var stump: Wound = null
	for w in npc.wounds.get_wounds_on(parent_part):
		if w.is_stump:
			stump = w
	check(pfx + ".4", "stump wound on parent part, attached (not detached)", stump != null and not stump.detached,
		stump.describe() if stump else "no stump wound on %s" % BodyIds.key(parent_part))
	check(pfx + ".5", "stump wound bleeding (current_flow > 0)", stump != null and stump.current_flow > 0.0,
		"flow=%.2f volume=%.0f" % [stump.current_flow if stump else -1.0, npc.blood.state.volume])
	var v1 := npc.blood.state.volume
	await seconds(2.0)
	check(pfx + ".6", "blood volume dropping after sever", npc.blood.state.volume < v1,
		"%.1f -> %.1f ext_rate=%.1f" % [v1, npc.blood.state.volume, npc.blood.state.external_rate])
	var piece_wounds_detached := true
	for w in npc.wounds.get_wounds_on(part):
		if not w.detached:
			piece_wounds_detached = false
	check(pfx + ".7", "wounds on the severed piece are detached (no longer drain the body)", piece_wounds_detached,
		str(npc.wounds.get_debug_info().wounds))
	check(pfx + ".8", "NPC itself survives the sever (not DEAD instantly, body still upright/animated or in a reaction)",
		not npc.is_dead() and _npc_sane(npc) == "", "state=%s sane='%s'" % [_state_name(npc), _npc_sane(npc)])
	return "piece y=%.3f class=%s" % [y, seg_node.get_class() if seg_node else "null"]


# ------------------------------------------------------------------ 5b/5c. hands and feet

## DamageEvent built exactly like MeleeWeapon._build_event for a fast knife slash (fallback when the real stroke misses).
func _slash_event(npc: Npc, part: int, speed := 13.0) -> DamageEvent:
	var kdef := WeaponDefs.get_def("knife")
	var e := DamageEvent.new()
	e.type = DamageEvent.Type.BLADE_SLASH
	e.weapon_id = &"knife"
	e.impactor_velocity = Vector3(speed, 0, 0)
	e.direction = Vector3.RIGHT
	e.impactor_mass = float(kdef.mass)
	e.amount = float(kdef.base_damage) * clampf(speed / float(kdef.velocity_ref), 0.0, float(kdef.max_damage_scale))
	e.penetration = float(kdef.slash_penetration) if kdef.has("slash_penetration") else 0.03
	e.can_dismember = speed > float(kdef.dismember_min_velocity)
	e.part_id = part
	e.hit_position = _part_pos(npc, part)
	e.hit_normal = Vector3.BACK
	return e


## Real knife slash through `part` (fast stroke). Falls back to a weapon-equivalent event when the stroke does not sever.
## Returns {npc, real(bool), notes}.
func _knife_sever(part: int, seed_value: int, aim_offset := Vector3.ZERO, f := 0.75, yaw_deg := 0.0) -> Dictionary:
	var r := await _knife_stroke(&"swing", 2.5, part, f, aim_offset, seed_value, yaw_deg)
	var npc: Npc = r.npc
	info("%s: knife hits=%s" % [BodyIds.key(part), str(r.hits.map(func(h): return h[0].describe() + " can_dismember=%s applied=%s" % [h[0].can_dismember, h[1]]))])
	var notes: Array = []
	var real: bool = r.ev != null and npc.damage.get_part(part).severed
	(r.w as Node).get_parent().queue_free()
	if not real:
		info("%s: real knife stroke did not sever (ev=%s) -> weapon-equivalent DamageEvent" % [BodyIds.key(part), r.ev.describe() if r.ev else "none"])
		npc.queue_free()
		await frames(2)
		npc = await _spawn(Vector3(0, 0.05, 0), seed_value)
		npc.part_severed.connect(func(p, root, _e): notes.append([p, root]))
		npc.apply_damage(_slash_event(npc, part))
	return {"npc": npc, "real": real, "notes": notes}


func _sec_hands() -> void:
	# --- H.1 handgun through the right hand (real HitscanWeapon, diagonal so the torso never shadows the hand)
	var npc := await _spawn(Vector3(0, 0.05, 0), 111)
	var states: Array = []
	npc.state_changed.connect(func(_o, n): states.append(BodyIds.state_name(n)))
	var broken: Array = []
	npc.part_broken.connect(func(p): broken.append(p))
	var held_before: String = npc.body.get_debug_info().held_item
	var ev := await shoot(npc, P.HAND_R, Vector3(-0.6, 0, 1), 3.0)
	check("H.1", "handgun ray resolves to HAND_R (BULLET)", ev != null and ev.part_id == P.HAND_R and ev.type == DamageEvent.Type.BULLET,
		ev.describe() if ev else "miss")
	if ev == null or ev.part_id != P.HAND_R:
		npc.queue_free()
		return
	await seconds(1.0)
	var bp: BodyPart = npc.damage.get_part(P.HAND_R)
	var w_on: Array = npc.wounds.get_wounds_on(P.HAND_R)
	var rate := npc.blood.state.external_rate + npc.blood.state.internal_rate
	check("H.2", "bullet through hand: hand takes damage (hp lost, or broken/severed) and a wound is recorded on HAND_R",
		(bp.hp < bp.max_hp or bp.broken or bp.severed) and w_on.size() >= 1,
		"hp=%.1f/%.1f broken=%s severed=%s destroyed=%s wounds=%s" % [bp.hp, bp.max_hp, bp.broken, bp.severed, bp.destroyed, str(w_on.map(func(w): return w.describe()))])
	check("H.3", "hand bullet bleeds, but far less than a torso/neck shot, and the NPC is not killed outright",
		rate > 0.0 and rate < 60.0 and not npc.is_dead(), "bleed(ext+int)=%.1f /s state=%s level=%s" % [rate, _state_name(npc), BodyIds.BloodLevel.keys()[npc.blood.state.level]])
	check("H.4", "hand hit makes the NPC react (leaves IDLE) and hand loss/fracture does not make it crawl",
		states.size() > 0 and npc.get_state() != S.CRAWL, "states=%s now=%s broken=%s" % [str(states), _state_name(npc), str(broken)])
	var fully_gone := bp.severed or not npc.body.has_part(P.HAND_R)
	info("hands: held item before='%s' after='%s'; hand_r severed=%s broken=%s one_handed=%s" % [held_before,
		npc.body.get_debug_info().held_item, bp.severed, bp.broken, str(npc.brain.is_one_handed())])
	if fully_gone or bp.broken:
		check("H.4b", "broken/lost right hand makes the brain treat the NPC as one-handed", npc.brain.is_one_handed(), "usable arms=%s" % str(npc.brain.get_debug_info().usable_arms))
	await seconds(3.0)
	check("H.5", "shot-hand NPC stays sane (finite, bounded)", _npc_sane(npc) == "", _npc_sane(npc))
	npc.queue_free()
	await frames(2)

	# --- H.6 left hand too (left/right symmetry of the data rows)
	var nl := await _spawn(Vector3(0, 0.05, 0), 112)
	var evl := await shoot(nl, P.HAND_L, Vector3(0.6, 0, 1), 3.0)
	await seconds(0.5)
	var bl: BodyPart = nl.damage.get_part(P.HAND_L)
	check("H.6", "handgun ray resolves to HAND_L and damages it (mirror of H.1)",
		evl != null and evl.part_id == P.HAND_L and (bl.hp < bl.max_hp or bl.broken or bl.severed), "%s hp=%.1f/%.1f" % [evl.describe() if evl else "miss", bl.hp, bl.max_hp])
	nl.queue_free()
	await frames(2)

	# --- H.7 knife slash severs the right hand
	var d := await _knife_sever(P.HAND_R, 113)
	var sn: Npc = d.npc
	await frames(3)
	var info_s := await _sever_checks(sn, P.HAND_R, d.notes, d.real, "H.7")
	info("hands: %s | held item after sever='%s'" % [info_s, sn.body.get_debug_info().held_item])
	var hand_node := sn.body.get_part_node(P.HAND_R)
	var phone: Node = hand_node.get_node_or_null("Phone") if hand_node else null
	check("H.8", "hand sever: the held phone leaves with the severed hand (docs/DECISIONS.md) and the NPC is one-handed",
		phone != null and hand_node.get_parent() != sn.body and sn.brain.is_one_handed(),
		"phone_on_severed_hand=%s one_handed=%s" % [phone != null, str(sn.brain.is_one_handed())])
	check("H.9", "hand sever does not make the NPC crawl or become dead", sn.get_state() != S.CRAWL and not sn.is_dead(), "state=%s" % _state_name(sn))
	sn.queue_free()
	await frames(2)


## Strokes at foot level are turned 90 degrees so they travel front-to-back and cannot sweep through both feet / the other leg.
const FOOT_YAW := 90.0


func _sec_feet() -> void:
	# --- F.1 bat breaks the right foot -> limp
	var r := await _bat_stroke(P.FOOT_R, 2.0, 1.0, Vector3.ZERO, 121, FOOT_YAW)
	var npc: Npc = r.npc
	var ev: DamageEvent = r.ev
	info("feet: bat hits=%s" % str(r.hits.map(func(h): return h[0].describe() + " applied=%s" % h[1])))
	check("F.1", "bat swing connects with FOOT_R (BLUNT)", ev != null and ev.type == DamageEvent.Type.BLUNT and r.applied,
		"hits=%s" % str(r.hits.map(func(h): return h[0].describe())))
	if ev != null:
		var bp: BodyPart = npc.damage.get_part(P.FOOT_R)
		check("F.2", "bat hard hit breaks the foot (part.broken + part_broken signal), not severed",
			bp.broken and P.FOOT_R in r.broken and not bp.severed,
			"amount=%.1f hp=%.1f/%.1f broken=%s signal=%s" % [ev.amount, bp.hp, bp.max_hp, bp.broken, str(r.broken)])
		var poses := {}
		var states := {}
		var smp := func() -> void:
			poses[npc.body.get_debug_info().pose] = true
			states[_state_name(npc)] = true
		_samplers.append(smp)
		await seconds(4.0)
		_samplers.erase(smp)
		var br: NpcBrain = npc.brain
		check("F.3", "broken foot -> brain limps on that side (limp_side 'r', not crawling)",
			br.get_limp_side() == "r" and br.is_limping() and not states.has("CRAWL"), "limp_side='%s' states seen=%s" % [br.get_limp_side(), str(states.keys())])
		check("F.4", "limping NPC is posed with 'limp' when it moves", poses.has("limp"), "poses seen=%s state=%s" % [str(poses.keys()), _state_name(npc)])
		check("F.5", "limping NPC stays sane (finite, bounded)", _npc_sane(npc) == "", _npc_sane(npc))
	_cleanup_stroke(r)
	await frames(2)

	# --- F.6 weak bat hit does not break the foot (force-dependent, like arms)
	var soft := await _bat_stroke(P.FOOT_R, 0.5, 1.0, Vector3.ZERO, 122, FOOT_YAW)
	if soft.ev != null:
		check("F.6", "bat soft hit on foot does NOT break it (no limp)", not (soft.npc as Npc).damage.get_part(P.FOOT_R).broken,
			"amount=%.1f broken=%s" % [soft.ev.amount, (soft.npc as Npc).damage.get_part(P.FOOT_R).broken])
	else:
		check("F.6", "bat soft hit connects with foot", false, "no hit")
	_cleanup_stroke(soft)
	await frames(2)

	# --- F.7 knife slash severs the left foot -> CRAWL
	var d := await _knife_sever(P.FOOT_L, 123, Vector3.ZERO, 0.75, FOOT_YAW)
	var sn: Npc = d.npc
	await seconds(1.0)
	check("F.7", "foot severed -> NPC crawls (CRAWL) and the body reports the foot detached",
		sn.damage.get_part(P.FOOT_L).severed and sn.get_state() == S.CRAWL and not sn.body.has_part(P.FOOT_L),
		"state=%s severed=%s attached=%s real_knife=%s" % [_state_name(sn), sn.damage.get_part(P.FOOT_L).severed, str(sn.body.get_debug_info().get("attached")), d.real])
	await seconds(3.0)
	check("F.7b", "crawling NPC (foot lost) stays sane and pose is 'crawl'", _npc_sane(sn) == "" and sn.body.get_debug_info().pose == "crawl",
		"sane='%s' pose=%s" % [_npc_sane(sn), sn.body.get_debug_info().pose])
	var info_s := await _sever_checks(sn, P.FOOT_L, d.notes, d.real, "F.8")
	info("feet: %s" % info_s)
	sn.queue_free()
	await frames(2)


# ------------------------------------------------------------------ milestone 3

## The real main scene (arena, Player in group "player", GoreFX, GameDirector, UI). Free it with _free_main.
func _main_scene() -> Node:
	var main: Node = (load("res://scenes/main.tscn") as PackedScene).instantiate()
	_bay.add_child(main)
	await frames(5)
	return main


func _free_main(main: Node) -> void:
	main.queue_free()
	await frames(3)
	Engine.time_scale = 1.0


# --- M3.1 fight back

## One fight-back trial: main scene, real Player, one NPC (aggression pinned) hit by a real handgun bullet.
## Returns {states, hits (player_hit count), min_health, min_dist, npc}.
func _fight_trial(fight_back: bool, part: int, seed_value: int, hold := 12.0) -> Dictionary:
	GameSettings.fight_back = fight_back
	var main := await _main_scene()
	var player: Player = main.player
	var npc: Npc = main.spawn_npc()
	await frames(3)
	npc.brain.aggression = 1.0          # pinned: >= fight_aggression_min
	var res := {"states": {}, "hits": 0, "min_health": player.health, "min_dist": 99.0, "npc": npc, "ev": null, "pain": 0.0}
	var on_hit := func(n, _a, _p): if n == npc: res.hits += 1
	GameEvents.player_hit.connect(on_hit)
	var smp := func() -> void:
		res.states[_state_name(npc)] = true
		res.min_health = minf(res.min_health, player.health)
		var to: Vector3 = npc.get_center() - player.global_position
		to.y = 0.0
		res.min_dist = minf(res.min_dist, to.length())
	_samplers.append(smp)
	# a light real knife slash (a bullet's entry+exit wounds already exceed fight_enter_pain); strokes travel along X, so the
	# NPC's far-side arm is hit only. The stroke is yawed 90 deg (front to back) to touch just the one limb.
	var w := _weapon("knife") as MeleeWeapon
	var hits: Array = []
	_record_hits(w, hits)
	await melee_through(w, _part_pos(npc, part), 0.7, &"swing", 0.75, 90.0)
	(w.get_parent() as Node).queue_free()
	for h in hits:
		if h[0].part_id == part:
			res.ev = h[0]
	res["pain0"] = npc.brain.get_pain()
	res["hits_all"] = hits.map(func(h): return h[0].describe())
	await seconds(hold)
	_samplers.erase(smp)
	GameEvents.player_hit.disconnect(on_hit)
	res.pain = npc.brain.get_pain()
	res["aggr"] = npc.brain.aggression
	await _free_main(main)
	return res


func _sec_m3fight() -> void:
	var off := await _fight_trial(false, P.UPPER_ARM_L, 201)
	check("M3.1a", "fight_back OFF: a hit aggressive NPC never enters FIGHT, never approaches the player, never hurts the player",
		off.ev != null and not off.states.has("FIGHT") and off.hits == 0 and off.min_health >= 100.0,
		"states=%s player_hits=%d min_health=%.0f min_dist=%.2f aggression=%.2f" % [str(off.states.keys()), off.hits, off.min_health, off.min_dist, off.aggr])
	var on := await _fight_trial(true, P.UPPER_ARM_L, 202)
	check("M3.1b", "fight_back ON + aggression 1.0: hit NPC enters FIGHT", on.states.has("FIGHT"),
		"states=%s pain@hit=%.2f ev=%s all=%s" % [str(on.states.keys()), on.pain0, on.ev.describe() if on.ev else "miss", str(on.hits_all)])
	check("M3.1c", "fighting NPC approaches the real Player (comes within 1.5 m of it)", on.min_dist < 1.5, "min_dist=%.2f m" % on.min_dist)
	check("M3.1d", "player_hit fires and the Player's HP drops (no permadeath: health stays >= 0)",
		on.hits >= 1 and on.min_health < 100.0 and on.min_health >= 0.0, "player_hit x%d min_health=%.1f/100" % [on.hits, on.min_health])


# --- M3.2 cower

func _sec_m3cower() -> void:
	# NPC A (bystander) is 3 m from NPC B; B is shot, A (IDLE inside alert_radius) turns ALERT and cowers.
	var a := await _spawn(Vector3(-1.5, 0.05, 0), 211)
	var b := await _spawn(Vector3(1.5, 0.05, 0), 212)
	var seen: Dictionary = {}
	var cower_in_alert := [false]
	var smp := func() -> void:
		var st := _state_name(a)
		seen[st] = true
		if st == "ALERT" and a.body.get_debug_info().pose == "cower":
			cower_in_alert[0] = true
	_samplers.append(smp)
	var ev := await shoot(b, P.UPPER_LEG_R, Vector3(0, 0, 1), 3.0)
	await seconds(2.5)
	_samplers.erase(smp)
	check("M3.2", "bystander NPC in ALERT uses the 'cower' pose", seen.has("ALERT") and cower_in_alert[0],
		"shot=%s states seen=%s cower_in_alert=%s pose_now=%s" % [ev.describe() if ev else "miss", str(seen.keys()), cower_in_alert[0], a.body.get_debug_info().pose])
	check("M3.2b", "cowering NPC stays sane (finite, bounded)", _npc_sane(a) == "", _npc_sane(a))


# --- M3.3 immortal dummy

func _sec_m3immortal() -> void:
	GameSettings.immortal_dummy = true
	var npc := await _spawn(Vector3(0, 0.05, 0), 221)
	GameSettings.immortal_dummy = false     # only NPCs spawned while ON are immortal
	var died := [false]
	var lethal := [false]
	npc.died.connect(func(_c): died[0] = true)
	npc.lethal_injury.connect(func(_c): lethal[0] = true)
	var dead_ticks := [0]
	var min_frac := [1.0]
	var max_flow := [0.0]
	var smp := func() -> void:
		if npc.is_dead() or npc.get_state() == S.DEAD:
			dead_ticks[0] += 1
		min_frac[0] = minf(min_frac[0], npc.blood.state.fraction())
		max_flow[0] = maxf(max_flow[0], npc.blood.state.external_rate + npc.blood.state.internal_rate)
	_samplers.append(smp)
	# head shot first, then wait for the knocked-down dummy to settle and slash its neck with the real knife
	# (retry from the other side, then fall back to a weapon-equivalent slash event)
	var hev := await shoot(npc, P.HEAD, Vector3(0, 0, 1), 3.0)
	await seconds(0.3)
	var tn := npc.body.get_part_node(P.TORSO) as RigidBody3D
	await wait_until(func(): return tn == null or tn.linear_velocity.length() < 0.3 or not npc.body.is_ragdoll(), 4.0)
	await frames(10)
	var hits: Array = []
	var neck_hit: DamageEvent = null
	var how := "real knife"
	for yaw in [0.0, 90.0]:
		var w := _weapon("knife") as MeleeWeapon
		_record_hits(w, hits)
		await melee_through(w, _part_pos(npc, P.NECK), 2.5, &"swing", 0.75, yaw)
		(w.get_parent() as Node).queue_free()
		for h in hits:
			if h[0].part_id == P.NECK:
				neck_hit = h[0]
		if neck_hit != null:
			break
	if neck_hit == null:
		how = "weapon-equivalent event"
		neck_hit = _slash_event(npc, P.NECK)
		npc.apply_damage(neck_hit)
	var head_bp: BodyPart = npc.damage.get_part(P.HEAD)
	var neck_bp: BodyPart = npc.damage.get_part(P.NECK)
	var v_after_hits := npc.blood.state.volume
	var wounds_after_hits := npc.wounds.get_wounds().size()
	check("M3.3a", "immortal dummy: handgun HEAD shot and sever-level knife NECK slash both land (preconditions)",
		npc.immortal and hev != null and hev.part_id == P.HEAD and neck_hit != null and neck_hit.can_dismember and neck_hit.part_id == P.NECK,
		"immortal=%s head=%s neck=%s (%s) can_dismember=%s hits=%s" % [npc.immortal, hev.describe() if hev else "miss", neck_hit.describe() if neck_hit else "none", how,
			neck_hit.can_dismember if neck_hit else "-", str(hits.map(func(h): return h[0].describe()))])
	await seconds(60.0)
	_samplers.erase(smp)
	var flow_now := npc.blood.state.external_rate + npc.blood.state.internal_rate
	check("M3.3b", "immortal dummy: never DEAD / never died / no lethal report over 60 s of bleeding",
		dead_ticks[0] == 0 and not died[0] and not lethal[0] and npc.get_state() != S.DEAD,
		"dead_ticks=%d died=%s lethal=%s state=%s min_blood=%.2f" % [dead_ticks[0], died[0], lethal[0], _state_name(npc), min_frac[0]])
	check("M3.3c", "immortal dummy: head not severed or destroyed, neck not severed, parts still attached",
		not head_bp.severed and not head_bp.destroyed and not neck_bp.severed and npc.body.has_part(P.HEAD) and npc.body.has_part(P.NECK),
		"head severed=%s destroyed=%s hp=%.1f | neck severed=%s hp=%.1f" % [head_bp.severed, head_bp.destroyed, head_bp.hp, neck_bp.severed, neck_bp.hp])
	check("M3.3d", "immortal dummy: wounds still exist and bleed (flow > 0, volume dropped), blood floored above HEAVY (0.70)",
		wounds_after_hits >= 2 and max_flow[0] > 50.0 and v_after_hits < npc.blood.state.max_volume and min_frac[0] > 0.70,
		"wounds=%d max_bleed=%.0f/s bleed@60s=%.1f/s volume after hits %.0f, min fraction %.3f" % [wounds_after_hits, max_flow[0], flow_now, v_after_hits, min_frac[0]])
	check("M3.3e", "immortal dummy stays sane (finite, bounded) after 60 s", _npc_sane(npc) == "", _npc_sane(npc))
	# control: a normal NPC with the same head shot dies at once (proves the dummy flag is what saved it)
	var ctl := await _spawn(Vector3(6, 0.05, 0), 221)
	await shoot(ctl, P.HEAD, Vector3(0, 0, 1), 3.0)
	await seconds(1.0)
	check("M3.3f", "control: same headshot kills a normal NPC", ctl.is_dead(), "state=%s" % _state_name(ctl))


# --- M3.4 gore / no dismemberment

func _sec_m3gore() -> void:
	# sever-level knife slash on a hand: control, no_dismemberment, gore LOW
	var rows := {}
	for cfg in [["control", false, GameSettings.Gore.HIGH], ["no_dismemberment", true, GameSettings.Gore.HIGH], ["gore_low", false, GameSettings.Gore.LOW]]:
		GameSettings.no_dismemberment = cfg[1]
		GameSettings.gore_intensity = cfg[2]
		var notes: Array = []
		var r := await _knife_stroke(&"swing", 2.5, P.HAND_R, 0.75, Vector3.ZERO, 231)
		var npc: Npc = r.npc
		npc.part_severed.connect(func(p, root, _e): notes.append(p))
		await seconds(1.5)
		rows[cfg[0]] = {"ev": r.ev, "severed": npc.damage.get_part(P.HAND_R).severed, "attached": npc.body.has_part(P.HAND_R), "notes": notes,
			"wounds": npc.wounds.get_wounds_on(P.HAND_R).size()}
		(r.w as Node).get_parent().queue_free()
		npc.queue_free()
		await frames(2)
		_reset_settings()
	var c: Dictionary = rows.control
	var nd: Dictionary = rows.no_dismemberment
	var gl: Dictionary = rows.gore_low
	check("M3.4a", "control: sever-level knife slash (can_dismember, setting off) severs the hand",
		c.ev != null and c.ev.can_dismember and c.severed and not c.attached, "ev=%s severed=%s attached=%s" % [c.ev.describe() if c.ev else "none", c.severed, c.attached])
	check("M3.4b", "no_dismemberment: the same slash does not sever (hand attached, wound still recorded)",
		nd.ev != null and nd.ev.can_dismember and not nd.severed and nd.attached and nd.wounds >= 1,
		"ev=%s severed=%s attached=%s wounds_on_hand=%d" % [nd.ev.describe() if nd.ev else "none", nd.severed, nd.attached, nd.wounds])
	check("M3.4c", "gore LOW implies no dismemberment: the same slash does not sever",
		gl.ev != null and not gl.severed and gl.attached, "ev=%s severed=%s attached=%s" % [gl.ev.describe() if gl.ev else "none", gl.severed, gl.attached])

	# GoreFX particle counts: same torso bullet at HIGH, MED, LOW (GoreFX of the real main scene)
	var main := await _main_scene()
	var gore: GoreFX = main.gore
	var counts := {}
	var k := 0
	for lvl in [GameSettings.Gore.HIGH, GameSettings.Gore.MED, GameSettings.Gore.LOW]:
		GameSettings.gore_intensity = lvl
		gore.clear_all()
		var npc := Npc.spawn(main.npc_root, Transform3D(Basis.IDENTITY, Vector3(-9.0 + 3.0 * k, 0.05, -6.0)), 232)
		k += 1
		await frames(3)
		var p0 := gore.particles_spawned
		await shoot(npc, P.TORSO, Vector3(0, 0, 1), 3.0, Vector3(0, 0.1, 0))
		await seconds(2.0)
		counts[lvl] = {"particles": gore.particles_spawned - p0, "emitters": gore.emitter_count(), "decal_cap": gore.decal_cap()}
		npc.queue_free()
		await frames(2)
	_reset_settings()
	await _free_main(main)
	var hi: Dictionary = counts[GameSettings.Gore.HIGH]
	var me: Dictionary = counts[GameSettings.Gore.MED]
	var lo: Dictionary = counts[GameSettings.Gore.LOW]
	check("M3.4d", "gore LOW spawns fewer particles than HIGH for the same bullet (LOW < MED < HIGH)",
		lo.particles < me.particles and me.particles < hi.particles and hi.particles > 0.0,
		"particles HIGH=%.0f MED=%.0f LOW=%.0f | wound emitters %d/%d/%d | decal cap %d/%d/%d" % [hi.particles, me.particles, lo.particles,
			hi.emitters, me.emitters, lo.emitters, hi.decal_cap, me.decal_cap, lo.decal_cap])


# --- M3.5 slow-mo on kill

func _sec_m3slowmo() -> void:
	var main := await _main_scene()
	var out := {}
	for on in [false, true]:
		GameSettings.slow_mo_on_kill = on
		var npc: Npc = main.spawn_npc()
		await frames(3)
		await shoot(npc, P.HEAD, Vector3(0, 0, 1), 3.0)
		var t0 := Time.get_ticks_msec()
		var min_scale := 1.0
		var t_drop := -1.0
		var t_restore := -1.0
		# poll the real clock (physics ticks are stretched by the time scale itself)
		while Time.get_ticks_msec() - t0 < 4000:
			await get_tree().process_frame
			var el := (Time.get_ticks_msec() - t0) / 1000.0
			var ts := Engine.time_scale
			min_scale = minf(min_scale, ts)
			if t_drop < 0.0 and ts < 0.99:
				t_drop = el
			if t_drop >= 0.0 and t_restore < 0.0 and ts > 0.99:
				t_restore = el
				break
		out[on] = {"dead": npc.is_dead(), "min_scale": min_scale, "t_drop": t_drop, "t_restore": t_restore}
		npc.queue_free()
		await frames(2)
		Engine.time_scale = 1.0
		await seconds(0.3)
	GameSettings.slow_mo_on_kill = false
	var off: Dictionary = out[false]
	var onr: Dictionary = out[true]
	check("M3.5a", "slow_mo_on_kill OFF: a kill leaves Engine.time_scale at 1.0", off.dead and off.min_scale > 0.99, "dead=%s min_scale=%.2f" % [off.dead, off.min_scale])
	check("M3.5b", "slow_mo_on_kill ON: kill drops Engine.time_scale to slow_mo_scale (0.3)", onr.dead and onr.min_scale <= 0.31 and onr.t_drop >= 0.0,
		"dead=%s min_scale=%.2f dropped at %.2fs real" % [onr.dead, onr.min_scale, onr.t_drop])
	check("M3.5c", "slow-mo restores to 1.0 within about 1.6 s of real time (and lasts >= 1.0 s)", onr.t_restore >= 0.0 and onr.t_restore - onr.t_drop <= 1.6 and onr.t_restore - onr.t_drop >= 1.0,
		"slow-mo lasted %.2fs real (drop %.2fs, restore %.2fs)" % [onr.t_restore - onr.t_drop, onr.t_drop, onr.t_restore])
	await _free_main(main)
	check("M3.5d", "Engine.time_scale is back to 1.0 after the scene is freed", is_equal_approx(Engine.time_scale, 1.0), "time_scale=%.2f" % Engine.time_scale)


# --- M3.6 auto cleanup

func _sec_m3cleanup() -> void:
	GameSettings.auto_cleanup_time = 2.0
	var main := await _main_scene()
	# dead NPC
	var dead_npc: Npc = main.spawn_npc()
	await frames(3)
	await shoot(dead_npc, P.HEAD, Vector3(0, 0, 1), 3.0)
	await wait_until(func(): return dead_npc.is_dead(), 3.0)
	var was_dead := dead_npc.is_dead()
	await seconds(0.8)
	var alive_at_1 := is_instance_valid(dead_npc) and not dead_npc.is_queued_for_deletion()
	# severed piece (separate NPC, not killed): knife slash through the left hand
	var r := await _knife_stroke(&"swing", 2.5, P.HAND_L, 0.75, Vector3.ZERO, 241)
	var piece: Node = r.npc.body.get_part_node(P.HAND_L)
	var severed: bool = r.npc.damage.get_part(P.HAND_L).severed and piece != null and piece.get_parent() != r.npc.body
	(r.w as Node).get_parent().queue_free()
	await seconds(0.6)
	var piece_alive_early := is_instance_valid(piece) and not piece.is_queued_for_deletion()
	var dead_id := dead_npc.get_instance_id()
	var piece_id := piece.get_instance_id()
	await wait_until(func(): return not is_instance_id_valid(dead_id) or (instance_from_id(dead_id) as Node).is_queued_for_deletion(), 6.0)
	var dead_freed := not is_instance_valid(dead_npc) or dead_npc.is_queued_for_deletion()
	await wait_until(func(): return not is_instance_id_valid(piece_id) or (instance_from_id(piece_id) as Node).is_queued_for_deletion(), 6.0)
	var piece_freed := not is_instance_valid(piece) or piece.is_queued_for_deletion()
	check("M3.6a", "auto_cleanup_time 2 s: a dead NPC is still there ~1 s after death and is freed afterwards",
		was_dead and alive_at_1 and dead_freed, "dead=%s present@0.8s=%s freed=%s" % [was_dead, alive_at_1, dead_freed])
	check("M3.6b", "auto_cleanup_time 2 s: a severed piece is freed (still present ~0.6 s after the cut)",
		severed and piece_alive_early and piece_freed, "severed=%s present@0.6s=%s freed=%s" % [severed, piece_alive_early, piece_freed])
	check("M3.6c", "the living NPC the piece was cut from is not cleaned up", is_instance_valid(r.npc) and not r.npc.is_queued_for_deletion() and not r.npc.is_dead(),
		"valid=%s" % is_instance_valid(r.npc))
	await _free_main(main)


# --- M3.7 hit reaction

func _sec_m3react() -> void:
	# A real (weak) bat head blow keeps the NPC animated; the head must visibly move relative to the neck within 0.1 s.
	var npc := await _spawn(Vector3(0, 0.05, 0), 251)
	await seconds(1.0)
	var samples: Array = []         # [tick, local origin, local basis, ragdoll]
	var smp := func() -> void:
		var hx: Transform3D = npc.body.get_part_global_transform(P.HEAD)
		var nx: Transform3D = npc.body.get_part_global_transform(P.NECK)
		samples.append([tick, nx.affine_inverse() * hx, npc.body.is_ragdoll()])
	_samplers.append(smp)
	await seconds(0.3)
	var base: Transform3D = samples[-1][1]
	var noise := 0.0
	for sm in samples:
		noise = maxf(noise, (sm[1].origin - base.origin).length() + (sm[1].basis.get_rotation_quaternion().angle_to(base.basis.get_rotation_quaternion())))
	var w := _weapon("bat") as MeleeWeapon
	var hit_tick := [-1]
	w.hit_resolved.connect(func(e: DamageEvent, _a): if e.part_id == P.HEAD and hit_tick[0] < 0: hit_tick[0] = tick)
	await melee_through(w, _part_pos(npc, P.HEAD), 0.5, &"swing", 0.75)
	_samplers.erase(smp)
	(w.get_parent() as Node).queue_free()
	var max_d := 0.0
	var max_a := 0.0
	var ragdoll_seen := false
	for sm in samples:
		if hit_tick[0] >= 0 and sm[0] >= hit_tick[0] and sm[0] <= hit_tick[0] + 6:
			var xf: Transform3D = sm[1]
			max_d = maxf(max_d, (xf.origin - base.origin).length())
			max_a = maxf(max_a, rad_to_deg(xf.basis.get_rotation_quaternion().angle_to(base.basis.get_rotation_quaternion())))
			ragdoll_seen = ragdoll_seen or sm[2]
	check("M3.7", "head hit while animated: head moves relative to the neck within 0.1 s (>= 2 deg or >= 1.5 cm) and the NPC is not ragdolled",
		hit_tick[0] >= 0 and not ragdoll_seen and (max_a >= 2.0 or max_d >= 0.015),
		"hit_tick=%d max_rot=%.1f deg max_shift=%.3f m (idle noise before hit %.4f) ragdoll=%s state=%s" % [hit_tick[0], max_a, max_d, noise, ragdoll_seen, _state_name(npc)])
	npc.queue_free()
	await frames(2)


## Number of per-part rows in a debug dict (non-part keys such as the "sever_dropped" counter are ignored).
func _part_rows(dmg: Dictionary) -> int:
	var c := 0
	for pid in BodyIds.KEYS:
		if dmg.has(BodyIds.key(pid)):
			c += 1
	return c


# ------------------------------------------------------------------ milestone 5: weapons and head chunks

## Fire a real hitscan weapon (any id) from `origin` along `dir`; returns the DamageEvents of the whole shot
## (one per pellet per body hit). Seeded so pellet patterns are repeatable.
func fire_events(id: String, origin: Vector3, dir: Vector3, seed_value := 5) -> Array:
	var gun := _weapon(id) as HitscanWeapon
	gun.rng.seed = seed_value
	await frames(1)
	gun.fire_ray(origin, dir)
	var evs: Array = gun.last_events.duplicate()
	gun.get_parent().queue_free()
	return evs


## One melee stroke of any real melee weapon through `target` on an existing NPC. Returns {hits, w}; the weapon holder is freed.
func stroke_on(npc: Npc, id: String, part: int, scale_v: float, f: float, yaw_deg := 0.0, offset := Vector3.ZERO, mode := &"swing") -> Dictionary:
	var w := _weapon(id) as MeleeWeapon
	var hits: Array = []
	_record_hits(w, hits)
	await melee_through(w, _part_pos(npc, part) + offset, scale_v, mode, f, yaw_deg)
	(w.get_parent() as Node).queue_free()
	return {"hits": hits, "ev": _ev_on(hits, part)}


func _ev_on(hits: Array, part: int) -> DamageEvent:
	var out: DamageEvent = null
	for h in hits:
		if h[0].part_id == part:
			out = h[0]
	return out


## Sum of nominal bleed rates (external + internal) of an NPC's wounds, and the number of entry wounds (no exit / fracture).
func _bleed_total(npc: Npc) -> Dictionary:
	var total := 0.0
	var entries := 0
	for w in npc.wounds.get_wounds():
		total += w.bleed_rate + w.internal_bleed_rate
		if not w.is_exit and not w.is_fracture and not w.is_stump:
			entries += 1
	return {"total": total, "entries": entries}


func _head_chunk_name(ev: DamageEvent) -> String:
	return BodyIds.head_chunk_key(BodyIds.head_chunk_from_local(ev.hit_local_normalized)) if ev else "-"


# --- M5.1 rifle: one bullet through two NPCs

func _sec_m5rifle() -> void:
	var a := await _spawn(Vector3(0, 0.05, 0), 301)
	var b := await _spawn(Vector3(0, 0.05, -1.5), 302)
	var origin := _part_pos(a, P.TORSO) + Vector3(0, 0.1, 4.0)
	var evs := await fire_events("rifle", origin, Vector3(0, 0, -1))
	await seconds(0.5)
	var ev_a: DamageEvent = null
	var ev_b: DamageEvent = null
	for e in evs:
		if e.hit_position.z > -0.9 and ev_a == null:
			ev_a = e
		elif e.hit_position.z < -0.9 and ev_b == null:
			ev_b = e
	var wa := a.wounds.get_wounds().size()
	var wb := b.wounds.get_wounds().size()
	check("M5.1a", "rifle: ONE shot hits both lined-up NPCs and wounds (or kills) both",
		ev_a != null and ev_b != null and (wa > 0 or a.is_dead()) and (wb > 0 or b.is_dead()),
		"events=%d first=%s second=%s | A wounds=%d dead=%s | B wounds=%d dead=%s" % [evs.size(), ev_a.describe() if ev_a else "none",
			ev_b.describe() if ev_b else "none", wa, a.is_dead(), wb, b.is_dead()])
	if ev_a != null and ev_b != null:
		var e1: float = ev_a.extra.get("energy", 0.0)
		var e2: float = ev_b.extra.get("energy", 0.0)
		check("M5.1b", "rifle: the second hit has lower energy and lower damage than the first",
			e2 > 0.0 and e2 < e1 and ev_b.amount < ev_a.amount,
			"energy %.0f J -> %.0f J (%.0f%%), amount %.1f -> %.1f, penetration %.2f -> %.2f" % [e1, e2, 100.0 * e2 / maxf(e1, 1.0), ev_a.amount, ev_b.amount, ev_a.penetration, ev_b.penetration])
	check("M5.1c", "rifle: stays sane (finite, bounded) for both NPCs", _npc_sane(a) == "" and _npc_sane(b) == "", "%s %s" % [_npc_sane(a), _npc_sane(b)])


# --- M5.2 shotgun

func _sec_m5shotgun() -> void:
	var close := await _spawn(Vector3(-9, 0.05, 0), 311)
	var hand := await _spawn(Vector3(0, 0.05, 0), 311)
	var far := await _spawn(Vector3(9, 0.05, 0), 311)
	var aim := Vector3(0, 0.1, 0)
	var ev_c := await fire_events("shotgun", _part_pos(close, P.TORSO) + aim + Vector3(0, 0, 1.5), Vector3(0, 0, -1))
	var ev_h := await fire_events("handgun", _part_pos(hand, P.TORSO) + aim + Vector3(0, 0, 1.5), Vector3(0, 0, -1))
	var ev_f := await fire_events("shotgun", _part_pos(far, P.TORSO) + aim + Vector3(0, 0, 20.0), Vector3(0, 0, -1))
	await frames(3)
	var bc := _bleed_total(close)
	var bh := _bleed_total(hand)
	var bf := _bleed_total(far)
	var torso_entries := 0
	for w in close.wounds.get_wounds_on(P.TORSO):
		if not w.is_exit and not w.is_fracture:
			torso_entries += 1
	check("M5.2a", "shotgun at 1.5 m: several pellet wounds on the torso (>= 3 entry wounds)", torso_entries >= 3 and ev_c.size() >= 3,
		"pellet events=%d torso entry wounds=%d all entries=%d" % [ev_c.size(), torso_entries, bc.entries])
	check("M5.2b", "shotgun close total bleed is greater than ONE handgun shot", bc.total > bh.total,
		"shotgun %.0f /s (%d wounds) vs handgun %.0f /s (%d wounds)" % [bc.total, bc.entries, bh.total, bh.entries])
	var amt_c := 0.0
	for e in ev_c:
		amt_c += e.amount
	var amt_f := 0.0
	for e in ev_f:
		amt_f += e.amount
	check("M5.2c", "shotgun at 20 m does much less (fewer hits, total bleed < 25% of close, total damage < 25%)",
		ev_f.size() < ev_c.size() and bf.total < 0.25 * bc.total and amt_f < 0.25 * amt_c,
		"20 m: %d pellet hits, bleed %.0f /s, damage %.1f | 1.5 m: %d hits, bleed %.0f /s, damage %.1f" % [ev_f.size(), bf.total, amt_f, ev_c.size(), bc.total, amt_c])
	check("M5.2d", "shotgun victims stay sane (finite, bounded)", _npc_sane(close) == "" and _npc_sane(far) == "", "%s %s" % [_npc_sane(close), _npc_sane(far)])


# --- M5.3 machete

func _caps_state(npc: Npc, part: int) -> String:
	var piece := npc.body.get_part_node(part) as BodySegment
	var par := npc.body.get_part_node(BodyIds.parent_of(part)) as BodySegment
	var stump: MeshInstance3D = par.stump_caps.get(part) if par else null
	var cut: MeshInstance3D = piece.severed_cap if piece else null
	return "stump_cap(on parent)=%s severed_cap(on piece)=%s" % [
		str(stump.visible) if stump else "none", str(cut.visible) if cut else "none"]


func _sec_m5machete() -> void:
	# --- normal slash through an upper arm
	var arm := await _spawn(Vector3(0, 0.05, 0), 321)
	var r := await stroke_on(arm, "machete", P.UPPER_ARM_R, 1.0, 0.65)
	var aev: DamageEvent = r.ev
	await seconds(1.5)
	var abp: BodyPart = arm.damage.get_part(P.UPPER_ARM_R)
	check("M5.3a", "machete, normal slash (scale 1.0): severs an upper arm",
		aev != null and abp.severed and not arm.is_dead(),
		"ev=%s can_dismember=%s speed=%.1f severed=%s | hits=%s" % [aev.describe() if aev else "none", aev.can_dismember if aev else "-",
			aev.extra.get("speed", 0.0) if aev else 0.0, abp.severed, str(r.hits.map(func(h): return h[0].describe()))])
	arm.queue_free()
	await frames(2)

	# --- normal slash does not reach the thigh (threshold 70) ...
	var th0 := await _spawn(Vector3(0, 0.05, 0), 322)
	var r0 := await stroke_on(th0, "machete", P.UPPER_LEG_R, 1.0, 0.65, 90.0)
	await seconds(1.0)
	var tev0: DamageEvent = r0.ev
	check("M5.3b", "machete, normal slash: does NOT sever a thigh (thigh needs a fast slash)",
		tev0 != null and not th0.damage.get_part(P.UPPER_LEG_R).severed,
		"ev=%s severed=%s" % [tev0.describe() if tev0 else "none", th0.damage.get_part(P.UPPER_LEG_R).severed])
	th0.queue_free()
	await frames(2)

	# --- ... a fast one (free-swing speed) does
	var th := await _spawn(Vector3(0, 0.05, 0), 323)
	var rf := await stroke_on(th, "machete", P.UPPER_LEG_R, 2.0, 0.65, 90.0)
	var tev: DamageEvent = rf.ev
	var notes: Array = []
	await seconds(1.0)
	var tbp: BodyPart = th.damage.get_part(P.UPPER_LEG_R)
	check("M5.3c", "machete, fast slash (scale 2.0): severs a thigh and the NPC crawls",
		tev != null and tbp.severed and th.get_state() == S.CRAWL and not th.body.has_part(P.UPPER_LEG_R),
		"ev=%s speed=%.1f severed=%s state=%s | hits=%s" % [tev.describe() if tev else "none", tev.extra.get("speed", 0.0) if tev else 0.0, tbp.severed,
			_state_name(th), str(rf.hits.map(func(h): return h[0].describe()))])
	if tbp.severed:
		var info_s := await _sever_checks(th, P.UPPER_LEG_R, notes, true, "M5.3d")
		check("M5.3e", "severed thigh: stump cap on the torso and cut-end cap on the leg piece are visible", _caps_state(th, P.UPPER_LEG_R).count("true") == 2,
			_caps_state(th, P.UPPER_LEG_R))
		info("machete: %s" % info_s)
	th.queue_free()
	await frames(2)


# --- M5.4 hammer vs bat

## Repeated lateral blows on the head until the cranium chunk is destroyed (max 12). Returns {n, destroyed, dead, gib, secs}.
func _head_smash(id: String, f: float, seed_value: int) -> Dictionary:
	var npc := await _spawn(Vector3(0, 0.05, 0), seed_value)
	var res := {"n": 0, "destroyed": false, "dead": false, "gib": null, "chunks": [], "secs": 0.0, "npc": npc, "log": []}
	npc.head_chunk_destroyed.connect(func(c, g, _e):
		res.chunks.append(BodyIds.head_chunk_key(c))
		if c == BodyIds.HeadChunk.CRANIUM:
			res.destroyed = true
			res.gib = g)
	var t0 := now()
	while res.n < 12 and not res.destroyed and not npc.is_dead():
		res.n += 1
		var r := await stroke_on(npc, id, P.HEAD, 1.0, f, 180.0, Vector3(0, 0.05, 0))   # side-rear blow on the upper head: cranium
		res.log.append(_head_chunk_name(r.ev) if r.ev else "miss")
		await seconds(0.5)
	await seconds(1.0)
	res.dead = npc.is_dead()
	res.secs = now() - t0
	return res


func _sec_m5hammer() -> void:
	var hm := await _head_smash("hammer", 1.0, 331)
	var bt := await _head_smash("bat", 0.75, 331)
	info("hammer: strokes=%d chunk hit log=%s chunks destroyed=%s dead=%s" % [hm.n, str(hm.log), str(hm.chunks), hm.dead])
	info("bat: strokes=%d chunk hit log=%s chunks destroyed=%s dead=%s" % [bt.n, str(bt.log), str(bt.chunks), bt.dead])
	check("M5.4a", "hammer: head blows destroy the cranium chunk within 3 strokes and the NPC dies",
		hm.destroyed and hm.dead and hm.n <= 3, "strokes=%d chunks destroyed=%s dead=%s (%.1fs)" % [hm.n, str(hm.chunks), hm.dead, hm.secs])
	check("M5.4b", "hammer destroys the cranium sooner (fewer strokes) than the bat does",
		hm.destroyed and (not bt.destroyed or hm.n < bt.n), "hammer %d strokes (destroyed=%s) vs bat %d strokes (destroyed=%s)" % [hm.n, hm.destroyed, bt.n, bt.destroyed])
	var gib: RigidBody3D = hm.gib
	var ok_gib := gib != null and is_instance_valid(gib)
	check("M5.4c", "hammer: a gib is spawned (RigidBody3D on the debris layer, not a hittable body part) and comes to rest on the floor",
		ok_gib and (gib.collision_layer & BodyIds.LAYER_DEBRIS) != 0 and not gib.has_meta(BodyIds.META_PART_ID) and gib.global_position.y < 0.5,
		"gib=%s y=%.2f layer=%d" % [gib.name if ok_gib else "none", gib.global_position.y if ok_gib else -9.0, gib.collision_layer if ok_gib else -1])
	(hm.npc as Npc).queue_free()
	(bt.npc as Npc).queue_free()
	await frames(2)


# --- M5.5 jaw shot

## Point on the front of the head in head-local normalised coordinates (x right, y up, z front), world space.
func _head_point(npc: Npc, n: Vector3) -> Vector3:
	var xf := npc.body.get_part_global_transform(P.HEAD)
	var h := npc.body.get_part_half_extents(P.HEAD)
	return xf * Vector3(n.x * h.x, n.y * h.y, n.z * h.z)


func _sec_m5jaw() -> void:
	var npc := await _spawn(Vector3(0, 0.05, 0), 341)
	var chunks: Array = []
	var gibs: Array = []
	npc.head_chunk_destroyed.connect(func(c, g, _e):
		chunks.append(BodyIds.head_chunk_key(c))
		gibs.append(g))
	var target := _head_point(npc, Vector3(0, -0.65, 0.9))
	var gun := _weapon("handgun") as HitscanWeapon
	await frames(1)
	var ev := gun.fire_ray(target + Vector3(0, 0, 3.0), Vector3(0, 0, -1))
	gun.get_parent().queue_free()
	await seconds(0.5)
	var head: BodyPart = npc.damage.get_part(P.HEAD)
	check("M5.5a", "handgun at the lower front of the head lands in the JAW chunk and destroys it",
		ev != null and ev.part_id == P.HEAD and _head_chunk_name(ev) == "jaw" and "jaw" in chunks,
		"ev=%s chunk=%s destroyed=%s chunk_hp=%s" % [ev.describe() if ev else "miss", _head_chunk_name(ev), str(chunks), str(head.chunk_hp)])
	await seconds(2.5)
	check("M5.5b", "jaw destroyed: the NPC lives (not dead), head still attached, heavy bleeding",
		not npc.is_dead() and not head.severed and npc.body.has_part(P.HEAD) and (npc.blood.state.external_rate + npc.blood.state.internal_rate) > 20.0,
		"state=%s dead=%s head severed=%s bleed=%.0f /s" % [_state_name(npc), npc.is_dead(), head.severed, npc.blood.state.external_rate + npc.blood.state.internal_rate])
	var gib: RigidBody3D = gibs[0] if gibs.size() > 0 else null
	var ok_gib := gib != null and is_instance_valid(gib)
	check("M5.5c", "jaw gib exists on the floor (RigidBody3D, debris layer, y < 0.3, at rest)",
		ok_gib and gib.global_position.y < 0.3 and (gib.collision_layer & BodyIds.LAYER_DEBRIS) != 0 and gib.linear_velocity.length() < 0.5,
		"gib=%s y=%.2f speed=%.2f" % [gib.name if ok_gib else "none", gib.global_position.y if ok_gib else -9.0, gib.linear_velocity.length() if ok_gib else -1.0])
	# a later wound: the NPC cannot scream any more, every vocal cue is a gurgle (control: an NPC with a jaw screams)
	_cues.clear()
	var leg_ev := await shoot(npc, P.UPPER_LEG_L, Vector3(0.6, 0, 1), 3.0)
	await seconds(4.0)
	var scr := _count_cues(npc, &"scream")
	var gur := _count_cues(npc, &"gurgle")
	var ctl := await _spawn(Vector3(6, 0.05, 0), 341)
	_cues.clear()
	await shoot(ctl, P.UPPER_LEG_L, Vector3(0.6, 0, 1), 3.0)
	await seconds(4.0)
	var scr_c := _count_cues(ctl, &"scream")
	check("M5.5d", "jaw destroyed: a later wound makes the NPC gurgle instead of scream (control NPC with a jaw screams)",
		leg_ev != null and scr == 0 and gur >= 1 and scr_c >= 1,
		"jawless: scream x%d gurgle x%d | control: scream x%d (brain jaw_gone=%s)" % [scr, gur, scr_c, str(npc.brain.get_debug_info().get("jaw_gone"))])
	check("M5.5e", "jaw-shot NPC stays sane (finite, bounded)", _npc_sane(npc) == "", _npc_sane(npc))


# --- M5.6 face destroyed, not lethal: disoriented, no fight-back

func _sec_m5face() -> void:
	GameSettings.fight_back = true
	var main := await _main_scene()
	var player: Player = main.player
	var npc: Npc = main.spawn_npc()
	await frames(3)
	npc.brain.aggression = 1.0
	npc.brain.pain_tolerance = 50.0     # pinned: pain must not be what stops the fight, only the missing face
	var states: Dictionary = {}
	var min_health := [player.health]
	var chunks: Array = []
	npc.head_chunk_destroyed.connect(func(c, _g, _e): chunks.append(BodyIds.head_chunk_key(c)))
	# 1. provoke a fight with a light real knife slash (as in M3.1), wait until the NPC stands in front of the player
	var prov := await stroke_on(npc, "knife", P.UPPER_ARM_L, 0.7, 0.75, 90.0)
	await wait_until(func(): return npc.get_state() == S.FIGHT, 3.0)
	var was_fighting := npc.get_state() == S.FIGHT
	await wait_until(func(): return (npc.get_center() - player.global_position).length() < 1.4, 6.0)
	# 2. one full-speed hammer blow to the FACE (a front-side stroke; the second yaw is only a retry if it missed)
	var face_ev: DamageEvent = null
	for yaw in [90.0, 0.0]:
		var r := await stroke_on(npc, "hammer", P.HEAD, 1.0, 1.0, yaw)
		face_ev = r.ev
		if "face" in chunks or npc.is_dead():
			break
		await seconds(0.8)
	await seconds(0.3)
	var face_gone: bool = "face" in chunks
	var lethal: bool = npc.is_dead()
	var smp := func() -> void:
		states[_state_name(npc)] = true
		min_health[0] = minf(min_health[0], player.health)
	_samplers.append(smp)
	var h0: float = player.health
	# 3. observe: flee direction must keep changing; no FIGHT
	var dirs: Array = []
	for i in 36:       # 18 s: the face blow stuns for about 6 s (UNCONSCIOUS), then the NPC gets up and flees blindly
		await seconds(0.5)
		if npc.get_state() in [S.PANIC_FLEE, S.STAGGER]:
			dirs.append(npc.brain.get_debug_info().get("flee_dir", Vector3.ZERO))
	_samplers.erase(smp)
	var changes := 0
	for i in range(1, dirs.size()):
		if (dirs[i] as Vector3).angle_to(dirs[i - 1]) > deg_to_rad(30.0):
			changes += 1
	var bi: Dictionary = npc.brain.get_debug_info()
	check("M5.6a", "precondition: the NPC was fighting, then a hammer blow destroys the FACE without killing it",
		was_fighting and face_gone and not lethal, "was_fighting=%s chunks destroyed=%s dead=%s ev=%s chunk=%s" % [was_fighting, str(chunks), lethal, face_ev.describe() if face_ev else "none", _head_chunk_name(face_ev)])
	check("M5.6b", "face destroyed: brain reports disoriented and the flee direction keeps changing (>= 2 turns > 30 deg while up)",
		bool(bi.get("disoriented", false)) and changes >= 2, "disoriented=%s direction changes=%d over %d samples while up, state=%s" % [str(bi.get("disoriented")), changes, dirs.size(), _state_name(npc)])
	check("M5.6c", "face destroyed: the NPC leaves FIGHT, never fights again and the player takes no more damage",
		not states.has("FIGHT") and min_health[0] >= h0, "states after=%s player health %.0f -> min %.0f" % [str(states.keys()), h0, min_health[0]])
	await _free_main(main)


# --- M5.7 regressions

func _sec_m5regress() -> void:
	# handgun headshot is still lethal from the front, the side (cranium) and the back (occiput)
	var rows: Array = []
	var all_dead := true
	var i := 0
	for dir in [Vector3(0, 0, 1), Vector3(1, 0, 0), Vector3(0, 0, -1)]:
		var npc := await _spawn(Vector3(-6 + 6 * i, 0.05, 0), 351 + i)
		i += 1
		var ev := await shoot(npc, P.HEAD, dir, 3.0)
		await seconds(1.0)
		rows.append("%s: %s chunk=%s dead=%s" % [dir, ev.describe() if ev else "miss", _head_chunk_name(ev), npc.is_dead()])
		all_dead = all_dead and npc.is_dead() and ev != null
	check("M5.7a", "handgun headshot is still lethal (front, side, back)", all_dead, " | ".join(rows))
	# neck bleed-out time
	var n := await _spawn(Vector3(0, 0.05, 6), 358)
	var t0 := now()
	await shoot(n, P.NECK)
	await wait_until(func(): return n.is_dead(), 40.0)
	var t := now() - t0
	check("M5.7b", "neck shot still bleeds out in 10-25 s", n.is_dead() and t >= 10.0 and t <= 25.0, "dead=%s t=%.1fs" % [n.is_dead(), t])


# ------------------------------------------------------------------ milestone 7: spawner, props, grabber, clear gore

func _find_button(root: Node, text: String) -> Button:
	if root is Button and (root as Button).text == text:
		return root as Button
	for c in root.get_children():
		var b := _find_button(c, text)
		if b != null:
			return b
	return null


func _key_event(code: int, pressed: bool) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = code
	e.keycode = code
	e.pressed = pressed
	Input.parse_input_event(e)


func _sec_m7() -> void:
	var main := await _main_scene()
	var player: Player = main.player
	# --- warning screen is skipped in headless runs
	check("M7.0", "content warning is skipped headless / with GORE_SKIP_WARNING (input enabled, no warning node)",
		not main.warning_active and main.warning == null and player.input_enabled,
		"warning_enabled=%s active=%s input_enabled=%s" % [main.warning_enabled, main.warning_active, player.input_enabled])

	# --- spawner x5
	var before: int = get_tree().get_nodes_in_group(&"npc").size()
	var b5 := _find_button(main.ui, "x5")
	if b5 != null:
		b5.pressed.emit()
	await frames(5)
	var spawned: Array = get_tree().get_nodes_in_group(&"npc").filter(func(n): return n.get_parent() == main.npc_root)
	var inside := spawned.all(func(n): return absf(n.body.get_center().x) < 20.0 and absf(n.body.get_center().z) < 20.0)
	check("M7.1", "spawner button 'x5' spawns 5 NPCs (all alive and inside the arena)",
		b5 != null and spawned.size() == before + 5 and inside and spawned.all(func(n): return not n.is_dead()),
		"button=%s npcs before=%d after=%d inside=%s" % [b5 != null, before, spawned.size(), inside])
	var bn := _find_button(main.ui, "Clear NPCs")
	if bn != null:
		bn.pressed.emit()
	await frames(5)
	check("M7.1b", "spawner button 'Clear NPCs' removes them", get_tree().get_nodes_in_group(&"npc").filter(func(n): return not n.is_queued_for_deletion()).is_empty(),
		"left=%d" % get_tree().get_nodes_in_group(&"npc").filter(func(n): return not n.is_queued_for_deletion()).size())

	# --- props are hit by the handgun
	var plank: RigidBody3D = main.spawn_prop("plank")
	await seconds(2.0)
	var impacts: Array = []
	var on_imp := func(pos, _n, ev): impacts.append([pos, ev])
	GameEvents.world_impact.connect(on_imp)
	var p0 := plank.global_position
	var peak := [0.0]
	var smp := func() -> void:
		peak[0] = maxf(peak[0], plank.linear_velocity.length())
	_samplers.append(smp)
	var gun := _weapon("handgun") as HitscanWeapon
	await frames(1)
	var ev := gun.fire_ray(p0 + Vector3(0, 0, 3.0), Vector3(0, 0, -1))
	gun.get_parent().queue_free()
	await seconds(1.0)
	_samplers.erase(smp)
	GameEvents.world_impact.disconnect(on_imp)
	var moved := plank.global_position.distance_to(p0)
	check("M7.2", "handgun hits a prop: world impact is emitted (no NPC) and the prop moves",
		ev != null and impacts.size() >= 1 and BodyIds.npc_from_collider(plank) == null and (peak[0] > 0.05 or moved > 0.01),
		"ev=%s impacts=%d peak speed=%.2f m/s moved=%.3f m" % [ev.describe() if ev else "miss", impacts.size(), peak[0], moved])
	var bp := _find_button(main.ui, "Clear props")
	if bp != null:
		bp.pressed.emit()
	await frames(5)
	check("M7.2b", "spawner button 'Clear props' removes the props", get_tree().get_nodes_in_group(&"prop").filter(func(n): return not n.is_queued_for_deletion()).is_empty(), "")

	# --- grabber: hold a severed hand, throw it with LMB
	var vic := Npc.spawn(main.npc_root, Transform3D(Basis.IDENTITY, Vector3(6, 0.05, -6)), 371)
	await frames(3)
	var r := await stroke_on(vic, "knife", P.HAND_L, 2.5, 0.75)
	await seconds(2.0)
	var sev: bool = vic.damage.get_part(P.HAND_L).severed
	var hand := vic.body.get_part_node(P.HAND_L) as RigidBody3D
	check("M7.3a", "precondition: a knife slash severed the left hand (RigidBody3D piece at rest)", sev and hand != null and hand.get_parent() != vic.body,
		"severed=%s y=%.2f" % [sev, hand.global_position.y if hand else -9.0])
	if sev and hand != null:
		# stand 1.5 m from the hand and look down at it (reach is 3 m)
		var hp := hand.global_position
		player.global_position = Vector3(hp.x, 0.05, hp.z + 1.5)
		player.rotation = Vector3.ZERO
		player.set("_pitch", -atan2(1.6 - hp.y, 1.5))
		player.velocity = Vector3.ZERO
		player.capture_mouse(true)
		await frames(3)
		_key_event(KEY_E, true)
		await seconds(0.5)
		var held := player.grabber.held
		player.set("_pitch", 0.25)     # carry it up: the hold point follows the view (2 m in front of the camera)
		await seconds(1.5)
		var speed_held := hand.linear_velocity.length()
		var lifted := hand.global_position.y
		var holding := player.grabber.is_holding() and player.grabber.held == hand
		check("M7.3b", "grabber (E) picks up the severed hand and carries it with the view (lifted > 0.5 m above the floor)",
			held == hand and holding and lifted > 0.5, "held=%s holding=%s y=%.2f speed=%.2f" % [held == hand, holding, lifted, speed_held])
		# throw with LMB. A headless run cannot capture the mouse, and the first click then only re-captures it,
		# so the click path is tried and grabber.throw() (what LMB calls while holding) is the fallback.
		player.set("_pitch", 0.1)
		await frames(3)
		var v_before := hand.linear_velocity.length()
		var peak2 := [0.0]
		var start := hand.global_position
		var smp2 := func() -> void:
			peak2[0] = maxf(peak2[0], hand.linear_velocity.length())
		_samplers.append(smp2)
		var click := InputEventMouseButton.new()
		click.button_index = MOUSE_BUTTON_LEFT
		click.pressed = true
		click.position = Vector2(100, 100)
		Input.parse_input_event(click)
		await frames(3)
		var by_click := not player.grabber.is_holding()
		if not by_click:
			player.grabber.throw()
		_key_event(KEY_E, false)
		await seconds(4.0)
		_samplers.erase(smp2)
		var travelled := (hand.global_position - start).length()
		check("M7.3c", "throw: the held hand's speed rises (> 6 m/s, above the hold speed), it travels > 2 m and lands (y < 0.35, at rest)",
			holding and not player.grabber.is_holding() and peak2[0] > 6.0 and peak2[0] > v_before + 3.0 and travelled > 2.0 and hand.global_position.y < 0.35 and hand.linear_velocity.length() < 0.5,
			"released by %s; speed before=%.2f peak=%.2f travelled=%.2f m final y=%.2f speed=%.2f" % ["LMB event" if by_click else "grabber.throw() (mouse not capturable headless, mode=%d)" % Input.mouse_mode,
				v_before, peak2[0], travelled, hand.global_position.y, hand.linear_velocity.length()])

	# --- clear gore
	var gore: GoreFX = main.gore
	var gv := Npc.spawn(main.npc_root, Transform3D(Basis.IDENTITY, Vector3(-6, 0.05, -6)), 372)
	await frames(3)
	await shoot(gv, P.TORSO, Vector3(0, 0, 1), 3.0, Vector3(0, 0.1, 0))
	await shoot(gv, P.HEAD, Vector3(0, 0, 1), 3.0)
	await seconds(4.0)
	var dec0 := gore.decal_count()
	var pool0 := gore.pool_count()
	var emit0 := gore.emitter_count()
	var old_pools: Array = []
	for k in gore.get("_pools"):
		old_pools.append(gore.get("_pools")[k].node)
	var bg := _find_button(main.ui, "Clear gore")
	if bg != null:
		bg.pressed.emit()
	var pool_now := gore.pool_count()     # right after the press (a still-bleeding corpse may start a new pool later)
	await frames(5)
	var old_gone := old_pools.all(func(n): return not is_instance_valid(n) or n.is_queued_for_deletion())
	check("M7.4a", "there was gore to clear (decals present before the button)", dec0 > 0, "decals=%d pools=%d emitters=%d" % [dec0, pool0, emit0])
	check("M7.4b", "spawner button 'Clear gore' removes decals, pools and wound emitters",
		bg != null and gore.decal_count() == 0 and pool_now == 0 and old_gone and gore.emitter_count() == 0,
		"decals %d -> %d, pools %d -> %d (old pool nodes freed=%s; %d after 5 frames), emitters %d -> %d" % [dec0, gore.decal_count(), pool0, pool_now, old_gone, gore.pool_count(), emit0, gore.emitter_count()])
	await _free_main(main)


# ------------------------------------------------------------------ 6. debug info + overlay

func _sec_debug() -> void:
	var npc := await _spawn(Vector3(0, 0.05, 0), 61)
	await shoot(npc, P.TORSO, Vector3(0, 0, 1), 3.0, Vector3(0, 0.1, 0))
	await frames(30)
	var d := npc.get_debug_info()
	var has_blood: bool = d.has("blood") and d.blood.has("volume") and d.blood.has("fraction") and d.blood.has("level")
	var has_wounds: bool = d.has("wounds") and d.wounds.has("count") and d.wounds.count >= 1 and d.wounds.has("wounds")
	var has_state: bool = d.has("state") and str(d.state) != "" and d.has("brain") and d.brain.has("state")
	check("6.1", "get_debug_info() has blood volume + level", has_blood, str(d.get("blood")))
	check("6.2", "get_debug_info() has wounds list", has_wounds, str(d.get("wounds")))
	check("6.3", "get_debug_info() has state per NPC", has_state, "state=%s brain=%s" % [d.get("state"), str(d.get("brain", {}).get("state"))])
	check("6.4", "get_debug_info() has body + per-part damage", d.has("body") and d.has("damage") and _part_rows(d.get("damage", {})) == BodyIds.PART_COUNT,
		"part rows=%d/%d (%d keys total, extra keys are counters) body=%s" % [_part_rows(d.get("damage", {})), BodyIds.PART_COUNT, d.get("damage", {}).size(), str(d.get("body", {}).get("mode"))])
	var missing: Array = []
	for pid in BodyIds.KEYS:
		var bp: BodyPart = npc.damage.get_part(pid)
		var node := npc.body.get_part_node(pid)
		if bp == null or not npc.body.has_part(pid) or node == null or BodyIds.part_from_collider(node) != pid or BodyIds.npc_from_collider(node) != npc:
			missing.append(BodyIds.key(pid))
	check("6.4b", "every BodyIds part has a damage row and an attached body node with npc/part_id metas",
		missing.is_empty() and BodyIds.KEYS.size() == BodyIds.PART_COUNT, "missing=%s keys=%d" % [str(missing), BodyIds.KEYS.size()])
	var main_scene: PackedScene = load("res://scenes/main.tscn")
	var main := main_scene.instantiate()
	_bay.add_child(main)
	await frames(5)
	var ov := main.get_node_or_null("DebugOverlay")
	check("6.5", "DebugOverlay node exists in main scene", ov != null and ov is DebugOverlay,
		"node=%s" % (str(ov.get_class()) if ov else "missing"))
	if ov != null:
		var mnpc: Npc = main.spawn_npc()
		await frames(5)
		var txt: String = ov.describe_npc(mnpc)
		check("6.6", "overlay text shows state, blood volume and wounds", txt.contains("blood") and txt.contains("wounds") and txt.begins_with("Npc"),
			txt.get_slice("\n", 0) + " | " + txt.get_slice("\n", 1))
		check("6.7", "GameSettings.debug_overlay is OFF after the main scene starts (main.gd turns it off; perf default)", not GameSettings.debug_overlay,
			"debug_overlay=%s" % str(GameSettings.debug_overlay))
		# toggled on: F1 key event -> overlay setting ON -> overlay layer visible and per-NPC text still works; F1 again -> OFF
		var f1 := InputEventKey.new()
		f1.physical_keycode = KEY_F1
		f1.pressed = true
		Input.parse_input_event(f1)
		await frames(3)
		var on_now := GameSettings.debug_overlay
		await frames(30)       # lets the overlay's own _process refresh its NPC labels
		var layer: CanvasLayer = ov._layer
		var txt2: String = ov.describe_npc(mnpc)
		check("6.8", "F1 turns the overlay ON: layer visible and describe_npc still reports state, blood and wounds",
			on_now and layer.visible and txt2.contains("blood") and txt2.contains("wounds"), "setting=%s layer.visible=%s text=%s" % [on_now, layer.visible, txt2.get_slice("\n", 0)])
		Input.parse_input_event(f1)
		await frames(3)
		check("6.9", "F1 again turns the overlay OFF (layer hidden)", not GameSettings.debug_overlay and not layer.visible,
			"setting=%s layer.visible=%s" % [GameSettings.debug_overlay, layer.visible])
	main.queue_free()
	await frames(2)


# ------------------------------------------------------------------ consistency sweep

## head, neck, torso first (S.3/S.4 index rows 0..2), then every other part in BodyIds order: new parts join automatically.
func _sweep_order() -> Array:
	var out: Array = [P.HEAD, P.NECK, P.TORSO]
	for pid in BodyIds.KEYS:
		if not pid in out:
			out.append(pid)
	return out


func _sec_sweep() -> void:
	# One NPC per part in parallel lanes (3 m apart), same bullet at every part, all observed for 30 s of sim time.
	var order := _sweep_order()
	var npcs := {}
	var lane := 0
	for part in order:
		npcs[part] = await _spawn(Vector3(-1.5 * (BodyIds.PART_COUNT - 1) + 3.0 * lane, 0.05, 0), 71)
		lane += 1
	var evs := {}
	_cues.clear()
	await frames(2)
	var t_shot := now()
	# all shots in the same physics tick (NPCs alert each other and walk off otherwise)
	for part in order:
		var dir := Vector3(0, 0, 1)
		if BodyIds.is_arm(part):   # front-lateral diagonal so the torso never shadows the arm
			dir = Vector3(0.6 if BodyIds.side_of(part) == "l" else -0.6, 0, 1)
		evs[part] = shoot_now(npcs[part], part, dir, 3.0)
	var ended := {}      # part -> reason string
	var insane := {}
	var smp := func() -> void:
		for part in order:
			var npc: Npc = npcs[part]
			if not ended.has(part):
				if npc.is_dead():
					ended[part] = "dead@%.1fs" % (now() - t_shot)
				elif npc.get_state() == S.UNCONSCIOUS and npc.blood.state.level >= BodyIds.BloodLevel.CRITICAL:
					ended[part] = "collapsed@%.1fs" % (now() - t_shot)
			if tick % 10 == 0 and not insane.has(part):
				var sn := _npc_sane(npc)
				if sn != "":
					insane[part] = sn
	_samplers.append(smp)
	await seconds(1.0)
	var rates := {}
	var states1 := {}
	for part in order:
		var npc: Npc = npcs[part]
		rates[part] = npc.blood.state.external_rate + npc.blood.state.internal_rate
		states1[part] = _state_name(npc)
	await seconds(29.0)
	_samplers.erase(smp)
	var rows: Array = []
	for part in order:
		var npc: Npc = npcs[part]
		var ev: DamageEvent = evs[part]
		var hit_part: int = ev.part_id if ev else -1
		var bp: BodyPart = npc.damage.get_part(part)
		var end_reason: String = ended.get(part, "alive")
		var sane: String = insane.get(part, "")
		var row := {"part": part, "hit": hit_part, "dmg_hp": snappedf(bp.max_hp - bp.hp, 0.1),
			"wounds": npc.wounds.get_wounds().size(), "rate": rates[part], "end": end_reason, "sane": sane,
			"frac": npc.blood.state.fraction(), "amount": ev.amount if ev else -1.0, "destroyed": bp.destroyed}
		rows.append(row)
		info("sweep %-12s hit=%-12s amt=%.0f hp_loss=%.1f wounds=%d bleed(ext+int)@1s=%.1f/s state@1s=%s -> %s (30 s): blood=%.2f state=%s %s%s%s%s" % [
			BodyIds.key(part), BodyIds.key(hit_part) if hit_part >= 0 else "MISS", row.amount, row.dmg_hp, row.wounds, row.rate,
			states1[part], end_reason, row.frac, _state_name(npc), "BROKEN " if bp.broken else "", "SEVERED " if bp.severed else "",
			"DESTROYED " if bp.destroyed else "", "INSANE:" + sane if sane != "" else ""])
	for part in order:
		(npcs[part] as Npc).queue_free()
	await frames(2)
	var all_hit := true
	var all_sane := true
	for r in rows:
		if r.hit != r.part:
			all_hit = false
		if r.sane != "":
			all_sane = false
	check("S.1", "sweep: same bullet at all %d parts resolves to the aimed part, no crash" % BodyIds.PART_COUNT,
		rows.size() == BodyIds.PART_COUNT and all_hit,
		str(rows.filter(func(r): return r.hit != r.part).map(func(r): return "%s->%s" % [BodyIds.key(r.part), BodyIds.key(r.hit) if r.hit >= 0 else "MISS"])))
	check("S.2", "sweep: every part leaves NPC physically sane (finite, bounded)", all_sane,
		str(rows.filter(func(r): return r.sane != "").map(func(r): return BodyIds.key(r.part) + ":" + r.sane)))
	# lethality: lower = deadlier. death/collapse time within 30 s; heads
	var lethal := {}
	for r in rows:
		var end: String = r.end
		var tt := 999.0
		if end != "alive":
			tt = float(end.split("@")[1].trim_suffix("s"))
		lethal[r.part] = tt
	var head_t: float = lethal[P.HEAD]
	var neck_t: float = lethal[P.NECK]
	var torso_t: float = lethal[P.TORSO]
	info("sweep lethality (time to dead/collapsed, 999=alive after 30 s): head=%.1f neck=%.1f torso=%.1f" % [head_t, neck_t, torso_t])
	var limb_alive := true
	var limb_max_rate := 0.0
	var limb_min_rate := 1e9
	for r in rows:
		if BodyIds.is_arm(r.part) or BodyIds.is_leg(r.part):
			limb_alive = limb_alive and r.end == "alive"
			limb_max_rate = maxf(limb_max_rate, r.rate)
			limb_min_rate = minf(limb_min_rate, r.rate)
	var head_row: Dictionary = rows[0]
	check("S.3", "sweep: head is the most lethal part (a single 9mm head shot kills outright, no later than neck/torso)",
		head_t <= neck_t and head_t <= torso_t and String(head_row.end).begins_with("dead"),
		"head: hp_loss=%.1f destroyed=%s end=%s | neck end=%s | torso end=%s | handgun amount=%.0f x head dmg_mult(1.5)=%.0f vs head lethal_damage=%s" % [
			head_row.dmg_hp, head_row.destroyed, head_row.end, rows[1].end, rows[2].end, head_row.amount,
			head_row.amount * 1.5, str(DataDB.table("injury/head_neck").parts.head.lethal_damage)])
	check("S.4", "sweep: limb shots moderate (no instant kill, bleed rate below torso/neck, still alive at 30 s)",
		limb_alive and limb_max_rate < rows[2].rate and limb_max_rate < rows[1].rate,
		"limb bleed range %.1f..%.1f /s; torso %.1f /s; neck %.1f /s" % [limb_min_rate, limb_max_rate, rows[2].rate, rows[1].rate])


# ------------------------------------------------------------------ ragdoll stability

func _sec_ragdoll() -> void:
	# kill by headshot burst, check ragdoll for 8 s, rest + no NaN + no flying parts
	var npc := await _spawn(Vector3(0, 0.05, 0), 81)
	var max_y := 0.0
	var max_speed := 0.0
	var worst := ""
	for i in 3:
		await shoot(npc, P.HEAD, Vector3(0, 0, 1), 3.0)
		await frames(2)
	var smp := func() -> void:
		for pid in BodyIds.KEYS:
			var n := npc.body.get_part_node(pid) as RigidBody3D
			if n == null:
				continue
			max_y = maxf(max_y, n.global_position.y)
			max_speed = maxf(max_speed, n.linear_velocity.length())
		var s := _npc_sane(npc)
		if s != "" and worst == "":
			worst = s
	_samplers.append(smp)
	await seconds(8.0)
	_samplers.erase(smp)
	check("R.1", "ragdoll (head shots -> dead): no NaN, no flying parts over 8 s (max y < 3 m, speed < 60)",
		worst == "" and max_y < 3.0 and max_speed < 60.0, "dead=%s max_y=%.2f max_speed=%.1f %s" % [npc.is_dead(), max_y, max_speed, worst])
	# all parts remain connected (within body length of torso)
	var torso_p := _part_pos(npc, P.TORSO)
	var far := 0.0
	for pid in BodyIds.KEYS:
		far = maxf(far, _part_pos(npc, pid).distance_to(torso_p))
	check("R.2", "ragdoll parts stay joined (every part within 1.6 m of torso)", far < 1.6, "max dist=%.2f" % far)
	var rest_speed := (npc.body.get_part_node(P.TORSO) as RigidBody3D).linear_velocity.length()
	check("R.3", "corpse comes to rest (torso speed < 0.2)", rest_speed < 0.2, "speed=%.3f" % rest_speed)
	npc.queue_free()
	await frames(2)
	# strong bat knock-down then wake: also stable
	var r := await _bat_stroke(P.HEAD, 2.0, 0.75, Vector3.ZERO, 82)
	var bad := ""
	var smp2 := func() -> void:
		var s := _npc_sane(r.npc)
		if s != "" and bad == "":
			bad = s
	_samplers.append(smp2)
	await seconds(7.0)
	_samplers.erase(smp2)
	check("R.4", "knock-down + get-up cycle (7 s) stays finite and bounded", bad == "", "state=%s %s" % [_state_name(r.npc), bad])
	_cleanup_stroke(r)


# ------------------------------------------------------------------ cross-system seams

## Which script files call npc.cue(&"<name>") ? Returns {cue: [file:line, ...]} for damage/ai/body folders.
func _cue_emitters() -> Dictionary:
	var out := {}
	for dir in ["res://scripts/damage", "res://scripts/ai", "res://scripts/body", "res://scripts/npc"]:
		for f in DirAccess.get_files_at(dir):
			if not f.ends_with(".gd"):
				continue
			var lines := FileAccess.get_file_as_string(dir + "/" + f).split("\n")
			for i in lines.size():
				var l: String = lines[i]
				var at := l.find("cue(&\"")
				if at >= 0 and not l.strip_edges().begins_with("##") and not l.strip_edges().begins_with("func cue"):
					var nm := l.substr(at + 6).get_slice("\"", 0)
					if not out.has(nm):
						out[nm] = []
					out[nm].append("%s:%d" % [f, i + 1])
	return out


func _sec_seams() -> void:
	# --- static: who emits each vocal cue?
	var em := _cue_emitters()
	for cue in ["grunt", "gurgle", "scream"]:
		var files := {}
		for loc in em.get(cue, []):
			files[String(loc).get_slice(":", 0)] = true
		check("X.0-" + cue, "'%s' cue has a single owning system (no duplicate emitters)" % cue, files.size() <= 1,
			"emitted from %s" % str(em.get(cue, [])))

	# --- dynamic: audio cue counts for one torso bullet (scream ON), one neck bullet
	var a := await _spawn(Vector3(0, 0.05, 0), 91)
	_cues.clear()
	await shoot(a, P.TORSO, Vector3(0, 0, 1), 3.0, Vector3(0, 0.1, 0))
	await frames(3)
	var g := _count_cues(a, &"grunt")
	var sc := _count_cues(a, &"scream")
	info("seam audio: one torso bullet (entry+exit wound) -> cues %s" % str(_cues.filter(func(c): return c[0] == a).map(func(c): return String(c[1]))))
	check("X.1", "scream ON: a body bullet makes the NPC scream (>= 1 scream cue)", sc >= 1, "scream x%d" % sc)
	check("X.1b", "one body bullet emits at most 1 grunt and 1 scream cue (entry+exit wound / two systems must not stack)",
		g <= 1 and sc <= 1, "grunt x%d scream x%d" % [g, sc])
	a.queue_free()
	await frames(2)
	var b := await _spawn(Vector3(0, 0.05, 0), 92)
	_cues.clear()
	await shoot(b, P.NECK)
	await frames(3)
	var gu := _count_cues(b, &"gurgle")
	var scr := _count_cues(b, &"scream")
	info("seam audio: one neck bullet -> gurgle x%d grunt x%d scream x%d" % [gu, _count_cues(b, &"grunt"), scr])
	check("X.2", "one neck bullet emits <= 1 gurgle cue", gu <= 1, "gurgle x%d" % gu)
	check("X.2b", "neck shot: NPC gurgles but does not scream (docs/DECISIONS.md: neck arterial = gurgle, no scream)", scr == 0 and gu >= 1,
		"scream x%d gurgle x%d (the non-arterial EXIT wound on the neck re-enters NpcBrain._on_wounded and screams)" % [scr, gu])
	b.queue_free()
	await frames(2)

	# --- scream toggle must silence the cue on the bus for every source
	GameSettings.scream_enabled = false
	var c := await _spawn(Vector3(0, 0.05, 0), 93)
	_cues.clear()
	await shoot(c, P.HEAD, Vector3(0, 0, 1), 3.0)
	await shoot(c, P.HEAD, Vector3(0, 0, 1), 3.0)
	await frames(5)
	var scr_off := _count_cues(c, &"scream")
	check("X.3", "scream_enabled=false: no scream cue on GameEvents.audio_cue from ANY source (head kill)", scr_off == 0,
		"scream cues on bus=%d (head destroyed=%s, state=%s)" % [scr_off, c.damage.get_part(P.HEAD).destroyed, _state_name(c)])
	c.queue_free()
	await frames(2)
	_reset_settings()

	# --- diagnostic for tests/ai_test.gd 7a (INFO only: the failure is test fragility, tracked in docs/REVIEW.md)
	var d := await _spawn(Vector3(0, 0.05, 0), 7)
	var tol: float = d.brain.pain_tolerance
	info("seam ai_test 7a: Npc seed 7 -> brain.pain_tolerance=%.3f; torso wound sev 0.4 -> pain %.3f (scream_pain_threshold 0.35, severity threshold 0.5)" % [tol, 0.4 / tol])
	d.queue_free()
	await frames(2)

	# --- limb sever -> AI crawl (Damage -> Npc.notify_part_severed -> Body.sever_part -> Brain)
	var leg := await _spawn(Vector3(0, 0.05, 0), 94)
	var kdef := WeaponDefs.get_def("knife")
	var e := DamageEvent.new()
	e.type = DamageEvent.Type.BLADE_SLASH
	e.weapon_id = &"knife"
	e.impactor_velocity = Vector3(13, 0, 0)
	e.direction = Vector3.RIGHT
	e.impactor_mass = float(kdef.mass)
	e.amount = 70.0     # above lower-leg dismember threshold (a weapon-built event with a stronger blade)
	e.penetration = 0.03
	e.can_dismember = true
	e.part_id = P.LOWER_LEG_L
	e.hit_position = _part_pos(leg, P.LOWER_LEG_L)
	e.hit_normal = Vector3.BACK
	leg.apply_damage(e)
	await seconds(1.0)
	check("X.5", "leg severed -> NPC crawls (CRAWL) and the body reports the part detached",
		leg.damage.get_part(P.LOWER_LEG_L).severed and leg.get_state() == S.CRAWL and not leg.body.has_part(P.LOWER_LEG_L),
		"state=%s attached=%s" % [_state_name(leg), str(leg.body.get_debug_info().get("attached"))])
	await seconds(3.0)
	check("X.5b", "crawling one-legged NPC stays sane (finite, bounded)", _npc_sane(leg) == "", _npc_sane(leg))
	leg.queue_free()
	await frames(2)

	# --- dead NPC keeps bleeding (dead_flow_mult) but no AI reaction and stays DEAD
	var dd := await _spawn(Vector3(0, 0.05, 0), 95)
	dd.brain.force_state(S.DEAD)
	await shoot(dd, P.TORSO, Vector3(0, 0, 1), 3.0, Vector3(0, 0.1, 0))
	await seconds(1.0)
	check("X.6", "shooting a dead NPC keeps it DEAD (no reaction/revival) and wounds still register",
		dd.get_state() == S.DEAD and dd.wounds.get_wounds().size() >= 1, "state=%s wounds=%d" % [_state_name(dd), dd.wounds.get_wounds().size()])
	dd.queue_free()
	await frames(2)
