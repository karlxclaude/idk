## CONTRACT (orchestrator-owned, read-only for agents). See docs/CONTRACTS.md.
## Per-NPC blood state. Owned/mutated ONLY by BloodSystem; everyone else reads.
class_name BloodState
extends RefCounted

var max_volume: float = 5000.0
var volume: float = 5000.0
var external_rate: float = 0.0   # current total external loss, units/s (incl. pulse)
var internal_rate: float = 0.0   # current total internal loss, units/s
var level: int = BodyIds.BloodLevel.NORMAL
var heart_rate: float = 70.0     # bpm, drives arterial pulsing
var pulse_phase: float = 0.0     # 0..1 within current beat


func fraction() -> float:
	return clampf(volume / max_volume, 0.0, 1.0) if max_volume > 0.0 else 0.0


func total_rate() -> float:
	return external_rate + internal_rate
