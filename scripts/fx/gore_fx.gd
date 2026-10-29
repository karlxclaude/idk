## GoreFX: listens to GameEvents. Cheap blood particle bursts, per-wound bleeding emitters whose rate
## follows Wound.current_flow, capped decals, and simple blood pools under bleeding NPCs.
## Tunables: data/gore.json. TODO(roadmap: advanced gore) wetness, arterial spray arcs, mist, drips.
## TODO(roadmap: blood staining) tint body materials from accumulated blood.
class_name GoreFX
extends Node3D

var cfg: Dictionary = {}
var max_decals := 120          # base cap; effective cap = max_decals * intensity decal_cap_mult
## Running total of particles asked for (bursts + emitter rate), for tests/debug.
var particles_spawned := 0.0
var chunk_bursts_fired := 0
var mist_fired := 0
var spurts_fired := 0
var blood: BloodSim
## Emitted whenever the body-blood sim pushes one part (also if the body has no set_part_blood yet).
signal part_blood_pushed(npc: Node, part_id: int, wounds: PackedVector4Array, stains: PackedVector4Array, runs: PackedFloat32Array, wetness: float)
var _mist_pool: Array[GPUParticles3D] = []
var _mist_i := 0
var _drip_pool: Array[GPUParticles3D] = []
var _drip_i := 0
var _pending_drops: Array[Dictionary] = []
var _fading := 0
var _last_limited_usec := 0
var _merged_pieces: Dictionary = {}
var _tex_entry: Texture2D
var _tex_exit: Texture2D
var _tex_drip: Texture2D
var _bone_bursts: Array[GPUParticles3D] = []
var _bone_i := 0
var _decals: Array[Decal] = []
var _decal_tex: Texture2D
var _bursts: Array[GPUParticles3D] = []
var _burst_i := 0
var _emitters: Array[Dictionary] = []   # {node, mat, wound, age, drop_t, stump_flow, stump_dur}
var _pools: Dictionary = {}             # npc instance id -> {node, radius, npc}
var _last_center: Dictionary = {}       # npc instance id -> Vector3
var _pool_timer := 0.0
var _rng := RandomNumberGenerator.new()
var _blood_color := Color(0.48, 0.04, 0.04)


func _ready() -> void:
	_rng.randomize()
	cfg = DataDB.table("gore")
	max_decals = int(cfg.get("max_decals", 120))
	_blood_color = Color(String(cfg.get("blood_color", "#7a0b0b")))
	_decal_tex = _make_decal_texture()
	_tex_entry = _make_splat_texture(false)
	_tex_exit = _make_splat_texture(true)
	_tex_drip = _decal_tex
	blood = BloodSim.new(self, cfg.get("body_blood", {}))
	_pool_material = _make_pool_material()
	_build_burst_pool()
	GameEvents.npc_wounded.connect(_on_wounded)
	GameEvents.npc_part_severed.connect(_on_severed)
	GameEvents.npc_head_chunk_destroyed.connect(_on_head_chunk)
	GameEvents.world_impact.connect(_on_world_impact)
	GameSettings.changed.connect(_on_settings_changed)


# ---------------- public (tests / debug) ----------------

## Gore intensity table row (data/gore.json "intensity") for the current GameSettings.gore_intensity.
func intensity() -> Dictionary:
	var name: String = GameSettings.Gore.keys()[GameSettings.gore_intensity]
	return cfg.get("intensity", {}).get(name, {})


func _im(key: String, default := 1.0) -> float:
	return float(intensity().get(key, default))


func decal_cap() -> int:
	return maxi(int(round(max_decals * _im("decal_cap_mult"))), 0)


func _on_settings_changed(_setting: StringName, _value) -> void:
	_trim_decals()


func _trim_decals() -> void:
	while _decals.size() > decal_cap():
		var old = _decals.pop_front()
		if not is_instance_valid(old):
			continue
		if _fading >= 24:
			old.queue_free()
			continue
		_fading += 1
		var tw: Tween = old.create_tween()
		tw.tween_property(old, "modulate:a", 0.0, 0.4)
		tw.tween_callback(func():
			_fading -= 1
			old.queue_free())


## Drop FX tied to an NPC that is about to be freed (pool, emitters on its parts).
func forget_npc(npc: Node) -> void:
	blood.forget(npc)
	var id := npc.get_instance_id()
	if _pools.has(id):
		if is_instance_valid(_pools[id].node):
			_pools[id].node.queue_free()
		_pools.erase(id)
	_last_center.erase(id)
	for i in range(_emitters.size() - 1, -1, -1):
		var n = _emitters[i].node
		if not is_instance_valid(n) or npc.is_ancestor_of(n):
			if is_instance_valid(n):
				n.queue_free()
			_emitters.remove_at(i)


func decal_count() -> int:
	return _decals.size()


func emitter_count() -> int:
	return _emitters.size()


func pool_count() -> int:
	return _pools.size()


func clear_all() -> void:
	for d in _decals:
		if is_instance_valid(d): d.queue_free()
	_decals.clear()
	for e in _emitters:
		if is_instance_valid(e.node): e.node.queue_free()
	_emitters.clear()
	for k in _pools:
		if is_instance_valid(_pools[k].node): _pools[k].node.queue_free()
	_pools.clear()
	_merged_pieces.clear()
	_pending_drops.clear()
	blood.clear()


## Add a projected decal; the oldest decals fade out beyond the cap. `dir` (optional) aligns streak textures.
func add_decal(pos: Vector3, normal: Vector3, size: float, color: Color, tex: Texture2D = null, dir := Vector3.ZERO) -> void:
	var d := Decal.new()
	d.size = Vector3(size, float(cfg.get("decal_depth", 0.3)), size)
	d.texture_albedo = tex if tex != null else _decal_tex
	d.modulate = color
	d.cull_mask = 1
	add_child(d)
	var n := normal.normalized()
	var q: Basis
	if dir.length_squared() > 0.001:
		var x := (dir - n * dir.dot(n))
		if x.length_squared() < 0.0001:
			x = n.cross(Vector3.RIGHT) if absf(n.dot(Vector3.RIGHT)) < 0.9 else n.cross(Vector3.UP)
		x = x.normalized()
		q = Basis(x, n, x.cross(n))
	else:
		if n.dot(Vector3.UP) < -0.999:
			q = Basis(Vector3.RIGHT, PI)
		else:
			q = Basis(Quaternion(Vector3.UP, n))
		q = q * Basis(Vector3.UP, _rng.randf() * TAU)
	d.global_transform = Transform3D(q, pos)
	_decals.append(d)
	_trim_decals()


# ---------------- event handlers ----------------

func _on_world_impact(pos: Vector3, normal: Vector3, ev: DamageEvent) -> void:
	var s := float(cfg.get("bullet_hole_size", 0.08))
	if ev != null and ev.type != DamageEvent.Type.BULLET:
		s *= 1.5
	add_decal(pos + normal * 0.01, normal, s, Color(0.04, 0.04, 0.04, 0.9))


func _on_wounded(npc: Node, wound: Wound, ev: DamageEvent) -> void:
	if wound == null or ev == null:
		return
	var b: Dictionary = cfg.get("burst", {})
	var sev := clampf(wound.severity, 0.0, 1.0)
	var amount := lerpf(float(b.get("min_amount", 12)), float(b.get("max_amount", 48)), sev)
	var speed := float(b.get("speed", 3.0))
	var dir := -ev.direction
	if wound.is_exit:
		amount *= float(b.get("exit_mult", 2.0))
		speed = float(b.get("exit_speed", 5.5))
		dir = ev.direction
	if wound.is_bruise and wound.bleed_rate <= 0.0:
		return  # TODO(roadmap: advanced gore) bruise decal for blunt hits
	var pos := _wound_world_pos(npc, wound, ev)
	burst(pos, dir, amount, speed)
	blood.on_wound(npc, wound)
	# high-energy bullets: fine red mist, bigger at the exit
	if ev.type == DamageEvent.Type.BULLET and float(ev.extra.get("energy", 0.0)) > float(cfg.get("mist", {}).get("energy_threshold", 800.0)):
		_mist(pos, dir, wound.is_exit)
	_splatter(pos, wound, ev)
	if wound.bleed_rate > 0.0 or wound.is_stump:
		_add_wound_emitter(npc, wound, pos)


## World splatter: exit sprays along the bullet/cut direction onto what is behind; entry leaves a small
## blowback spot toward the attacker if a surface is close.
func _splatter(pos: Vector3, wound: Wound, ev: DamageEvent) -> void:
	var sp: Dictionary = cfg.get("splatter", {})
	var d := ev.direction.normalized()
	if wound.is_exit:
		var res := _world_ray(pos, pos + d * float(sp.get("exit_range", 4.0)))
		if not res.is_empty():
			var sz := _rng.randf_range(float(sp.get("exit_min", 0.5)), float(sp.get("exit_max", 0.9))) * lerpf(0.7, 1.2, clampf(wound.severity, 0.0, 1.0))
			add_decal(res.position + res.normal * 0.01, res.normal, sz, _blood_decal_color(), _tex_exit, d)
	elif not wound.is_stump and not wound.is_bruise:
		var res2 := _world_ray(pos, pos - d * float(sp.get("entry_range", 1.5)))
		if not res2.is_empty():
			add_decal(res2.position + res2.normal * 0.01, res2.normal, _rng.randf_range(0.12, 0.25), _blood_decal_color(), _tex_entry, -d)


func _mist(pos: Vector3, dir: Vector3, big: bool) -> void:
	var m := _im("mist_mult")
	if m <= 0.0 or _mist_pool.is_empty():
		return
	var mc: Dictionary = cfg.get("mist", {})
	var p := _mist_pool[_mist_i]
	_mist_i = (_mist_i + 1) % _mist_pool.size()
	var mat := p.process_material as ParticleProcessMaterial
	mat.direction = dir.normalized() if dir.length() > 0.01 else Vector3.UP
	mat.initial_velocity_max = float(mc.get("speed", 2.0)) * (1.6 if big else 1.0)
	mat.initial_velocity_min = mat.initial_velocity_max * 0.4
	p.amount_ratio = clampf((1.0 if big else 0.4) * m, 0.05, 1.0)
	p.global_position = pos
	particles_spawned += p.amount * p.amount_ratio
	mist_fired += 1
	p.restart()
	p.emitting = true


## One falling blood drop from `pos`: a particle plus a small floor decal after the fall time.
func spawn_drip(pos: Vector3) -> void:
	var res := _world_ray(pos, pos + Vector3.DOWN * 4.0)
	if res.is_empty() or _pending_drops.size() >= 30:
		return
	var h: float = pos.y - res.position.y
	var fall := sqrt(2.0 * maxf(h, 0.01) / 9.8)
	if _im("emitter_mult") > 0.0 and not _drip_pool.is_empty():
		var p := _drip_pool[_drip_i]
		_drip_i = (_drip_i + 1) % _drip_pool.size()
		p.lifetime = maxf(fall, 0.05)
		p.global_position = pos
		particles_spawned += 1.0
		p.restart()
		p.emitting = true
	_pending_drops.append({"t": fall, "pos": res.position, "n": res.normal})


func _on_severed(npc: Node, part_id: int, root: RigidBody3D, ev: DamageEvent) -> void:
	var st: Dictionary = cfg.get("stump", {})
	var pos: Vector3 = ev.hit_position if ev else Vector3.ZERO
	burst(pos, -ev.direction if ev else Vector3.UP, float(st.get("burst", 40)), 4.0)
	if root != null and is_instance_valid(root):
		var local := root.to_local(pos)
		var e := _make_emitter(root, local, local.normalized() if local.length() > 0.01 else Vector3.UP)
		if not e.is_empty():
			e.stump_flow = float(st.get("flow", 30.0))
			e.stump_dur = float(st.get("duration", 6.0))


# ---------------- particles ----------------

func burst(pos: Vector3, dir: Vector3, amount: float, speed: float, limited := false) -> void:
	if limited:
		var now := Time.get_ticks_usec()
		if now - _last_limited_usec < int(float(cfg.get("spurt_min_gap_s", 0.04)) * 1e6):
			return  # repeating sources (arterial spurts) must not overspawn the burst pool
		_last_limited_usec = now
	if _bursts.is_empty():
		return
	var mult := _im("burst_mult")
	if mult <= 0.0:
		return
	var p := _bursts[_burst_i]
	_burst_i = (_burst_i + 1) % _bursts.size()
	var mat := p.process_material as ParticleProcessMaterial
	mat.direction = dir.normalized() if dir.length() > 0.01 else Vector3.UP
	mat.initial_velocity_min = speed * 0.4
	mat.initial_velocity_max = speed
	var ratio := clampf(amount / float(cfg.get("burst", {}).get("max_amount", 48)), 0.05, 1.0) * mult
	p.amount_ratio = maxf(ratio, 0.01)
	particles_spawned += p.amount * p.amount_ratio
	p.global_position = pos
	p.restart()
	p.emitting = true


## Head chunk destroyed: big blood + bone fragment burst, short bleeding on the gib and the head.
func _on_head_chunk(npc: Node, chunk: int, gib: RigidBody3D, ev: DamageEvent) -> void:
	var cc: Dictionary = cfg.get("chunk", {})
	var pos := Vector3.ZERO
	var head: Node3D = _part_node(npc, BodyIds.Part.HEAD)
	if gib != null and is_instance_valid(gib):
		pos = gib.global_position
	elif ev != null:
		pos = ev.hit_position
	elif head != null:
		pos = head.global_position
	var dir: Vector3 = (-ev.direction if ev != null else Vector3.UP)
	var mult := _im("burst_mult")
	chunk_bursts_fired += 1
	if mult <= 0.0:
		return
	burst(pos, dir, float(cc.get("blood_amount", 90)), float(cc.get("speed", 6.0)))
	if not _bone_bursts.is_empty():
		var bp := _bone_bursts[_bone_i]
		_bone_i = (_bone_i + 1) % _bone_bursts.size()
		var bm := bp.process_material as ParticleProcessMaterial
		bm.direction = dir.normalized() if dir.length() > 0.01 else Vector3.UP
		bm.initial_velocity_min = float(cc.get("bone_speed", 5.0)) * 0.4
		bm.initial_velocity_max = float(cc.get("bone_speed", 5.0))
		bp.amount_ratio = maxf(mult, 0.05)
		bp.global_position = pos
		particles_spawned += bp.amount * bp.amount_ratio
		bp.restart()
		bp.emitting = true
	if _im("emitter_mult") <= 0.0:
		return  # LOW: small burst only, no gib/head emitters
	var dur := float(cc.get("emitter_duration", 3.0))
	var flow := float(cc.get("emitter_flow", 25.0))
	if gib != null and is_instance_valid(gib):
		var e := _make_emitter(gib, Vector3.ZERO, Vector3.UP)
		if not e.is_empty():
			e.stump_flow = flow; e.stump_dur = dur
	if head != null and ev != null:
		var e2 := _make_emitter(head, head.to_local(pos), head.global_basis.inverse() * dir)
		if not e2.is_empty():
			e2.stump_flow = flow; e2.stump_dur = dur * 1.5


func _build_burst_pool() -> void:
	var cc: Dictionary = cfg.get("chunk", {})
	for i in int(cc.get("max_bone_bursts", 6)):
		var bp := _make_particles(int(cc.get("bone_amount", 24)), 0.9, true, true)
		(bp.process_material as ParticleProcessMaterial).gravity = Vector3(0, -9.8, 0)
		add_child(bp)
		_bone_bursts.append(bp)
	var mc: Dictionary = cfg.get("mist", {})
	for i in int(mc.get("max", 6)):
		var mp := _make_particles(int(mc.get("amount", 28)), float(mc.get("lifetime", 0.55)), true)
		var mm := mp.process_material as ParticleProcessMaterial
		mm.spread = 55.0
		mm.gravity = Vector3(0, -0.8, 0)
		mm.damping_min = 3.0
		mm.damping_max = 5.0
		mm.scale_min = 1.5
		mm.scale_max = 3.0
		var sphere := mp.draw_pass_1 as SphereMesh
		var smat := sphere.material as StandardMaterial3D
		smat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		smat.albedo_color = Color(0.55, 0.05, 0.05, 0.3)
		add_child(mp)
		_mist_pool.append(mp)
	for i in int(cfg.get("drip", {}).get("max", 8)):
		var dp := _make_particles(1, 0.4, true)
		(dp.process_material as ParticleProcessMaterial).initial_velocity_max = 0.0
		(dp.process_material as ParticleProcessMaterial).spread = 0.0
		dp.explosiveness = 1.0
		add_child(dp)
		_drip_pool.append(dp)
	var b: Dictionary = cfg.get("burst", {})
	for i in int(cfg.get("max_bursts", 12)):
		var p := _make_particles(int(b.get("max_amount", 48)) * 2, float(b.get("lifetime", 0.7)), true)
		add_child(p)
		_bursts.append(p)


func _make_particles(amount: int, lifetime: float, one_shot: bool, bone := false) -> GPUParticles3D:
	var p := GPUParticles3D.new()
	p.amount = amount
	p.lifetime = lifetime
	p.one_shot = one_shot
	p.explosiveness = 0.95 if one_shot else 0.0
	p.emitting = false
	p.local_coords = false
	p.visibility_aabb = AABB(Vector3(-5, -5, -5), Vector3(10, 10, 10))
	p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var m := ParticleProcessMaterial.new()
	m.gravity = Vector3(0, -9.8, 0)
	m.spread = 35.0 if one_shot else 25.0
	m.scale_min = 0.6
	m.scale_max = 1.4
	p.process_material = m
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if bone:
		sm.albedo_color = Color(0.9, 0.86, 0.74)
		var box := BoxMesh.new()
		box.size = Vector3(0.02, 0.012, 0.016)
		box.material = sm
		p.draw_pass_1 = box
		m.angle_min = 0.0
		m.angle_max = 360.0
		return p
	sm.albedo_color = _blood_color
	var sphere := SphereMesh.new()
	sphere.radius = 0.018
	sphere.height = 0.036
	sphere.radial_segments = 6
	sphere.rings = 3
	sphere.material = sm
	p.draw_pass_1 = sphere
	return p


func _wound_world_pos(npc: Node, wound: Wound, ev: DamageEvent) -> Vector3:
	var node := _part_node(npc, wound.part_id)
	if node != null:
		return node.to_global(wound.local_position)
	return ev.hit_position


func _part_node(npc: Node, part_id: int) -> Node3D:
	if npc != null and is_instance_valid(npc) and npc.get("body") != null and is_instance_valid(npc.body):
		return npc.body.get_part_node(part_id)
	return null


func _add_wound_emitter(npc: Node, wound: Wound, world_pos: Vector3) -> void:
	var node := _part_node(npc, wound.part_id)
	var e: Dictionary
	if node != null:
		e = _make_emitter(node, wound.local_position, wound.local_normal)
	else:
		e = _make_emitter(self, world_pos, Vector3.UP)
	if not e.is_empty():
		e.wound = wound


func _make_emitter(parent: Node3D, local_pos: Vector3, local_dir: Vector3) -> Dictionary:
	var we: Dictionary = cfg.get("wound_emitter", {})
	while _emitters.size() >= int(cfg.get("max_wound_emitters", 40)):
		var old: Dictionary = _emitters.pop_front()
		if is_instance_valid(old.node):
			old.node.queue_free()
	var p := _make_particles(int(we.get("amount", 24)), float(we.get("lifetime", 0.6)), false)
	parent.add_child(p)
	p.position = local_pos
	var mat := p.process_material as ParticleProcessMaterial
	mat.direction = local_dir.normalized() if local_dir.length() > 0.01 else Vector3.UP
	var e := {"node": p, "mat": mat, "wound": null, "age": 0.0, "drop_t": 0.0,
		"stump_flow": 0.0, "stump_dur": 0.0, "on": false}
	_emitters.append(e)
	return e


func _physics_process(delta: float) -> void:
	_update_emitters(delta)
	blood.update(delta)
	for i in range(_pending_drops.size() - 1, -1, -1):
		var d: Dictionary = _pending_drops[i]
		d.t -= delta
		if d.t <= 0.0:
			var ds: Array = cfg.get("drip", {}).get("size", [0.04, 0.09])
			add_decal(d.pos + d.n * 0.01, d.n, _rng.randf_range(ds[0], ds[1]), _blood_decal_color(), _tex_drip)
			_pending_drops.remove_at(i)
	_pool_timer -= delta
	if _pool_timer <= 0.0:
		_pool_timer = float(cfg.get("pool", {}).get("update_interval", 0.25))
		_update_pools(float(cfg.get("pool", {}).get("update_interval", 0.25)))


func _update_emitters(delta: float) -> void:
	var we: Dictionary = cfg.get("wound_emitter", {})
	var flow_ref := maxf(float(we.get("flow_ref", 25.0)), 0.001)
	var min_flow := float(we.get("min_flow", 0.02))
	var i := _emitters.size() - 1
	while i >= 0:
		var e: Dictionary = _emitters[i]
		var node = e.node  # untyped: may already be freed
		if not is_instance_valid(node):
			_emitters.remove_at(i)
			i -= 1
			continue
		e.age += delta
		var flow := 0.0
		if e.stump_dur > 0.0:
			flow = e.stump_flow * clampf(1.0 - e.age / e.stump_dur, 0.0, 1.0)
		elif e.wound != null:
			flow = e.wound.current_flow
		var emit_mult := _im("emitter_mult")
		var wet: bool = flow > min_flow
		var on: bool = wet and emit_mult > 0.0
		if on != e.on:
			e.on = on
			node.emitting = on
		var w: Wound = e.wound
		if w != null and w.is_arterial and emit_mult > 0.0:
			_arterial_spurt(e, node, flow, flow_ref)
		if on:
			var r := clampf(flow / flow_ref, 0.05, 1.0)
			if w != null and w.is_arterial:
				r = r * r  # arterial: the continuous trickle tapers hard, the spurts carry the show
			node.amount_ratio = maxf(r * emit_mult, 0.01)
			particles_spawned += node.amount * node.amount_ratio * delta / maxf(node.lifetime, 0.01)
			var mat: ParticleProcessMaterial = e.mat
			mat.initial_velocity_min = float(we.get("speed_min", 0.6)) * r
			mat.initial_velocity_max = lerpf(float(we.get("speed_min", 0.6)), float(we.get("speed_max", 3.5)), r)
		if wet:
			e.drop_t -= delta
			if e.drop_t <= 0.0:
				e.drop_t = float(we.get("drop_interval", 0.3))
				if _rng.randf() < flow * float(we.get("drop_chance_per_flow", 0.05)):
					_drop_blood(node.global_position)
		i -= 1


## Arterial wounds: each pulse (flow rising through half its recent peak) throws a strong arcing spurt.
func _arterial_spurt(e: Dictionary, node: Node3D, flow: float, flow_ref: float) -> void:
	var sc: Dictionary = cfg.get("spray", {})
	e.peak = maxf(flow, float(e.get("peak", 0.0)) * 0.985)
	var thr := maxf(float(sc.get("min_flow", 4.0)), 0.5 * e.peak)
	var prev: float = e.get("prev", 0.0)
	e.prev = flow
	if flow >= thr and prev < thr:
		var r := clampf(flow / flow_ref, 0.1, 1.0)
		var local_dir: Vector3 = (e.mat as ParticleProcessMaterial).direction
		var dir: Vector3 = (node.global_basis * local_dir).normalized()
		dir = (dir + Vector3.UP * float(sc.get("lift", 0.25))).normalized()
		spurts_fired += 1
		burst(node.global_position, dir, lerpf(float(sc.get("min_amount", 20)), float(sc.get("max_amount", 48)), r),
			lerpf(float(sc.get("min_speed", 2.5)), float(sc.get("max_speed", 6.5)), r), true)


func _drop_blood(from: Vector3) -> void:
	var off := Vector3(_rng.randf_range(-0.3, 0.3), 0, _rng.randf_range(-0.3, 0.3))
	var res := _world_ray(from + off, from + off + Vector3.DOWN * 4.0)
	if not res.is_empty():
		var d: Array = cfg.get("decal_size", [0.15, 0.5])
		add_decal(res.position + res.normal * 0.01, res.normal, _rng.randf_range(d[0], d[1]), _blood_decal_color())


func _blood_decal_color() -> Color:
	var c := _blood_color
	c.a = _rng.randf_range(0.6, 0.9)
	return c


func _world_ray(from: Vector3, to: Vector3) -> Dictionary:
	if not is_inside_tree():
		return {}
	var q := PhysicsRayQueryParameters3D.create(from, to, BodyIds.LAYER_WORLD)
	return get_world_3d().direct_space_state.intersect_ray(q)


# ---------------- blood pools ----------------

func _update_pools(interval: float) -> void:
	var pc: Dictionary = cfg.get("pool", {})
	if not bool(pc.get("enabled", true)):
		return
	for npc in get_tree().get_nodes_in_group(&"npc"):
		if not is_instance_valid(npc) or npc.get("blood") == null or npc.blood == null:
			continue
		var id: int = npc.get_instance_id()
		var center: Vector3 = npc.get_center()
		var speed := 0.0
		if _last_center.has(id):
			speed = center.distance_to(_last_center[id]) / maxf(interval, 0.001)
		_last_center[id] = center
		var st: BloodState = npc.blood.state
		var lost := st.max_volume - st.volume
		var down: bool = npc.get_state() in [BodyIds.NpcState.CRAWL, BodyIds.NpcState.UNCONSCIOUS, BodyIds.NpcState.DEAD,
			BodyIds.NpcState.STAGGER] or (is_instance_valid(npc.body) and npc.body.is_ragdoll())
		var bleeding := st.external_rate > float(pc.get("min_external_rate", 0.1))
		if not (down and speed < float(pc.get("slow_speed", 0.6)) and (bleeding or _pools.has(id))):
			continue
		if lost <= 1.0:
			continue
		var target := clampf(float(pc.get("radius_per_sqrt_lost", 0.03)) * sqrt(lost),
			float(pc.get("min_radius", 0.15)), float(pc.get("max_radius", 1.2))) * _im("pool_radius_mult")
		var torso := center
		if is_instance_valid(npc.body):
			torso = npc.body.get_part_global_transform(BodyIds.Part.TORSO).origin
		var res := _world_ray(torso + Vector3.UP * 0.3, torso + Vector3.DOWN * 3.0)
		if res.is_empty() or torso.y - res.position.y > float(pc.get("max_torso_height", 0.5)):
			continue  # still falling / not on the floor yet
		var pool: Dictionary
		if _pools.has(id):
			pool = _pools[id]
		else:
			pool = _create_pool(npc, id, int(pc.get("max_pools", 12)))
		if target > pool.radius:
			pool.radius = target
		if not is_instance_valid(pool.node):
			_pools.erase(id)
			continue
		var node: MeshInstance3D = pool.node
		var p: Vector3 = Vector3(torso.x, res.position.y, torso.z)
		if not pool.placed:
			node.global_position = p + Vector3.UP * 0.012
			pool.placed = true
		node.scale = Vector3(pool.radius, 1.0, pool.radius)
	_update_piece_pools(pc, interval)
	_merge_pools(pc)
	# forget freed NPCs
	for id in _pools.keys():
		if not is_instance_valid(_pools[id].npc):
			if is_instance_valid(_pools[id].node):
				_pools[id].node.queue_free()
			_pools.erase(id)
			_last_center.erase(id)


## Pools under bleeding severed pieces, fed by the blood those parts actually lost.
func _update_piece_pools(pc: Dictionary, interval: float) -> void:
	for src in blood.piece_sources():
		var node: Node3D = src.node
		var id := node.get_instance_id()
		if _merged_pieces.has(id):
			continue
		var pos := node.global_position
		var speed := 0.0
		if _last_center.has(id):
			speed = pos.distance_to(_last_center[id]) / maxf(interval, 0.001)
		_last_center[id] = pos
		if speed > float(pc.get("slow_speed", 0.6)) or (not src.flowing and not _pools.has(id)):
			continue
		var res := _world_ray(pos + Vector3.UP * 0.2, pos + Vector3.DOWN * 3.0)
		if res.is_empty() or pos.y - res.position.y > float(pc.get("max_piece_height", 0.4)):
			continue
		var target := clampf(float(pc.get("radius_per_sqrt_lost", 0.03)) * float(pc.get("piece_radius_mult", 0.8)) * sqrt(src.lost),
			float(pc.get("min_radius", 0.15)) * 0.6, float(pc.get("max_radius", 1.2))) * _im("pool_radius_mult")
		var pool: Dictionary = _pools[id] if _pools.has(id) else _create_pool(node, id, int(pc.get("max_pools", 12)))
		if not is_instance_valid(pool.node):
			_pools.erase(id)
			continue
		pool.radius = maxf(pool.radius, target)
		if not pool.placed:
			pool.node.global_position = Vector3(pos.x, res.position.y + 0.012, pos.z)
			pool.placed = true
		pool.node.scale = Vector3(pool.radius, 1.0, pool.radius)
		pool.piece = true


## A piece pool that overlaps another pool is absorbed into it (area adds, radius cap kept).
func _merge_pools(pc: Dictionary) -> void:
	var cap := float(pc.get("max_radius", 1.2))
	for a in _pools.keys():
		if not _pools.has(a) or not _pools[a].get("piece", false):
			continue
		var pa: Dictionary = _pools[a]
		if not is_instance_valid(pa.node):
			continue
		for b in _pools.keys():
			if b == a or not _pools.has(b) or not is_instance_valid(_pools[b].node):
				continue
			var pb: Dictionary = _pools[b]
			var d := Vector2(pa.node.global_position.x - pb.node.global_position.x, pa.node.global_position.z - pb.node.global_position.z).length()
			if d < (pa.radius + pb.radius) * 0.6:
				pb.radius = minf(sqrt(pa.radius * pa.radius + pb.radius * pb.radius), cap)
				pb.node.scale = Vector3(pb.radius, 1.0, pb.radius)
				pa.node.queue_free()
				_pools.erase(a)
				_merged_pieces[a] = true
				break


func _create_pool(npc: Node, id: int, max_pools: int) -> Dictionary:
	while _pools.size() >= max_pools:
		var oldest = _pools.keys()[0]
		if is_instance_valid(_pools[oldest].node):
			_pools[oldest].node.queue_free()
		_pools.erase(oldest)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(2, 2)
	pm.material = _pool_material
	mi.mesh = pm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var pool := {"node": mi, "radius": 0.0, "npc": npc, "placed": false}
	_pools[id] = pool
	return pool


var _pool_material: StandardMaterial3D


func _make_pool_material() -> StandardMaterial3D:
	var pc: Dictionary = cfg.get("pool", {})
	var n := FastNoiseLite.new()
	n.frequency = 0.9
	n.seed = 7
	var sz := 128
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	var jag := float(pc.get("edge_jaggedness", 0.25))
	for y in sz:
		for x in sz:
			var v := Vector2((x + 0.5) / sz * 2.0 - 1.0, (y + 0.5) / sz * 2.0 - 1.0)
			var d := v.length() / (1.0 + jag * n.get_noise_2d(v.x * 3.0, v.y * 3.0))
			var a := clampf((1.0 - d) / 0.25, 0.0, 1.0)
			img.set_pixel(x, y, Color(1, 1, 1, a * float(pc.get("opacity", 0.92))))
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.albedo_color = Color(String(pc.get("color", "#550505")))
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.roughness = float(pc.get("roughness", 0.12))
	m.metallic_specular = float(pc.get("specular", 0.25))
	return m


## Splatter shapes: entry = round spot with a few satellites; exit = streak along +X with sprayed droplets.
func _make_splat_texture(exit: bool) -> Texture2D:
	var sz := 96
	var img := Image.create(sz, sz, false, Image.FORMAT_RGBA8)
	var r := RandomNumberGenerator.new()
	r.seed = 4242 if exit else 99
	var blobs: Array[Vector3] = []   # x,y centre (-1..1), z radius
	if exit:
		blobs.append(Vector3(-0.1, 0.0, 0.16))
		for i in 44:
			var t := r.randf()
			blobs.append(Vector3(lerpf(-0.1, 0.95, t), r.randfn(0.0, 0.1 + 0.25 * t), r.randf_range(0.02, 0.085) * (1.2 - t)))
	else:
		blobs.append(Vector3(0.0, 0.0, 0.22))
		for i in 10:
			var a := r.randf() * TAU
			var d := r.randf_range(0.3, 0.85)
			blobs.append(Vector3(cos(a) * d, sin(a) * d, r.randf_range(0.015, 0.06)))
	for y in sz:
		for x in sz:
			var u := Vector2((x + 0.5) / sz * 2.0 - 1.0, (y + 0.5) / sz * 2.0 - 1.0)
			var a := 0.0
			for b in blobs:
				var d := Vector2(b.x, b.y).distance_to(u)
				a = maxf(a, clampf((b.z - d) / (b.z * 0.35), 0.0, 1.0))
			img.set_pixel(x, y, Color(1, 1, 1, a))
	return ImageTexture.create_from_image(img)


func _make_decal_texture() -> Texture2D:
	var g := Gradient.new()
	g.offsets = PackedFloat32Array([0.0, 0.55, 1.0])
	g.colors = PackedColorArray([Color(1, 1, 1, 1), Color(1, 1, 1, 0.9), Color(1, 1, 1, 0)])
	var t := GradientTexture2D.new()
	t.gradient = g
	t.fill = GradientTexture2D.FILL_RADIAL
	t.fill_from = Vector2(0.5, 0.5)
	t.fill_to = Vector2(0.5, 0.0)
	t.width = 64
	t.height = 64
	return t
