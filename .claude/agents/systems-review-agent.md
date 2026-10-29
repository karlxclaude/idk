---
name: systems-review-agent
description: Phase 2 overseer: end-to-end flow and automated acceptance scene (N shots/stabs/hits at every part), visual capture check.
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
tests/acceptance_test.*, docs/REVIEW.md

## Scope
Successor of review-agent. Keep acceptance_test green, extend for new parts/features, render tools/visual_capture and inspect PNGs.
