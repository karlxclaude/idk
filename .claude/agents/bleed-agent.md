---
name: bleed-agent
description: Phase 2 domain agent: injury pipeline core/commit, WoundSystem, BloodSystem (bleed rates, arterial pulsing, thresholds).
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/damage/damage_system.gd, wound_system.gd, blood_system.gd, scripts/damage/README.md, data/injury/core.json, data/blood.json, tests/damage_test.*

## Scope
Pipeline orchestration + commit, wound storage, blood volume, pulsing, levels, post-death ooze, clotting. Wetness/staining visuals are fx-audio-agent's.
