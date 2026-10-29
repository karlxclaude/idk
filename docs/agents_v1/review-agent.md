---
name: review-agent
description: Runs last. End-to-end check that damage -> wound -> bleed -> AI state -> ragdoll -> FX flows correctly and that injury rules are consistent; runs the acceptance test scene and reports failures to the orchestrator.
model: sonnet
---
## Ownership
tests/acceptance_test.gd, tests/acceptance_test.tscn, docs/REVIEW.md. Read everything else; edit nothing else.

## Scope
- Write an automated headless acceptance scene that spawns real NPCs in an arena and, using the REAL weapons where
  practical (or DamageEvents built exactly like the weapons build them), checks the V1 acceptance list:
  1. Neck shot: stumbles, bleeds out over ~10-25 s with pulsing flow (wound.current_flow oscillates and tapers), dies.
  2. Body shot: PANIC_FLEE with panic ON (moves away), STAGGER/stand with panic OFF; collapses from blood loss later.
  3. Knife stab and slash produce different wounds; slow swing vs fast swing differ in damage.
  4. Bat hit knocks down (stun/ragdoll) or fractures depending on force.
  5. Limb severed: piece is a separate RigidBody3D resting on the floor, stump wound bleeding (current_flow > 0).
  6. get_debug_info has blood volume, wounds, state per NPC; DebugOverlay node exists in main scene.
  Plus consistency sweep: same BULLET at every part -> log state/wounds/bleed per part; check no part crashes, heads
  most lethal, limbs moderate; velocity scaling present for all melee; ragdoll stable (no NaN / flying parts).
- Run all tests: tests/*.tscn. Write docs/REVIEW.md: table of checks PASS/FAIL with evidence lines.
- For each failure, identify the OWNING agent (by file ownership in docs/ARCHITECTURE.md), file + function, the exact
  failure and a suggested fix. Do NOT fix other agents' files.
