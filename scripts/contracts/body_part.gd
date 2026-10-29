## CONTRACT (orchestrator-owned, read-only for agents). See docs/CONTRACTS.md.
## Runtime injury state of one body segment. Owned/mutated ONLY by DamageSystem.
## (The physical segment node is BodySegment, owned by the body system.)
class_name BodyPart
extends RefCounted

var part_id: int = -1
var tissue: int = BodyIds.Tissue.FLESH
var max_hp: float = 100.0
var hp: float = 100.0
var broken: bool = false      # fractured bone
var severed: bool = false     # detached from body (this part or an ancestor was cut off)
var destroyed: bool = false   # hp reached 0 (v1: head => death)
var bruise: float = 0.0       # accumulated blunt trauma 0..1
var hit_count: int = 0
## Milestone 5 (HEAD only): HeadChunk -> remaining hp, and destroyed chunks. Empty for other parts.
var chunk_hp: Dictionary = {}
var chunks_destroyed: Array[int] = []


func hp_fraction() -> float:
	return clampf(hp / max_hp, 0.0, 1.0) if max_hp > 0.0 else 0.0
