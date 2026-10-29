---
name: blunt-agent
description: Phase 2 domain agent: blunt trauma mechanism across all parts (force, bruises, fracture force, concussion inputs).
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/damage/mechanisms/blunt.gd, data/injury/blunt.json, tests/blunt_test.*

## Scope
Force thresholds, bruise wounds, force value used by region rules for fracture/concussion/winded/knockdown. Bruise decals are fx-audio-agent's.
