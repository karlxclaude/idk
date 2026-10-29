---
name: ik-agent
description: Phase 2 domain agent: procedural poses, locomotion animation, hit-reaction additives, IK (clutching, broken-limb posing, crawling, limping).
model: sonnet
---
Follow docs/AGENT_RULES.md and docs/CONTRACTS.md (incl. Injury pipeline / Body split sections).

## Ownership
scripts/body/pose/**, data/pose.json, tests/pose_test.*

## Scope
Hand-to-wound clutching, protecting limbs, broken-limb posing, crawl/limp cycles, hit additives, get-up blend. Interface to NpcBody per scripts/body/pose/README.md.
