# Review report (systems-review-agent)

State: milestone 3. Acceptance is green (128/128). No red scenes.
Nothing outside the review-owned files (`tests/acceptance_test.*`, `docs/REVIEW.md`) was edited.

Run any scene with `godot --headless --path /home/user/idk res://tests/<name>.tscn` (run `--import` once after adding `class_name` scripts).
The acceptance scene (`tests/acceptance_test.tscn`, about 290 s wall clock: Godot headless steps physics in real time and `Engine.time_scale`
cannot be used to speed it up, it scales the physics step) prints `ACC|id|PASS/FAIL|name|evidence` lines and exits 1 on any failure.
Optional filter: `-- only=<prefix>[,<prefix>...]` over the sections neck, body, knife, bat, sever, hands, feet, m3fight, m3cower, m3immortal, m3gore, m3slowmo, m3cleanup, m3react, debug, sweep, ragdoll, seams
(`only=m3` runs all milestone 3 sections, `only=hands,m3fight` two sections).
The test is part-count agnostic: it uses `BodyIds.PART_COUNT` / `BodyIds.KEYS`, and the sweep covers every part in `BodyIds.KEYS`.
Every section starts and ends with all `GameSettings` toggles (milestone 3 ones included) and `Engine.time_scale` reset to their defaults.

## 1. Test scenes

| Scene | Result | Count |
|---|---|---|
| tests/smoke_test.tscn | PASS | "SMOKE OK" |
| tests/ai_test.tscn | PASS | 55 PASS, 0 FAIL |
| tests/damage_test.tscn | PASS | 29 PASS, 0 FAIL |
| tests/body_test.tscn | PASS | 20 PASS, 0 FAIL |
| tests/pose_test.tscn | PASS | 55 PASS, 0 FAIL |
| tests/arms_test.tscn | PASS | 20 PASS, 0 FAIL |
| tests/legs_test.tscn | PASS | 29 PASS, 0 FAIL |
| tests/weapons_fx_test.tscn | PASS | 18 PASS, 0 FAIL |
| tests/limb_integration_test.tscn | PASS | 575 PASS, 0 FAIL (earlier arm frac.pose failures fixed) |
| tests/injury_consistency_test.tscn | PASS | 50 / 50 CHK (about 360 s; an earlier run mid-development had 11 failures, fixed since) |
| tests/acceptance_test.tscn | PASS | 128 / 128 checks |

## 2. Acceptance checks (all 128 from the last full run)

### Neck shot

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 1.0 | PASS | handgun ray resolves to NECK | BULLET 34.0 part=neck v=380.0m/s |
| 1.1 | PASS | neck bullet creates arterial wound | ["neck BULLET sev=0.68 ext=260.0 int=0.0 flow=0.0 ART", "neck BULLET sev=1.00 ext=60.0 int=0.0 flow=0.0 EXIT"] |
| 1.2 | PASS | neck: stumbles (CLUTCH_WOUND, still moving) before collapse | states=["0.0s:CLUTCH_WOUND", "7.2s:UNCONSCIOUS", "12.1s:DEAD"] |
| 1.2b | PASS | neck: NPC actually locomotes while clutching (>0.3 m) | moved=5.20 m |
| 1.3 | PASS | neck: dies of blood loss | dead=true t=12.1s state=DEAD |
| 1.4 | PASS | neck: death time within 10-25 s | t_death=12.1s |
| 1.5 | PASS | neck: flow pulses (oscillates 1 s window, peak/min > 1.5; 60-170 bpm) | peaks=25 over 12.1s = 124 bpm; 1s window min=90.9 max=530.3 |
| 1.6 | PASS | neck: flow tapers as blood is lost (last 2 s mean < 0.75x first 2 s mean) | first2s=317.3 last2s=112.9 ratio=0.36 |
| 1.7 | PASS | neck: corpse ragdoll sane (finite, bounded) |  |

### Body shot (panic on/off)

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 2.0 | PASS | handgun rays resolve to TORSO | BULLET 34.0 part=torso v=380.0m/s \| BULLET 34.0 part=torso v=380.0m/s |
| 2.1 | PASS | panic ON: body shot -> PANIC_FLEE | state@shot=PANIC_FLEE states seen in 2 s=["IDLE", "PANIC_FLEE"] |
| 2.2 | PASS | panic ON: NPC moves away from shooter (>2 m along fire direction in 2 s) | displacement=8.58 m (away component 8.58) |
| 2.4 | PASS | panic OFF: no PANIC_FLEE; reacts STAGGER/CLUTCH_WOUND (stands/staggers) | states seen in 2 s=["IDLE", "CLUTCH_WOUND"] first=CLUTCH_WOUND |
| 2.5 | PASS | panic OFF: NPC stays near (<2.5 m in 2 s) and exertion low (<0.5) | displacement=1.93 m max_exertion=0.30 |
| 2.3 | PASS | panic ON: collapses from blood loss later (UNCONSCIOUS/DEAD) | collapse t=45.6s state=UNCONSCIOUS level=CRITICAL vol=2485/5000 |
| 2.3b | PASS | panic ON: collapse is not instant (>10 s after the shot) | t=45.6s |
| 2.6 | PASS | panic OFF: still collapses from blood loss later | collapse t=55.4s state=UNCONSCIOUS vol=2749 |
| 2.7 | PASS | panic ON bleeds out faster than panic OFF (running raises exertion) | ON=45.6s OFF=55.4s |

### Knife

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 3.1 | PASS | knife thrust -> BLADE_STAB on torso | hits=["BLADE_STAB 20.0 part=torso v=5.0m/s"] |
| 3.2 | PASS | knife swing -> BLADE_SLASH on torso | hits=["BLADE_SLASH 23.0 part=torso v=5.7m/s", "BLADE_SLASH 25.7 part=upper_arm_r v=6.4m/s"] |
| 3.3 | PASS | stab and slash wounds both exist | stab=torso BLADE_STAB sev=0.62 ext=1.0 int=43.7 flow=1.3 slash=torso BLADE_SLASH sev=0.46 ext=4.8 int=0.0 flow=9.6 |
| 3.4 | PASS | stab vs slash wounds differ (type, internal vs external bleed) | stab ext=1.0 int=43.7 sev=0.62 depth=0.150 dirlen=1.0 \| slash ext=4.8 int=0.0 sev=0.46 dirlen=1.0 |
| 3.5 | PASS | stab = deep/internal (int > ext); slash = surface/external (int == 0, ext > stab ext) | stab int=43.7 ext=1.0 \| slash int=0.0 ext=4.8 |
| 3.6-swing | PASS | knife swing: damage scales with speed (slow < medium < fast, slow not delivered) | scale 0.15/0.5/1.0/1.5 -> amount [0.0, 11.5, 23.0, 34.4] speeds=[1.1, 2.9, 5.7, 8.6] |
| 3.6-thrust | PASS | knife thrust: damage scales with speed (slow < medium < fast, slow not delivered) | scale 0.15/0.5/1.0/1.5 -> amount [0.0, 10.0, 20.0, 30.0] speeds=[0.8, 2.5, 5.0, 7.5] |

### Bat

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 4.0 | PASS | bat swing connects with HEAD (BLUNT) | hits=["BLUNT 56.7 part=head v=17.2m/s"] |
| 4.1 | PASS | bat heavy head hit knocks down (stun >= 2 s -> UNCONSCIOUS + ragdoll) | amount=56.7 stunned=[[2.83411983870664, &"concussion"]] state=UNCONSCIOUS ragdoll=true |
| 4.1b | PASS | knocked-down NPC wakes up after the stun (not stuck) | state after 3.5 s=PANIC_FLEE |
| 4.2 | PASS | bat weak head hit does NOT knock down (stagger/stun < 2 s only) | amount=8.2 applied=true stunned=[[1.0, &"concussion"]] state=STAGGER |
| 4.3 | PASS | bat hard hit on lower arm fractures it (part.broken, is_fracture wound, part_broken signal) | amount=56.7 broken=true signal=[6] |
| 4.4 | PASS | bat soft hit on lower arm does NOT fracture (bruise only) | amount=9.4 broken=false bruise=0.08 |
| 4.6 | PASS | every melee weapon def has velocity_ref / min_velocity / max_damage_scale > 1 (data-driven velocity scaling) | melee ids=["knife", "bat"] unscaled=[] |
| 4.5 | PASS | bat damage scales with swing speed (strictly increasing; slowest ~0) | scale 0.15/0.5/1.0/1.5/2.0 -> amount [0.0, 7.6, 18.8, 31.8, 46.1] |

### Dismemberment (lower arm)

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 5.0 | PASS | limb severed (REAL knife stroke) | severed=true |
| 5.1 | PASS | severed piece is a separate RigidBody3D no longer under NpcBody | class=RigidBody3D parent=Severed_lower_arm_r_23 attached=false |
| 5.2 | PASS | piece rests on the floor (y < 0.35, speed < 0.3 after 3 s) | y=0.040 speed=0.000 sleeping=true |
| 5.3 | PASS | piece stays on npc_parts layer with npc/part_id metas (can still be hit) | layer=2 meta_npc=true |
| 5.4 | PASS | stump wound on parent part, attached (not detached) | upper_arm_r BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=74.9 STUMP |
| 5.5 | PASS | stump wound bleeding (current_flow > 0) | flow=74.94 volume=4682 |
| 5.6 | PASS | blood volume dropping after sever | 4682.5 -> 4503.3 ext_rate=87.9 |
| 5.7 | PASS | wounds on the severed piece are detached (no longer drain the body) | ["upper_arm_r BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=72.1 STUMP", "torso BLADE_SLASH sev=0.96 ext=8.8 int=0.0 flow=15.8"] |
| 5.8 | PASS | NPC itself survives the sever (not DEAD instantly, body still upright/animated or in a reaction) | state=PANIC_FLEE sane='' |

### Hands

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| H.1 | PASS | handgun ray resolves to HAND_R (BULLET) | BULLET 34.0 part=hand_r v=380.0m/s |
| H.2 | PASS | bullet through hand: hand takes damage (hp lost, or broken/severed) and a wound is recorded on HAND_R | hp=0.0/20.0 broken=true severed=false destroyed=false wounds=["hand_r BULLET sev=0.74 ext=2.0 int=0.2 flow=4.0", "hand_r BULLET sev=1.00 ext=5.0 in... |
| H.3 | PASS | hand bullet bleeds, but far less than a torso/neck shot, and the NPC is not killed outright | bleed(ext+int)=15.0 /s state=PANIC_FLEE level=NORMAL |
| H.4 | PASS | hand hit makes the NPC react (leaves IDLE) and hand loss/fracture does not make it crawl | states=["PANIC_FLEE", "STAGGER", "PANIC_FLEE"] now=PANIC_FLEE broken=[12] |
| H.4b | PASS | broken/lost right hand makes the brain treat the NPC as one-handed | usable arms=1 |
| H.5 | PASS | shot-hand NPC stays sane (finite, bounded) |  |
| H.6 | PASS | handgun ray resolves to HAND_L and damages it (mirror of H.1) | BULLET 34.0 part=hand_l v=380.0m/s hp=0.0/20.0 |
| H.7.0 | PASS | limb severed (REAL knife stroke) | severed=true |
| H.7.1 | PASS | severed piece is a separate RigidBody3D no longer under NpcBody | class=RigidBody3D parent=Severed_hand_r_26 attached=false |
| H.7.2 | PASS | piece rests on the floor (y < 0.35, speed < 0.3 after 3 s) | y=0.030 speed=0.000 sleeping=true |
| H.7.3 | PASS | piece stays on npc_parts layer with npc/part_id metas (can still be hit) | layer=2 meta_npc=true |
| H.7.4 | PASS | stump wound on parent part, attached (not detached) | lower_arm_r BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=75.8 STUMP |
| H.7.5 | PASS | stump wound bleeding (current_flow > 0) | flow=75.76 volume=4734 |
| H.7.6 | PASS | blood volume dropping after sever | 4734.0 -> 4584.9 ext_rate=73.4 |
| H.7.7 | PASS | wounds on the severed piece are detached (no longer drain the body) | ["lower_arm_r BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=73.4 STUMP"] |
| H.7.8 | PASS | NPC itself survives the sever (not DEAD instantly, body still upright/animated or in a reaction) | state=PANIC_FLEE sane='' |
| H.8 | PASS | hand sever: the held phone leaves with the severed hand (docs/DECISIONS.md) and the NPC is one-handed | phone_on_severed_hand=true one_handed=true |
| H.9 | PASS | hand sever does not make the NPC crawl or become dead | state=PANIC_FLEE |

### Feet (limp, crawl)

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| F.1 | PASS | bat swing connects with FOOT_R (BLUNT) | hits=["BLUNT 70.0 part=foot_r v=20.4m/s"] |
| F.2 | PASS | bat hard hit breaks the foot (part.broken + part_broken signal), not severed | amount=70.0 hp=2.0/30.0 broken=true signal=[14] |
| F.3 | PASS | broken foot -> brain limps on that side (limp_side 'r', not crawling) | limp_side='r' states seen=["PANIC_FLEE"] |
| F.4 | PASS | limping NPC is posed with 'limp' when it moves | poses seen=["limp"] state=PANIC_FLEE |
| F.5 | PASS | limping NPC stays sane (finite, bounded) |  |
| F.6 | PASS | bat soft hit on foot does NOT break it (no limp) | amount=11.7 broken=false |
| F.7 | PASS | foot severed -> NPC crawls (CRAWL) and the body reports the foot detached | state=CRAWL severed=true attached=["torso", "neck", "head", "upper_arm_l", "lower_arm_l", "upper_arm_r", "lower_arm_r", "upper_leg_l", "lower_leg_l... |
| F.7b | PASS | crawling NPC (foot lost) stays sane and pose is 'crawl' | sane='' pose=crawl |
| F.8.0 | PASS | limb severed (REAL knife stroke) | severed=true |
| F.8.1 | PASS | severed piece is a separate RigidBody3D no longer under NpcBody | class=RigidBody3D parent=Severed_foot_l_29 attached=false |
| F.8.2 | PASS | piece rests on the floor (y < 0.35, speed < 0.3 after 3 s) | y=0.051 speed=0.000 sleeping=true |
| F.8.3 | PASS | piece stays on npc_parts layer with npc/part_id metas (can still be hit) | layer=2 meta_npc=true |
| F.8.4 | PASS | stump wound on parent part, attached (not detached) | lower_leg_l BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=58.3 STUMP |
| F.8.5 | PASS | stump wound bleeding (current_flow > 0) | flow=58.25 volume=4550 |
| F.8.6 | PASS | blood volume dropping after sever | 4550.0 -> 4435.0 ext_rate=56.8 |
| F.8.7 | PASS | wounds on the severed piece are detached (no longer drain the body) | ["lower_leg_l BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=56.8 STUMP"] |
| F.8.8 | PASS | NPC itself survives the sever (not DEAD instantly, body still upright/animated or in a reaction) | state=CRAWL sane='' |

### M3 fight-back

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.1a | PASS | fight_back OFF: a hit aggressive NPC never enters FIGHT, never approaches the player, never hurts the player | states=["IDLE", "PANIC_FLEE"] player_hits=0 min_health=100 min_dist=3.00 aggression=1.00 |
| M3.1b | PASS | fight_back ON + aggression 1.0: hit NPC enters FIGHT | states=["IDLE", "FIGHT"] pain@hit=0.59 ev=BLADE_SLASH 18.0 part=upper_arm_l v=4.5m/s all=["BLADE_SLASH 19.9 part=torso v=5.0m/s", "BLADE_SLASH 18.0... |
| M3.1c | PASS | fighting NPC approaches the real Player (comes within 1.5 m of it) | min_dist=0.20 m |
| M3.1d | PASS | player_hit fires and the Player's HP drops (no permadeath: health stays >= 0) | player_hit x9 min_health=23.3/100 |

### M3 cower

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.2 | PASS | bystander NPC in ALERT uses the 'cower' pose | shot=BULLET 34.0 part=upper_leg_r v=380.0m/s states seen=["IDLE", "ALERT"] cower_in_alert=true pose_now=cower |
| M3.2b | PASS | cowering NPC stays sane (finite, bounded) |  |

### M3 immortal dummy

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.3a | PASS | immortal dummy: handgun HEAD shot and sever-level knife NECK slash both land (preconditions) | immortal=true head=BULLET 34.0 part=head v=380.0m/s neck=BLADE_SLASH 48.0 part=neck v=15.9m/s (real knife) can_dismember=true hits=["BLADE_SLASH 48... |
| M3.3b | PASS | immortal dummy: never DEAD / never died / no lethal report over 60 s of bleeding | dead_ticks=0 died=false lethal=false state=IDLE min_blood=0.72 |
| M3.3c | PASS | immortal dummy: head not severed or destroyed, neck not severed, parts still attached | head severed=false destroyed=false hp=9.0 \| neck severed=false hp=0.0 |
| M3.3d | PASS | immortal dummy: wounds still exist and bleed (flow > 0, volume dropped), blood floored above HEAVY (0.70) | wounds=5 max_bleed=1226/s bleed@60s=500.1/s volume after hits 4852, min fraction 0.720 |
| M3.3e | PASS | immortal dummy stays sane (finite, bounded) after 60 s |  |
| M3.3f | PASS | control: same headshot kills a normal NPC | state=DEAD |

### M3 no-dismemberment / gore intensity

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.4a | PASS | control: sever-level knife slash (can_dismember, setting off) severs the hand | ev=BLADE_SLASH 48.0 part=hand_r v=15.9m/s severed=true attached=false |
| M3.4b | PASS | no_dismemberment: the same slash does not sever (hand attached, wound still recorded) | ev=BLADE_SLASH 48.0 part=hand_r v=15.9m/s severed=false attached=true wounds_on_hand=2 |
| M3.4c | PASS | gore LOW implies no dismemberment: the same slash does not sever | ev=BLADE_SLASH 48.0 part=hand_r v=15.9m/s severed=false attached=true |
| M3.4d | PASS | gore LOW spawns fewer particles than HIGH for the same bullet (LOW < MED < HIGH) | particles HIGH=202 MED=101 LOW=24 \| wound emitters 2/2/2 \| decal cap 120/90/60 |

### M3 slow-mo on kill

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.5a | PASS | slow_mo_on_kill OFF: a kill leaves Engine.time_scale at 1.0 | dead=true min_scale=1.00 |
| M3.5b | PASS | slow_mo_on_kill ON: kill drops Engine.time_scale to slow_mo_scale (0.3) | dead=true min_scale=0.30 dropped at 0.00s real |
| M3.5c | PASS | slow-mo restores to 1.0 within about 1.6 s of real time (and lasts >= 1.0 s) | slow-mo lasted 1.51s real (drop 0.00s, restore 1.51s) |
| M3.5d | PASS | Engine.time_scale is back to 1.0 after the scene is freed | time_scale=1.00 |

### M3 auto cleanup

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.6a | PASS | auto_cleanup_time 2 s: a dead NPC is still there ~1 s after death and is freed afterwards | dead=true present@0.8s=true freed=true |
| M3.6b | PASS | auto_cleanup_time 2 s: a severed piece is freed (still present ~0.6 s after the cut) | severed=true present@0.6s=true freed=true |
| M3.6c | PASS | the living NPC the piece was cut from is not cleaned up | valid=true |

### M3 hit reaction

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| M3.7 | PASS | head hit while animated: head moves relative to the neck within 0.1 s (>= 2 deg or >= 1.5 cm) and the NPC is not ragd... | hit_tick=14105 max_rot=5.7 deg max_shift=0.075 m (idle noise before hit 0.0001) ragdoll=false state=STAGGER |

### Debug info / overlay

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 6.1 | PASS | get_debug_info() has blood volume + level | { "volume": 4948.8, "fraction": 0.99, "external_rate": 12.87, "internal_rate": 89.11, "level": "NORMAL", "heart_rate": 71.5 } |
| 6.2 | PASS | get_debug_info() has wounds list | { "count": 2, "attached": 2, "wounds": ["torso BULLET sev=0.57 ext=1.5 int=30.0 flow=3.0", "torso BULLET sev=0.85 ext=5.0 int=15.0 flow=9.9 EXIT"] } |
| 6.3 | PASS | get_debug_info() has state per NPC | state=PANIC_FLEE brain=PANIC_FLEE |
| 6.4 | PASS | get_debug_info() has body + per-part damage | part rows=15/15 (16 keys total, extra keys are counters) body=animated |
| 6.4b | PASS | every BodyIds part has a damage row and an attached body node with npc/part_id metas | missing=[] keys=15 |
| 6.5 | PASS | DebugOverlay node exists in main scene | node=Node3D |
| 6.6 | PASS | overlay text shows state, blood volume and wounds | Npc48 IDLE \| blood 5000/5000 (100%) NORMAL  ext 0.0/s int 0.0/s  hr 70 |
| 6.7 | PASS | GameSettings.debug_overlay defaults ON | true |

### Consistency sweep (all 15 parts)

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| S.1 | PASS | sweep: same bullet at all 15 parts resolves to the aimed part, no crash | [] |
| S.2 | PASS | sweep: every part leaves NPC physically sane (finite, bounded) | [] |
| S.3 | PASS | sweep: head is the most lethal part (a single 9mm head shot kills outright, no later than neck/torso) | head: hp_loss=60.0 destroyed=true end=dead@0.0s \| neck end=collapsed@7.1s \| torso end=alive \| handgun amount=34 x head dmg_mult(1.5)=51 vs head ... |
| S.4 | PASS | sweep: limb shots moderate (no instant kill, bleed rate below torso/neck, still alive at 30 s) | limb bleed range 15.0..29.8 /s; torso 100.9 /s; neck 541.1 /s |

### Ragdoll stability

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| R.1 | PASS | ragdoll (head shots -> dead): no NaN, no flying parts over 8 s (max y < 3 m, speed < 60) | dead=true max_y=0.00 max_speed=0.0  |
| R.2 | PASS | ragdoll parts stay joined (every part within 1.6 m of torso) | max dist=0.70 |
| R.3 | PASS | corpse comes to rest (torso speed < 0.2) | speed=0.000 |
| R.4 | PASS | knock-down + get-up cycle (7 s) stays finite and bounded | state=PANIC_FLEE  |

### Cross-system seams

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| X.0-grunt | PASS | 'grunt' cue has a single owning system (no duplicate emitters) | emitted from ["npc_brain.gd:360"] |
| X.0-gurgle | PASS | 'gurgle' cue has a single owning system (no duplicate emitters) | emitted from ["npc_brain.gd:362"] |
| X.0-scream | PASS | 'scream' cue has a single owning system (no duplicate emitters) | emitted from ["npc_brain.gd:365", "npc_brain.gd:454", "npc_brain.gd:543"] |
| X.1 | PASS | scream ON: a body bullet makes the NPC scream (>= 1 scream cue) | scream x1 |
| X.1b | PASS | one body bullet emits at most 1 grunt and 1 scream cue (entry+exit wound / two systems must not stack) | grunt x1 scream x1 |
| X.2 | PASS | one neck bullet emits <= 1 gurgle cue | gurgle x1 |
| X.2b | PASS | neck shot: NPC gurgles but does not scream (docs/DECISIONS.md: neck arterial = gurgle, no scream) | scream x0 gurgle x1 (the non-arterial EXIT wound on the neck re-enters NpcBrain._on_wounded and screams) |
| X.3 | PASS | scream_enabled=false: no scream cue on GameEvents.audio_cue from ANY source (head kill) | scream cues on bus=0 (head destroyed=true, state=DEAD) |
| X.5 | PASS | leg severed -> NPC crawls (CRAWL) and the body reports the part detached | state=CRAWL attached=["torso", "neck", "head", "upper_arm_l", "lower_arm_l", "upper_arm_r", "lower_arm_r", "upper_leg_l", "upper_leg_r", "lower_leg... |
| X.5b | PASS | crawling one-legged NPC stays sane (finite, bounded) |  |
| X.6 | PASS | shooting a dead NPC keeps it DEAD (no reaction/revival) and wounds still register | state=DEAD wounds=2 |

## 3. Notes

- Sweep (S.*): one 9mm bullet per part, 30 s observation. Head dies at once, neck collapses at about 7 s, torso survives 30 s.
  Hands break (hp 20) and bleed 15 /s, other limbs/feet 29.8 /s; nobody dies or crawls from one limb bullet.
- Hands/feet use real weapons. Strokes at foot level are yawed 90 degrees (`FOOT_YAW`) so they travel front to back; a lateral swing at ground level sweeps through both legs, breaks the lower leg and sends the NPC crawling instead of limping.
- H.8: the phone stays on a severed right hand (DECISIONS.md); a broken-but-attached right hand drops it instead (seen in H.1).
- M3.1: a bullet gives entry+exit wounds whose pain already exceeds `fight_enter_pain` (0.5), so the fight-back trial uses a light real knife slash (scale 0.7) instead; the stroke also nicks the torso. Aggression is pinned to 1.0 on the brain after spawn.
  The trial runs inside the real `main.tscn` (real Player in group "player", GameDirector, GoreFX) and counts `GameEvents.player_hit`; the Player regenerates, so the minimum health seen is reported.
- M3.3: the dummy is spawned with `immortal_dummy` on, then the toggle is switched off (only NPCs spawned while ON are immortal). Head shot first; the dummy is then knocked down, so the neck slash is thrown at the settled ragdoll
  (real knife, retry from the other side, weapon-equivalent event as last resort; the evidence names which one was used). A bullet fired at the fallen head from the front hits the torso first, so the order "neck slash then head shot" is not usable either.
- M3.4d counts `GoreFX.particles_spawned` over 2 s after the same torso bullet at HIGH, MED, LOW (LOW has no wound emitters, bursts x0.15).
- M3.5 polls the real clock (physics ticks are stretched by the time scale it measures). Slow-mo lasts `slow_mo_duration` (1.5 s) and `Engine.time_scale` returns to 1.0.
- M3.6 uses `auto_cleanup_time = 2`; the dead NPC and the severed hand are freed after about 2 s.
- M3.7 uses a weak real bat blow on the head (a handgun headshot kills and ragdolls at once, which would not test the animated hit reaction). Head-vs-neck local transform moves by about 5.7 degrees / 7.5 cm within 6 physics ticks of the hit; idle noise is 0.0001.
- Mid-reaction panic toggling still changes an NPC that is already clutching; the IDLE-NPC alert radius (8 m) makes sweep shots go off in one tick; lanes are 3 m apart.
- `damage.get_debug_info()` now has a non-part key `sever_dropped` (counter); check 6.4 counts only per-part rows.
- Not fixed, intermittent: three engine lines "Lambda capture at index 0 was freed" appeared in one of four full runs (sections m3immortal and m3gore, no check failed); they did not reproduce in 12 bisect runs or in the final full run.

## 4. History

v1 round 1 (review-agent) found four failures, all fixed and green since:
- **F1** `ai_test 7a` scream cue: seed-dependent pain tolerance made a fixed test wound too weak. Fixed (ai_test green).
- **F2** duplicate / mis-gated vocal cues (DamageSystem and NpcBrain both emitting, per-wound instead of per-event, scream with `scream_enabled` off, neck scream). Fixed: NpcBrain is the only vocal-cue source (X.0-*, X.1b, X.2, X.2b, X.3).
- **F3** a 9mm headshot was not lethal (51 < `lethal_damage` 55). Fixed: head `lethal_damage` 48 (S.3).
- **F4** a fracture wound was created on a limb severed by the same hit. Fixed (5.7).
Milestone 2: acceptance 68 -> 104 checks (hands, feet, 15-part sweep, 6.4b), part counts no longer hard-coded.
Milestone 3: acceptance 104 -> 128 checks (M3.1 to M3.7).
