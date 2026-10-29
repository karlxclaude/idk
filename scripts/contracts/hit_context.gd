## CONTRACT (orchestrator-owned, read-only for agents). See docs/CONTRACTS.md "Injury pipeline".
## Scratchpad passed through the injury pipeline for ONE DamageEvent:
##   DamageSystem builds it -> mechanism rule (by ev.type) -> region rule (by region) -> DamageSystem commits.
## Rules only fill this object; they never touch BodyPart HP, emit signals or call Npc helpers.
class_name HitContext
extends RefCounted

## Region keys (one per region rule).
const REGION_HEAD := &"head"
const REGION_NECK := &"neck"
const REGION_CHEST := &"chest"      # torso, hit_local_normalized.y > 0
const REGION_ABDOMEN := &"abdomen"  # torso, y <= 0
const REGION_ARM := &"arm"          # upper/lower arm (+ hand from milestone 2)
const REGION_LEG := &"leg"          # upper/lower leg (+ foot from milestone 2)

# --- set by DamageSystem before rules run (read-only for rules) ---
var npc: Node                      # Npc
var ev: DamageEvent
var part: BodyPart                 # state BEFORE this hit
var part_cfg: Dictionary           # this part's row from its region data file
var region: StringName
var detached := false              # part was already severed before this hit
var base_damage := 0.0             # ev.amount × part dmg_mult × type mult

# --- filled by the MECHANISM rule (penetrating / blunt) ---
var damage := 0.0                  # HP to remove from part (region rule may scale)
var depth := 0.0                   # metres reached into the part (0 for blunt)
var passes_through := false        # bullet exits the part
var force := 0.0                   # blunt force measure (ev.amount-based) for fracture/stun rules
## Wounds to create. Mechanism creates base wounds (entry/exit/stab/slash/bruise) with generic
## bleed; region rule may modify them (arterial, organ internal bleed) or add more.
## Use DamageSystem.new_wound(ctx, ...) helpers so positions/directions are in part space.
var wounds: Array[Wound] = []

# --- requests, mostly by the REGION rule, honoured by DamageSystem.commit ---
var fracture := false              # break the bone (ignored for flesh / severed parts)
var sever := false                 # cut this part off (DamageSystem severs subtree + stump)
var destroy := false               # part destroyed (head => lethal)
var stun_duration := 0.0
var stun_cause: StringName = &""
var lethal_cause: StringName = &""  # non-empty => report_lethal_injury
## Non-vocal audio cues to emit (bone_crack, sever, flesh_hit...). Vocal cues belong to the brain.
var cues: Array[StringName] = []
## Free-form notes rules may leave for later rules / debug ("organ_hit", "artery_cut"...).
var tags: Dictionary = {}
