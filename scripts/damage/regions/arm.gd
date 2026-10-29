## Region rule: ARM (upper/lower arm + hands). Thresholds (fracture_accum/force, dismember) live in
## data/injury/arms.json part rows; logic is shared in limb_base.gd.
## Hands (rows with "pain"/"bleed_mult"): thin bone, low HP, low sever threshold. They hurt a lot (dmg_mult,
## ctx.tags.pain) but bleed modestly (bleed_mult scales the mechanism's wounds). A hand fracture or sever only
## emits facts (part_broken / part_severed + ctx.tags.drop_item); the ai-agent decides to drop the held item.
## TODO(roadmap: hands) finger-level injuries.
extends "limb_base.gd"


func apply(ctx: HitContext) -> void:
	super.apply(ctx)
	if not BodyIds.is_hand(ctx.ev.part_id):
		return
	var cfgp := ctx.part_cfg
	var bm := float(cfgp.get("bleed_mult", 1.0))
	for w in ctx.wounds:
		w.bleed_rate *= bm
		w.internal_bleed_rate *= bm
	ctx.tags["pain"] = float(cfgp.get("pain", 1.0))
	if ctx.sever or ctx.fracture:
		ctx.tags["drop_item"] = true  # fact for the ai-agent: this hand can no longer hold anything
		var stun := float(cfgp.get("break_stun", 0.0))
		if stun > 0.0:
			ctx.stun_duration = maxf(ctx.stun_duration, stun)
			ctx.stun_cause = &"hand_injury"
