# Decisions log

- **GDScript over C#**: container has no .NET SDK; GDScript avoids tooling friction. Whole project stays GDScript.
- **Godot 4.4.1**: Jolt is built in (`physics/3d/physics_engine="Jolt Physics"`), no addon needed.
- **Primitive body** (capsules/boxes) for v1; no external meshes, so CREDITS.md has no assets yet.
- **JSON data files** (not .tres) loaded by `DataDB` autoload: diff-friendly and hand-editable.
- **NPC built in code** (`Npc.spawn`) instead of a .tscn so no two agents edit one scene file.
- **Brain is the sole owner of NPC state**; damage/blood report facts (`lethal_injury`, `blood_level_changed`) and the brain decides.
- **Weapons compute raw `amount`/`penetration`** from their stats + velocity; DamageSystem applies per-part rules.
