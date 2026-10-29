## CONTRACT (orchestrator-owned). Base class for injury pipeline rules.
## Mechanism rules (scripts/damage/mechanisms/*.gd) handle one DamageEvent.Type.
## Region rules (scripts/damage/regions/*.gd) handle one or more HitContext.REGION_* keys.
class_name InjuryRule
extends RefCounted

## Data for this rule (its own data/injury/<file>.json table). Set once by DamageSystem.
var cfg: Dictionary = {}
## The owning DamageSystem (for shared helpers like new_wound / local_dir). Never mutate its state.
var system: Node


func setup(rule_cfg: Dictionary, owner_system: Node) -> void:
	cfg = rule_cfg
	system = owner_system


## Fill ctx. Must be deterministic given ctx + npc.rng.
func apply(ctx: HitContext) -> void:
	pass
