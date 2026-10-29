# Review report (systems-review-agent)

State: milestone 2 (15 body parts, limp pose, injury pipeline). All test scenes green. Nothing outside the review-owned files was edited.

Run any scene with `godot --headless --path /home/user/idk res://tests/<name>.tscn` (run `--import` once after adding `class_name` scripts).
The acceptance scene (`tests/acceptance_test.tscn`, about 175 s wall clock: Godot headless steps physics in real time and `Engine.time_scale`
cannot be used, it scales the physics step) prints `ACC|id|PASS/FAIL|name|evidence` lines and exits 1 on any failure.
Optional filter: `-- only=<section>` (neck, body, knife, bat, sever, hands, feet, debug, sweep, ragdoll, seams).
The test is part-count agnostic: it uses `BodyIds.PART_COUNT` / `BodyIds.KEYS`, and the sweep covers every part in `BodyIds.KEYS`
(head, neck, torso first, then the rest in enum order), so a new part joins the sweep and checks 6.4 / 6.4b / S.1 automatically.

## 1. Test scenes

| Scene | Result | Count |
|---|---|---|
| tests/smoke_test.tscn | PASS | "SMOKE OK" |
| tests/ai_test.tscn | PASS | 30 PASS lines, 0 FAIL |
| tests/damage_test.tscn | PASS | 16 / 16 |
| tests/body_test.tscn | PASS | 16 / 16 |
| tests/pose_test.tscn | PASS | 31 / 31 (fails=0) |
| tests/arms_test.tscn | PASS | 20 / 20 |
| tests/legs_test.tscn | PASS | 28 / 28 |
| tests/weapons_fx_test.tscn | PASS | 12 / 12 |
| tests/acceptance_test.tscn | PASS | 104 / 104 checks |

`tests/limb_integration_test.*` belongs to the limb-integration overseer and is not covered here.

## 2. Acceptance checks (all 104 from the last full run)

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
| 2.3 | PASS | panic ON: collapses from blood loss later (UNCONSCIOUS/DEAD) | collapse t=43.7s state=UNCONSCIOUS level=CRITICAL vol=2424/5000 |
| 2.3b | PASS | panic ON: collapse is not instant (>10 s after the shot) | t=43.7s |
| 2.6 | PASS | panic OFF: still collapses from blood loss later | collapse t=55.9s state=UNCONSCIOUS vol=2749 |
| 2.7 | PASS | panic ON bleeds out faster than panic OFF (running raises exertion) | ON=43.7s OFF=55.9s |

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

### Debug info / overlay

| ID | Result | Check | Evidence (last run) |
|---|---|---|---|
| 6.1 | PASS | get_debug_info() has blood volume + level | { "volume": 4948.8, "fraction": 0.99, "external_rate": 12.87, "internal_rate": 89.11, "level": "NORMAL", "heart_rate": 71.5 } |
| 6.2 | PASS | get_debug_info() has wounds list | { "count": 2, "attached": 2, "wounds": ["torso BULLET sev=0.57 ext=1.5 int=30.0 flow=3.0", "torso BULLET sev=0.85 ext=5.0 int=15.0 flow=9.9 EXIT"] } |
| 6.3 | PASS | get_debug_info() has state per NPC | state=PANIC_FLEE brain=PANIC_FLEE |
| 6.4 | PASS | get_debug_info() has body + per-part damage | parts=15/15 body=animated |
| 6.4b | PASS | every BodyIds part has a damage row and an attached body node with npc/part_id metas | missing=[] keys=15 |
| 6.5 | PASS | DebugOverlay node exists in main scene | node=Node3D |
| 6.6 | PASS | overlay text shows state, blood volume and wounds | Npc31 IDLE \| blood 5000/5000 (100%) NORMAL  ext 0.0/s int 0.0/s  hr 70 |
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
| X.0-grunt | PASS | 'grunt' cue has a single owning system (no duplicate emitters) | emitted from ["npc_brain.gd:319"] |
| X.0-gurgle | PASS | 'gurgle' cue has a single owning system (no duplicate emitters) | emitted from ["npc_brain.gd:321"] |
| X.0-scream | PASS | 'scream' cue has a single owning system (no duplicate emitters) | emitted from ["npc_brain.gd:324", "npc_brain.gd:399", "npc_brain.gd:470"] |
| X.1 | PASS | scream ON: a body bullet makes the NPC scream (>= 1 scream cue) | scream x1 |
| X.1b | PASS | one body bullet emits at most 1 grunt and 1 scream cue (entry+exit wound / two systems must not stack) | grunt x1 scream x1 |
| X.2 | PASS | one neck bullet emits <= 1 gurgle cue | gurgle x1 |
| X.2b | PASS | neck shot: NPC gurgles but does not scream (docs/DECISIONS.md: neck arterial = gurgle, no scream) | scream x0 gurgle x1 (the non-arterial EXIT wound on the neck re-enters NpcBrain._on_wounded and screams) |
| X.3 | PASS | scream_enabled=false: no scream cue on GameEvents.audio_cue from ANY source (head kill) | scream cues on bus=0 (head destroyed=true, state=DEAD) |
| X.5 | PASS | leg severed -> NPC crawls (CRAWL) and the body reports the part detached | state=CRAWL attached=["torso", "neck", "head", "upper_arm_l", "lower_arm_l", "upper_arm_r", "lower_arm_r", "upper_leg_l", "upper_leg_r", "lower_leg... |
| X.5b | PASS | crawling one-legged NPC stays sane (finite, bounded) |  |
| X.6 | PASS | shooting a dead NPC keeps it DEAD (no reaction/revival) and wounds still register | state=DEAD wounds=2 |

## 3. Notes

- Sweep (S.*): one 9mm bullet per part, 30 s observation. Head dies at once, neck collapses at about 7 s, torso survives 30 s at 0.64 blood.
  Limb bleed 15.0 /s (hands, bleed x0.5) to 29.8 /s (all other limbs/feet); hands and feet break (hand hp 20, foot hp 30) but nobody dies or crawls from a single limb bullet.
- Hands/feet use real weapons: handgun for H.1/H.6, knife swing (scale 2.5) for H.7 and F.7, bat swing (scale 2.0) for F.1/F.2. Strokes at foot level are yawed 90 degrees
  (`FOOT_YAW`) so they travel front to back; a lateral swing at ground level sweeps through both legs, hits `lower_leg` too, breaks it and sends the NPC crawling instead of limping.
- H.8 documents the design choice that the phone stays on the severed right hand (DECISIONS.md); a broken-but-attached right hand drops it instead (`drop_held_item`, seen in H.1).
- Limp is verified at brain level (`get_limp_side() == "r"`, `is_limping()`) and at pose level (`body.get_debug_info().pose == "limp"` while the NPC flees), see F.3/F.4.
- Mid-reaction panic toggling still changes an NPC that is already clutching (`_after_clutch`/`_get_up`/post-stumble resume read `panic_enabled`); the body test (section 2) flips it only before the shots.
- IDLE NPCs within `alert_radius` (8 m) of a wounded NPC turn ALERT and walk away (intended); the sweep fires all shots in one physics tick for this reason, and lanes are 3 m apart.
- Fixed-seed assertions elsewhere are fragile if `npc.rng` draw order changes (this caused F1 in round 1); the acceptance test avoids seed-dependent thresholds.

## 4. History

v1 round 1 (review-agent) found four failures, all since fixed and now green:
- **F1** `ai_test 7a` scream cue: seed-dependent pain tolerance made a fixed test wound too weak. Fixed (ai_test now green, 30 PASS).
- **F2** duplicate / mis-gated vocal cues (grunt/gurgle/scream emitted by DamageSystem and NpcBrain, per-wound instead of per-event, scream with `scream_enabled` off, neck scream).
  Fixed: NpcBrain is the only vocal-cue source, once per DamageEvent, never a neck scream (acceptance X.0-*, X.1b, X.2, X.2b, X.3).
- **F3** a 9mm headshot was not lethal (51 < `lethal_damage` 55). Fixed: head `lethal_damage` 48 (acceptance S.3).
- **F4** a fracture wound was created on a limb severed by the same hit. Fixed (acceptance 5.7 PASS).
Milestone 2 changes to this document: acceptance extended from 68 to 104 checks (hands, feet, 15-part sweep, 6.4b part-table check), part counts no longer hard-coded.
