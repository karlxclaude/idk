## Shared base for arm.gd / leg.gd: bone fracture (accumulated damage or blunt force) and sever thresholds.
## Fractures and severs are requests on the context; DamageSystem commits them.
extends InjuryRule


static func is_cut(ev: DamageEvent) -> bool:
	return ev.type == DamageEvent.Type.BLADE_SLASH or ev.type == DamageEvent.Type.EXPLOSIVE


## Slash: amount >= part threshold. Any other type needs amount >= threshold x high_damage_sever_mult.
static func wants_sever(ctx: HitContext, high_mult: float) -> bool:
	var th := float(ctx.part_cfg.get("dismember", 0.0))
	if ctx.detached or not ctx.ev.can_dismember or th <= 0.0:
		return false
	return ctx.ev.amount >= (th if is_cut(ctx.ev) else th * high_mult)


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	var cut_through := false
	if wants_sever(ctx, float(cfg.get("high_damage_sever_mult", 2.0))):
		ctx.sever = true
		ctx.cues.append(&"sever")
		if is_cut(ev):
			cut_through = true
			ctx.wounds.clear()  # a clean cut-through replaces the surface wound
	var fa := float(ctx.part_cfg.get("fracture_accum", 0.0))
	if fa > 0.0 and not ctx.part.broken and not ctx.detached and not cut_through:
		var accum := ctx.part.max_hp - maxf(0.0, ctx.part.hp - ctx.damage)
		var force_hit: bool = ev.type == DamageEvent.Type.BLUNT and ctx.force >= float(ctx.part_cfg.get("fracture_force", 1e9))
		if accum >= fa or force_hit:
			ctx.fracture = true
			ctx.cues.append(&"bone_crack")
	# Optional per-part row value: scale the mechanism's wound bleed (hands, feet). Absent => unchanged.
	var bm := float(ctx.part_cfg.get("bleed_mult", 1.0))
	if bm != 1.0:
		for w in ctx.wounds:
			w.bleed_rate *= bm
			w.internal_bleed_rate *= bm
