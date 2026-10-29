## CONTRACT (orchestrator-owned, read-only for agents). See docs/CONTRACTS.md.
## The ONLY way damage enters an NPC. Built by weapons, consumed by DamageSystem.
class_name DamageEvent
extends RefCounted

enum Type { BULLET, BLADE_STAB, BLADE_SLASH, BLUNT, EXPLOSIVE }

# --- filled by the hitter (weapon) ---
var type: int = Type.BULLET
## Raw damage after weapon-side velocity/mass scaling, before body-part rules.
var amount: float = 0.0
var hit_position: Vector3 = Vector3.ZERO     # world space
var hit_normal: Vector3 = Vector3.UP         # world space, surface normal at hit
var direction: Vector3 = Vector3.FORWARD     # world space, normalized travel/swing direction
var impactor_velocity: Vector3 = Vector3.ZERO  # world space m/s (bullet velocity or blade tip/bat head velocity)
var impactor_mass: float = 0.0               # kg
## Penetration depth capability in metres (bullets: through-power; stabs: blade depth reached; blunt: 0).
var penetration: float = 0.0
## Weapon allows severing (fast blade slash / very high damage weapons). DamageSystem still checks thresholds.
var can_dismember: bool = false
var weapon_id: StringName = &""
var source: Node = null                       # who caused it (player / weapon node)
var part_id: int = -1                         # BodyIds.Part hit (from collider meta)
## Free-form extras for later passes (caliber, edge_length, ...). Never required by v1 logic.
var extra: Dictionary = {}

# --- filled by Npc.apply_damage() before DamageSystem sees it ---
var hit_local: Vector3 = Vector3.ZERO         # hit_position in the part's local space
## hit_local divided by part half-extents: each axis roughly -1..1. Part-local axes are defined in
## the standing rest pose (arms hanging at sides): +Y = up, +Z = front of body (NPC facing), +X = NPC's left.
var hit_local_normalized: Vector3 = Vector3.ZERO
var time: float = 0.0                         # Time.get_ticks_msec()/1000 at application


func describe() -> String:
	return "%s %.1f part=%s v=%.1fm/s" % [Type.keys()[type], amount,
		BodyIds.key(part_id) if part_id >= 0 else "?", impactor_velocity.length()]
