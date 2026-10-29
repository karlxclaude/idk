---
name: torso-agent
description: Phase 2 domain agent: torso injury rules (chest/abdomen organ zones, internal bleeding, winded).
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/damage/regions/torso.gd, data/injury/torso.json, tests/torso_test.*

## Scope
Organ zones (heart/lung/abdomen) from hit_local_normalized, internal bleed rates, winded stun from blunt, extreme torso split (roadmap).
