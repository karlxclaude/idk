## Region rule: NECK. Owns the arterial flag (primary wound, not the exit wound) and neck severing
## (decapitation). Data: data/injury/head_neck.json (parts.neck, neck).
extends InjuryRule

const LimbBase := preload("limb_base.gd")


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	if system.type_name(ev.type) in cfg.neck.arterial_types:
		for w in ctx.wounds:
			if not w.is_exit:
				w.is_arterial = true
				if ctx.tags.has("base_ext"):
					w.bleed_rate = float(ctx.tags.base_ext)  # arterial flow is not severity-scaled
	if LimbBase.wants_sever(ctx, float(cfg.high_damage_sever_mult)):
		ctx.sever = true
		ctx.cues.append(&"sever")
		ctx.lethal_cause = StringName(cfg.neck.decapitated_cause)
		if LimbBase.is_cut(ev):
			ctx.wounds.clear()
