## GoreFX: listens to GameEvents. Cheap blood particle bursts, per-wound bleeding emitters whose rate
## follows Wound.current_flow, capped decals, and simple blood pools under bleeding NPCs.
## Tunables: data/gore.json. TODO(roadmap: advanced gore) wetness, arterial spray arcs, mist, drips.
## TODO(roadmap: blood staining) tint body materials from accumulated blood.
class_name GoreFX
extends Node3D

var cfg: Dictionary = {}
var max_decals := 120
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
	_build_burst_pool()
	GameEvents.npc_wounded.connect(_on_wounded)
	GameEvents.npc_part_severed.connect(_on_severed)
	GameEvents.world_impact.connect(_on_world_impact)


# ---------------- public (tests / debug) ----------------

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


## Add a projected decal; the oldest decals are removed beyond max_decals.
func add_decal(pos: Vector3, normal: Vector3, size: float, color: Color) -> void:
	var d := Decal.new()
	d.size = Vector3(size, float(cfg.get("decal_depth", 0.3)), size)
	d.texture_albedo = _decal_tex
	d.modulate = color
	d.cull_mask = 1
	add_child(d)
	var q: Basis
	if normal.dot(Vector3.UP) < -0.999:
		q = Basis(Vector3.RIGHT, PI)
	else:
		q = Basis(Quaternion(Vector3.UP, normal.normalized()))
	q = q * Basis(Vector3.UP, _rng.randf() * TAU)
	d.global_transform = Transform3D(q, pos)
	_decals.append(d)
	while _decals.size() > max_decals:
		var old: Decal = _decals.pop_front()
		if is_instance_valid(old):
			old.queue_free()


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
	# spatter on whatever is behind an exit wound / below the hit
	var res := _world_ray(pos, pos + ev.direction.normalized() * 3.0)
	if not res.is_empty() and wound.is_exit:
		add_decal(res.position + res.normal * 0.01, res.normal, _rng.randf_range(0.2, 0.5), _blood_decal_color())
	if wound.bleed_rate > 0.0 or wound.is_stump:
		_add_wound_emitter(npc, wound, pos)


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

func burst(pos: Vector3, dir: Vector3, amount: float, speed: float) -> void:
	if _bursts.is_empty():
		return
	var p := _bursts[_burst_i]
	_burst_i = (_burst_i + 1) % _bursts.size()
	var mat := p.process_material as ParticleProcessMaterial
	mat.direction = dir.normalized() if dir.length() > 0.01 else Vector3.UP
	mat.initial_velocity_min = speed * 0.4
	mat.initial_velocity_max = speed
	p.amount_ratio = clampf(amount / float(cfg.get("burst", {}).get("max_amount", 48)) , 0.05, 1.0)
	p.global_position = pos
	p.restart()
	p.emitting = true


func _build_burst_pool() -> void:
	var b: Dictionary = cfg.get("burst", {})
	for i in int(cfg.get("max_bursts", 12)):
		var p := _make_particles(int(b.get("max_amount", 48)) * 2, float(b.get("lifetime", 0.7)), true)
		add_child(p)
		_bursts.append(p)


func _make_particles(amount: int, lifetime: float, one_shot: bool) -> GPUParticles3D:
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
	var sphere := SphereMesh.new()
	sphere.radius = 0.014
	sphere.height = 0.028
	sphere.radial_segments = 6
	sphere.rings = 3
	var sm := StandardMaterial3D.new()
	sm.albedo_color = _blood_color
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
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
		var node: GPUParticles3D = e.node
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
		var on: bool = flow > min_flow
		if on != e.on:
			e.on = on
			node.emitting = on
		if on:
			var r := clampf(flow / flow_ref, 0.05, 1.0)
			node.amount_ratio = r
			var mat: ParticleProcessMaterial = e.mat
			mat.initial_velocity_min = float(we.get("speed_min", 0.6)) * r
			mat.initial_velocity_max = lerpf(float(we.get("speed_min", 0.6)), float(we.get("speed_max", 3.5)), r)
			e.drop_t -= delta
			if e.drop_t <= 0.0:
				e.drop_t = float(we.get("drop_interval", 0.3))
				if _rng.randf() < flow * float(we.get("drop_chance_per_flow", 0.05)):
					_drop_blood(node.global_position)
		i -= 1


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
			float(pc.get("min_radius", 0.15)), float(pc.get("max_radius", 1.4)))
		var pool: Dictionary
		if _pools.has(id):
			pool = _pools[id]
		else:
			pool = _create_pool(npc, id, int(pc.get("max_pools", 12)))
		if target > pool.radius:
			pool.radius = target
		var res := _world_ray(center + Vector3.UP * 0.5, center + Vector3.DOWN * 3.0)
		if res.is_empty():
			continue
		var node: MeshInstance3D = pool.node
		var p: Vector3 = res.position
		if not pool.placed or Vector2(p.x - node.global_position.x, p.z - node.global_position.z).length() > 0.5:
			node.global_position = p + Vector3.UP * 0.012
			pool.placed = true
		node.scale = Vector3(pool.radius, 1.0, pool.radius)
	# forget freed NPCs
	for id in _pools.keys():
		if not is_instance_valid(_pools[id].npc):
			if is_instance_valid(_pools[id].node):
				_pools[id].node.queue_free()
			_pools.erase(id)
			_last_center.erase(id)


func _create_pool(npc: Node, id: int, max_pools: int) -> Dictionary:
	while _pools.size() >= max_pools:
		var oldest = _pools.keys()[0]
		if is_instance_valid(_pools[oldest].node):
			_pools[oldest].node.queue_free()
		_pools.erase(oldest)
	var mi := MeshInstance3D.new()
	var cyl := CylinderMesh.new()
	cyl.top_radius = 1.0
	cyl.bottom_radius = 1.0
	cyl.height = 0.004
	cyl.radial_segments = 20
	cyl.rings = 1
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(_blood_color.r * 0.8, _blood_color.g * 0.8, _blood_color.b * 0.8)
	m.roughness = 0.15
	m.metallic_specular = 0.8
	cyl.material = m
	mi.mesh = cyl
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var pool := {"node": mi, "radius": 0.0, "npc": npc, "placed": false}
	_pools[id] = pool
	return pool


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
