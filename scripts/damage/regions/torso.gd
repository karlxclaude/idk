## Region rule: TORSO (chest and abdomen share this rule). Owns organ hits (stab deep enough => heavy
## internal bleed, per-zone rate) and the blunt "winded" stun. Data: data/injury/torso.json.
extends InjuryRule


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	if ev.type == DamageEvent.Type.BLADE_STAB and ctx.depth >= float(cfg.organ_depth) and not ctx.wounds.is_empty():
		var organ := float(cfg.organ_int[String(ctx.region)])
		ctx.wounds[0].internal_bleed_rate = organ * clampf(ctx.depth / float(cfg.organ_scale_depth), 0.6, 1.5)
		ctx.tags["organ_hit"] = true
	if ev.type == DamageEvent.Type.BLUNT and not ctx.detached and ev.amount >= float(cfg.winded.min_amount):
		ctx.stun_duration = clampf(ev.amount * float(cfg.winded.per_amount), float(cfg.winded.min), float(cfg.winded.max))
		ctx.stun_cause = &"winded"
