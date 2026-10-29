## Region rule: HEAD. Owns the head-lethal threshold, graze stun, concussion, accumulated-skull death and
## (milestone 5) chunk damage: the hit lands in one of jaw/face/cranium/occiput (ctx.chunk, BodyIds.head_chunk_from_local),
## damages that chunk's hp and may destroy it (plus a neighbour for high-energy bullets). The rule only fills the context.
## Data: data/injury/head_neck.json (parts.head, head, chunks, chunk_rules).
## TODO(roadmap: head chunks) per-chunk sub-rules beyond hp/lethal flags (e.g. eye/teeth loss) plug in at _chunk_hit.
extends InjuryRule

const HEAD := BodyIds.Part.HEAD


func apply(ctx: HitContext) -> void:
	if ctx.detached:
		return
	var ev := ctx.ev
	var h: Dictionary = cfg.head
	var chunk := ctx.chunk if ctx.chunk >= 0 else BodyIds.head_chunk_from_local(ev.hit_local_normalized)
	var row := _row(chunk)
	var type_key: String = system.type_name(ev.type)
	var cause := StringName(h.lethal_causes[type_key])
	var blunt := ev.type == DamageEvent.Type.BLUNT
	# --- old-style whole-head rule (a hard enough hit kills outright; the jaw is exempt: nothing vital there)
	var lethal_th := float(row.get("lethal_damage", ctx.part_cfg.get("lethal_damage", 55.0)))
	var lethal := lethal_th > 0.0 and ctx.damage >= lethal_th
	# --- chunk hit
	var destroyed_now: Array[int] = _chunk_hit(ctx, chunk, row, type_key, lethal)
	# the share of damage that also counts against the overall head hp (a jaw hit barely hurts the brain)
	var raw_damage := ctx.damage
	ctx.damage = raw_damage * float(row.get("hp_share", 1.0))
	var post_hp := maxf(0.0, ctx.part.hp - ctx.damage)
	var chunk_cause := _chunk_lethal_cause(destroyed_now)
	var chunk_first := bool(cfg.chunk_rules.get("chunk_cause_priority", false))
	if blunt:
		if post_hp <= 0.0 or lethal or chunk_cause != &"":
			ctx.destroy = true
			ctx.lethal_cause = chunk_cause if chunk_cause != &"" and (chunk_first or not lethal) else cause
		else:
			var c: Dictionary = h.concussion
			ctx.stun_duration = clampf(_blunt_force(ctx) * float(c.per_amount), float(c.min), float(c.max))
			ctx.stun_cause = &"concussion"
	else:
		if lethal or chunk_cause != &"":
			ctx.destroy = true
			ctx.lethal_cause = chunk_cause if chunk_cause != &"" and (chunk_first or not lethal) else cause
		else:
			ctx.stun_duration = lerpf(float(h.stun_min), float(h.stun_max), clampf(ev.amount / float(h.stun_amount_ref), 0.0, 1.0))
			ctx.stun_cause = &"head_graze"
	# accumulated damage destroyed the skull
	if not ctx.destroy and post_hp <= 0.0 and not ctx.part.destroyed:
		ctx.destroy = true
		ctx.lethal_cause = StringName(h.destroyed_cause)
	# a destroyed jaw/face (not lethal) knocks the victim down for longer than any graze
	if not ctx.destroy:
		for c in destroyed_now:
			var r := _row(c)
			if float(r.get("stun", 0.0)) > 0.0:
				ctx.stun_duration = maxf(ctx.stun_duration, float(r.stun))
				ctx.stun_cause = StringName(r.get("stun_cause", "head_graze"))


## Damage the hit chunk, scale entry-wound bleed by chunk, decide which chunks are destroyed (hit chunk, plus the
## neighbour behind it for high-energy bullets). Fills ctx.chunk_damage, ctx.destroy_chunks, destruction wounds.
func _chunk_hit(ctx: HitContext, chunk: int, row: Dictionary, type_key: String, lethal: bool) -> Array[int]:
	var cr: Dictionary = cfg.chunk_rules
	var out: Array[int] = []
	var bm := float(row.get("bleed_mult", 1.0))
	if bm != 1.0:
		for w in ctx.wounds:
			w.bleed_rate *= bm
	var part := ctx.part
	if chunk in part.chunks_destroyed or float(part.chunk_hp.get(chunk, 1.0)) <= 0.0:
		return out  # shot through the hole where the chunk was: only the overall head hp takes it
	var cdmg := ctx.damage * float(cr.type_chunk_mult.get(type_key, 1.0))
	if ctx.ev.type == DamageEvent.Type.BLUNT:
		# concentrated force (momentum x contact area, blunt mechanism) cracks chunks: same scale as ctx.damage for a reference bat
		var per_amount := ctx.base_damage / ctx.ev.amount if ctx.ev.amount > 0.0 else 1.0
		cdmg = _blunt_force(ctx) * per_amount * float(cr.type_chunk_mult.get(type_key, 1.0))
	ctx.chunk_damage = cdmg
	var remaining := float(part.chunk_hp.get(chunk, part.max_hp))
	# a killing non-blunt hit through a vital chunk takes the chunk with it (bullets already do via hp)
	var kill_through := lethal and ctx.ev.type != DamageEvent.Type.BLUNT and float(row.get("lethal_damage", 0.0)) > 0.0
	if cdmg >= remaining or kill_through:
		out.append(chunk)
		_destroy_wound(ctx, chunk, false)
		# high-energy bullets carry on into the neighbour behind
		var ev := ctx.ev
		var energy: float = float(ev.extra["energy"]) * float(cr.energy_scale) if ev.extra.has("energy") else ev.amount
		if type_key in cr.spill_types and energy >= float(cr.spill_energy):
			var nb: int = _chunk_by_key(String(cr.spill_to.get(BodyIds.head_chunk_key(chunk), "")))
			if nb >= 0 and nb != chunk and not nb in part.chunks_destroyed and not nb in out:
				out.append(nb)
				_destroy_wound(ctx, nb, true)
	for c in out:
		ctx.destroy_chunks.append(c)
	return out


## Blunt force measure from the mechanism (ctx.force, ev.amount units); amount if the mechanism left it unset.
func _blunt_force(ctx: HitContext) -> float:
	return ctx.force if ctx.force > 0.0 else ctx.ev.amount


## Lethal cause when a destroyed chunk is flagged lethal_on_destroy (skull vault), else empty.
func _chunk_lethal_cause(destroyed: Array[int]) -> StringName:
	for c in destroyed:
		if bool(_row(c).get("lethal_on_destroy", false)):
			return StringName(cfg.chunk_rules.skull_cause)
	return &""


## The ragged wound a destroyed chunk leaves on the head (bleed from the chunk row). Spilled chunks are
## placed at the chunk's centre instead of the hit point.
func _destroy_wound(ctx: HitContext, chunk: int, spilled: bool) -> void:
	var row := _row(chunk)
	var w: Wound = system.new_wound(ctx, float(row.get("wound_severity", 0.9)), float(row.get("bleed", 10.0)), 0.0, false)
	w.local_direction = system.local_dir(ctx)
	if spilled:
		var c: Array = row.get("center", [0, 0, 0])
		var half: Vector3 = ctx.npc.body.get_part_half_extents(HEAD)
		w.local_position = Vector3(float(c[0]), float(c[1]), float(c[2])) * half
	ctx.wounds.append(w)


func _row(chunk: int) -> Dictionary:
	return cfg.chunks.get(BodyIds.head_chunk_key(chunk), {})


func _chunk_by_key(key: String) -> int:
	for c in BodyIds.HEAD_CHUNK_KEYS:
		if BodyIds.HEAD_CHUNK_KEYS[c] == key:
			return c
	return -1
