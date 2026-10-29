## review-agent: end-to-end V1 acceptance test (real NPCs, real weapons where practical).
## Run: godot --headless --path . res://tests/acceptance_test.tscn
## Output: one "ACC|<id>|PASS/FAIL|<name>|<evidence>" line per check plus "INFO|" diagnostics.
## Exit code 1 if any check FAILs. Optional user arg:  -- only=<section prefix>  (e.g. only=neck)
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
	for sec in ["neck", "body", "knife", "bat", "sever", "debug", "sweep", "ragdoll", "seams"]:
		if _only != "" and not sec.begins_with(_only):
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


func _reset_settings() -> void:
	GameSettings.panic_enabled = true
	GameSettings.scream_enabled = true
	GameSettings.ragdoll_only = false


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
func melee_through(w: MeleeWeapon, target: Vector3, scale_v: float, mode: StringName, f := 1.0) -> void:
	var rt := w.rest_transform
	var len_ := float(w.def.get("length", 0.2))
	var tip_rest := rt * Vector3(0, 0, -len_ * f)
	var origin := target - tip_rest
	if mode == &"thrust":
		var axis := (rt.basis * Vector3(0, 0, -1)).normalized()
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
func _knife_stroke(mode: StringName, scale_v: float, part := P.TORSO, f := 1.0, aim_offset := Vector3(0, 0.1, 0), seed_value := 31) -> Dictionary:
	var npc := await _spawn(Vector3(0, 0.05, 0), seed_value)
	var w := _weapon("knife") as MeleeWeapon
	var hits: Array = []
	_record_hits(w, hits)
	var tgt := _part_pos(npc, part) + aim_offset
	await melee_through(w, tgt, scale_v, mode, f)
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

func _bat_stroke(part: int, scale_v: float, f := 0.75, aim_offset := Vector3.ZERO, seed_value := 41) -> Dictionary:
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
	await melee_through(w, _part_pos(npc, part) + aim_offset, scale_v, &"swing", f)
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
func _sever_checks(npc: Npc, part: int, notes: Array, used_real: bool) -> String:
	var seg_node := npc.body.get_part_node(part) as RigidBody3D     # BodySegment kept in _segments after severing
	await seconds(3.0)
	var bp: BodyPart = npc.damage.get_part(part)
	var src := "REAL knife stroke" if used_real else "weapon-equivalent DamageEvent"
	check("5.0", "limb severed (%s)" % src, bp.severed, "severed=%s" % bp.severed)
	var is_rb := seg_node != null and seg_node is RigidBody3D
	var detached_from_body: bool = seg_node != null and seg_node.get_parent() != npc.body
	check("5.1", "severed piece is a separate RigidBody3D no longer under NpcBody", is_rb and detached_from_body,
		"class=%s parent=%s attached=%s" % [seg_node.get_class() if seg_node else "null",
			seg_node.get_parent().name if seg_node and seg_node.get_parent() else "null",
			npc.body.has_part(part)])
	var y := 99.0
	var spd := 99.0
	if is_rb:
		var rb := seg_node as RigidBody3D
		y = rb.global_position.y
		spd = rb.linear_velocity.length()
	check("5.2", "piece rests on the floor (y < 0.35, speed < 0.3 after 3 s)", y < 0.35 and spd < 0.3,
		"y=%.3f speed=%.3f sleeping=%s" % [y, spd, str((seg_node as RigidBody3D).sleeping) if is_rb else "n/a"])
	var layer_ok: bool = is_rb and (seg_node.collision_layer & BodyIds.LAYER_NPC_PARTS) != 0 and seg_node.has_meta(BodyIds.META_NPC)
	check("5.3", "piece stays on npc_parts layer with npc/part_id metas (can still be hit)", layer_ok,
		"layer=%d meta_npc=%s" % [seg_node.collision_layer if is_rb else -1, str(seg_node.has_meta(BodyIds.META_NPC)) if is_rb else "n/a"])
	var parent_part := BodyIds.parent_of(part)
	var stump: Wound = null
	for w in npc.wounds.get_wounds_on(parent_part):
		if w.is_stump:
			stump = w
	check("5.4", "stump wound on parent part, attached (not detached)", stump != null and not stump.detached,
		stump.describe() if stump else "no stump wound on %s" % BodyIds.key(parent_part))
	check("5.5", "stump wound bleeding (current_flow > 0)", stump != null and stump.current_flow > 0.0,
		"flow=%.2f volume=%.0f" % [stump.current_flow if stump else -1.0, npc.blood.state.volume])
	var v1 := npc.blood.state.volume
	await seconds(2.0)
	check("5.6", "blood volume dropping after sever", npc.blood.state.volume < v1,
		"%.1f -> %.1f ext_rate=%.1f" % [v1, npc.blood.state.volume, npc.blood.state.external_rate])
	var piece_wounds_detached := true
	for w in npc.wounds.get_wounds_on(part):
		if not w.detached:
			piece_wounds_detached = false
	check("5.7", "wounds on the severed piece are detached (no longer drain the body)", piece_wounds_detached,
		str(npc.wounds.get_debug_info().wounds))
	check("5.8", "NPC itself survives the sever (not DEAD instantly, body still upright/animated or in a reaction)",
		not npc.is_dead() and _npc_sane(npc) == "", "state=%s sane='%s'" % [_state_name(npc), _npc_sane(npc)])
	return "piece y=%.3f class=%s" % [y, seg_node.get_class() if seg_node else "null"]


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
	check("6.4", "get_debug_info() has body + per-part damage", d.has("body") and d.has("damage") and d.damage.size() == 11,
		"parts=%d body=%s" % [d.get("damage", {}).size(), str(d.get("body", {}).get("mode"))])
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
		check("6.7", "GameSettings.debug_overlay defaults ON", GameSettings.debug_overlay, str(GameSettings.debug_overlay))
	main.queue_free()
	await frames(2)


# ------------------------------------------------------------------ consistency sweep

const SWEEP_ORDER := [P.HEAD, P.NECK, P.TORSO, P.UPPER_ARM_L, P.LOWER_ARM_L, P.UPPER_ARM_R, P.LOWER_ARM_R,
	P.UPPER_LEG_L, P.LOWER_LEG_L, P.UPPER_LEG_R, P.LOWER_LEG_R]


func _sec_sweep() -> void:
	# 11 NPCs in parallel lanes (3 m apart), same bullet at every part, all observed for 30 s of sim time.
	var npcs := {}
	var lane := 0
	for part in SWEEP_ORDER:
		npcs[part] = await _spawn(Vector3(-15.0 + 3.0 * lane, 0.05, 0), 71)
		lane += 1
	var evs := {}
	_cues.clear()
	await frames(2)
	var t_shot := now()
	# all 11 shots in the same physics tick (NPCs alert each other and walk off otherwise)
	for part in SWEEP_ORDER:
		var dir := Vector3(0, 0, 1)
		if BodyIds.is_arm(part):   # front-lateral diagonal so the torso never shadows the arm
			dir = Vector3(0.6 if BodyIds.side_of(part) == "l" else -0.6, 0, 1)
		evs[part] = shoot_now(npcs[part], part, dir, 3.0)
	var ended := {}      # part -> reason string
	var insane := {}
	var smp := func() -> void:
		for part in SWEEP_ORDER:
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
	for part in SWEEP_ORDER:
		var npc: Npc = npcs[part]
		rates[part] = npc.blood.state.external_rate + npc.blood.state.internal_rate
		states1[part] = _state_name(npc)
	await seconds(29.0)
	_samplers.erase(smp)
	var rows: Array = []
	for part in SWEEP_ORDER:
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
	for part in SWEEP_ORDER:
		(npcs[part] as Npc).queue_free()
	await frames(2)
	var all_hit := true
	var all_sane := true
	for r in rows:
		if r.hit != r.part:
			all_hit = false
		if r.sane != "":
			all_sane = false
	check("S.1", "sweep: same bullet at all 11 parts resolves to the aimed part, no crash", rows.size() == 11 and all_hit,
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
			head_row.amount * 1.5, str(DataDB.table("injury").parts.head.lethal_damage)])
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
