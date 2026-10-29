## Body-surface blood simulation (GoreFX owns it). Per NPC, per part (attached or severed): every wound becomes
## a dark core plus a stain that grows with the blood it lost and runs down along the part's local gravity;
## wetness decays over ~60 s. Results are pushed to NpcBody.set_part_blood (when it exists) every ~0.2 s.
## Tunables: data/gore.json "body_blood".
class_name BloodSim
extends RefCounted

var gore: Node3D
var calls := 0                       # pushes made (also when the body has no renderer yet)
var last_stains := PackedVector4Array()
var last_runs := PackedFloat32Array()
var _cfg: Dictionary = {}
var _npcs: Dictionary = {}           # npc id -> {npc, parts: {pid: part dict}, touched: float}
var _t := 0.0
var _sim_time := 0.0
var _rng := RandomNumberGenerator.new()


func _init(g: Node3D, cfg: Dictionary) -> void:
	gore = g
	_cfg = cfg
	_rng.randomize()


func tracked_npcs() -> int:
	return _npcs.size()


func forget(npc: Node) -> void:
	_npcs.erase(npc.get_instance_id())


func clear() -> void:
	_npcs.clear()


## A wound appeared: add its core and stain source to the owning part (max entries per part enforced).
func on_wound(npc: Node, wound: Wound) -> void:
	if npc == null or wound == null or wound.is_fracture and wound.bleed_rate <= 0.0 and not wound.is_stump:
		return
	if wound.is_bruise and wound.bleed_rate <= 0.0:
		return
	var id := npc.get_instance_id()
	if not _npcs.has(id):
		while _npcs.size() >= int(_cfg.get("max_npcs", 8)):
			_npcs.erase(_npcs.keys()[0])
		_npcs[id] = {"npc": npc, "parts": {}}
	var parts: Dictionary = _npcs[id].parts
	if not parts.has(wound.part_id):
		parts[wound.part_id] = {"entries": [], "wet": 0.0, "idle": false, "since": 0.0}
	var p: Dictionary = parts[wound.part_id]
	var core := lerpf(float(_cfg.get("core_entry_min", 0.006)), float(_cfg.get("core_entry_max", 0.016)), clampf(wound.severity, 0.0, 1.0))
	if wound.is_exit or wound.is_stump:
		core = lerpf(float(_cfg.get("core_exit_min", 0.02)), float(_cfg.get("core_exit_max", 0.05)), clampf(wound.severity, 0.0, 1.0))
	p.entries.append({"wound": wound, "pos": wound.local_position, "core": core, "lost": 0.0, "run": 0.0, "drain": -1.0})
	while p.entries.size() > int(_cfg.get("max_per_part", 8)):
		p.entries.pop_front()
	p.idle = false


## Advance the simulation; pushes to bodies every push_interval.
func update(delta: float) -> void:
	_t += delta
	var iv := float(_cfg.get("push_interval", 0.2))
	if _t < iv:
		return
	var dt := _t
	_t = 0.0
	_sim_time += dt
	var im: Dictionary = gore.intensity()
	var run_mult := float(im.get("stain_run_mult", 1.0))
	var stain_mult := float(im.get("stain_mult", 1.0))
	var min_flow := float(_cfg.get("min_flow", 0.5))
	var budget := int(_cfg.get("max_pushes", 24))
	for id in _npcs.keys():
		var rec: Dictionary = _npcs[id]
		if not is_instance_valid(rec.npc):
			_npcs.erase(id)
			continue
		for pid in rec.parts.keys():
			var p: Dictionary = rec.parts[pid]
			if p.idle:
				continue
			if budget <= 0:
				return
			budget -= 1
			_step_part(rec.npc, pid, p, dt, run_mult, stain_mult, min_flow)


func _step_part(npc: Node, pid: int, p: Dictionary, dt: float, run_mult: float, stain_mult: float, min_flow: float) -> void:
	var node: Node3D = null
	if npc.get("body") != null and is_instance_valid(npc.body):
		node = npc.body.get_part_node(pid)
	var any_flow := false
	var wounds := PackedVector4Array()
	var stains := PackedVector4Array()
	var runs := PackedFloat32Array()
	var base := float(_cfg.get("stain_base", 0.02))
	var k := float(_cfg.get("stain_k", 0.012))
	var max_r := float(_cfg.get("stain_max", 0.14))
	var rpf := float(_cfg.get("run_per_flow", 0.002))
	var max_run := float(_cfg.get("max_run", 0.6))
	var fast := float(_cfg.get("soak_mult", 2.5))
	for e in p.entries:
		var w: Wound = e.wound
		var f := w.current_flow * float(e.get("share", 1.0))
		if w.detached:
			if e.drain < 0.0:
				e.drain = maxf(w.bleed_rate, f)
			e.drain *= exp(-dt / float(_cfg.get("piece_drain_s", 8.0)))
			f = maxf(f, e.drain)
		var soak := fast if (w.is_stump or w.is_arterial) else 1.0
		if f > min_flow:
			any_flow = true
			e.lost += f * dt
			e.run = minf(e.run + f * rpf * soak * dt, max_run)
		var r := minf(base + k * sqrt(e.lost * soak), max_r) * stain_mult
		if not e.get("spilled", false) and e.lost > float(_cfg.get("spill_lost", 20.0)) and node != null:
			e.spilled = true
			_spill(npc, pid, node, e)
		wounds.append(Vector4(e.pos.x, e.pos.y, e.pos.z, e.core))
		stains.append(Vector4(e.pos.x, e.pos.y, e.pos.z, r if e.lost > 0.0 else 0.0))
		runs.append(e.run * run_mult)
	if any_flow:
		p.wet = 1.0
		p.since = 0.0
	else:
		p.wet = maxf(p.wet - dt / float(_cfg.get("wet_decay_s", 60.0)), 0.0)
		p.since += dt
		if p.wet <= 0.0:
			p.idle = true  # final push below clears glossiness, then the part sleeps
	var down := Vector3.DOWN
	if node != null:
		down = node.global_basis.orthonormalized().inverse() * Vector3.DOWN
	calls += 1
	last_stains = stains
	last_runs = runs
	if npc.get("body") != null and is_instance_valid(npc.body) and npc.body.has_method("set_part_blood"):
		npc.body.set_part_blood(pid, wounds, stains, runs, down, p.wet)
	gore.part_blood_pushed.emit(npc, pid, wounds, stains, runs, p.wet)
	# drips from wet, bleeding parts
	if any_flow and node != null and p.wet > 0.3 and _rng.randf() < float(_cfg.get("drip_chance", 0.25)):
		var e2: Dictionary = p.entries[_rng.randi() % p.entries.size()]
		var lp: Vector3 = e2.pos + down * e2.run
		gore.spawn_drip(node.to_global(lp))


## Blood reaching the end of a part flows onto the neighbour below (neck -> shirt): add a stain source
## on the parent part at the wound's world position, clamped to that part's extent.
func _spill(npc: Node, pid: int, node: Node3D, e: Dictionary) -> void:
	var q: int = BodyIds.PARENT.get(pid, -1)
	if q < 0 or not npc.body.has_part(q):
		return
	var qxf: Transform3D = npc.body.get_part_global_transform(q)
	var to_parent: Vector3 = (qxf.origin - node.global_position).normalized()
	if to_parent.dot(Vector3.DOWN) < float(_cfg.get("spill_min_down", 0.3)):
		return
	var h: Vector3 = npc.body.get_part_half_extents(q)
	var lp: Vector3 = qxf.affine_inverse() * node.to_global(e.pos)
	lp = Vector3(clampf(lp.x, -h.x * 0.9, h.x * 0.9), minf(lp.y, h.y * 0.9), clampf(lp.z, -h.z * 0.9, h.z * 0.9))
	var parts: Dictionary = _npcs[npc.get_instance_id()].parts
	if not parts.has(q):
		parts[q] = {"entries": [], "wet": 0.0, "idle": false, "since": 0.0}
	var qp: Dictionary = parts[q]
	qp.entries.append({"wound": e.wound, "pos": lp, "core": 0.0, "lost": 0.0, "run": 0.0, "drain": -1.0,
		"share": float(_cfg.get("spill_share", 0.6)), "spilled": true})
	while qp.entries.size() > int(_cfg.get("max_per_part", 8)):
		qp.entries.pop_front()
	qp.idle = false


## Severed (detached) parts that are bleeding: [{node, lost}] for floor pools under pieces.
func piece_sources() -> Array:
	var out: Array = []
	for id in _npcs:
		var rec: Dictionary = _npcs[id]
		if not is_instance_valid(rec.npc) or rec.npc.get("body") == null or not is_instance_valid(rec.npc.body):
			continue
		for pid in rec.parts:
			var p: Dictionary = rec.parts[pid]
			var detached := false
			var lost := 0.0
			for e in p.entries:
				if e.wound.detached:
					detached = true
				lost += e.lost
			if detached and lost > 1.0:
				var n: Node3D = rec.npc.body.get_part_node(pid)
				if n != null and is_instance_valid(n):
					out.append({"node": n, "lost": lost, "flowing": not p.idle and p.wet > 0.5})
	return out
