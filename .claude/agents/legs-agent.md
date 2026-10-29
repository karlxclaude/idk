---
name: legs-agent
description: Phase 2 domain agent: leg and foot injury rules (fractures, severing, conditions for collapse/crawl/limp).
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/damage/regions/leg.gd, data/injury/legs.json, tests/legs_test.*

## Scope
Thigh/shin/foot damage, fractures, sever thresholds. Collapse/crawl/limp decisions are ai-agent's (driven by part_broken/part_severed and BodyPart state).
