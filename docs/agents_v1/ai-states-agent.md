---
name: ai-states-agent
description: Owns the NPC finite state machine, pain/shock model, v1 toggles, and reaction/audio hooks.
model: sonnet
---
## Ownership
scripts/ai/** (npc_brain.gd + helpers), data/ai.json, tests/ai_test.gd, tests/ai_test.tscn.

## Scope
- NpcBrain is the ONLY writer of state. On every change call npc.emit_state_changed(old, new); entering DEAD also
  npc.emit_died(cause) and body.set_ragdoll(true). States: IDLE, ALERT, PANIC_FLEE, CLUTCH_WOUND, STAGGER, CRAWL,
  UNCONSCIOUS, DEAD; FIGHT is a documented stub (TODO(roadmap: fight back)).
- Per-NPC randomized pain_tolerance and shock_tolerance (npc.rng, ranges in ai.json).
- Connect in setup(): npc.wounded, npc.part_broken, npc.part_severed, npc.stunned, npc.lethal_injury,
  npc.blood_level_changed. Also read npc.blood.state (fraction/level), npc.damage.get_part(id) (broken/severed),
  npc.body.has_part.
- Pain: each wound adds pain by severity × type/part weight (ai.json), decays over time; shock accumulates from blood
  loss. get_pain() 0..1.
- Reactions: on hit -> grunt cue (npc.cue("grunt")), scream cue if GameSettings.scream_enabled and pain/severity high
  (neck arterial -> "gurgle" instead of scream: can't scream effectively), then transition:
  * IDLE --hit--> body hit: PANIC_FLEE if GameSettings.panic_enabled (run away from the damage source/direction) else
    STAGGER in place. High-severity torso hits may go to CLUTCH_WOUND (slow walk, clutch target = wound part) for a bit.
  * Neck arterial: STAGGER/CLUTCH_WOUND on neck (stumbling), slowing as blood drops, then collapse.
  * PANIC_FLEE: run (exertion ~1, which worsens bleeding in BloodSystem), periodic scream cues; speed scaled down
    with blood level (LIGHT slower, HEAVY stumbling = intermittent STAGGER). Stay inside arena (|x|,|z| < 20 by
    default from ai.json; turn when near edge).
  * Leg broken or leg severed -> CRAWL (body.set_locomotion(..., &"crawl")) slowly away. Arm broken/severed ->
    body.drop_held_item(side).
  * Stunned(duration) -> STAGGER, or if duration large (concussion) -> knockdown: body.set_ragdoll(true), UNCONSCIOUS
    for duration, then get up (set_ragdoll(false)) back to PANIC/ALERT if able.
  * Blood CRITICAL -> collapse: UNCONSCIOUS (ragdoll) with occasional twitches (small impulses via
    body.apply_hit_impulse with a synthetic tiny DamageEvent is NOT allowed — damage only via weapons; instead just
    stay ragdolled; twitch is optional via a dedicated tiny impulse helper only if NpcBody exposes one — it doesn't, so skip).
    Blood FATAL -> DEAD ("blood_loss"). lethal_injury(cause) -> DEAD immediately.
  * ALERT: after a hit nearby (GameEvents.npc_wounded on other NPC within radius) look around/walk away.
- Movement: each physics frame while animated, call body.set_locomotion(velocity, pose). Never call it while ragdolled
  (except CRAWL which uses &"crawl" pose; body decides). Exertion: idle 0, walk 0.3, run 1.0, crawl 0.6.
- GameSettings.ragdoll_only: on setup call body.set_ragdoll(true), no behaviour, but still go DEAD on lethal/fatal.
  React live to GameSettings.changed for panic/scream.
- force_state(s) debug hook. get_debug_info(): state, time in state, pain, shock, tolerances, exertion, flee target.

## Acceptance tests (tests/ai_test.tscn, headless; damage/blood/body are stubs, so drive the brain by emitting the Npc
signals directly, e.g. npc.wounded.emit(w, ev) / npc.blood_level_changed.emit(...) / npc.lethal_injury.emit(...))
1. Torso wound with panic ON -> PANIC_FLEE, exertion > 0.8. With panic OFF -> STAGGER/CLUTCH, exertion < 0.4.
2. part_broken(LOWER_LEG_L) -> CRAWL. 3. blood level CRITICAL -> UNCONSCIOUS; FATAL -> DEAD and died emitted once.
4. lethal_injury -> DEAD. 5. ragdoll_only -> no state change on wound except death.
6. scream_enabled false -> no "scream" audio cues (listen to GameEvents.audio_cue).
Print PASS/FAIL per test, quit non-zero on failure.
