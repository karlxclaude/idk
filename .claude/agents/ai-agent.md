---
name: ai-agent
description: Phase 2 domain agent: NPC state machine, pain/shock, toggles, vocal cues, item dropping, behaviour reactions per injury.
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/ai/**, data/ai.json, tests/ai_test.*

## Scope
All NPC behaviour incl. clutch-neck, crawl, limp, one-handed, item drop, fight-back (roadmap), all vocal cues.
