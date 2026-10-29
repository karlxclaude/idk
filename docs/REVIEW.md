# Review report (review-agent)

Run: `godot --headless --path /home/user/idk res://tests/<name>.tscn` for every scene in `tests/`.
Acceptance scene: `tests/acceptance_test.tscn` (script `tests/acceptance_test.gd`), about 150 s wall clock
(Godot headless steps physics in real time; `Engine.time_scale` is NOT usable, it scales the physics step and breaks
collisions). Optional filter: `-- only=<section>` (neck, body, knife, bat, sever, debug, sweep, ragdoll, seams).
It prints `ACC|id|PASS/FAIL|name|evidence` lines and exits 1 on any failure. The full run was repeated and gave identical results.

## 1. Test scene results

| Scene | Result | Notes |
|---|---|---|
| tests/smoke_test.tscn | PASS | |
| tests/damage_test.tscn | PASS | |
| tests/body_test.tscn | PASS | |
| tests/weapons_fx_test.tscn | PASS | 12/12 |
| tests/ai_test.tscn | **FAIL** (11/12) | `7a scream on -> scream cue`; see F1 |
| tests/acceptance_test.tscn | **FAIL** (9 of 68 checks) | 59 PASS; failures F2 to F4 below (F1 is the ai_test scene) |

## 2. Failures, owner, exact cause, suggested fix

Owners follow the file-ownership table in `docs/ARCHITECTURE.md`. Nothing outside review-agent files was edited.

### F1. tests/ai_test.tscn `7a scream on -> scream cue` (seam 1, confirmed). Owner: ai-states-agent
- File: `tests/ai_test.gd`, function `_t7`. This is test fragility, not a game bug: a real body bullet screams (acceptance X.1 PASS).
- Cause: `Npc._ready` runs `body.setup` before `brain.setup`. The real body now consumes 3 draws from `npc.rng`
  (skin variation, shirt, pants), so seed 7 gives `brain.pain_tolerance = 1.240` instead of the stub-era value
  (acceptance INFO line `seam ai_test 7a`). `_on_wounded` screams only if pain >= 0.35 or severity >= 0.5;
  the test wound is severity 0.4 so pain = 0.4/1.240 = 0.323 -> no scream.
- Fix (any one): in `_t7` use a wound of severity 0.55 (>= `scream_severity_threshold` 0.5 and < `clutch_severity_min` 0.6, so it still ends in
  PANIC_FLEE), or set `n.brain.pain_tolerance = 1.0` before emitting `wounded`. Same hardening is advisable for any other fixed-seed assertion.

### F2. Duplicate and mis-gated audio cues (seam 2, confirmed). Owners: damage-wounds-bleed-agent + ai-states-agent
Checks failing: X.0-grunt, X.0-gurgle, X.0-scream, X.1b, X.2, X.2b, X.3.
- `scripts/damage/damage_system.gd` emits vocal cues: grunt (lines 120, 146, 175, 199), gurgle (113, 139, 168), scream (260, in `_destroy_head`).
  `scripts/ai/npc_brain.gd` `_on_wounded` (lines 274, 276, 279) and `_physics_process` (386) emit the same cues. Observed on the
  `GameEvents.audio_cue` bus for ONE 9mm body bullet: `grunt, scream, grunt, scream, grunt` (grunt x3, scream x2); ONE neck bullet: gurgle x2, grunt x2, scream x1.
- Four separate problems:
  1. Two systems own the same cue (DamageSystem and NpcBrain). Suggested single owner: NpcBrain (it owns pain, `scream_enabled`, state).
  2. Per-wound emission: an entry plus exit wound both go through `_on_wounded`, so one bullet cues twice.
  3. `damage_system.gd:_destroy_head` emits `scream` unconditionally. With `GameSettings.scream_enabled = false` a head kill still puts a
     scream on `GameEvents.audio_cue` (only `AudioCues._on_cue` filters it, so any other listener would play it).
  4. Contradicts `docs/DECISIONS.md` ("Neck arterial -> ... gurgle, no scream"): the neck EXIT wound is non-arterial, so `_on_wounded` falls into
     the scream branch (severity 1.0 >= 0.5) and the NPC screams with its throat shot.
- Fix, damage-wounds-bleed-agent: delete the `npc.cue(&"grunt"/&"gurgle"/&"scream", ...)` calls in `_bullet`, `_stab`, `_slash`, `_blunt` and `_destroy_head`;
  keep the non-vocal `bone_crack` and `sever` cues.
- Fix, ai-states-agent, `NpcBrain._on_wounded`: emit vocal cues once per DamageEvent (skip them when `w.is_exit`, or remember the last `ev` and skip repeats);
  never scream when `w.part_id == BodyIds.Part.NECK` (treat the whole neck as gurgle-only, not just `is_arterial`); in `_on_lethal` emit one death `scream`
  gated on `GameSettings.scream_enabled` if a head-kill scream is wanted. Result: <= 1 grunt, <= 1 scream, <= 1 gurgle per bullet and no scream cue on the bus when the toggle is off.

### F3. A single 9mm headshot is not lethal (check S.3). Owner: damage-wounds-bleed-agent
- File: `data/injury.json` `parts.head` (`lethal_damage` 55, `dmg_mult` 1.5), used by `DamageSystem._bullet` (head branch, `dmg >= lethal_damage` -> `_destroy_head`).
- Evidence: handgun `base_damage` 34 x 1.5 = 51 < 55. Head takes 51 HP damage (9 HP left), NPC is knocked out for a few seconds via `head_graze` stun, then wakes
  (state IDLE, blood 0.84 after 30 s). Neck is deadlier (collapse at 7.2 s). Spec says heads are the most lethal part.
- Fix: lower `parts.head.lethal_damage` to about 48 (a 9mm at full velocity then kills; remember `_blunt` uses the same threshold with the 0.5 blunt
  multiplier, so a bat swing needs amount >= ~64, i.e. near the top of its speed range, to destroy the head, which seems right). Alternative: raise head `dmg_mult` to >= 1.65.

### F4. Fracture wound created on a limb severed by the same hit (check 5.7). Owner: damage-wounds-bleed-agent
- File: `scripts/damage/damage_system.gd`, function `apply`. `var detached := part.severed` is captured at line 37 BEFORE the rules run; a slash that severs the part
  (`_slash` -> `_sever`) leaves `detached == false`, so the fracture block (line 58, `_fracture(ev, part, detached)`) still runs and adds a
  `lower_arm_r ... FX` wound with `detached = false` (stays in `get_attached_wounds()`), emits `part_broken` and the `bone_crack` cue for a limb that was just cut off.
  Evidence: wounds after a real knife sever: `["upper_arm_r ... STUMP", "lower_arm_r BLADE_SLASH sev=0.60 ... FX"]`.
- Fix: add `and not part.severed` to the fracture condition (`if not part.broken and not was_fractured and not part.severed and ...`), so a part cut off by
  this hit gets no fracture wound, no `part_broken` signal and no `bone_crack` cue. (The later "sever by very high damage" block must still run after it.)

### Observations (not failures)
- Knife can only sever lower arms and the neck (max amount 2.0 x 24 = 48 vs thresholds 45/45; others need >= 55). Upper arms and legs cannot be severed by any current weapon; the leg sever check (X.5) uses a weapon-style event with amount 70.
- All limb bullets are identical (29.8 /s incl. exertion), no arterial limb wound other than stumps; "limbs moderate" holds.
- Neck bleed rate is pulsing: instantaneous total 233 to 549 /s by heart phase (sweep INFO lines differ per run for that reason).
- Panic OFF body shot goes to CLUTCH_WOUND (not STAGGER): the bullet EXIT wound has severity 0.85 >= `clutch_severity_min` 0.6. The NPC walks about 1.9 m while clutching, then staggers and idles. Within spec ("stagger/stand").
- IDLE NPCs within `alert_radius` (8 m) of any wounded NPC switch to ALERT and walk away (intended reaction; the sweep fires all shots in one tick for this reason).
- `GameSettings.panic_enabled` is read at reaction time and again by `_after_clutch` / `_get_up` / the post-stumble resume, so toggling it mid-reaction changes an NPC that is still clutching.

## 3. Acceptance results (59 PASS, 9 FAIL of 68)

Mapping to the V1 acceptance list: 1 -> section 1, 2 -> section 2, 3 -> section 3, 4 -> section 4, 5 -> section 5, 6 -> section 6, sweep/ragdoll -> S., R.

### 1. Neck shot

| ID | Result | Check | Evidence |
|---|---|---|---|
| 1.0 | **PASS** | handgun ray resolves to NECK | BULLET 34.0 part=neck v=380.0m/s |
| 1.1 | **PASS** | neck bullet creates arterial wound | ["neck BULLET sev=0.68 ext=260.0 int=0.0 flow=0.0 ART", "neck BULLET sev=1.00 ext=60.0 int=0.0 flow=0.0 EXIT"] |
| 1.2 | **PASS** | neck: stumbles (CLUTCH_WOUND, still moving) before collapse | states=["0.0s:CLUTCH_WOUND", "7.2s:UNCONSCIOUS", "12.1s:DEAD"] |
| 1.2b | **PASS** | neck: NPC actually locomotes while clutching (>0.3 m) | moved=5.18 m |
| 1.3 | **PASS** | neck: dies of blood loss | dead=true t=12.1s state=DEAD |
| 1.4 | **PASS** | neck: death time within 10-25 s | t_death=12.1s |
| 1.5 | **PASS** | neck: flow pulses (oscillates 1 s window, peak/min > 1.5; 60-170 bpm) | peaks=25 over 12.1s = 124 bpm; 1s window min=90.9 max=530.3 |
| 1.6 | **PASS** | neck: flow tapers as blood is lost (last 2 s mean < 0.75x first 2 s mean) | first2s=317.3 last2s=112.9 ratio=0.36 |
| 1.7 | **PASS** | neck: corpse ragdoll sane (finite, bounded) |  |

### 2. Body shot (panic ON / OFF)

| ID | Result | Check | Evidence |
|---|---|---|---|
| 2.0 | **PASS** | handgun rays resolve to TORSO | BULLET 34.0 part=torso v=380.0m/s / BULLET 34.0 part=torso v=380.0m/s |
| 2.1 | **PASS** | panic ON: body shot -> PANIC_FLEE | state@shot=PANIC_FLEE states seen in 2 s=["IDLE", "PANIC_FLEE"] |
| 2.2 | **PASS** | panic ON: NPC moves away from shooter (>2 m along fire direction in 2 s) | displacement=8.58 m (away component 8.58) |
| 2.4 | **PASS** | panic OFF: no PANIC_FLEE; reacts STAGGER/CLUTCH_WOUND (stands/staggers) | states seen in 2 s=["IDLE", "CLUTCH_WOUND"] first=CLUTCH_WOUND |
| 2.5 | **PASS** | panic OFF: NPC stays near (<2.5 m in 2 s) and exertion low (<0.5) | displacement=1.93 m max_exertion=0.30 |
| 2.3 | **PASS** | panic ON: collapses from blood loss later (UNCONSCIOUS/DEAD) | collapse t=43.7s state=UNCONSCIOUS level=CRITICAL vol=2424/5000 |
| 2.3b | **PASS** | panic ON: collapse is not instant (>10 s after the shot) | t=43.7s |
| 2.6 | **PASS** | panic OFF: still collapses from blood loss later | collapse t=55.9s state=UNCONSCIOUS vol=2749 |
| 2.7 | **PASS** | panic ON bleeds out faster than panic OFF (running raises exertion) | ON=43.7s OFF=55.9s |

### 3. Knife stab vs slash, speed scaling

| ID | Result | Check | Evidence |
|---|---|---|---|
| 3.1 | **PASS** | knife thrust -> BLADE_STAB on torso | hits=["BLADE_STAB 20.0 part=torso v=5.0m/s"] |
| 3.2 | **PASS** | knife swing -> BLADE_SLASH on torso | hits=["BLADE_SLASH 23.0 part=torso v=5.7m/s", "BLADE_SLASH 25.7 part=upper_arm_r v=6.4m/s"] |
| 3.3 | **PASS** | stab and slash wounds both exist | stab=torso BLADE_STAB sev=0.62 ext=1.0 int=43.7 flow=1.3 slash=torso BLADE_SLASH sev=0.46 ext=4.8 int=0.0 flow=9.6 |
| 3.4 | **PASS** | stab vs slash wounds differ (type, internal vs external bleed) | stab ext=1.0 int=43.7 sev=0.62 depth=0.150 dirlen=1.0 / slash ext=4.8 int=0.0 sev=0.46 dirlen=1.0 |
| 3.5 | **PASS** | stab = deep/internal (int > ext); slash = surface/external (int == 0, ext > stab ext) | stab int=43.7 ext=1.0 / slash int=0.0 ext=4.8 |
| 3.6-swing | **PASS** | knife swing: damage scales with speed (slow < medium < fast, slow not delivered) | scale 0.15/0.5/1.0/1.5 -> amount [0.0, 11.5, 23.0, 34.4] speeds=[1.1, 2.9, 5.7, 8.6] |
| 3.6-thrust | **PASS** | knife thrust: damage scales with speed (slow < medium < fast, slow not delivered) | scale 0.15/0.5/1.0/1.5 -> amount [0.0, 10.0, 20.0, 30.0] speeds=[0.8, 2.5, 5.0, 7.5] |

### 4. Bat knock-down / fracture, speed scaling

| ID | Result | Check | Evidence |
|---|---|---|---|
| 4.0 | **PASS** | bat swing connects with HEAD (BLUNT) | hits=["BLUNT 56.7 part=head v=17.2m/s"] |
| 4.1 | **PASS** | bat heavy head hit knocks down (stun >= 2 s -> UNCONSCIOUS + ragdoll) | amount=56.7 stunned=[[2.83411983870664, &"concussion"]] state=UNCONSCIOUS ragdoll=true |
| 4.1b | **PASS** | knocked-down NPC wakes up after the stun (not stuck) | state after 3.5 s=PANIC_FLEE |
| 4.2 | **PASS** | bat weak head hit does NOT knock down (stagger/stun < 2 s only) | amount=8.2 applied=true stunned=[[1.0, &"concussion"]] state=STAGGER |
| 4.3 | **PASS** | bat hard hit on lower arm fractures it (part.broken, is_fracture wound, part_broken signal) | amount=56.7 broken=true signal=[6] |
| 4.4 | **PASS** | bat soft hit on lower arm does NOT fracture (bruise only) | amount=9.4 broken=false bruise=0.08 |
| 4.6 | **PASS** | every melee weapon def has velocity_ref / min_velocity / max_damage_scale > 1 (data-driven velocity scaling) | melee ids=["knife", "bat"] unscaled=[] |
| 4.5 | **PASS** | bat damage scales with swing speed (strictly increasing; slowest ~0) | scale 0.15/0.5/1.0/1.5/2.0 -> amount [0.0, 7.6, 18.8, 31.8, 46.1] |

### 5. Limb severed

| ID | Result | Check | Evidence |
|---|---|---|---|
| 5.0 | **PASS** | limb severed (REAL knife stroke) | severed=true |
| 5.1 | **PASS** | severed piece is a separate RigidBody3D no longer under NpcBody | class=RigidBody3D parent=Severed_lower_arm_r_23 attached=false |
| 5.2 | **PASS** | piece rests on the floor (y < 0.35, speed < 0.3 after 3 s) | y=0.025 speed=0.000 sleeping=true |
| 5.3 | **PASS** | piece stays on npc_parts layer with npc/part_id metas (can still be hit) | layer=2 meta_npc=true |
| 5.4 | **PASS** | stump wound on parent part, attached (not detached) | upper_arm_r BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=75.8 STUMP |
| 5.5 | **PASS** | stump wound bleeding (current_flow > 0) | flow=75.82 volume=4738 |
| 5.6 | **PASS** | blood volume dropping after sever | 4737.8 -> 4588.5 ext_rate=73.4 |
| 5.7 | **FAIL** | wounds on the severed piece are detached (no longer drain the body) | ["upper_arm_r BLADE_SLASH sev=1.00 ext=40.0 int=0.0 flow=73.4 STUMP", "lower_arm_r BLADE_SLASH sev=0.60 ext=0.0 int=0.0 flow=0.0 FX"] |
| 5.8 | **PASS** | NPC itself survives the sever (not DEAD instantly, body still upright/animated or in a reaction) | state=PANIC_FLEE sane='' |

### 6. Debug info and overlay

| ID | Result | Check | Evidence |
|---|---|---|---|
| 6.1 | **PASS** | get_debug_info() has blood volume + level | { "volume": 4948.8, "fraction": 0.99, "external_rate": 12.87, "internal_rate": 89.11, "level": "NORMAL", "heart_rate": 71.5 } |
| 6.2 | **PASS** | get_debug_info() has wounds list | { "count": 2, "attached": 2, "wounds": ["torso BULLET sev=0.57 ext=1.5 int=30.0 flow=3.0", "torso BULLET sev=0.85 ext=5.0 int=15.0 flow=9.9 EXIT"] } |
| 6.3 | **PASS** | get_debug_info() has state per NPC | state=PANIC_FLEE brain=PANIC_FLEE |
| 6.4 | **PASS** | get_debug_info() has body + per-part damage | parts=11 body=animated |
| 6.5 | **PASS** | DebugOverlay node exists in main scene | node=Node3D |
| 6.6 | **PASS** | overlay text shows state, blood volume and wounds | Npc25 IDLE / blood 5000/5000 (100%) NORMAL  ext 0.0/s int 0.0/s  hr 70 |
| 6.7 | **PASS** | GameSettings.debug_overlay defaults ON | true |

### Consistency sweep (same 9mm at every part)

| ID | Result | Check | Evidence |
|---|---|---|---|
| S.1 | **PASS** | sweep: same bullet at all 11 parts resolves to the aimed part, no crash | [] |
| S.2 | **PASS** | sweep: every part leaves NPC physically sane (finite, bounded) | [] |
| S.3 | **FAIL** | sweep: head is the most lethal part (a single 9mm head shot kills outright, no later than neck/torso) | head: hp_loss=51.0 destroyed=false end=alive / neck end=collapsed@7.2s / torso end=alive / handgun amount=34 x head dmg_mult(1.5)=51 vs head lethal_damage=55.0 |
| S.4 | **PASS** | sweep: limb shots moderate (no instant kill, bleed rate below torso/neck, still alive at 30 s) | limb bleed range 29.8..29.8 /s; torso 100.9 /s; neck 233.2 /s |

### Ragdoll stability

| ID | Result | Check | Evidence |
|---|---|---|---|
| R.1 | **PASS** | ragdoll (head shots -> dead): no NaN, no flying parts over 8 s (max y < 3 m, speed < 60) | dead=true max_y=0.00 max_speed=0.0  |
| R.2 | **PASS** | ragdoll parts stay joined (every part within 1.6 m of torso) | max dist=0.70 |
| R.3 | **PASS** | corpse comes to rest (torso speed < 0.2) | speed=0.000 |
| R.4 | **PASS** | knock-down + get-up cycle (7 s) stays finite and bounded | state=PANIC_FLEE  |

### Cross-system seams

| ID | Result | Check | Evidence |
|---|---|---|---|
| X.0-grunt | **FAIL** | 'grunt' cue has a single owning system (no duplicate emitters) | emitted from ["damage_system.gd:120", "damage_system.gd:146", "damage_system.gd:175", "damage_system.gd:199", "npc_brain.gd:274"] |
| X.0-gurgle | **FAIL** | 'gurgle' cue has a single owning system (no duplicate emitters) | emitted from ["damage_system.gd:113", "damage_system.gd:139", "damage_system.gd:168", "npc_brain.gd:276"] |
| X.0-scream | **FAIL** | 'scream' cue has a single owning system (no duplicate emitters) | emitted from ["damage_system.gd:260", "npc_brain.gd:279", "npc_brain.gd:386"] |
| X.1 | **PASS** | scream ON: a body bullet makes the NPC scream (>= 1 scream cue) | scream x2 |
| X.1b | **FAIL** | one body bullet emits at most 1 grunt and 1 scream cue (entry+exit wound / two systems must not stack) | grunt x3 scream x2 |
| X.2 | **FAIL** | one neck bullet emits <= 1 gurgle cue | gurgle x2 |
| X.2b | **FAIL** | neck shot: NPC gurgles but does not scream (docs/DECISIONS.md: neck arterial = gurgle, no scream) | scream x1 gurgle x2 (the non-arterial EXIT wound on the neck re-enters NpcBrain._on_wounded and screams) |
| X.3 | **FAIL** | scream_enabled=false: no scream cue on GameEvents.audio_cue from ANY source (head kill) | scream cues on bus=1 (head destroyed=true, state=DEAD) |
| X.5 | **PASS** | leg severed -> NPC crawls (CRAWL) and the body reports the part detached | state=CRAWL attached=["torso", "neck", "head", "upper_arm_l", "lower_arm_l", "upper_arm_r", "lower_arm_r", "upper_leg_l", "upper_leg_r", "lower_leg_r"] |
| X.5b | **PASS** | crawling one-legged NPC stays sane (finite, bounded) |  |
| X.6 | **PASS** | shooting a dead NPC keeps it DEAD (no reaction/revival) and wounds still register | state=DEAD wounds=2 |

Sweep detail (single 9mm, 34 damage, per part, observed 30 s; `INFO|sweep` lines): head: 51 HP loss, knocked out, then alive; neck: collapse at 7.2 s, dead soon after;
torso: panic, blood 0.64 at 30 s (collapses at about 44 s); each of 8 limb parts: 27.2 HP loss, 29.8 /s total bleed, alive at 0.88 blood. No NaN, no part outside bounds, ragdoll parts stay within 0.70 m of the torso and rest (speed 0.000).
