## Orchestrator tool: CPU performance benchmark (headless; GPU cost is NOT measured here).
## Spawns N NPCs in the real main scene, wounds them in phases and samples frame timings.
## Run with fixed steps so wall time per frame == CPU cost of one 1/60 s frame:
##   godot --headless --fixed-fps 60 --path . res://tools/perf_bench.tscn -- npcs=20 seconds=8
## `seconds` is simulated time (frames = seconds*60). Budget for 60 fps: < 16.7 ms/frame (CPU only).
extends Node

var main: Node3D
var npcs: Array = []
var args := {}


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		var kv := a.split("=")
		if kv.size() == 2:
			args[kv[0]] = kv[1]
	var n := int(args.get("npcs", "20"))
	var secs := float(args.get("seconds", "8"))
	main = load("res://scenes/main.tscn").instantiate()
	add_child(main)
	await get_tree().process_frame
	main.player.capture_mouse(false)
	if args.get("overlay", "1") == "0":
		GameSettings.set_setting(&"debug_overlay", false)
	for i in n:
		var a := TAU * i / n
		var pos := Vector3(cos(a), 0, sin(a)) * (4.0 + (i % 3) * 2.0)
		npcs.append(Npc.spawn(main.npc_root, Transform3D(Basis(Vector3.UP, a), pos), 500 + i))
	await _phase("idle", secs)
	for i in npcs.size():
		_shoot(npcs[i], [BodyIds.Part.TORSO, BodyIds.Part.UPPER_LEG_L, BodyIds.Part.LOWER_ARM_R][i % 3])
	await _phase("wounded_fleeing", secs)
	for npc in npcs:
		if is_instance_valid(npc) and not npc.is_dead():
			npc.brain.force_state(BodyIds.NpcState.DEAD)
	await _phase("ragdolls_bleeding", secs)
	get_tree().quit(0)


func _shoot(npc: Npc, part: int) -> void:
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BULLET
	ev.amount = 34.0
	ev.part_id = part
	ev.hit_position = npc.body.get_part_global_transform(part).origin
	ev.direction = Vector3.FORWARD
	ev.impactor_velocity = Vector3.FORWARD * 380.0
	ev.impactor_mass = 0.008
	ev.penetration = 0.45
	ev.extra = {"caliber": "9mm", "energy": 577.6}
	npc.apply_damage(ev)


func _phase(label: String, secs: float) -> void:
	var n := int(secs * 60.0)
	var times: Array[float] = []
	var last := Time.get_ticks_usec()
	for i in n:
		await get_tree().process_frame
		var now := Time.get_ticks_usec()
		times.append((now - last) / 1000.0)
		last = now
	times.sort()
	var total := 0.0
	for t in times:
		total += t
	print("PERF|%s|npcs=%d|avg_ms=%.2f|p50_ms=%.2f|p95_ms=%.2f|max_ms=%.1f|cpu_fps=%.0f|nodes=%d" % [
		label, npcs.size(), total / n, times[n / 2], times[int(n * 0.95)], times[n - 1], 1000.0 / (total / n),
		Performance.get_monitor(Performance.OBJECT_NODE_COUNT)])
