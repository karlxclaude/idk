# scripts/damage
Owner: damage-wounds-bleed-agent. Tunables: data/injury/*.json (one file per rule group), data/blood.json.

Pipeline (DamageSystem.apply): HitContext -> mechanism rule (ev.type) -> region rule (ctx.region) -> commit.
Rules only fill the context. `_commit` is the only code that mutates BodyPart, calls WoundSystem, emits via Npc.
Shared helpers for rules: type_name, region_of, new_wound(ctx,sev,ext,int,art), local_dir(ctx), local_vec(id,v).

Rule -> decision (data file)
- mechanisms/bullet: entry wound, exit wound if penetration > thickness (penetrating.json)
- mechanisms/stab: narrow wound, severity from depth/thickness, low ext bleed (penetrating.json)
- mechanisms/slash: wound along swing, ext bleed scaled by severity (penetrating.json)
- mechanisms/blunt: bruise wound, bruise accumulation, force (blunt.json)
- regions/head: lethal threshold + cause per type, graze stun, concussion, skull-hp death (head_neck.json)
- regions/neck: arterial flag on primary wound, neck sever + "decapitated" (head_neck.json)
- regions/torso: chest/abdomen organ hit -> internal bleed on deep stab, blunt "winded" (torso.json)
- regions/arm, leg (share limb_base): fracture (accum dmg or blunt force), sever thresholds (arms/legs.json)
- core.json (commit): per-type dmg multiplier, stump bleed + arterial stump parts, fracture wound severity.
- Slash sever needs ev.can_dismember and amount >= part "dismember"; other types need x high_damage_sever_mult.
  A cutting sever replaces the surface wound and skips fracture. Severing a subtree holding the head destroys it.
- Per-part rows (max_hp, dmg_mult, thickness, thresholds) live in the region's file under "parts".
- BloodSystem.step(delta): flow = rate x clot x volume fraction x exertion x pulse (blood.json).
- Test: godot --headless --path . res://tests/damage_test.tscn
