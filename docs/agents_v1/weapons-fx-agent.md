---
name: weapons-fx-agent
description: Owns the three weapons, player controller, tip-velocity tracking, gore FX (particles, decals, pools), audio hooks, debug overlay, spawn button and the main scene.
model: sonnet
---
## Ownership
scripts/weapons/**, scripts/player/**, scripts/fx/**, scripts/ui/**, scenes/** (main.tscn and any scenes),
data/weapons.json, data/gore.json, tests/weapons_fx_test.gd, tests/weapons_fx_test.tscn.

## Scope
- data/weapons.json: ONE schema for all weapons: {id, name, slot, kind: "hitscan"|"melee", damage_types, base_damage,
  mass, length, velocity_ref (m/s at which melee deals base_damage), min_velocity, damage_velocity_exponent,
  penetration, can_dismember, dismember_min_velocity, stab_cone_deg, fire_rate, muzzle_velocity, impulse_scale, ...}.
  Entries: handgun (BULLET, hitscan, one caliber), knife (BLADE_STAB + BLADE_SLASH), bat (BLUNT). Adding a weapon must be
  a data-only change (code switches on kind/damage_types, never on id).
- Damage building: weapons create DamageEvent (all fields), resolve npc/part via BodyIds.npc_from_collider/part_from_collider,
  call npc.apply_damage(ev). Non-NPC hits -> GameEvents.world_impact. Raycasts mask world|npc_parts|debris.
  * Handgun: hitscan from camera, ev.impactor_velocity = dir*muzzle_velocity, mass small, penetration from data.
  * Melee: weapon is held in front of camera; tip velocity tracked EVERY physics frame from tip global position delta.
    Damage = base_damage * clamp((v/velocity_ref)^exponent) and 0 below min_velocity (a slow limp swing ~nothing).
    Hit detection by shape/ray sweep from previous to current tip/edge positions against npc_parts each physics frame;
    one hit per part per swing. Knife: angle between tip velocity and blade axis within stab_cone_deg -> BLADE_STAB
    (penetration = min(blade length, depth from speed)), else BLADE_SLASH (direction = tip velocity dir,
    can_dismember if v > dismember_min_velocity). Bat: BLUNT, mass from data.
  * Swinging: LMB = scripted fast swing arc (full speed), RMB on knife = thrust (stab). Holding Shift = "free swing":
    mouse movement drives the weapon so swing speed follows the player's mouse speed. Expose
    `debug_swing(speed_scale: float, mode: StringName)` so tests can do slow vs fast swings.
- Player: first-person CharacterBody3D (layer player), WASD + mouse look, jump, keys 1/2/3 select weapon,
  Esc releases mouse. Viewmodel = simple primitive meshes.
- GoreFX (listen to GameEvents): blood particle bursts on npc_wounded (scaled by severity; bigger for exit wounds);
  per active wound a lightweight emitter attached at the wound (part node from npc.body.get_part_node, local_position)
  whose spawn rate follows wound.current_flow (so arterial spurts pulse and taper); stumps on severed pieces bleed
  from part_severed. Blood decals (Decal nodes) on world where drops land, CAPPED (gore.json max_decals, oldest
  fades/removed). Basic blood pool under NPCs bleeding while slow/ragdolled that grows with lost blood, capped.
  Bruise decal for blunt optional. Keep it cheap. TODO(roadmap: advanced gore), TODO(roadmap: blood staining).
- Audio hooks: AudioCues node listening to GameEvents.audio_cue; v1 plays nothing audible-critical: log in debug and
  optionally short procedural AudioStreamGenerator blips. Map cue->asset path table in gore.json for later assets.
- Debug overlay (F1 toggles GameSettings.debug_overlay): for each npc in group "npc" a panel with npc.get_debug_info():
  state, blood volume/level/rates, per-part damage, pain, active wounds. Also a world-space label above each NPC.
- UI: "Spawn NPC" button (+ key N) spawning Npc.spawn in front of player within arena; toggle checkboxes for
  panic, scream, ragdoll-only (GameSettings.set_setting). Clear-all optional.
- scenes/main.tscn: flat arena (40x40 floor StaticBody3D on layer world + low walls), light, environment, player, UI,
  GoreFX, AudioCues, overlay. Keep it a small tscn; build most in code.
- Mature-content note: a one-line "fictional NPCs only" label in the UI is enough for v1.

## Acceptance tests (tests/weapons_fx_test.tscn, headless; NPC body is a stub — so for hit tests spawn your own
StaticBody3D/RigidBody3D targets with BodyIds metas pointing to a fake/real Npc, or check the DamageEvent you build via
a test hook such as a `last_event` property / signal on the weapon)
1. weapons.json loads; three weapons; handgun hitscan at a tagged target yields BULLET event with correct part_id.
2. Knife: fast thrust along blade axis -> BLADE_STAB; fast sideways swing -> BLADE_SLASH; slow swing amount near 0,
   fast swing amount >> slow. 3. Bat fast swing -> BLUNT with amount scaling with speed.
4. Decal cap respected after many world impacts. 5. main.tscn loads without errors (instantiate it for a few frames).
Print PASS/FAIL per test, quit non-zero on failure.
