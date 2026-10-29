# Injury consistency report

Owner: injury-consistency overseer. Test: `tests/injury_consistency_test.gd/.tscn` (read-only against every other agent's files).
Run: `godot --headless --path . res://tests/injury_consistency_test.tscn` (about 6 min wall; `-- only=table|sweep|gates|repeat|data`,
`-- out=/abs/table.tsv` writes the per-case table, `-- dump=1` prints the sweep rows). Exit code 1 while any CHK fails.
Result of the last run: **50 checks, 46 PASS, 4 FAIL** (T7.limbsgthands_feet, S3b, S3c, D5), plus 1 design observation (S4).
Nothing crashed, no NaN/inf anywhere, left and right are identical, immortal / no-dismemberment / gore-LOW gates hold for the default rules.

## Method
- Every case is a fresh `Npc.spawn()` NPC (same seed, so the same pain/aggression personality) with the real brain, blood and body running.
- **Bullet**: `HitscanWeapon.fire_ray` from `data/weapons.json` (handgun, base 34, penetration 0.45) along a real raycast onto the part.
  Intensities slow / normal / fast = muzzle velocity 120 / 250 / 380 m/s (380 is the shipped gun; damage = 34 x v/380, capped at 34).
- **Melee**: `MeleeWeapon._sweep` (the exact per-frame hit path: raycast, `_build_event`, `_deliver`) driven with a chosen tip velocity.
  Intensities slow / normal / fast = the tip speed that the scripted swing/thrust really produces at `debug_swing` speed scale 0.5 / 1.0 / 1.5,
  measured at start-up: knife thrust 2.5 / 5.0 / 7.5 m/s, knife swing 3.55 / 7.1 / 10.63 m/s, bat swing 5.12 / 10.23 / 15.33 m/s.
  The player's LMB is always scale 1.0 ("normal"); only Shift free-swing can exceed it. Knife stab vs slash is decided by the weapon code (blade axis vs velocity).
- 4 mechanisms x 16 zones (15 parts, torso split into chest / abdomen by `hit_local_normalized.y`) x 3 intensities = 192 table cases.
  Each is simulated 1 s (AI state) and 20 s (blood) with 9 m spacing so NPCs never alert each other.
- Sweeps (instant, no simulation): 4 mechanisms x 16 zones x 8-12 speeds (672 NPCs) repeated with `no_dismemberment` and with an immortal dummy.
- Gate runs use **synthetic** 500-damage overkill events (marked `weapon_id=synthetic_overkill`) because no shipped weapon reaches every threshold.

## Outcome table
Cell = `HP lost / nominal bleed mL/s (ext+int, attached wounds)  flags  AI state at 1 s  blood volume at 20 s`. Left = right for every limb (check T8), so L/R are merged.
Flags: A arterial, X exit wound, F fracture, S sever, K<s> stun seconds, LETHAL lethal_injury. `†` = DEAD at 20 s.
States: ID idle, AL alert, FL panic flee, CW clutch wound, SG stagger, CR crawl, UN unconscious, DE dead.

**BULLET (handgun, muzzle 120 / 250 / 380 m/s)**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 16/20 X,K1.9 SG 88% | 34/20 X,K2.2 UN 87% | 60/20 X,LETHAL DE 97% † |
| neck | 13/320 A,X CW 34% † | 27/320 A,X CW 34% † | 40/320 A,X CW 34% † |
| chest | 11/51.5 X FL 71% | 22/51.5 X FL 70% | 34/51.5 X FL 70% |
| abdomen | 11/33.5 X FL 80% | 22/33.5 X FL 80% | 34/33.5 X FL 80% |
| upper_arm (L=R) | 9/15 X FL 91% | 18/15 X FL 91% | 27/15 X FL 90% |
| lower_arm (L=R) | 9/15 X FL 91% | 18/15 X FL 91% | 27/15 X FL 90% |
| hand (L=R) | 14/7.5 X FL 95% | 20/7.5 X,F,K0.6 FL 95% | 20/7.5 X,F,K0.6 FL 95% |
| upper_leg (L=R) | 9/15 X FL 91% | 18/15 X FL 91% | 27/15 X FL 90% |
| lower_leg (L=R) | 9/15 X FL 91% | 18/15 X FL 91% | 27/15 X FL 90% |
| foot (L=R) | 9/15 X FL 91% | 18/15 X FL 91% | 27/15 X,F FL 90% |

**BLADE_STAB (knife thrust, tip speed 2.5/5.0/7.5 m/s)**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 14/3 K1.8 SG 98% | 27/3 K2.2 UN 98% | 40/3 K2.5 UN 98% |
| neck | 11/220 A CW 39% † | 22/220 A CW 39% † | 32/220 A CW 39% † |
| chest | 9/22.9 FL 86% | 18/44.8 CW 76% | 27/53.5 CW 72% |
| abdomen | 9/13.5 FL 91% | 18/26 CW 85% | 27/31 CW 83% |
| upper_arm (L=R) | 7/1.5 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| lower_arm (L=R) | 7/1.5 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| hand (L=R) | 12/0.8 FL 99% | 20/0.8 F,K0.6 FL 100% | 20/0.8 F,K0.6 FL 100% |
| upper_leg (L=R) | 7/1.5 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| lower_leg (L=R) | 7/1.5 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| foot (L=R) | 7/1.5 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |

**BLADE_SLASH (knife swing, tip speed 3.5/7.1/10.6 m/s)**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 17/4.6 K2.0 SG 97% | 34/6.8 K2.4 UN 95% | 60/7.5 LETHAL DE 99% † |
| neck | 14/240 A CW 38% † | 27/240 A CW 38% † | 40/240 A CW 38% † |
| chest | 11/3.9 FL 98% | 23/5.3 FL 96% | 34/6.8 CW 96% |
| abdomen | 11/4.7 FL 97% | 23/6.4 FL 96% | 34/8.1 CW 95% |
| upper_arm (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| lower_arm (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| hand (L=R) | 15/2.6 F,K0.6 FL 98% | 20/40 S,K0.6 FL 79% | 20/40 S,K0.6 FL 79% |
| upper_leg (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| lower_leg (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| foot (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/40 S CR 77% |

**BLUNT (bat swing, tip speed 5.1/10.2/15.3 m/s)**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 9/0.1 K1.0 AL 100% | 22/0.1 K1.4 SG 100% | 37/0.1 K2.4 UN 100% |
| neck | 7/0.1 SG 100% | 17/0.1 FL 100% | 29/0.1 FL 100% |
| chest | 6/0.1 K1.0 AL 100% | 14/0.1 K1.4 SG 100% | 24/0.1 K2.4 UN 100% |
| abdomen | 6/0.1 K1.0 AL 100% | 14/0.1 K1.4 SG 100% | 24/0.1 K2.4 UN 100% |
| upper_arm (L=R) | 5/0.1 SG 100% | 12/0.1 SG 100% | 20/0.1 F FL 100% |
| lower_arm (L=R) | 5/0.1 SG 100% | 12/0.1 SG 100% | 20/0.1 F FL 100% |
| hand (L=R) | 8/0 SG 100% | 19/0 F,K0.6 FL 100% | 20/0 F,K0.6 FL 100% |
| upper_leg (L=R) | 5/0.1 SG 100% | 12/0.1 SG 100% | 20/0.1 FL 100% |
| lower_leg (L=R) | 5/0.1 SG 100% | 12/0.1 SG 100% | 20/0.1 F CR 100% |
| foot (L=R) | 5/0.1 SG 100% | 12/0.1 F FL 100% | 20/0.1 F FL 100% |

### What each mechanism can reach (lowest speed found by the sweep, 1 m/s steps; bullet = muzzle velocity)
`LMB` = scripted swing at scale 1.0 (stab 5.0, slash 7.1, bat 10.2 m/s); `fast` = scale 1.5 (7.5 / 10.6 / 15.3); anything above needs Shift free-swing.

| effect | knife stab | knife slash | bat | handgun |
|---|---|---|---|---|
| head lethal | 9 (above fast thrust) | 10 (fast) | 19 (above fast) | 380 (full speed only) |
| neck sever / decapitation | never | 12 (needs free-swing; amount 45 = 11.25 m/s) | never | never |
| upper arm sever | never | 12 (free-swing) | never | never |
| lower arm sever / fracture | never / 10 | 12 / 11 | never / 13 | never / never |
| hand sever / fracture | never / 3 | 8 (LMB; binding limit is `dismember_min_velocity` 7.0) / 4 | never / 9 | never / 150 |
| thigh, shin sever | never | never (amount 70/55 > knife max 48) | never | never |
| foot sever / fracture | never / 8 | 10 (fast) / 9 | never / 11 | never / 380 |
| upper arm / thigh / shin fracture | never / never / 12 | never / never / never | 15 / 19 / 15 | never |
| chest, abdomen winded stun | - | - | 5 | - |
| neck: arterial bleed | any speed | any speed | never | any speed |

## Checks
| id | check | result |
|---|---|---|
| T1-T4, T2b | all 192 cases get an unobstructed shot, an event on the intended part, finite values in range, bodies stay sane for 20 s | PASS |
| T5-T6 | every normal/fast event is delivered and changes HP/wounds (no mechanism x part is a silent no-op) | PASS |
| T7 (5 pairs) | bullet at 380 m/s: head (lethal) > neck 320 > chest 51.5 > abdomen 33.5 > limbs 15 | PASS (4 of 5) |
| T7.limbsgthands_feet | bullet: limbs (15) > hands (7.5) **and feet (15)** | **FAIL** P1 |
| T8, T8b, T8c | left/right identical (HP, wounds, bleed, fracture, sever, stun, lethal, AI state at 1 s, blood at 20 s, data rows) | PASS |
| T9, S3 | faster never does less: table intensities and 672-NPC sweep over every mechanism x part | PASS |
| S5 | impactor mass 0.1 kg vs 9 kg at the same speed: identical injury (mass only feeds the physics impulse) | PASS |
| T10-T13 | lethal only from head/neck, stun 0..8 s and only from head/torso/hand rules, one sever notification + stump, every lethal ends DEAD | PASS |
| T14, T15 | AI state matches injury (knockdown stun, leg/foot loss crawl, foot break limps, neck artery clutches); exit wound iff bullet penetration > thickness | PASS |
| G0-G1d, G2 | no_dismemberment and gore LOW: no sever / stump / "sever" cue / "decapitated" for any mechanism x part (500-damage overkill); cuts still leave a wound | PASS |
| G3-G3f, G4, G5 | immortal: no lethal report, head never destroyed or severed, never DEAD, volume floor held 30 s of neck/head/chest bleeding, brain level <= HEAVY; control neck shot kills a mortal | PASS |
| R1, R2 | re-hitting a severed part / 8 repeated hits: one sever, one fracture, one lethal report, HP and bruise in range | PASS |
| D1-D4 | every part has injury/pain/body rows, type keys line up, high_damage_sever_mult equal in 3 files, bleed rows complete | PASS |
| S3b | monotonic sweep with `no_dismemberment` ON | **FAIL** P2 |
| S3c | monotonic sweep with an immortal dummy | **FAIL** P3 |
| D5 | every cause in npc_brain's no-scream list exists in head_neck.json | **FAIL** P4 |

## Problems (owner, location, evidence, suggested fix)
Nobody edited; owners per `docs/ARCHITECTURE.md`.

**P1 - feet bleed like thighs, hands do not (minor).** Owner legs-agent (`data/injury/legs.json` foot rows, `scripts/damage/regions/leg.gd apply()`); `limb_base.gd` is arms-agent.
Evidence: bullet/stab/slash nominal bleed is 15 / 1.5 / identical to the shin for `foot_l/r` but 7.5 / 0.75 for `hand_l/r` (arms.json `bleed_mult 0.5`, applied only in `arm.gd apply()` lines 15-18).
Spec asks hands/feet at the bottom of the bleed order; the foot ties with the limbs.
Fix: add `"bleed_mult": 0.5` to the foot rows and apply `bleed_mult` for any part that has it (move the 4 lines from `arm.gd` into `limb_base.gd`, so legs and arms share it).

**P2 - `no_dismemberment` makes a stronger cut do less.** Owners: arms-agent `scripts/damage/regions/limb_base.gd apply()` (line 28 `... and not cut_through`) plus bleed-agent `scripts/damage/damage_system.gd _apply_gates()` / `data/injury/core.json dropped_sever_wound`.
Evidence (S3b, knife slash with the gate on): hand 7 -> 8 m/s, lower arm 11 -> 12, foot 9 -> 10 all **lose the fracture** (cut-through skips it and the gate drops the sever, so the hit becomes a plain wound);
neck 11 -> 12 m/s bleed **240 -> 180** mL/s (`dropped_sever_wound.arterial_ext` 180 is below neck slash base 240 from `penetrating.json`). Same neck result under an immortal dummy (P3).
Fix: `limb_base.apply` computes `ctx.fracture` without the `not cut_through` term; `_commit` skips a fracture only when `ctx.sever` is still set after the gates (`if ctx.fracture and not ctx.sever ...`).
In `_apply_gates` use `maxf(dropped arterial_ext, ctx.tags.get("base_ext", 0))` (or keep the original wound instead of replacing it).

**P3 - immortal dummy: a lethal-strength head hit gives no stun / knockdown.** Owners: head-neck-agent `scripts/damage/regions/head.gd apply()` (lines 16-29: lethal branches never set a stun), bleed-agent `damage_system.gd _apply_gates()` (clears `lethal_cause`/`destroy` afterwards).
Evidence (S3c): head stun drops to 0 exactly where the hit would have killed: bullet 300 -> 380 m/s 2.39 s -> 0.00, slash 9 -> 10 m/s 2.70 -> 0.00, stab 8 -> 9 m/s 2.57 -> 0.00, bat 17 -> 19 m/s 2.79 -> 0.00.
The hardest hits on the training dummy's head react less than weaker ones (contract: "Wounds, FX, pain still happen").
Fix: `head.apply` always fills the stun (graze / concussion) even when it requests lethal; `_commit` emits `emit_stunned` only if no `lethal_cause` survives the gates.

**P4 - stale / inconsistent no-scream cause list (minor).** Owner ai-agent, `scripts/ai/npc_brain.gd _on_lethal()` line 452.
Evidence: list is `[head_destroyed, decapitation, headshot, decapitated]`; `decapitation` is never emitted (neck uses `decapitated`), and the other head-destroying causes `stabbed_head`, `slashed_head`, `blunt_head` (all set `ctx.destroy`) still get a death scream although the comment says "no head left to scream with".
Fix: drop `decapitation`; derive the list from data (e.g. `ai.json no_scream_causes` mirroring `head_neck.json head.lethal_causes`) or read it from a fact the damage side publishes.

**P5 - console error when a dropped phone outlives its NPC (minor).** Owner dismember-agent, `scripts/body/npc_body.gd drop_held_item()` line 466.
Evidence: 5x `Lambda capture at index 0 was freed. Passed "null" instead.` in the table run (batch freed before the 120 s timer; also happens with `auto_cleanup_time`). The lambda's `is_instance_valid` guard never runs because the engine nulls the capture first.
Fix: `timer.timeout.connect(rb.queue_free)` (a Callable on the object is dropped silently when it is freed), or parent a Timer to `rb` like the severed container does (line 431).

**P6 - DECISIONS.md vs measured reach (docs/tuning).** Owners arms-agent (`arms.json dismember`) and weapons-ui-agent (`weapons.json` knife, swing speed).
DECISIONS says "upper-arm sever threshold 45 so a full-speed knife slash can sever it" and "hand 18 (fast knife slash)". Measured: the scripted LMB slash reaches 7.1 m/s (amount 28), so it severs **hands** (yes, but only 0.1 m/s above the weapon gate `dismember_min_velocity` 7.0, and only the tip sample can: the 0.4 / 0.7 samples are slower), **feet** at fast (10.6), and **never** arms or the neck (need 11.25 m/s = Shift free-swing; knife damage cap is amount 48).
Either lower the arm/neck thresholds (e.g. 28-30 for the arms) or update DECISIONS.md; also make the hand's 18 threshold meaningful (the weapon gate, not `dismember`, decides hands today).

## Duplicated logic and hard-coded rules (grep of the rule files)
| # | decision implemented in more than one place | where | owners | risk / suggestion |
|---|---|---|---|---|
| D-1 | **Whether a cut severs**: weapon gate `can_dismember = speed > dismember_min_velocity` (`melee_weapon.gd` line 216), part threshold `ev.amount >= dismember` (`limb_base.gd wants_sever`), settings/immortal gate (`damage_system.gd _apply_gates`) | weapons-ui-agent / arms+head-neck+legs / bleed | the binding limit differs per part (hands: weapon gate, arms: amount); retuning one file silently changes reach. Express the sever speed once (e.g. rules read `ev.impactor_velocity` and drop the weapon gate) |
| D-2 | **Immortal rule** in 8 places: `_apply_gates` (2 spots), commit head-HP floor, `blood_system` floor, brain `_die`, `_on_lethal`, `_on_blood_level_changed`, `_effective_blood_level` | bleed / ai | intentional by contract, tested (G3-G5). They already drifted once (P3). Keep one helper per system, document in README |
| D-3 | **Fracture guard** `not broken and not severed` in `limb_base.apply` and again in `_commit` | arms / bleed | harmless; merge when fixing P2 |
| D-4 | **EXPLOSIVE = slash**: `_mech` map and `type_name()` default (damage_system.gd), `limb_base.is_cut`; the brain has its own `type_pain_weight.explosive` | bleed / arms / ai | three encodings of one fallback; when EXPLOSIVE is implemented they must change together |
| D-5 | **Type naming**: `type_name()` gives `stab/slash` (core, penetrating, head_neck) but the brain uses `DamageEvent.Type.keys()` lowercased (`blade_stab`) | bleed / ai | D3 passes today; a rename breaks one silently |
| D-6 | **Wound severity semantics** are produced by three mechanism formulas (bullet dmg/60, slash dmg/40, stab depth/thickness, bruise accumulation) and consumed by thresholds in four files: ai.json (`clutch_severity_min` 0.6, `limp_wound_severity_min` 0.3, `scream_severity_threshold` 0.5, `bruise_severity_max` 0.3), blood.json (`clot_max_severity` 0.35), core.json (`fracture_severity` 0.6, `dropped_sever_wound.severity` 0.8) | penetrating / bleed / ai | changing a divisor changes AI reactions and clotting with no test failing. Add a documented severity scale to CONTRACTS.md |
| D-7 | **Knockdown threshold** `ai.json knockdown_min_duration 2.0` interprets stun values produced by `head_neck.json` (1.5-3.5 graze, 1-8 concussion) and `torso.json` (winded 1-4) | ai / head-neck / torso | T14 passes; stuns land just around 2.0 (slash slow 1.97 staggers, 2.16 knocks out) |
| D-8 | **Hand pain**: `arms.json pain 2.0` is written to `ctx.tags["pain"]` (`arm.gd` line 19) but nothing reads it; the brain uses `ai.json part_pain_weight.hand_* 1.4`. Also dead tags: `drop_item`, `limp_cause`, `organ_hit` (the brain re-derives drop / limp from the signals) | arms / legs / torso / ai | dead data that looks like a tunable; delete or consume |
| D-9 | **Thresholds on different bases**: sever uses raw `ev.amount`, fracture accumulation uses `ctx.damage` (x `dmg_mult` x `type_mult`), head lethal uses `ctx.damage`, blunt fracture uses `ev.amount` | arms / legs / head-neck | slash (x0.8) and stab (x0.9) hit the HP/accumulation scale but not the sever scale; hand `dmg_mult` 1.3 raises fracture odds but not sever. State the base in each json |
| D-10 | **Tunables hard-coded in rules** (AGENT_RULES: "all tunables go in your data file"): `bullet.gd` 60.0, 0.1, 1.5, 0.2; `slash.gd` 40.0, 0.5, 1.5; `stab.gd` 0.1; `torso.gd` clamp 0.6 / 1.5; `blunt.gd` 0.05; `head.gd` default 55 | penetrating / torso / blunt / head-neck | move to `penetrating.json` / `torso.json`; they are exactly the severity formulas D-6 depends on |
| D-11 | `high_damage_sever_mult 2.0` repeated in head_neck / arms / legs | head-neck / arms / legs | by design (each rule reads only its own file); check D2 guards equality |
| D-12 | Chest vs abdomen split (`hit_local_normalized.y > 0`) lives only in `damage_system.region_of()` | bleed | no duplicate found |

## Suggestions (design-level, not failures)
1. **Bleed ignores hit strength for bullets and stabs (S4: 30 combos).** A 20 m/s bullet (1.8 damage) bleeds exactly like a 380 m/s one (neck 320 mL/s, chest 51.5, limb 15), and a 2.5 m/s stab (amount 10) bleeds like a 7.5 m/s one on neck/limbs/head; only slashes (`0.5 + severity`) and torso stabs (organ depth) scale. Scale ext/int by `clamp(amount / base_damage)` for bullets and stabs, or add a bullet `min_velocity`. Owner penetrating-agent (`bullet.gd`, `stab.gd`, `penetrating.json`).
2. **Bullet penetration does not scale with velocity** (always 0.45 m): spent bullets still make exit wounds everywhere and double the chest internal bleed. Scale `ev.penetration` by `v/velocity_ref` in `HitscanWeapon.fire_ray` (weapons-ui-agent).
3. **Head kill margin is 6 %:** 34 x `dmg_mult` 1.5 = 51 vs `lethal_damage` 48, and only at the full 380 m/s (250 m/s stuns 2.2 s into UNCONSCIOUS). A retune of `base_damage`, `dmg_mult` or `type_mult.bullet` flips the headshot. Consider a per-type lethal threshold in `head_neck.json`.
4. **HP of torso, neck and limbs has no consequence** except through fracture accumulation (150 HP torso is unreachable). Either add a "crippled" or "destroyed" rule (hp 0 -> crawl / unconscious) or lower the torso HP.
5. **Blunt to the neck does nothing special** (bat 15 m/s: 29 of 40 HP, bruise only; no stun, no gurgle) while the same hit knocks out via chest or head. A windpipe / winded stun in `head_neck.json` would fit.
6. **One bullet never breaks a long bone:** 27 HP vs `fracture_accum` 28 (forearm), 32 (shin), 35 (upper arm), 45 (thigh). Hands break from 150 m/s, feet only at 380. Pick the intent; a second shot does break them (accumulation).
7. **Head stab / slash lethality sits above the LMB range for stab:** head stab kills at 9 m/s, the scripted thrust maxes out at 7.5 (knock-out only, 2.5 s stun); slash kills at 10 m/s (fast swing).
8. **Chest and abdomen gunshots are slow killers:** at 20 s chest 70 % / abdomen 80 % blood, state already back to IDLE (panic 8-14 s, then alert 3-5 s) while internal bleeding continues (brain only reacts to blood level changes, LIGHT has no behaviour). Consider a pain/shock-driven limp or crawl for sustained internal bleeding.
9. **Sever cliff:** upper arm slash bleed jumps from 7 mL/s (11 m/s) to 180 mL/s arterial (12 m/s), and in dropped-sever mode the "deep cut" reproduces the same 180. Probably intended, but a graded stump bleed would read better.
10. **`impactor_mass` is ignored by injury** (S5): a 9 kg bat equals a 0.1 kg bat at equal speed; heavy weapons will need their own `base_damage` or a mass term in the weapon-side scaling.
