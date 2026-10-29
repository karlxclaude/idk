# Weapons / player / FX / UI (weapons-fx-agent)
- `data/weapons.json`: one schema for all weapons; code switches on `kind` (hitscan|melee) and `damage_types`, never on id.
  Adding a weapon = new JSON entry (viewmodel primitives, rest pose, swing/thrust params included).
- `scripts/weapons/`: `Weapon` (base, `last_event`, `hit_resolved`), `HitscanWeapon.fire_ray(origin, dir)`,
  `MeleeWeapon` (per-physics-frame tip velocity, swept hit detection, `debug_swing(speed_scale, mode)`),
  `WeaponFactory.create(def)`, `WeaponDefs`.
- Melee damage = base_damage * clamp((v/velocity_ref)^exp, 0, max_damage_scale), 0 below `min_velocity`.
  Knife: velocity within `stab_cone_deg` of blade axis -> BLADE_STAB, else BLADE_SLASH.
- `scripts/player/player.gd`: FPS controller, keys 1/2/3, LMB attack, RMB thrust, Shift free swing (mouse drives weapon).
- `scripts/fx/gore_fx.gd`: bursts, per-wound emitters (rate follows `Wound.current_flow`), capped decals, blood pools.
  `scripts/fx/audio_cues.gd`: logs cues + procedural blips; cue table in `data/gore.json`.
- `scripts/ui/`: `main.gd` (scene root, builds arena in code), `game_ui.gd`, `debug_overlay.gd` (F1).
- Test: `godot --headless --path . res://tests/weapons_fx_test.tscn`
