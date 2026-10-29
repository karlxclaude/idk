## CONTRACT (orchestrator-owned, read-only for agents). See docs/CONTRACTS.md.
## Body part IDs, skeleton hierarchy, enums shared by every system.
class_name BodyIds
extends RefCounted

enum Part {
	HEAD, NECK, TORSO,
	UPPER_ARM_L, LOWER_ARM_L, UPPER_ARM_R, LOWER_ARM_R,
	UPPER_LEG_L, LOWER_LEG_L, UPPER_LEG_R, LOWER_LEG_R,
	HAND_L, HAND_R, FOOT_L, FOOT_R,  # milestone 2 (appended: earlier ids unchanged)
}
const PART_COUNT := 15
const ROOT := Part.TORSO

## Parent of each part (joint goes from part to its parent). Root has -1.
const PARENT := {
	Part.HEAD: Part.NECK,
	Part.NECK: Part.TORSO,
	Part.TORSO: -1,
	Part.UPPER_ARM_L: Part.TORSO, Part.LOWER_ARM_L: Part.UPPER_ARM_L,
	Part.UPPER_ARM_R: Part.TORSO, Part.LOWER_ARM_R: Part.UPPER_ARM_R,
	Part.UPPER_LEG_L: Part.TORSO, Part.LOWER_LEG_L: Part.UPPER_LEG_L,
	Part.UPPER_LEG_R: Part.TORSO, Part.LOWER_LEG_R: Part.UPPER_LEG_R,
	Part.HAND_L: Part.LOWER_ARM_L, Part.HAND_R: Part.LOWER_ARM_R,
	Part.FOOT_L: Part.LOWER_LEG_L, Part.FOOT_R: Part.LOWER_LEG_R,
}

## String keys used in every data file (data/*.json) and the debug overlay.
const KEYS := {
	Part.HEAD: "head", Part.NECK: "neck", Part.TORSO: "torso",
	Part.UPPER_ARM_L: "upper_arm_l", Part.LOWER_ARM_L: "lower_arm_l",
	Part.UPPER_ARM_R: "upper_arm_r", Part.LOWER_ARM_R: "lower_arm_r",
	Part.UPPER_LEG_L: "upper_leg_l", Part.LOWER_LEG_L: "lower_leg_l",
	Part.UPPER_LEG_R: "upper_leg_r", Part.LOWER_LEG_R: "lower_leg_r",
	Part.HAND_L: "hand_l", Part.HAND_R: "hand_r",
	Part.FOOT_L: "foot_l", Part.FOOT_R: "foot_r",
}

enum Tissue { FLESH, BONE }

## NPC behaviour states (owned at runtime by the AI brain).
enum NpcState { IDLE, ALERT, PANIC_FLEE, CLUTCH_WOUND, STAGGER, CRAWL, UNCONSCIOUS, DEAD, FIGHT }

## Blood loss levels (computed by BloodSystem from data/blood.json thresholds).
enum BloodLevel { NORMAL, LIGHT, HEAVY, CRITICAL, FATAL }

## Physics layers (bit values). Names mirror project.godot [layer_names].
const LAYER_WORLD := 1
const LAYER_NPC_PARTS := 2
const LAYER_PLAYER := 4
const LAYER_WEAPONS := 8
const LAYER_DEBRIS := 16
const LAYER_NPC_MOVER := 32

## Metadata keys every body-part collider carries so hitters can resolve a hit.
const META_NPC := &"npc"          # -> Npc
const META_PART_ID := &"part_id"  # -> int (Part)


static func key(part_id: int) -> String:
	return KEYS[part_id]


static func from_key(k: String) -> int:
	for p in KEYS:
		if KEYS[p] == k:
			return p
	return -1


static func parent_of(part_id: int) -> int:
	return PARENT[part_id]


static func children_of(part_id: int) -> Array[int]:
	var out: Array[int] = []
	for p in PARENT:
		if PARENT[p] == part_id:
			out.append(p)
	return out


## All parts below part_id (not including it), depth-first.
static func descendants_of(part_id: int) -> Array[int]:
	var out: Array[int] = []
	for c in children_of(part_id):
		out.append(c)
		out.append_array(descendants_of(c))
	return out


## Arm chain incl. hands.
static func is_arm(part_id: int) -> bool:
	return part_id in [Part.UPPER_ARM_L, Part.LOWER_ARM_L, Part.UPPER_ARM_R, Part.LOWER_ARM_R,
		Part.HAND_L, Part.HAND_R]


## Leg chain incl. feet.
static func is_leg(part_id: int) -> bool:
	return part_id in [Part.UPPER_LEG_L, Part.LOWER_LEG_L, Part.UPPER_LEG_R, Part.LOWER_LEG_R,
		Part.FOOT_L, Part.FOOT_R]


static func is_hand(part_id: int) -> bool:
	return part_id == Part.HAND_L or part_id == Part.HAND_R


static func is_foot(part_id: int) -> bool:
	return part_id == Part.FOOT_L or part_id == Part.FOOT_R


## The hand at the end of the arm chain on `side` ("l"/"r").
static func hand_of(side: String) -> int:
	return Part.HAND_L if side == "l" else Part.HAND_R


## "l", "r", or "" for centre-line parts.
static func side_of(part_id: int) -> String:
	var k: String = KEYS[part_id]
	if k.ends_with("_l"):
		return "l"
	if k.ends_with("_r"):
		return "r"
	return ""


## Resolve a collider hit to its NPC (null if not an NPC body part).
static func npc_from_collider(collider: Object) -> Node:
	if collider and collider.has_meta(META_NPC):
		var n = collider.get_meta(META_NPC)
		if is_instance_valid(n):
			return n
	return null


static func part_from_collider(collider: Object) -> int:
	if collider and collider.has_meta(META_PART_ID):
		return int(collider.get_meta(META_PART_ID))
	return -1


static func state_name(s: int) -> String:
	return NpcState.keys()[s]
