## Region rule: HEAD. Owns the head-lethal threshold, graze stun, concussion, accumulated-skull death.
## Data: data/injury/head_neck.json (parts.head, head).
## TODO(roadmap: head chunks) replace with jaw/face/cranium sub-rules.
extends InjuryRule


func apply(ctx: HitContext) -> void:
	if ctx.detached:
		return
	var ev := ctx.ev
	var h: Dictionary = cfg.head
	var post_hp := maxf(0.0, ctx.part.hp - ctx.damage)
	var lethal := ctx.damage >= float(ctx.part_cfg.get("lethal_damage", 55.0))
	var cause := StringName(h.lethal_causes[system.type_name(ev.type)])
	if ev.type == DamageEvent.Type.BLUNT:
		if post_hp <= 0.0 or lethal:
			ctx.destroy = true
			ctx.lethal_cause = cause
		else:
			var c: Dictionary = h.concussion
			ctx.stun_duration = clampf(ev.amount * float(c.per_amount), float(c.min), float(c.max))
			ctx.stun_cause = &"concussion"
	else:
		if lethal:
			ctx.destroy = true
			ctx.lethal_cause = cause
		else:
			ctx.stun_duration = lerpf(float(h.stun_min), float(h.stun_max), clampf(ev.amount / float(h.stun_amount_ref), 0.0, 1.0))
			ctx.stun_cause = &"head_graze"
	# accumulated damage destroyed the skull
	if not ctx.destroy and post_hp <= 0.0 and not ctx.part.destroyed:
		ctx.destroy = true
		ctx.lethal_cause = StringName(h.destroyed_cause)
