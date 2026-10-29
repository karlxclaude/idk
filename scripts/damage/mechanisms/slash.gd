## Mechanism rule: BLADE_SLASH (also EXPLOSIVE for now). Surface wound with local_direction along the
## swing; external bleed scaled by severity. Severing is decided by the region rules.
## Tunables: data/injury/penetrating.json "slash".
extends InjuryRule


func apply(ctx: HitContext) -> void:
	var sc: Dictionary = cfg.slash
	var b: Dictionary = cfg.bleed.slash[cfg.table_key[String(ctx.region)]]
	ctx.damage = ctx.base_damage
	var sev := clampf(ctx.damage / float(sc.sev_div), float(sc.sev_min), float(sc.sev_max))
	var base_ext := float(b.get("ext", 0.0))
	var scale := clampf(float(sc.bleed_sev_base) + sev, float(sc.bleed_scale_min), float(sc.bleed_scale_max))
	var w: Wound = system.new_wound(ctx, sev, base_ext * scale, 0.0, false)
	w.local_direction = system.local_dir(ctx)  # slash vector along the swing
	ctx.wounds.append(w)
	ctx.tags["base_ext"] = base_ext  # unscaled rate, for rules that make the wound arterial
