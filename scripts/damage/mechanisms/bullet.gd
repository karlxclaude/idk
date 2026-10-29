## Mechanism rule: BULLET. Entry wound, optional exit wound (ev.penetration > part thickness; the weapon
## decides penetration, including a rifle's continued penetration across parts, we never recompute it).
## Base bleed from data/injury/penetrating.json (type x region). Region rules refine (arterial, organs, lethal).
## Hit strength s scales severity, bleed and exit size: ev.extra.energy (J) when present, else impactor
## speed against the caliber's reference values; caliber profiles (9mm, rifle, buckshot) in the same file.
## Absent energy and speed => s = 1, so plain events behave as the full-power reference round.
extends InjuryRule


## Caliber profile for the event: ev.extra.caliber (+ aliases), pellets default to buckshot.
func profile_of(ev: DamageEvent) -> Dictionary:
	var bc: Dictionary = cfg.bullet
	var cals: Dictionary = bc.calibers
	var key := String(ev.extra.get("caliber", "")).to_lower()
	key = String(bc.aliases.get(key, key))
	if not cals.has(key):
		var p = ev.extra.get("pellet", false)
		var is_pellet: bool = p != null and not (p is bool and not p)
		key = "buckshot" if is_pellet else String(bc.default_caliber)
	return cals[key]


## Hit strength: 1.0 = the caliber's reference energy. Monotonic in energy (and in speed).
func strength_of(ev: DamageEvent, prof: Dictionary) -> float:
	var st: Dictionary = cfg.bullet.strength
	var ratio := 1.0
	if ev.extra.has("energy"):
		ratio = maxf(float(ev.extra.energy), 0.0) / maxf(float(prof.ref_energy_j), 1.0)
	else:
		var v := ev.impactor_velocity.length()
		if v >= float(st.fallback_min_speed):
			var r := v / maxf(float(prof.ref_velocity), 1.0)
			ratio = r * r
	return clampf(pow(ratio, float(st.energy_exp)), float(st.min), float(st.max))


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	var bc: Dictionary = cfg.bullet
	var b: Dictionary = cfg.bleed.bullet[cfg.table_key[String(ctx.region)]]
	var thick := float(ctx.part_cfg.get("thickness", 0.1))
	var prof := profile_of(ev)
	var s := strength_of(ev, prof)
	var s_bleed := pow(s, float(bc.strength.bleed_exp))
	var s_sev := pow(s, float(bc.strength.sev_exp))
	var ext_k := s_bleed * float(prof.bleed_mult)
	var int_k := s_bleed * float(prof.int_mult)
	ctx.damage = ctx.base_damage
	ctx.depth = ev.penetration
	ctx.tags["bullet_strength"] = s
	var sev := clampf(ctx.damage / float(bc.sev_div) * float(prof.sev_mult) * s_sev,
		float(prof.get("sev_min", bc.sev_min)) * s_sev, float(bc.sev_max))
	var entry: Wound = system.new_wound(ctx, sev, float(b.get("ext", 0.0)) * ext_k, float(b.get("int", 0.0)) * int_k, false)
	entry.local_direction = system.local_dir(ctx)
	ctx.wounds.append(entry)
	if ev.penetration > thick:
		ctx.passes_through = true
		var xc: Dictionary = bc.exit
		var xs := clampf(sev * float(xc.sev_mult) * float(prof.exit_size_mult),
			float(prof.get("exit_sev_min", xc.sev_min)) * s_sev, float(xc.sev_max))
		var xk := s_bleed * float(prof.exit_bleed_mult)
		var ex: Wound = system.new_wound(ctx, xs, float(b.get("exit_ext", 0.0)) * xk, float(b.get("exit_int", 0.0)) * xk, false)
		ex.is_exit = true
		ex.local_direction = entry.local_direction
		ex.local_position = ev.hit_local + entry.local_direction * thick
		ex.local_normal = entry.local_direction
		ctx.wounds.append(ex)
