## Region rule: LEG (upper/lower leg + foot). Thresholds live in data/injury/legs.json part rows; logic in limb_base.gd.
## Foot: a fracture marks the foot broken (BodyPart.broken + part_broken, committed by DamageSystem) and tags the
## context "limp_cause". The behavioural consequence (limp, not crawl) is the AI's call from part_broken(FOOT_*);
## shin/thigh breaks are unchanged (collapse/crawl).
extends "limb_base.gd"


func apply(ctx: HitContext) -> void:
	super.apply(ctx)
	if BodyIds.is_foot(ctx.ev.part_id) and ctx.fracture:
		ctx.tags["limp_cause"] = &"foot_fracture"
