## Mechanism rule: BLADE_STAB. One narrow wound, depth = ev.penetration, low external bleed.
## Bleed (ext/int) scales with hit strength: ev.amount against the normal thrust (penetrating.json stab.strength).
## Organ hits (internal bleed) are decided by the torso region rule.
## TODO(roadmap: stuck blades) a deep stab could request a stuck blade here (weapon + DamageSystem commit).
extends InjuryRule


func apply(ctx: HitContext) -> void:
	var ev := ctx.ev
	var sc: Dictionary = cfg.stab
	var b: Dictionary = cfg.bleed.stab[cfg.table_key[String(ctx.region)]]
	var thick := float(ctx.part_cfg.get("thickness", 0.1))
	ctx.damage = ctx.base_damage
	ctx.depth = maxf(ev.penetration, 0.0)
	var st: Dictionary = sc.strength
	var s := clampf(ev.amount / maxf(float(st.ref_amount), 0.001), float(st.min), float(st.max))
	var k := pow(s, float(st.bleed_exp))
	ctx.tags["stab_strength"] = s
	var sev := clampf(ctx.depth / maxf(thick, 0.01), float(sc.sev_min), float(sc.sev_max))
	var w: Wound = system.new_wound(ctx, sev, float(b.get("ext", 0.0)) * k, float(b.get("int", 0.0)) * k, false)
	w.local_direction = system.local_dir(ctx)  # path of the blade (into the body)
	w.local_position = ev.hit_local
	ctx.wounds.append(w)
