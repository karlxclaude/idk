# Limb checklist (milestone 2 overseer pass)

Test: `tests/limb_integration_test.tscn` (about 80 s, 561 checks). Run `godot --headless --path . res://tests/limb_integration_test.tscn`.
The default run starts itself again with `-- --inner` as a child process, prints the log, and FAILS on any `SCRIPT ERROR` or engine `ERROR:` line (Godot 4.4 has no in-process log hook).
Visuals: `xvfb-run -a -s "-screen 0 1600x900x24" godot --path . --rendering-driver opengl3 res://tests/limb_integration_test.tscn -- --visual /abs/dir`.

Method: real `Npc`s on a floor on layer `world`, with GoreFX and AudioCues alive. Events come from the real weapon code:
the handgun through `HitscanWeapon.fire_ray`, the knife and bat through `MeleeWeapon._build_event` + `Weapon._deliver`, then `Npc.apply_damage`.
Strikes come from behind along a ray at the part centre, and every case asserts the ray's first hit is the intended part (it was for all 12 parts, so shins are not hit by foot-level strikes).
Where no shipped weapon reaches a threshold, a marked SYNTHETIC event of the same type is used and the REACH column fails.
Weapon speeds: a normal LMB swing reaches knife 7.1 m/s and bat 10.2 m/s. The test uses the lowest speed from a ladder that crosses each threshold.

## Per-limb matrix (PASS only if every check in the group passes)

| limb | fracture state/signal | fracture AI | fracture pose | bleed | hand/foot hit | sever state | sever floor | stump flow | sever AI | sever pose | clutch | ragdoll round trip | dead hit | fx | reach |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| upper_arm_l/r | PASS | PASS | **FAIL** (F1) | PASS | PASS | PASS | PASS | PASS | **FAIL** (F2) | PASS | - | - | PASS | PASS | PASS (bat 16, knife 12 m/s) |
| lower_arm_l/r | PASS | PASS | **FAIL** (F1) | PASS | PASS | PASS | PASS | PASS | **FAIL** (F2) | PASS | PASS | PASS (r) | PASS | PASS | PASS (bat 12, knife 12) |
| hand_l/r | PASS | PASS | **FAIL** (F1) | PASS | PASS | PASS | PASS | PASS | **FAIL** (F2) | PASS | PASS | PASS (l) | PASS | PASS | PASS (bat 8, knife 7.5) |
| upper_leg_l/r | PASS | PASS | PASS | PASS | PASS | PASS (synthetic) | PASS | PASS | **FAIL** (F2) | PASS | - | - | PASS | PASS | INFO (F4, by decision) |
| lower_leg_l/r | PASS | PASS | PASS | PASS | PASS | PASS (synthetic) | PASS | PASS | **FAIL** (F2) | PASS | - | - | PASS | PASS | INFO (F4, by decision) |
| foot_l/r | PASS | PASS | PASS | PASS | PASS | PASS (knife 10.5 m/s) | PASS | PASS | **FAIL** (F2) | PASS | - | PASS | PASS | PASS | PASS (bat 10, knife 10.5) |

Combos: both feet broken PASS. Chain cut (hand, then forearm, then upper arm; foot, shin, thigh) shows the right state but raises engine errors (F3). Corpse sever PASS. GoreFX with freed nodes **FAIL** (F5).

### Evidence (PASS rows)
- **Fracture state**: `BodyPart.broken`, one `part_broken(pid)`, fracture wound recorded, one `bone_crack` cue, the part stays attached. All 12 parts.
- **Arm and hand fracture AI**: `usable_arms == 1` and `one_handed`. A right-side break drops the phone (`held_item=''`, one `DroppedPhone`). A left-side break keeps it. The NPC goes to PANIC_FLEE.
- **Foot fracture AI**: `get_limp_side()` equals the broken side, and the state is not CRAWL.
- **Foot fracture pose**: body pose `limp`, PoseDriver limp side equals the broken side. The broken sole averages 11-12 cm above the floor (min 4.9 cm), while the sound sole reaches the floor (min -0.9 cm).
- **Shin and thigh fracture**: CRAWL, pose `crawl`, torso y 0.29 and pitched (up_dot 0.13), 1.5 m of progress in 2.5 s.
- **Arm pose while walking**: the broken hand's swing range is 16-19 cm against 49 cm for the sound hand (ratio 0.33-0.39, limit 0.6). The torso stays upright.
- **Bleeding**: a 9 mm hit gives entry and exit wounds on every part, `current_flow` above 0, and falling blood volume. Limbs give 27.8 ml/s and hands 14 ml/s.
- **Hand/foot hit behaviour**: the ray lands on the part collider, there is no launch (max torso step 7.6 cm per frame), and the hand ends at 0 hp but intact.
- **Sever state**: `has_part` is false for the whole subtree, every other part stays attached, and exactly one `part_severed` fires.
  The severed body is a dynamic `BodySegment` on `npc_parts` with `npc` and `part_id` metas. One `sever` cue fires. Wounds on the subtree are detached with flow 0.
- **Sever floor**: after 3 s the severed root rests on the floor (lowest point -3.3 to +0.8 cm, speed 0.00 m/s).
- **Stump flow**: stump wound on the parent with flow above 0. Upper arm 229 ml/s, forearm and hand 79, thigh 274, shin and foot 63.
- **Sever AI**: arm chain loss gives `one_handed` and a flee or clutch reaction. The phone leaves with a severed right arm (no ghost drop) and stays when the left is cut. Any leg or foot loss gives CRAWL with pose `crawl`.
- **Clutch** (chest hit then clutch): with a broken forearm the sound hand is 4.5 cm from the wound and the broken hand 67 cm away. With a severed hand the other hand or the stump tip reaches the wound.
- **Ragdoll round trip**:
  - A stun of 2.5 s or more knocks the NPC down and it gets up again.
  - A severed hand stays gone.
  - A broken forearm stays limp (ratio 0.27).
  - A broken foot still limps on the same side, with the sole lifted 11.5 cm.
  - A foot cut while ragdolled gives a crawl on wake-up.
- **Dead hit**: bat at 16 m/s on a ragdolled limb. Joints recover (final gap 0.8 cm). Part speed is at most 17 m/s.
- **FX**: bleeding wounds create 2 emitters. A sever creates 2 emitters, one on the severed piece.

## Known open item: broken arm in IDLE (CONFIRMED)

Measured against a control NPC of the same seed (`frac.pose`, IDLE checks):

| | broken hand y | control hand y | elbow flexion |
|---|---|---|---|
| left | 0.848 | 0.836 | 10.3 deg broken vs 6.9 deg sound |
| right | 0.842 | 0.830 | 10.3 deg broken vs 6.9 deg sound |

- In IDLE the broken hand is 1.2 cm higher than the sound one, not lower. Cause: `pose.json broken.elbow -0.18` is more bent than `idle.elbow -0.12`.
- Only 4.6-5.1 cm separates it from the sound hand, which does not read as a broken arm in the screenshot `brokenarm_idle_front.png`.
- While walking it is only 0.5-0.6 cm lower than the sound hand (test passes at 0). The visible effect is that it does not swing (ratio about 0.35), not that it hangs.
- A straight arm can drop only about 1 cm below a sound one, so "hangs lower" is physically capped. The fix has to be a visible difference of another kind.
- What-if run, edited in memory only: `broken.arm_abduct 0.25, elbow -0.02, hand_z 0.3` puts the hand 13 cm from the sound position. The arm visibly dangles away from the body, though the hand is 2.8 cm higher. `arm_abduct 0.18, elbow 0` gave only 7.3 cm, which is borderline.

## Failures (owner, file, function, failure, fix)

**F1. Broken arm not visible in IDLE** (LOW, cosmetic). Owner: **ik-agent**. File: `data/pose.json` `broken` block and `scripts/body/pose/pose_driver.gd` `_apply_broken`.
Failure: see the open item above (hand 1.2 cm higher, 4.6-5.1 cm from normal). Test names: `IDLE: broken hand hangs ...` and `IDLE: broken arm reads differently ...`, 12 rows.
Fix: set `broken.elbow` to about -0.02 (straight), `arm_abduct` to about 0.25, and `hand_z` to about 0.3. Optionally add a shoulder-drop torso roll toward the broken side in `_apply_broken`.

**F2. Shooting a severed piece hurts the living NPC again** (MEDIUM). Owner: **ai-agent**. File: `scripts/ai/npc_brain.gd` `_on_wounded`.
Failure, all 12 rows: after a sever, a 9 mm into the lying severed piece (and into its distal piece) raised pain to the cap (0.40-0.67 to 1.00) and fired 2-4 grunt/scream cues.
`DamageSystem` correctly adds the wound with `detached=true` and flow 0, but the brain only does `_pain_raw += ...`, cues, and `_react`, so the NPC re-panics.
Fix: at the top of `_on_wounded` do `if w.detached: return`. DamageSystem should keep emitting, because GoreFX wants the hits on severed pieces.

**F3. Cutting a limb piece by piece raises engine errors** (MEDIUM). Owner: **dismember-agent**. File: `scripts/body/npc_body.gd` `sever_part`.
Failure: hand, then forearm, then upper arm (also foot, shin, thigh) gives `ERROR: Condition "p_child->data.parent != this"` and `Can't add child 'hand_l' to 'Severed_lower_arm_l_*', already has a parent 'Severed_hand_l_*'` (12 errors per run).
Cause: `sever_part` only checks `has_part(part_id)` for the root, but `ids` includes descendants that are already severed. It then runs `remove_child`/`add_child` on segments and joints that live in earlier containers.
The pieces still end up fine in the test (`chain_*` checks pass), so this is log spam and a risk.
Fix: `ids = ids.filter(func(p): return _segments[p].attached)`, and only move joints of still-attached parts.

**F4. Upper and lower legs cannot be severed by a shipped weapon: INTENTIONAL, not a failure.** Per docs/DECISIONS.md, leg severing by the v1 knife is out of reach until the machete/heavy weapons arrive in milestone 5.
The REACH rows are now INFO lines in the test. The synthetic-event sever checks for thigh and shin remain real assertions.
Reach notes:
- At a normal LMB swing (knife 7.1, bat 10.2 m/s) only hand and foot fractures and the hand sever are reachable.
- The hand sever clears `dismember_min_velocity` 7.0 by only 1.4 %.

**F5. GoreFX errors every physics frame once an emitter's node is freed** (HIGH for stability). Owner: **fx-audio-agent**. File: `scripts/fx/gore_fx.gd` `_update_emitters` (line 238).
Failure: `var node: GPUParticles3D = e.node` is assigned before the `is_instance_valid` check, so a freed node raises `SCRIPT ERROR: Trying to assign invalid previously freed instance` and aborts the function.
The invalid entry is never removed, so it errors every frame forever and emitters older than it stop updating.
Triggers: any freed NPC or severed piece with a registered emitter (the 120 s `severed_cleanup_s` of every severed limb, and NPC removal without `clear_all`).
The test saw 2016 identical errors when NPCs were freed without `clear_all`. Test: `fx_cleanup` combo.
Fix: `var node = e.node` (untyped), then `if not is_instance_valid(node): remove; continue`.

**F6. Clutching a front-shot chest reaches over the shoulder for the exit wound on the back** (LOW, cosmetic). Owner: **ai-agent**, `scripts/ai/npc_brain.gd` `_push_clutch_wound`; secondary **ik-agent** reach.
Evidence: `clutch_shot_from_front_back.png` and `clutch_shot_from_front_side.png`. The hand is 4.5 cm from the exit wound on the back.
Cause: `_push_clutch_wound` picks the highest-severity wound and the exit wound (1.5 x severity) wins over the chest entry.
Fix: prefer wounds on the NPC's front face (`local_normal.z > 0`), or entry before exit, unless only the back one exists.

**Observations (not failed)**
- A 9 mm chest hit has severity 0.57 (below `clutch_severity_min` 0.6), so it makes PANIC_FLEE and not CLUTCH. Only stumps on the torso (upper-arm sever) clutch by default.
- A CRAWL NPC ignores stuns, including 2 s or longer concussion knockdowns (`_on_stunned` returns while CRAWL). It looks intentional.
- A hand hit with a 16 m/s bat on a dead body stretches the wrist joint up to 9.6 cm for a moment before it recovers.

## Screenshots (view with the Read tool)
`/tmp/claude-0/-home-user-idk/76ddc07a-0840-57dc-b99b-dbb42e1bdfa0/scratchpad/vis3/`
- `limp_side_a/b.png`, `limp_front.png`: broken left foot. The leg is held up and the torso rolls over the sound leg (OK).
- `clutch_shot_from_behind_side/front.png`: hand presses the chest exit wound, the other hand holds the phone (OK).
- `clutch_shot_from_front_side/back.png`: F6.
- `brokenarm_idle_front.png`: F1, indistinguishable from a sound arm. `brokenarm_walk_side_a.png` and `brokenarm_walk_front.png` show the limp, non-swinging arm.
