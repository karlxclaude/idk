# scripts/damage
Owner: damage-wounds-bleed-agent. Tunables: data/injury.json, data/blood.json.

- DamageSystem.apply(ev): per-part BodyPart state, injury rules per damage type, creates Wounds,
  emits via Npc helpers (emit_wounded, emit_part_broken, notify_part_severed, emit_stunned,
  report_lethal_injury, cue). Sole mutator of BodyPart.
- WoundSystem: wound storage. Internal API: add_wound(w, detached), detach_part(id).
- BloodSystem: step(delta) (called from _physics_process; tests may call it directly with
  set_physics_process(false)). Flow = base rate x clot x volume fraction (taper) x exertion x pulse.
  Arterial wounds pulse (mean 1) with heart rate; dead NPCs bleed at dead_flow_mult, no pulse.
- Bleed regions: limb / chest (hit_local_normalized.y > 0) / abdomen / neck / head.
- Severing: slash with can_dismember and amount >= part "dismember"; any other type needs
  amount >= dismember * high_damage_sever_mult. Neck sever => head destroyed, "decapitated".
- Test: godot --headless --path . res://tests/damage_test.tscn
