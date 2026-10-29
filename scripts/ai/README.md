# scripts/ai — NpcBrain
Finite state machine for NPC behaviour. Tunables: `data/ai.json`. Test: `tests/ai_test.tscn`.

- `NpcBrain` is the only writer of `state`; every change goes through `_change()` which also toggles
  ragdoll, resets timers and calls `npc.emit_state_changed`. DEAD additionally calls `npc.emit_died` (once).
- Inputs: Npc signals (wounded, part_broken, part_severed, stunned, lethal_injury, blood_level_changed),
  `GameEvents.npc_wounded` for other NPCs (IDLE -> ALERT), `GameSettings.changed`.
- Pain = sum of wound severity x type weight x part weight, decays; `get_pain()` = raw / pain_tolerance (0..1).
  Shock derives from blood fraction (informational in v1).
- Exertion is a pure function of state (idle 0, alert-walk 0.3, run 1.0, crawl 0.6) read by BloodSystem.
- Public: `get_exertion()`, `get_pain()`, `get_shock()`, `force_state(s)`, `get_debug_info()`.
- Knockdown (long stun) = UNCONSCIOUS with a wake timer; blood CRITICAL = UNCONSCIOUS without one.
- FIGHT is a stub (TODO(roadmap: fight back)).
