## Mechanism rule: BLUNT. No penetration; bruise wound (~0 bleed). Bruise accumulation is requested via
## ctx.tags["bruise"] (new part bruise value) and applied by DamageSystem's commit.
extends InjuryRule


func apply(ctx: HitContext) -> void:
	ctx.damage = ctx.base_damage
	ctx.depth = 0.0
	ctx.force = ctx.ev.amount
	var bruise := clampf(ctx.part.bruise + ctx.damage * float(cfg.get("bruise_per_damage", 0.02)), 0.0, 1.0)
	ctx.tags["bruise"] = bruise
	var w: Wound = system.new_wound(ctx, clampf(bruise, 0.05, 1.0), float(cfg.get("bruise_bleed_ext", 0.05)), 0.0, false)
	w.is_bruise = true
	ctx.wounds.append(w)
