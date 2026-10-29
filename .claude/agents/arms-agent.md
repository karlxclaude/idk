---
name: arms-agent
description: Phase 2 domain agent: arm and hand injury rules (fractures, severing thresholds, hand damage).
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/damage/regions/arm.gd, data/injury/arms.json, tests/arms_test.*

## Scope
Upper/lower arm + hand: damage, fractures, sever thresholds, hand hits. Item dropping and one-handed behaviour are ai-agent's; posing is ik-agent's.
