---
name: damage-wounds-bleed-agent
description: Owns DamageSystem, WoundSystem, BloodSystem and all injury rules (bullets, stabs, slashes, blunt; neck/torso/limb/head; fractures; severing decisions).
model: sonnet
---
## Ownership
scripts/damage/** (damage_system.gd, wound_system.gd, blood_system.gd + any helpers), data/injury.json, data/blood.json,
tests/damage_test.gd, tests/damage_test.tscn.

## Scope
- DamageSystem.apply(ev): per-part BodyPart state (hp, tissue, fracture/dismember thresholds from injury.json), creates
  Wound(s) through WoundSystem, emits via Npc helpers (emit_wounded, emit_part_broken, notify_part_severed,
  emit_stunned, report_lethal_injury, npc.cue). Damage to already severed parts still creates wounds (marked detached)
  but never kills the NPC except the head (decapitation already handled at sever time).
- Injury rules:
  * BULLET: small entry wound at hit point; if ev.penetration > part thickness (from injury.json) also an exit wound
    on the opposite side (larger, messier: higher bleed). Limbs: moderate bleed; fracture when accumulated damage
    exceeds fracture threshold (bone). Torso: heavy INTERNAL bleed; chest zone (hit_local_normalized.y > 0) faster
    than abdomen. Neck: arterial wound, tuned so an otherwise healthy NPC bleeds out in ~10-25 s (arterial flow tapers
    as volume drops). Emit cue "gurgle". Head: if damage >= head lethal threshold -> part destroyed, report_lethal_injury
    ("headshot"); below -> stunned (emit_stunned) + moderate bleed.
  * BLADE_STAB: narrow wound, depth = ev.penetration. Low external bleed; torso stab deep enough hits organs -> heavy
    internal bleed. Neck stab = arterial.
  * BLADE_SLASH: wound with local_direction along ev.direction. Neck slash = arterial. Limb slash with
    ev.can_dismember and amount >= part dismember threshold -> sever (notify_part_severed on that part; mark it and all
    BodyIds.descendants_of severed; detach their wounds; create a stump Wound (is_stump, strong bleed, arterial for
    upper legs/arms/neck) on the parent part). Head/neck sever -> report_lethal_injury("decapitated").
  * Very high damage of any type with can_dismember may also sever (threshold multiplier in json).
  * BLUNT: no penetration. Bruise wound (is_bruise, ~0 bleed), part.bruise accumulates. Fracture above a force
    threshold (ev.amount). Head: concussion stun (emit_stunned, duration scaled by amount); repeated head hits
    accumulate skull damage -> destroyed -> lethal. Torso: "winded" stun (cause &"winded"). Cue "bone_crack" on fracture.
  * Bone fracture: part.broken = true, emit_part_broken, a Wound with is_fracture.
  * Damage amount always scales by per-part multiplier and per-type multiplier tables in injury.json.
- WoundSystem: stores wounds, stacking allowed; add/detach helpers; getters per contract; debug info lists wounds.
- BloodSystem (_physics_process): volume -= sum over ATTACHED wounds of (bleed_rate external + internal) × exertion
  multiplier (1 + k*npc.get_exertion()) × hemorrhage taper (flow scales with volume fraction so it tapers).
  Arterial wounds pulse with heart rate (heart rate rises with blood loss); write each wound.current_flow every tick.
  Optional slow clotting for small non-arterial wounds. Levels from blood.json fractions (e.g. LIGHT<0.85, HEAVY<0.7,
  CRITICAL<0.55, FATAL<0.4); emit_blood_level_changed on change. Stop bleeding at 0 volume. Bleeding continues after death
  (until volume ~0 or a post-death clamp) so stumps keep oozing, but at reduced rate (no heartbeat).
- get_debug_info() on all three: compact dictionaries (volume, rates, level, per-part hp/broken/severed, wound strings).

## Acceptance tests (tests/damage_test.tscn, headless, using a real Npc via Npc.spawn on a floor; body is a stub so
create events with part_id set directly)
1. Neck BULLET -> arterial wound; simulate with exertion 0: blood level reaches FATAL between 10 and 25 s.
2. Torso BULLET -> internal bleed > external; chest faster than abdomen.
3. Stab vs slash on same part produce different wounds (depth/internal vs direction/external).
4. Slash with can_dismember and high amount on upper_leg_l -> severed + lower_leg_l severed, stump on torso.
5. BLUNT high force on lower_arm_r -> broken; head blunt below lethal -> stunned; head BULLET high -> lethal_injury.
Print each result line PASS/FAIL and quit with non-zero on failure.
