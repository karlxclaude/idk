## Region rule: ARM (upper/lower arm + hands). Thresholds (fracture_accum/force, dismember) live in
## data/injury/arms.json part rows; logic is shared in limb_base.gd (incl. per-row bleed_mult).
## Hands: thin bone, low HP, low sever threshold; they hurt a lot (dmg_mult) but bleed modestly (bleed_mult).
## A hand fracture or sever only emits facts (part_broken / part_severed + ctx.tags.drop_item, documentation only);
## the ai-agent decides to drop the held item.
## TODO(roadmap: hands) finger-level injuries.
extends "limb_base.gd"


func apply(ctx: HitContext) -> void:
	super.apply(ctx)
	if not BodyIds.is_hand(ctx.ev.part_id):
		return
	if ctx.sever or ctx.fracture:
		ctx.tags["drop_item"] = true  # fact for the ai-agent: this hand can no longer hold anything
		var stun := float(ctx.part_cfg.get("break_stun", 0.0))
		if stun > 0.0:
			ctx.stun_duration = maxf(ctx.stun_duration, stun)
			ctx.stun_cause = &"hand_injury"
