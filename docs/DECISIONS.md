# Decisions log

- **GDScript over C#**: container has no .NET SDK; GDScript avoids tooling friction. Whole project stays GDScript.
- **Godot 4.4.1**: Jolt is built in (`physics/3d/physics_engine="Jolt Physics"`), no addon needed.
- **Primitive body** (capsules/boxes) for v1; no external meshes, so CREDITS.md has no assets yet.
- **JSON data files** (not .tres) loaded by `DataDB` autoload: diff-friendly and hand-editable.
- **NPC built in code** (`Npc.spawn`) instead of a .tscn so no two agents edit one scene file.
- **Brain is the sole owner of NPC state**; damage/blood report facts (`lethal_injury`, `blood_level_changed`) and the brain decides.
- **Weapons compute raw `amount`/`penetration`** from their stats + velocity; DamageSystem applies per-part rules.

## AI (ai-states-agent)
- Exertion is a pure function of state: IDLE 0, ALERT 0.3, PANIC_FLEE 1.0, CRAWL 0.6, CLUTCH_WOUND 0.3, STAGGER 0.2.
- Pain per wound = severity × type weight × part weight (+ fracture bonus), decays; `get_pain()` = sum / pain_tolerance, clamped 0..1.
- Shock is informational only; BloodSystem levels stay authoritative for collapse/death.
- Torso hit severity ≥ 0.6 → CLUTCH_WOUND 2–4 s; other hits → PANIC_FLEE (panic on) or STAGGER (off); bruise < 0.3 only staggers.
- Neck arterial → CLUTCH_WOUND on neck with gurgle, no scream; blood level takes over.
- Stun ≥ 2 s = knockdown (ragdoll, UNCONSCIOUS, wake timer); blood CRITICAL → UNCONSCIOUS (no wake); FATAL → DEAD.
- Brain tracks its own `_ragdolled` flag; steers inside arena by reflecting heading.

## Damage / blood (damage-wounds-bleed-agent)
- Torso chest vs abdomen = `hit_local_normalized.y > 0`. Exit wound only when `ev.penetration` > part thickness.
- Arterial pulse = `1 + amp·sin(2π·phase)` (mean 1); heart rate 70→160 bpm with loss; flow tapers linearly with volume.
- Dead bleed at 0.35× flow, no pulse. Clotting only for small non-arterial/stump/exit wounds.
- Non-slash `can_dismember` severs only at 2× dismember threshold. Neck sever destroys head → `decapitated`. Lethal reported once.
- Fracture when accumulated damage ≥ `fracture_accum` or blunt `amount` ≥ `fracture_force`. Head HP accumulates (repeated hits kill).
- `BloodSystem.step(delta)` is public so tests can simulate deterministically.
