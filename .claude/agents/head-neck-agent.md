---
name: head-neck-agent
description: Phase 2 domain agent: head and neck injury rules (lethality, stun/concussion, arterial neck), later head sub-segments and chunk damage.
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/damage/regions/head.gd, scripts/damage/regions/neck.gd, data/injury/head_neck.json, tests/head_neck_test.*

## Scope
Head: instant death above threshold, stun/knockdown below, repeated-hit skull damage. Neck: arterial wounds (10-25 s bleed-out), decapitation. Roadmap: head sub-segments (jaw/face/cranium) + chunk damage (milestone 5; needs contract change via orchestrator). Clutch-neck behaviour and gurgle audio are requested from ai-agent via orchestrator.
