## Mechanism rule: BULLET. Entry wound, optional exit wound (penetration > part thickness).
## Base bleed from data/injury/penetrating.json (type x region). Region rules refine (arterial, organs, lethal).
extends InjuryRule


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	var b: Dictionary = cfg.bleed.bullet[cfg.table_key[String(ctx.region)]]
	var thick := float(ctx.part_cfg.get("thickness", 0.1))
	ctx.damage = ctx.base_damage
	ctx.depth = ev.penetration
	var sev := clampf(ctx.damage / 60.0, 0.1, 1.0)
	var entry: Wound = system.new_wound(ctx, sev, float(b.get("ext", 0.0)), float(b.get("int", 0.0)), false)
	entry.local_direction = system.local_dir(ctx)
	ctx.wounds.append(entry)
	if ev.penetration > thick:
		ctx.passes_through = true
		var ex: Wound = system.new_wound(ctx, clampf(sev * 1.5, 0.2, 1.0), float(b.get("exit_ext", 0.0)), float(b.get("exit_int", 0.0)), false)
		ex.is_exit = true
		ex.local_direction = entry.local_direction
		ex.local_position = ev.hit_local + entry.local_direction * thick
		ex.local_normal = entry.local_direction
		ctx.wounds.append(ex)
