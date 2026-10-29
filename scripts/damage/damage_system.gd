## OWNER: damage-wounds-bleed-agent. Injury pipeline (docs/CONTRACTS.md "Injury pipeline"):
## build HitContext -> mechanism rule (by ev.type) -> region rule (by ctx.region) -> commit.
## The commit is the ONLY place that mutates BodyPart, calls WoundSystem and emits via Npc helpers.
## Tunables: data/injury/*.json (each rule reads only its own file; core.json is the commit's).
## TODO(roadmap: weapons) EXPLOSIVE is reserved (currently uses the slash mechanism).
## TODO(roadmap: stuck blades) hook in the stab mechanism / commit.
class_name DamageSystem
extends Node

const BulletRule := preload("mechanisms/bullet.gd")
const StabRule := preload("mechanisms/stab.gd")
const SlashRule := preload("mechanisms/slash.gd")
const BluntRule := preload("mechanisms/blunt.gd")
const HeadRule := preload("regions/head.gd")
const NeckRule := preload("regions/neck.gd")
const TorsoRule := preload("regions/torso.gd")
const ArmRule := preload("regions/arm.gd")
const LegRule := preload("regions/leg.gd")

var npc: Npc
var _core: Dictionary
var _parts: Dictionary = {}      # part id -> BodyPart
var _rows: Dictionary = {}       # part id -> part data row (from its region file)
var _mech: Dictionary = {}       # DamageEvent.Type -> InjuryRule
var _regions: Dictionary = {}    # region StringName -> InjuryRule
var _lethal_reported := false
var _dropped_severs := 0  # sever requests dropped by the gate (settings / immortal), for debug


func setup(owner_npc: Npc) -> void:
	npc = owner_npc
	_core = DataDB.table("injury/core")
	var pen := DataDB.table("injury/penetrating")
	var slash := _rule(SlashRule, pen)
	_mech = {
		DamageEvent.Type.BULLET: _rule(BulletRule, pen),
		DamageEvent.Type.BLADE_STAB: _rule(StabRule, pen),
		DamageEvent.Type.BLADE_SLASH: slash,
		DamageEvent.Type.BLUNT: _rule(BluntRule, DataDB.table("injury/blunt")),
		DamageEvent.Type.EXPLOSIVE: slash,  # reserved: treated as a generic cut
	}
	var hn := DataDB.table("injury/head_neck")
	var torso := DataDB.table("injury/torso")
	var arms := DataDB.table("injury/arms")
	var legs := DataDB.table("injury/legs")
	var torso_rule := _rule(TorsoRule, torso)
	_regions = {
		HitContext.REGION_HEAD: _rule(HeadRule, hn),
		HitContext.REGION_NECK: _rule(NeckRule, hn),
		HitContext.REGION_CHEST: torso_rule,
		HitContext.REGION_ABDOMEN: torso_rule,
		HitContext.REGION_ARM: _rule(ArmRule, arms),
		HitContext.REGION_LEG: _rule(LegRule, legs),
	}
	for table in [hn, torso, arms, legs]:
		for k in table.get("parts", {}):
			var id := BodyIds.from_key(k)
			if id < 0:
				continue
			var pc: Dictionary = table.parts[k]
			_rows[id] = pc
			var bp := BodyPart.new()
			bp.part_id = id
			bp.tissue = BodyIds.Tissue.BONE if pc.get("tissue", "flesh") == "bone" else BodyIds.Tissue.FLESH
			bp.max_hp = float(pc.get("max_hp", 100.0))
			bp.hp = bp.max_hp
			if id == BodyIds.Part.HEAD:
				var chunks: Dictionary = table.get("chunks", {})
				for c in BodyIds.HEAD_CHUNK_KEYS:
					var row = chunks.get(BodyIds.HEAD_CHUNK_KEYS[c], bp.max_hp)
					bp.chunk_hp[c] = float(row.get("hp", bp.max_hp)) if row is Dictionary else float(row)
			_parts[id] = bp


func _rule(script: GDScript, table: Dictionary) -> InjuryRule:
	var r: InjuryRule = script.new()
	r.setup(table, self)
	return r


## Apply one DamageEvent (already localized by Npc.apply_damage). Returns wounds created.
func apply(ev: DamageEvent) -> Array[Wound]:
	if not _parts.has(ev.part_id):
		return []
	var ctx := HitContext.new()
	ctx.npc = npc
	ctx.ev = ev
	ctx.part = _parts[ev.part_id]
	ctx.part_cfg = _rows[ev.part_id]
	ctx.region = region_of(ev)
	ctx.detached = ctx.part.severed
	if ev.part_id == BodyIds.Part.HEAD:
		ctx.chunk = BodyIds.head_chunk_from_local(ev.hit_local_normalized)
	ctx.base_damage = ev.amount * float(ctx.part_cfg.get("dmg_mult", 1.0)) \
		* float(_core.get("type_mult", {}).get(type_name(ev.type), 1.0))
	_mech.get(ev.type, _mech[DamageEvent.Type.BLADE_SLASH]).apply(ctx)
	_regions[ctx.region].apply(ctx)
	return _commit(ctx)


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
	var hp: BodyPart = _parts.get(BodyIds.Part.HEAD)
	if hp:
		var ch := {}
		for c in hp.chunk_hp:
			ch[BodyIds.head_chunk_key(c)] = snappedf(float(hp.chunk_hp[c]), 0.1)
		d["head"]["chunk_hp"] = ch
		d["head"]["chunks_destroyed"] = hp.chunks_destroyed.map(func(c): return BodyIds.head_chunk_key(c))
	d["sever_dropped"] = _dropped_severs
	return d


# ---------------------------------------------------------------- shared helpers for rules

func type_name(t: int) -> String:
	match t:
		DamageEvent.Type.BULLET: return "bullet"
		DamageEvent.Type.BLADE_STAB: return "stab"
		DamageEvent.Type.BLADE_SLASH: return "slash"
		DamageEvent.Type.BLUNT: return "blunt"
	return "slash"


func region_of(ev: DamageEvent) -> StringName:
	match ev.part_id:
		BodyIds.Part.HEAD: return HitContext.REGION_HEAD
		BodyIds.Part.NECK: return HitContext.REGION_NECK
		BodyIds.Part.TORSO:
			return HitContext.REGION_CHEST if ev.hit_local_normalized.y > 0.0 else HitContext.REGION_ABDOMEN
	return HitContext.REGION_ARM if BodyIds.is_arm(ev.part_id) else HitContext.REGION_LEG


## World-space vector -> part-local direction (zero if degenerate).
func local_vec(part_id: int, world_dir: Vector3) -> Vector3:
	var b := npc.body.get_part_global_transform(part_id).basis.orthonormalized()
	var v := b.transposed() * world_dir
	return v.normalized() if v.length() > 0.0001 else Vector3.ZERO


## Direction of the hit (ev.direction) in the hit part's local space.
func local_dir(ctx: HitContext) -> Vector3:
	return local_vec(ctx.ev.part_id, ctx.ev.direction)


## New wound on ctx's part at the hit point (part space). Not stored until the commit.
func new_wound(ctx: HitContext, sev: float, ext: float, inn: float, art: bool) -> Wound:
	var w := Wound.new()
	w.part_id = ctx.ev.part_id
	w.type = ctx.ev.type
	w.local_position = ctx.ev.hit_local
	w.local_normal = local_vec(ctx.ev.part_id, ctx.ev.hit_normal)
	w.severity = sev
	w.bleed_rate = ext
	w.internal_bleed_rate = inn
	w.is_arterial = art
	return w


# ---------------------------------------------------------------- commit (only mutator)

## Settings / immortal gates, applied to the region rule's requests before they are committed.
func _apply_gates(ctx: HitContext) -> void:
	var id := ctx.part.part_id
	var lethal_suppressed: bool = npc.immortal and (ctx.lethal_cause != &"" or ctx.destroy)
	var drop := false
	if ctx.sever:
		if not GameSettings.dismemberment_allowed():
			drop = true
		elif npc.immortal and (id == BodyIds.Part.NECK or id == BodyIds.Part.HEAD):
			drop = true
	if drop:
		ctx.sever = false
		ctx.tags["sever_dropped"] = true
		_dropped_severs += 1
		if id == BodyIds.Part.NECK:
			ctx.lethal_cause = &""  # decapitation did not happen
			lethal_suppressed = npc.immortal
		ctx.cues.erase(&"sever")
		if ctx.wounds.is_empty():
			# the region rule replaced the surface wound by the cut-through: keep it as a deep cut,
			# never weaker than the wound a non-severing slash of the same strength would make
			var d: Dictionary = _core.get("dropped_sever_wound", {})
			var art: bool = BodyIds.key(id) in _core.get("arterial_stump_parts", [])
			var w := new_wound(ctx, float(d.get("severity", 0.8)), float(d.get("arterial_ext", 180.0)) if art else float(d.get("ext", 25.0)), 0.0, art)
			w.local_direction = local_dir(ctx)
			var shadow := _shadow_cut(ctx)
			for sw in shadow.wounds:
				if sw.is_exit:
					continue
				w.bleed_rate = maxf(w.bleed_rate, sw.bleed_rate)
				w.internal_bleed_rate = maxf(w.internal_bleed_rate, sw.internal_bleed_rate)
				w.severity = maxf(w.severity, sw.severity)
				w.is_arterial = w.is_arterial or sw.is_arterial
				break
			ctx.wounds.append(w)
			# a cut that would have severed a bone part at least breaks it
			if ctx.part.tissue == BodyIds.Tissue.BONE and not ctx.part.broken and not ctx.part.severed:
				ctx.fracture = true
				if not ctx.cues.has(&"bone_crack"):
					ctx.cues.append(&"bone_crack")
	if npc.immortal:
		# chunks may break visually, but the skull vault (cranium/occiput) always survives
		ctx.destroy_chunks = ctx.destroy_chunks.filter(func(c): return c != BodyIds.HeadChunk.CRANIUM and c != BodyIds.HeadChunk.OCCIPUT)
		if lethal_suppressed:
			# the blow that would have killed knocks the dummy down instead
			var knock := float(_core.get("immortal_lethal_knockdown", 3.0))
			if ctx.stun_duration < knock:
				ctx.stun_duration = knock
				ctx.stun_cause = &"concussion"
		ctx.lethal_cause = &""
		ctx.destroy = false


## Head chunk damage and destruction (HEAD only, head not already severed/destroyed before this hit).
func _commit_chunks(ctx: HitContext) -> void:
	var part := ctx.part
	if ctx.chunk >= 0 and ctx.chunk_damage > 0.0:
		part.chunk_hp[ctx.chunk] = maxf(0.0, float(part.chunk_hp.get(ctx.chunk, part.max_hp)) - ctx.chunk_damage)
	if npc.immortal:
		for c in [BodyIds.HeadChunk.CRANIUM, BodyIds.HeadChunk.OCCIPUT]:
			part.chunk_hp[c] = maxf(float(part.chunk_hp.get(c, 1.0)), 1.0)
	for c in ctx.destroy_chunks:
		if c in part.chunks_destroyed:
			continue
		part.chunks_destroyed.append(c)
		part.chunk_hp[c] = 0.0 if not (npc.immortal and c in [BodyIds.HeadChunk.CRANIUM, BodyIds.HeadChunk.OCCIPUT]) else 1.0
		npc.notify_head_chunk_destroyed(c, ctx.ev)
		npc.cue(&"skull_crack", 1.0)


## Rule pipeline re-run on a scratch context with severing off (what a non-severing cut would produce).
func _shadow_cut(ctx: HitContext) -> HitContext:
	var ev := ctx.ev
	var sc := HitContext.new()
	sc.npc = npc
	sc.ev = ev
	sc.part = ctx.part
	sc.part_cfg = ctx.part_cfg
	sc.region = ctx.region
	sc.detached = ctx.detached
	sc.base_damage = ctx.base_damage
	var had := ev.can_dismember
	ev.can_dismember = false
	_mech.get(ev.type, _mech[DamageEvent.Type.BLADE_SLASH]).apply(sc)
	_regions[sc.region].apply(sc)
	ev.can_dismember = had
	return sc

func _commit(ctx: HitContext) -> Array[Wound]:
	var out: Array[Wound] = []
	var ev := ctx.ev
	var part := ctx.part
	_apply_gates(ctx)
	var chunks_live := part.part_id == BodyIds.Part.HEAD and not part.severed and not part.destroyed
	part.hit_count += 1
	part.hp = maxf(0.0, part.hp - ctx.damage)
	if npc.immortal and part.part_id == BodyIds.Part.HEAD:
		part.hp = maxf(part.hp, 1.0)
	if ctx.tags.has("bruise"):
		part.bruise = float(ctx.tags.bruise)
	for w in ctx.wounds:
		npc.wounds.add_wound(w, ctx.detached)
		out.append(w)
		npc.emit_wounded(w, ev)
	if chunks_live:
		_commit_chunks(ctx)
	if ctx.stun_duration > 0.0:
		npc.emit_stunned(ctx.stun_duration, ctx.stun_cause)
	if ctx.destroy:
		part.hp = 0.0
		part.destroyed = true
	if ctx.lethal_cause != &"":
		_report_lethal(ctx.lethal_cause)
	if ctx.fracture and not part.broken and not part.severed:
		part.broken = true
		var fw := new_wound(ctx, float(_core.get("fracture_severity", 0.6)), 0.0, 0.0, false)
		fw.is_fracture = true
		npc.wounds.add_wound(fw, false)
		out.append(fw)
		npc.emit_wounded(fw, ev)
		npc.emit_part_broken(part.part_id)
	if ctx.sever and not part.severed:
		var stump := _sever(ev, part)
		if stump:
			out.append(stump)
	for c in ctx.cues:
		npc.cue(c, 1.0)
	return out


## Cut part (and all descendants) off; returns the stump wound on the parent (null for the root).
func _sever(ev: DamageEvent, part: BodyPart) -> Wound:
	var id := part.part_id
	var parent := BodyIds.parent_of(id)
	if parent < 0:
		return null
	var all: Array[int] = [id]
	all.append_array(BodyIds.descendants_of(id))
	for pid in all:
		var bp: BodyPart = _parts[pid]
		bp.severed = true
		if pid == BodyIds.Part.HEAD:
			bp.destroyed = true  # a separated head is a dead head
		npc.wounds.detach_part(pid)
	npc.notify_part_severed(id, ev)
	var st: Dictionary = _core.stump
	var art: bool = BodyIds.key(id) in _core.get("arterial_stump_parts", [])
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
	w.local_normal = local_vec(parent, -ev.direction)
	w.local_direction = local_vec(parent, ev.direction)
	npc.wounds.add_wound(w, _parts[parent].severed)
	npc.emit_wounded(w, ev)
	return w


func _report_lethal(cause: StringName) -> void:
	if _lethal_reported:
		return
	_lethal_reported = true
	npc.report_lethal_injury(cause)
