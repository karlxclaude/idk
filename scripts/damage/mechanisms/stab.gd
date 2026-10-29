## Mechanism rule: BLADE_STAB. One narrow wound, depth = ev.penetration, low external bleed.
## Organ hits (internal bleed) are decided by the torso region rule.
extends InjuryRule


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	var b: Dictionary = cfg.bleed.stab[cfg.table_key[String(ctx.region)]]
	var thick := float(ctx.part_cfg.get("thickness", 0.1))
	ctx.damage = ctx.base_damage
	ctx.depth = maxf(ev.penetration, 0.0)
	var sev := clampf(ctx.depth / maxf(thick, 0.01), 0.1, 1.0)
	var w: Wound = system.new_wound(ctx, sev, float(b.get("ext", 0.0)), float(b.get("int", 0.0)), false)
	w.local_direction = system.local_dir(ctx)  # path of the blade (into the body)
	w.local_position = ev.hit_local
	ctx.wounds.append(w)
