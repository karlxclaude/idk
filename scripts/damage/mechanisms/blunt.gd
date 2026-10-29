## Mechanism rule: BLUNT. No penetration; bruise wound (~0 bleed). Bruise accumulation is requested via
## ctx.tags["bruise"] (new part bruise value) and applied by DamageSystem's commit.
##
## ctx.force (fracture / concussion / chunk-damage measure, same units as ev.amount):
##   force = ev.amount x blend(1, momentum_factor) x area_factor
##   momentum_factor = clamp((impactor_mass x |impactor_velocity| / ref_momentum)^exponent)  (1 when mass or velocity unknown)
##   area_factor     = clamp((ref_area / ev.extra.head_area)^exponent)  (1 when head_area absent): small head = concentrated.
## The reference bat (0.9 kg at 10 m/s = 9 kg m/s, no head_area) therefore keeps force ~= ev.amount.
## Debug tags: force, momentum_factor, area_factor (for other rules / FX that want to read them).
## Data: data/injury/blunt.json.
extends InjuryRule


func _momentum_factor(ev: DamageEvent) -> float:
	var m: Dictionary = cfg.get("momentum", {})
	var speed := ev.impactor_velocity.length()
	if ev.impactor_mass <= 0.0 or speed <= 0.0:
		return 1.0
	var ratio := ev.impactor_mass * speed / maxf(float(m.get("ref_momentum", 9.0)), 0.001)
	return clampf(pow(ratio, float(m.get("exponent", 1.0))), float(m.get("min_factor", 0.25)), float(m.get("max_factor", 4.0)))


func _area_factor(ev: DamageEvent) -> float:
	var a: Dictionary = cfg.get("area", {})
	var area := float(ev.extra.get("head_area", 0.0))
	if area <= 0.0:
		return 1.0
	area = maxf(area, float(a.get("min_area_cm2", 0.5)))
	return clampf(pow(float(a.get("ref_area_cm2", 30.0)) / area, float(a.get("exponent", 0.5))),
		float(a.get("min_factor", 0.7)), float(a.get("max_factor", 2.5)))


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	var mom := _momentum_factor(ev)
	var area := _area_factor(ev)
	var w := clampf(float(cfg.get("momentum", {}).get("weight", 0.6)), 0.0, 1.0)
	ctx.force = ev.amount * lerpf(1.0, mom, w) * area
	var dw := float(cfg.get("area", {}).get("damage_weight", 0.3))
	ctx.damage = ctx.base_damage * lerpf(1.0, area, dw)
	ctx.depth = 0.0
	ctx.tags["force"] = ctx.force
	ctx.tags["momentum_factor"] = mom
	ctx.tags["area_factor"] = area
	var bruise := clampf(ctx.part.bruise + ctx.damage * float(cfg.get("bruise_per_damage", 0.02)), 0.0, 1.0)
	ctx.tags["bruise"] = bruise
	var w2: Wound = system.new_wound(ctx, clampf(bruise, float(cfg.get("bruise_min_severity", 0.05)), 1.0), float(cfg.get("bruise_bleed_ext", 0.05)), 0.0, false)
	w2.is_bruise = true
	ctx.wounds.append(w2)
