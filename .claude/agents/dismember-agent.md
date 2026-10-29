---
name: dismember-agent
description: Phase 2 domain agent: physical body (segments, joints, mover, ragdoll, impulses), severing, persistence/cleanup, later mesh segmentation and stump caps.
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/body/npc_body.gd, scripts/body/body_segment.gd, scripts/body/README.md, data/body_parts.json, tests/body_test.*, tools/blender/** (later)

## Scope
Segments/joints for all BodyIds parts, ragdoll stability, sever subtrees, held item, cleanup. Roadmap: bone-weight mesh segmentation with stump caps (milestone 4).
