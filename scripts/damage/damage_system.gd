## OWNER: damage-wounds-bleed-agent. Applies injury rules per damage type/part.
## The only code that mutates BodyPart HP. Tunables: data/injury.json
## TODO(roadmap: head chunks) head rule lives in _apply_head_damage / lethal threshold.
## TODO(roadmap: weapons) EXPLOSIVE type is reserved; add a rule in apply().
## TODO(roadmap: stuck blades) hook in _stab().
class_name DamageSystem
extends Node

var npc: Npc
var _cfg: Dictionary
var _parts: Dictionary = {}  # part id -> BodyPart
var _lethal_reported := false


func setup(owner_npc: Npc) -> void:
	npc = owner_npc
	_cfg = DataDB.table("injury")
	for id in BodyIds.KEYS:
		var pc: Dictionary = _pcfg(id)
		var bp := BodyPart.new()
		bp.part_id = id
		bp.tissue = BodyIds.Tissue.BONE if pc.get("tissue", "flesh") == "bone" else BodyIds.Tissue.FLESH
		bp.max_hp = float(pc.get("max_hp", 100.0))
		bp.hp = bp.max_hp
		_parts[id] = bp


## Apply one DamageEvent (already localized by Npc.apply_damage). Returns wounds created.
func apply(ev: DamageEvent) -> Array[Wound]:
	var out: Array[Wound] = []
	if not _parts.has(ev.part_id):
		return out
	var part: BodyPart = _parts[ev.part_id]
	var pc := _pcfg(ev.part_id)
	part.hit_count += 1
	var dmg := ev.amount * float(pc.get("dmg_mult", 1.0)) * float(_cfg.get("type_mult", {}).get(_tname(ev.type), 1.0))
	var detached := part.severed
	var was_fractured := part.broken
	part.hp = maxf(0.0, part.hp - dmg)

	match ev.type:
		DamageEvent.Type.BULLET:
			_bullet(ev, part, pc, dmg, detached, out)
		DamageEvent.Type.BLADE_STAB:
			_stab(ev, part, pc, dmg, detached, out)
		DamageEvent.Type.BLADE_SLASH:
			_slash(ev, part, pc, dmg, detached, out)
		DamageEvent.Type.BLUNT:
			_blunt(ev, part, pc, dmg, detached, out)
		_:
			_slash(ev, part, pc, dmg, detached, out)  # EXPLOSIVE reserved: treat as generic cut

	# bone fracture from accumulated damage (blunt also checks raw force)
	if not part.broken and not was_fractured and float(pc.get("fracture_accum", 0.0)) > 0.0:
		var accum := part.max_hp - part.hp
		var force_hit: bool = ev.type == DamageEvent.Type.BLUNT and ev.amount >= float(pc.get("fracture_force", 1e9))
		if accum >= float(pc.fracture_accum) or force_hit:
			out.append(_fracture(ev, part, detached))

	# severing by very high damage (not for slashes already handled)
	if not detached and not part.severed and ev.can_dismember and ev.type != DamageEvent.Type.BLADE_SLASH:
		var th := float(pc.get("dismember", 0.0))
		if th > 0.0 and ev.amount >= th * float(_cfg.get("high_damage_sever_mult", 2.0)):
			out.append_array(_sever(ev, part))

	# head destroyed by accumulated damage
	if ev.part_id == BodyIds.Part.HEAD and part.hp <= 0.0 and not part.destroyed and not detached:
		_destroy_head(part, &"head_destroyed")
	return out


func get_part(part_id: int) -> BodyPart:
	return _parts.get(part_id, null)


func get_parts() -> Array[BodyPart]:
	var out: Array[BodyPart] = []
	for id in BodyIds.KEYS:
		if _parts.has(id):
			out.append(_parts[id])
	return out


func get_debug_info() -> Dictionary:
	var d := {}
	for id in _parts:
		var p: BodyPart = _parts[id]
		d[BodyIds.key(id)] = {"hp": snappedf(p.hp, 0.1), "broken": p.broken, "severed": p.severed,
			"destroyed": p.destroyed, "bruise": snappedf(p.bruise, 0.01)}
	return d


# ---------------------------------------------------------------- rules

func _bullet(ev: DamageEvent, part: BodyPart, pc: Dictionary, dmg: float, detached: bool, out: Array[Wound]) -> void:
	var region := _region(ev)
	var b: Dictionary = _cfg.bleed.bullet[region]
	var sev := clampf(dmg / 60.0, 0.1, 1.0)
	var entry := _new_wound(ev, sev, float(b.get("ext", 0.0)), float(b.get("int", 0.0)), bool(b.get("art", false)))
	entry.local_direction = _local_dir(ev)
	_commit(entry, ev, detached, out)
	if ev.penetration > float(pc.get("thickness", 0.1)):
		var ex := _new_wound(ev, clampf(sev * 1.5, 0.2, 1.0), float(b.get("exit_ext", 0.0)), float(b.get("exit_int", 0.0)), false)
		ex.is_exit = true
		ex.local_direction = entry.local_direction
		ex.local_position = ev.hit_local + entry.local_direction * float(pc.get("thickness", 0.1))
		ex.local_normal = entry.local_direction
		_commit(ex, ev, detached, out)
	if detached:
		return
	match ev.part_id:
		BodyIds.Part.NECK:
			npc.cue(&"gurgle", 1.0)
		BodyIds.Part.HEAD:
			if dmg >= float(pc.get("lethal_damage", 55.0)):
				_destroy_head(part, &"headshot")
			else:
				_head_stun(ev)
		_:
			npc.cue(&"grunt", clampf(dmg / 40.0, 0.3, 1.0))


func _stab(ev: DamageEvent, part: BodyPart, pc: Dictionary, dmg: float, detached: bool, out: Array[Wound]) -> void:
	var region := _region(ev)
	var b: Dictionary = _cfg.bleed.stab[region]
	var thick := float(pc.get("thickness", 0.1))
	var depth := maxf(ev.penetration, 0.0)
	var sev := clampf(depth / maxf(thick, 0.01), 0.1, 1.0)
	var inn := float(b.get("int", 0.0))
	if b.has("organ_int") and depth >= float(_cfg.get("organ_depth", 0.07)):
		inn = float(b.organ_int) * clampf(depth / 0.12, 0.6, 1.5)
	var w := _new_wound(ev, sev, float(b.get("ext", 0.0)), inn, bool(b.get("art", false)))
	w.local_direction = _local_dir(ev)  # path of the blade (into the body)
	w.local_position = ev.hit_local
	_commit(w, ev, detached, out)
	if detached:
		return
	if ev.part_id == BodyIds.Part.NECK:
		npc.cue(&"gurgle", 1.0)
	elif ev.part_id == BodyIds.Part.HEAD:
		if dmg >= float(pc.get("lethal_damage", 55.0)):
			_destroy_head(part, &"stabbed_head")
		else:
			_head_stun(ev)
	else:
		npc.cue(&"grunt", 0.6)


func _slash(ev: DamageEvent, part: BodyPart, pc: Dictionary, dmg: float, detached: bool, out: Array[Wound]) -> void:
	# sever first: a clean cut-through replaces the surface wound
	var th := float(pc.get("dismember", 0.0))
	if not detached and ev.can_dismember and th > 0.0 and ev.amount >= th:
		out.append_array(_sever(ev, part))
		return
	var region := _region(ev)
	var b: Dictionary = _cfg.bleed.slash[region]
	var sev := clampf(dmg / 40.0, 0.1, 1.0)
	var ext := float(b.get("ext", 0.0))
	var art := bool(b.get("art", false))
	if not art:
		ext *= clampf(0.5 + sev, 0.5, 1.5)
	var w := _new_wound(ev, sev, ext, 0.0, art)
	w.local_direction = _local_dir(ev)  # slash vector along the swing
	_commit(w, ev, detached, out)
	if detached:
		return
	if ev.part_id == BodyIds.Part.NECK:
		npc.cue(&"gurgle", 1.0)
	elif ev.part_id == BodyIds.Part.HEAD:
		if dmg >= float(pc.get("lethal_damage", 55.0)):
			_destroy_head(part, &"slashed_head")
		else:
			_head_stun(ev)
	else:
		npc.cue(&"grunt", 0.6)


func _blunt(ev: DamageEvent, part: BodyPart, pc: Dictionary, dmg: float, detached: bool, out: Array[Wound]) -> void:
	var bc: Dictionary = _cfg.get("blunt", {})
	part.bruise = clampf(part.bruise + dmg * float(bc.get("bruise_per_damage", 0.02)), 0.0, 1.0)
	var w := _new_wound(ev, clampf(part.bruise, 0.05, 1.0), float(bc.get("bruise_bleed_ext", 0.05)), 0.0, false)
	w.is_bruise = true
	_commit(w, ev, detached, out)
	if detached:
		return
	match ev.part_id:
		BodyIds.Part.HEAD:
			var dur := clampf(ev.amount * float(bc.get("concussion_per_amount", 0.05)),
				float(bc.get("concussion_min", 1.0)), float(bc.get("concussion_max", 8.0)))
			if part.hp <= 0.0 or dmg >= float(pc.get("lethal_damage", 55.0)):
				_destroy_head(part, &"blunt_head")
			else:
				npc.emit_stunned(dur, &"concussion")
		BodyIds.Part.TORSO:
			if ev.amount >= float(bc.get("winded_min_amount", 10.0)):
				var dur2 := clampf(ev.amount * 0.05, float(bc.get("winded_min", 1.0)), float(bc.get("winded_max", 4.0)))
				npc.emit_stunned(dur2, &"winded")
		_:
			npc.cue(&"grunt", 0.5)


func _fracture(ev: DamageEvent, part: BodyPart, detached: bool) -> Wound:
	part.broken = true
	var w := _new_wound(ev, float(_cfg.get("fracture_severity", 0.6)), 0.0, 0.0, false)
	w.is_fracture = true
	var tmp: Array[Wound] = []
	_commit(w, ev, detached, tmp)
	if not detached:
		npc.emit_part_broken(part.part_id)
		npc.cue(&"bone_crack", 1.0)
	return w


## Cut part_id (and all descendants) off. Returns the stump wound(s) on the parent.
func _sever(ev: DamageEvent, part: BodyPart) -> Array[Wound]:
	var out: Array[Wound] = []
	var id := part.part_id
	var parent := BodyIds.parent_of(id)
	if parent < 0:
		return out
	var all: Array[int] = [id]
	all.append_array(BodyIds.descendants_of(id))
	for pid in all:
		var bp: BodyPart = _parts[pid]
		bp.severed = true
		npc.wounds.detach_part(pid)
	npc.notify_part_severed(id, ev)
	npc.cue(&"sever", 1.0)
	# stump on the parent
	var st: Dictionary = _cfg.bleed.stump
	var art: bool = BodyIds.key(id) in _cfg.get("arterial_stump_parts", [])
	var w := Wound.new()
	w.part_id = parent
	w.type = ev.type
	w.severity = 1.0
	w.is_stump = true
	w.is_arterial = art
	w.bleed_rate = float(st.arterial_ext) if art else float(st.ext)
	var pxf := npc.body.get_part_global_transform(parent)
	var ext := npc.body.get_part_half_extents(parent)
	var lp := pxf.affine_inverse() * ev.hit_position
	w.local_position = Vector3(clampf(lp.x, -ext.x, ext.x), clampf(lp.y, -ext.y, ext.y), clampf(lp.z, -ext.z, ext.z))
	w.local_normal = _local_vec(parent, -ev.direction)
	w.local_direction = _local_vec(parent, ev.direction)
	npc.wounds.add_wound(w, _parts[parent].severed)
	out.append(w)
	npc.emit_wounded(w, ev)
	if id == BodyIds.Part.NECK:
		var head: BodyPart = _parts[BodyIds.Part.HEAD]
		head.destroyed = true  # separated head: dead
		_report_lethal(&"decapitated")
	return out


# ---------------------------------------------------------------- helpers

func _destroy_head(part: BodyPart, cause: StringName) -> void:
	part.hp = 0.0
	part.destroyed = true
	npc.cue(&"scream", 0.5)
	_report_lethal(cause)


func _report_lethal(cause: StringName) -> void:
	if _lethal_reported:
		return
	_lethal_reported = true
	npc.report_lethal_injury(cause)


func _head_stun(ev: DamageEvent) -> void:
	var hc: Dictionary = _cfg.get("head", {})
	var dur := lerpf(float(hc.get("stun_min", 1.5)), float(hc.get("stun_max", 3.5)), clampf(ev.amount / 60.0, 0.0, 1.0))
	npc.emit_stunned(dur, &"head_graze")


func _pcfg(part_id: int) -> Dictionary:
	return _cfg.get("parts", {}).get(BodyIds.key(part_id), {})


func _tname(t: int) -> String:
	match t:
		DamageEvent.Type.BULLET: return "bullet"
		DamageEvent.Type.BLADE_STAB: return "stab"
		DamageEvent.Type.BLADE_SLASH: return "slash"
		DamageEvent.Type.BLUNT: return "blunt"
	return "slash"


## Bleed-table region for the hit part.
func _region(ev: DamageEvent) -> String:
	match ev.part_id:
		BodyIds.Part.HEAD: return "head"
		BodyIds.Part.NECK: return "neck"
		BodyIds.Part.TORSO: return "chest" if ev.hit_local_normalized.y > 0.0 else "abdomen"
	return "limb"


func _local_vec(part_id: int, world_dir: Vector3) -> Vector3:
	var b := npc.body.get_part_global_transform(part_id).basis.orthonormalized()
	var v := b.transposed() * world_dir
	return v.normalized() if v.length() > 0.0001 else Vector3.ZERO


func _local_dir(ev: DamageEvent) -> Vector3:
	return _local_vec(ev.part_id, ev.direction)


func _new_wound(ev: DamageEvent, sev: float, ext: float, inn: float, art: bool) -> Wound:
	var w := Wound.new()
	w.part_id = ev.part_id
	w.type = ev.type
	w.local_position = ev.hit_local
	w.local_normal = _local_vec(ev.part_id, ev.hit_normal)
	w.severity = sev
	w.bleed_rate = ext
	w.internal_bleed_rate = inn
	w.is_arterial = art
	return w


func _commit(w: Wound, ev: DamageEvent, detached: bool, out: Array[Wound]) -> void:
	npc.wounds.add_wound(w, detached)
	out.append(w)
	npc.emit_wounded(w, ev)
