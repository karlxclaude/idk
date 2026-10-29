## Mechanism rule: BLADE_SLASH (also EXPLOSIVE for now). Surface wound with local_direction along the
## swing; external bleed scaled by severity. Severing is decided by the region rules.
extends InjuryRule


func apply(ctx: HitContext) -> void:
	var b: Dictionary = cfg.bleed.slash[cfg.table_key[String(ctx.region)]]
	ctx.damage = ctx.base_damage
	var sev := clampf(ctx.damage / 40.0, 0.1, 1.0)
	var base_ext := float(b.get("ext", 0.0))
	var w: Wound = system.new_wound(ctx, sev, base_ext * clampf(0.5 + sev, 0.5, 1.5), 0.0, false)
	w.local_direction = system.local_dir(ctx)  # slash vector along the swing
	ctx.wounds.append(w)
	ctx.tags["base_ext"] = base_ext  # unscaled rate, for rules that make the wound arterial
