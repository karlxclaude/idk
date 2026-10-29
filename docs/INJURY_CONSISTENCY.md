# Injury consistency report

Owner: injury-consistency overseer. Test: `tests/injury_consistency_test.gd/.tscn` (read-only against every other agent's files).
Run: `godot --headless --path . res://tests/injury_consistency_test.tscn` (about 13 min wall; `-- only=table|wtable|sweep|chunks|gates|repeat|data`,
`-- out=/abs/table.tsv` writes the per-case tables (`_w.tsv` for the milestone 5 weapons), `-- dump=1` prints every sweep row). Exit code 1 while any CHK fails.
Result of the last full run (milestone 5 code): **91 checks, 90 PASS, 1 FAIL** (S6b, shotgun bleed ignores range) and 3 design observations (SUG: shotgun-blast
lethality order, W18 point-blank head blast). No crash, no NaN/inf, left = right, all gates hold, every monotonic sweep passes (default, `no_dismemberment`, immortal).
Nothing was timing-sensitive; no check needed a rerun.

## Resolved since the first report
All five findings of the first report were fixed by their owners and are now guarded by passing checks: feet bleed < limbs (T7), `no_dismemberment`
fracture / neck-bleed cliffs (S3b), immortal head knockdown (S3c, `core.json immortal_lethal_knockdown`), stale no-scream cause (D5), dropped-phone timer error (no
`Lambda capture` message in the 13 min run). Bleed now scales with hit strength (S4 passes: bullets by energy per caliber, stabs by amount). The knife's
`dismember_min_velocity` was lowered 7.0 -> 6.0 and the machete covers the arm / neck / leg severs (see reach table), so the earlier DECISIONS mismatch only remains for the knife.

## Method
- Every case is a fresh `Npc.spawn()` NPC (same seed, so the same pain/aggression personality) with the real brain, blood and body running.
- **Hitscan** (`handgun`, `rifle`, `shotgun`): `HitscanWeapon.fire_ray` from `data/weapons.json`, a real raycast onto the part, real energy / pellets / pass-through.
  Handgun intensity = muzzle 120 / 250 / 380 m/s (380 shipped), rifle 450 / 700 / 900 (900 shipped), energy = 1/2 m v^2 (58 / 250 / 578 J and 405 / 980 / 1620 J).
  Shotgun has one muzzle velocity, so slow / normal / fast = **range 14 / 7 / 2 m** (falloff 4-25 m). `shotgun_pellet` = a single pellet (`pellets` forced to 1, no spread);
  `shotgun_shot` = the whole 9-pellet blast with its 4 deg spread (seeded), results summed over the whole NPC.
- **Melee** (`knife`, `machete`, `bat`, `hammer`): `MeleeWeapon._sweep` (the per-frame hit path: raycast, `_build_event`, `_deliver`) driven with a tip velocity.
  slow / normal / fast = tip speed that the scripted swing / thrust really produces at `debug_swing` scale 0.5 / 1.0 / 1.5 (measured at start-up):
  knife thrust 2.5 / 5.0 / 7.5 m/s, knife swing 3.55 / 7.1 / 10.63, machete thrust 2.1 / 4.3 / 6.4, machete swing 4.7 / 9.3 / 13.9, bat 5.1 / 10.2 / 15.3, hammer 3.7 / 7.4 / 11.1.
  Player LMB is always scale 1.0 ("normal"); only Shift free-swing exceeds it. Stab vs slash is chosen by the weapon code (blade axis vs velocity).
- Table: 10 weapon families x 16 zones (15 parts, torso split into chest / abdomen) x 3 intensities = 480 cases, each simulated 1 s (AI state) and 20 s (blood),
  lanes arranged so shots and pierced rifle rounds never cross another NPC. Sweeps (instant, same-tick read): every family x 16 zones x 8-15 speeds, and x 4 head
  chunk zones, repeated with `no_dismemberment` and with an immortal dummy (about 4000 fresh NPCs). Extra sweeps: shotgun range, bat / hammer mass and contact area.
- Head chunk zones are aimed at their centres in head-local space (jaw: front, low; face: front; cranium: from above; occiput: from behind) and verified with
  `BodyIds.head_chunk_from_local` before every shot.
- Gate runs use **synthetic** 500-damage overkill events (`weapon_id=synthetic_overkill`, 5000 J for bullets) because no shipped weapon reaches every threshold.

## Outcome tables
Cell = `HP lost / nominal bleed mL/s (ext+int of attached wounds)  flags  AI state at 1 s  blood volume at 20 s`. Left = right for every limb (checks T8 / W8), so L/R are merged.
Flags: A arterial, X exit wound, F fracture, S sever, K<s> stun seconds, c:<chunks> head chunks destroyed, LETHAL lethal_injury, P<n> pellets on the aimed part.
`†` = DEAD at 20 s. States: ID idle, AL alert, FL panic flee, CW clutch wound, SG stagger, CR crawl, UN unconscious, DE dead.
The "HP lost" of the whole-blast table is the whole NPC (a scattered blast wounds neighbouring parts too).

**handgun 9mm, muzzle 120 / 250 / 380 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 16/9.5 X,K1.9 SG 94% | 34/39.7 X,K6.0,c:face UN 79% | 60/50 X,K6.0,c:face,LETHAL DE 93% † |
| neck | 13/101.1 A,X CW 59% | 27/210.5 A,X CW 39% † | 40/320 A,X CW 34% † |
| chest | 11/16.3 X FL 90% | 22/33.9 X FL 80% | 34/51.5 X FL 70% |
| abdomen | 11/10.6 X FL 93% | 22/22 X FL 86% | 34/33.5 X FL 80% |
| upper_arm (L=R) | 9/4.7 X FL 97% | 18/9.9 X FL 94% | 27/15 X FL 90% |
| lower_arm (L=R) | 9/4.7 X FL 97% | 18/9.9 X FL 94% | 27/15 X FL 90% |
| hand (L=R) | 14/2.4 X FL 98% | 20/4.9 X,F,K0.6 FL 97% | 20/7.5 X,F,K0.6 FL 95% |
| upper_leg (L=R) | 9/4.7 X FL 97% | 18/9.9 X FL 94% | 27/15 X FL 90% |
| lower_leg (L=R) | 9/4.7 X FL 97% | 18/9.9 X FL 94% | 27/15 X FL 90% |
| foot (L=R) | 9/2.8 X FL 98% | 18/5.9 X FL 96% | 27/9 X,F FL 94% |

**knife thrust, tip speed 2.5/5.0/7.5 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 14/2.2 K1.8 SG 98% | 27/4.5 K2.2 UN 97% | 40/4.5 K2.5 UN 97% |
| neck | 11/110 A CW 56% | 22/220 A CW 39% † | 32/220 A CW 39% † |
| chest | 9/22.4 FL 86% | 18/44.8 CW 76% | 27/53.5 CW 72% |
| abdomen | 9/13 FL 92% | 18/26 CW 85% | 27/31 CW 83% |
| upper_arm (L=R) | 7/0.8 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| lower_arm (L=R) | 7/0.8 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| hand (L=R) | 12/0.4 FL 100% | 20/0.8 F,K0.6 FL 100% | 20/0.8 F,K0.6 FL 100% |
| upper_leg (L=R) | 7/0.8 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| lower_leg (L=R) | 7/0.8 FL 99% | 14/1.5 FL 99% | 22/1.5 FL 99% |
| foot (L=R) | 7/0.5 FL 100% | 14/0.9 FL 99% | 22/0.9 FL 99% |

**knife swing, tip speed 3.5/7.1/10.6 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 17/6.9 K2.0 SG 95% | 34/10.1 K2.4 UN 93% | 60/31.2 K6.0,c:face,LETHAL DE 96% † |
| neck | 14/240 A CW 38% † | 27/240 A CW 38% † | 40/240 A CW 38% † |
| chest | 11/3.9 FL 98% | 23/5.3 FL 96% | 34/6.8 CW 96% |
| abdomen | 11/4.7 FL 97% | 23/6.4 FL 96% | 34/8.1 CW 95% |
| upper_arm (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| lower_arm (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| hand (L=R) | 15/2.6 F,K0.6 FL 98% | 20/40 S,K0.6 FL 79% | 20/40 S,K0.6 FL 79% |
| upper_leg (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| lower_leg (L=R) | 9/4.4 FL 98% | 18/5.7 FL 96% | 27/7.1 FL 95% |
| foot (L=R) | 9/2.6 FL 99% | 18/3.4 FL 98% | 27/40 S CR 77% |

**bat swing, tip speed 5.1/10.2/15.3 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 9/0.1 K1.0 AL 100% | 21/0.1 K1.1 SG 100% | 36/0.1 K2.5 UN 100% |
| neck | 7/0.1 SG 100% | 17/0.1 FL 100% | 29/0.1 FL 100% |
| chest | 6/0.1 K1.0 AL 100% | 14/0.1 K1.4 SG 100% | 24/0.1 K2.4 UN 100% |
| abdomen | 6/0.1 K1.0 AL 100% | 14/0.1 K1.4 SG 100% | 24/0.1 K2.4 UN 100% |
| upper_arm (L=R) | 5/0.1 SG 100% | 11/0.1 SG 100% | 19/0.1 F FL 100% |
| lower_arm (L=R) | 5/0.1 SG 100% | 11/0.1 SG 100% | 19/0.1 F FL 100% |
| hand (L=R) | 8/0 SG 100% | 19/0 F,K0.6 FL 100% | 20/0 F,K0.6 FL 100% |
| upper_leg (L=R) | 5/0.1 SG 100% | 11/0.1 SG 100% | 19/0.1 F CR 100% |
| lower_leg (L=R) | 5/0.1 SG 100% | 11/0.1 SG 100% | 19/0.1 F CR 100% |
| foot (L=R) | 5/0 SG 100% | 11/0 F FL 100% | 19/0 F FL 100% |

**rifle 5.56, muzzle 450 / 700 / 900 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 45/45.8 X,K6.0,c:face UN 77% | 60/60.1 X,K6.0,c:face,LETHAL DE 92% † | 60/83.5 X,K6.0,c:face+cranium,LETHAL DE 89% † |
| neck | 36/210.9 A,X CW 39% † | 40/328 A,X CW 33% † | 40/421.7 A,X CW 29% † |
| chest | 30/42.4 X FL 75% | 47/65.9 X CW 66% | 60/84.7 X CW 59% |
| abdomen | 30/27.7 X FL 83% | 47/43.1 X CW 76% | 60/55.4 X CW 71% |
| upper_arm (L=R) | 24/13 X FL 92% | 37/20.2 X,F FL 87% | 48/25.9 X,F FL 84% |
| lower_arm (L=R) | 24/13 X FL 92% | 37/20.2 X,F FL 87% | 48/25.9 X,F FL 84% |
| hand (L=R) | 20/6.5 X,F,K0.6 FL 96% | 20/10.1 X,F,K0.6 FL 94% | 20/13 X,F,K0.6 FL 92% |
| upper_leg (L=R) | 24/13 X FL 92% | 37/20.2 X FL 87% | 48/25.9 X,F CR 85% |
| lower_leg (L=R) | 24/13 X FL 92% | 37/20.2 X,F CR 88% | 48/25.9 X,F CR 85% |
| foot (L=R) | 24/7.8 X,F FL 95% | 30/12.1 X,F FL 92% | 30/15.6 X,F FL 90% |

**shotgun, ONE pellet, range 14 / 7 / 2 m (slow / normal / fast)**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 9/2.7 K1.7 SG 99% | 14/2.7 K1.8 SG 99% | 16/2.7 K1.9 SG 99% |
| neck | 8/108 A,X CW 57% | 12/108 A,X CW 57% | 13/108 A,X CW 57% |
| chest | 6/8 FL 95% | 10/8 FL 95% | 11/8 FL 95% |
| abdomen | 6/5 FL 97% | 10/5 FL 97% | 11/5 FL 97% |
| upper_arm (L=R) | 5/6.6 X FL 96% | 8/6.6 X FL 96% | 9/6.6 X FL 96% |
| lower_arm (L=R) | 5/6.6 X FL 96% | 8/6.6 X FL 96% | 9/6.6 X FL 96% |
| hand (L=R) | 8/3.3 X FL 98% | 12/3.3 X FL 98% | 14/3.3 X,F,K0.6 FL 98% |
| upper_leg (L=R) | 5/1.3 FL 99% | 8/1.3 FL 99% | 9/1.3 FL 99% |
| lower_leg (L=R) | 5/6.6 X FL 96% | 8/6.6 X FL 96% | 9/6.6 X FL 96% |
| foot (L=R) | 5/3.9 X FL 97% | 8/3.9 X FL 97% | 9/3.9 X FL 97% |

**shotgun, WHOLE blast (9 pellets, 4 deg spread), range 14 / 7 / 2 m; cells sum every wound on the NPC, P = pellets on the aimed part**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 11/6.3 P0 FL 96% | 66/37.1 X,K1.8,P2 FL 79% | 66/174.2 A,X,K6.0,c:jaw+face,P5 UN 43% |
| neck | 21/9 K1.7,P0 SG 95% | 48/64.6 X,K2.5,c:jaw,P0 UN 67% | 70/247.8 A,X,P2 CW 37% † |
| chest | 6/8 P1 FL 95% | 61/34 X,P5 FL 80% | 99/71.5 P9 FL 62% |
| abdomen | 13/12.9 P2 FL 92% | 39/14.5 X,P2 FL 91% | 99/44.5 P9 FL 74% |
| upper_arm (L=R) | 11/9.3 P0 FL 94% | 59/32.7 X,P1 FL 80% | 77/56.7 X,F,P5 FL 69% |
| lower_arm (L=R) | 11/11.5 X,P0 FL 93% | 27/14.2 P0 FL 91% | 74/37.9 X,F,K0.6,P3 FL 79% |
| hand (L=R) | 11/11.5 X,P0 FL 93% | 19/9.9 P0 FL 94% | 31/11.5 X,F,K0.6,P2 FL 93% |
| upper_leg (L=R) | 10/5.3 X,P0 FL 97% | 38/22.4 X,P2 FL 87% | 53/8 F,P6 CR 96% |
| lower_leg (L=R) | 0/0 P0 ID 100% | 8/6.6 X,P1 FL 96% | 44/32.9 X,F,P5 CR 82% |
| foot (L=R) | 0/0 P0 ID 100% | 8/6.6 X,P0 FL 96% | 18/7.9 X,P2 FL 95% |

**machete thrust, tip speed 2.1/4.3/6.4 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 20/3.2 K2.0 SG 98% | 39/4.5 K2.5 UN 97% | 60/24.5 K6.0,c:face,LETHAL DE 97% † |
| neck | 16/158.9 A CW 46% | 31/220 A CW 39% † | 40/220 A CW 39% † |
| chest | 13/25.7 FL 84% | 26/51 CW 73% | 39/53.5 CW 72% |
| abdomen | 13/15 FL 90% | 26/29.6 CW 83% | 39/31 CW 83% |
| upper_arm (L=R) | 10/1.1 FL 99% | 21/1.5 FL 99% | 31/1.5 FL 99% |
| lower_arm (L=R) | 10/1.1 FL 99% | 21/1.5 FL 99% | 31/1.5 F FL 99% |
| hand (L=R) | 17/0.5 F,K0.6 FL 100% | 20/0.8 F,K0.6 FL 100% | 20/0.8 F,K0.6 FL 100% |
| upper_leg (L=R) | 10/1.1 FL 99% | 21/1.5 FL 99% | 31/1.5 FL 99% |
| lower_leg (L=R) | 10/1.1 FL 99% | 21/1.5 FL 99% | 31/1.5 FL 99% |
| foot (L=R) | 10/0.7 FL 100% | 21/0.9 FL 99% | 30/0.9 F FL 99% |

**machete swing, tip speed 4.7/9.3/13.9 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 38/10.8 K2.5 UN 93% | 60/31.2 K6.0,c:face,LETHAL DE 96% † | 60/31.2 K6.0,c:face,LETHAL DE 96% † |
| neck | 30/240 A CW 38% † | 40/180 A,S,LETHAL DE 78% † | 40/180 A,S,LETHAL DE 78% † |
| chest | 25/5.6 CW 97% | 50/7.5 CW 96% | 75/7.5 CW 96% |
| abdomen | 25/6.8 CW 96% | 50/9 CW 95% | 75/9 CW 95% |
| upper_arm (L=R) | 20/6 FL 96% | 40/180 A,S CW 39% † | 60/180 A,S CW 39% † |
| lower_arm (L=R) | 20/6 FL 96% | 40/40 S FL 76% | 50/40 S FL 76% |
| hand (L=R) | 20/40 S,K0.6 FL 79% | 20/40 S,K0.6 FL 79% | 20/40 S,K0.6 FL 79% |
| upper_leg (L=R) | 20/6 FL 96% | 40/9 FL 94% | 60/180 A,S CR 40% † |
| lower_leg (L=R) | 20/6 FL 96% | 40/40 S CR 77% | 60/40 S CR 77% |
| foot (L=R) | 20/3.6 FL 98% | 30/40 S CR 77% | 30/40 S CR 77% |

**hammer swing, tip speed 3.7/7.4/11.1 m/s**

| zone | slow | normal | fast |
|---|---|---|---|
| head | 18/0.1 K1.1 SG 100% | 47/20.1 K6.0,c:face UN 89% | 60/20.1 K8.0,c:face,LETHAL DE 97% † |
| neck | 14/0.1 SG 100% | 37/0.1 FL 100% | 40/0.1 FL 100% |
| chest | 12/0.1 K1.0 AL 100% | 31/0.1 K2.3 UN 100% | 55/0.1 K4.0 UN 100% |
| abdomen | 12/0.1 K1.0 AL 100% | 31/0.1 K2.3 UN 100% | 55/0.1 K4.0 UN 100% |
| upper_arm (L=R) | 9/0.1 SG 100% | 25/0.1 F FL 100% | 44/0.1 F FL 100% |
| lower_arm (L=R) | 9/0.1 SG 100% | 25/0.1 F FL 100% | 44/0.1 F FL 100% |
| hand (L=R) | 15/0 F,K0.6 FL 100% | 20/0 F,K0.6 FL 100% | 20/0 F,K0.6 FL 100% |
| upper_leg (L=R) | 9/0.1 SG 100% | 25/0.1 F CR 100% | 44/0.1 F CR 100% |
| lower_leg (L=R) | 9/0.1 SG 100% | 25/0.1 F CR 100% | 44/0.1 F CR 100% |
| foot (L=R) | 9/0 F FL 100% | 25/0 F FL 100% | 30/0 F FL 100% |

### Head chunks
Destroyed chunks per intensity `slow / normal / fast` for a hit aimed at each chunk (J jaw, F face, C cranium, O occiput; `!` = lethal_injury; `-` = none).

| weapon | jaw | face | cranium | occiput |
|---|---|---|---|---|
| handgun | - / J / J | - / F / F! | - / - / C! | - / - / O! |
| rifle | J / J / JF | F / F! / FC! | C! / C! / CO! | O! / O! / CO! |
| shotgun_pellet | - / - / - | - / - / - | - / - / - | - / - / - |
| shotgun_shot | - / - / J | - / - / JF! | - / - / - | - / - / O! |
| knife_stab | - / - / - | - / - / - | - / - / - | - / - / - |
| knife_slash | - / - / - | - / - / F! | - / - / C! | - / - / O! |
| machete_stab | - / - / J | - / - / F! | - / - / C! | - / - / O! |
| machete_slash | - / J / J | - / F! / F! | - / C! / C! | - / O! / O! |
| bat | - / - / J | - / - / - | - / - / - | - / - / - |
| hammer | - / J / J | - / F / F! | - / C! / C! | - / O! / O! |

- **Ordering (C3)**: lethal intensities per weapon for jaw / face / cranium / occiput: handgun 0/1/1/1, rifle 0/2/3/3, machete slash 0/2/2/2, hammer 0/1/2/2, knife slash 0/1/1/1;
  the jaw is never lethal in any weapon x intensity, the face is lethal at no more intensities than the skull vault, a destroyed vault chunk is always lethal (C4), a destroyed
  jaw / face always carries its configured stun (2.5 / 6.0 s, C5). A destroyed jaw bleeds hardest of all non-lethal head injuries (9mm: 70 mL/s, shotgun blast: 160).
- **Spill (C6)**: the rifle at full power (1620 J x 0.075 = 121 >= `spill_energy` 90) also destroys the neighbour (J->F, F->C, C->O, O->C); at 700 m/s (73) and below it does not.
  The 9mm (578 J -> 43), single pellets (21) and every melee never spill. Immortal dummies never lose cranium / occiput (G3g, S3cb).
- **Monotonic (C1)**: in all four chunk zones, for every family, a faster hit never destroys fewer chunks and never gives less stun - default, `no_dismemberment` and immortal (S3c).

### What each weapon can reach (lowest speed found by the sweep, 1 m/s steps; hitscan = muzzle m/s)
Scripted LMB (normal / fast): knife thrust 5.0 / 7.5, knife swing 7.1 / 10.6, machete thrust 4.3 / 6.4, machete swing 9.3 / 13.9, bat 10.2 / 15.3, hammer 7.4 / 11.1.

| weapon | head lethal | neck sever | upper / lower arm sever | hand sever / fracture | thigh / shin sever | foot sever / fracture | long-bone fracture (upper arm / lower arm / thigh / shin) |
|---|---|---|---|---|---|---|---|
| handgun | 380 | - | - | - / 150 | - | - / 380 | never |
| rifle | 500 | - | - | - / 200 | - | - / 500 | 700 / 600 / 900 / 600 |
| shotgun pellet | never | - | - | - / 400 | - | - / never | never |
| knife thrust | 9 | - | - | - / 3 | - | - / 8 | never / 10 / never / 12 |
| knife swing | 10 | 12 | 12 / 12 | 7 / 4 | never / never | 10 / 9 | never / 11 / never / never |
| machete thrust | 6 | - | - | - / 2 | - | - / 5 | 8 / 6 / 10 / 7 |
| machete swing | 6 | 7 | 7 / 7 | 5 / 2 | 11 / 9 | 6 / never | never / never / never / 8 |
| bat | 21 | - | - | - / 9 | - | - / 11 | 15 / 13 / 17 / 15 |
| hammer | 8 | - | - | - / 3 | - | - / 4 | 5 / 5 / 6 / 5 |

(Sweeps stop at 13 m/s knife, 18 machete, 21 bat, 14 hammer.) At scripted LMB speed: the machete swing at normal already severs neck, arms, shin, foot and hand and the thigh at fast
(DECISIONS: "leg severing arrives with the machete"); the knife swing at normal severs only hands, at fast also feet, and arms / neck need free-swing (11.25 m/s);
the hammer at normal breaks every long bone and its face / skull chunks; the bat at normal breaks only hand / foot.

## Checks
| id | check | result |
|---|---|---|
| T1-T6, W1-W6 | every family x part x intensity gets an unobstructed shot and an event on the intended part, finite values, bodies sane for 20 s, delivered at normal / fast, never a silent no-op | PASS |
| T7 / W7 (5 pairs each) | handgun at 380 m/s and rifle at 900: head (lethal) > neck > chest > abdomen > limbs > hands / feet in bleed or lethality | PASS |
| T8 / W8, T8b / W8b, T8c | left / right identical (HP, wounds, bleed, fracture, sever, stun, lethal, AI state at 1 s, blood at 20 s, data rows) | PASS |
| T9 / W9, S3.* | faster never does less: table intensities, and the 4000-NPC sweeps for bullets per caliber (9mm, 5.56, buckshot) in energy, blades incl. machete (sever of a part is never lost, bleed / fracture / stun / lethal never drop), blunt | PASS |
| S5.bat.mass, S5.bat.area, S5.hammer.mass, S5.hammer.area | blunt: more momentum (mass at equal speed) and smaller contact area never do less (HP, fracture, stun, chunks) over 6-7 steps, 16 zones + 4 chunk zones | PASS |
| S4 | bleed responds to hit strength for every firearm and blade (regression guard of the milestone 5 energy scaling) | PASS |
| S6 | shotgun pellet: closer never does less (8 ranges 24 -> 2 m, all zones + chunks) | PASS |
| **S6b** | shotgun pellet **bleed** also falls off with range | **FAIL** P1 |
| S7 | rifle pass-through: 2 bodies hit, energy 1620 -> 1050 J, second body bleeds less (68 vs 85 mL/s) | PASS |
| T10-T16, W10-W16 | lethal only from head / neck, stun 0..8 s from head / torso / hand rules, one sever notification + stump, lethal ends DEAD, AI state matches injury, exit wound iff penetration > thickness, value ranges | PASS |
| W17 | a whole blast that lands on the aimed part never does less body damage than half of one pellet | PASS |
| C1 | head chunks: stronger hit never destroys fewer chunks / never less stun (every family x 4 chunk zones) | PASS |
| C2-C6 | chunk zones reachable; jaw least lethal and face <= vault; vault destroyed => lethal, jaw alone => not; destroyed jaw / face carry their stun; rifle spills, 9mm / buckshot do not | PASS |
| G0-G1e, G2 | no_dismemberment and gore LOW: nothing severed (incl. 500-damage overkill and chunk zones), no stump, no "sever" cue, dropped cuts keep a wound, head chunks still break | PASS |
| G3-G3g, G4, G5 | immortal: no lethal, head never destroyed / severed, cranium + occiput survive every overkill, never DEAD, volume floor held for 30 s of rifle / shotgun / handgun / knife / machete bleeding on neck, head, jaw, chest | PASS |
| S3b, S3c, S3cb | monotonic sweeps incl. head chunks with `no_dismemberment` and with an immortal dummy; immortal sweeps never destroy cranium / occiput or report lethal | PASS |
| R1, R2 | re-hitting a severed part; 8 repeated hits per family x zone (incl. chunk zones): one fracture / lethal / chunk destruction, HP / bruise / chunk HP in range | PASS |
| D1-D6 | rows for every part, key vocabularies, sever multiplier equal in 3 files, bleed rows, no stale cause in the brain list, chunk `lethal_damage` equals `parts.head.lethal_damage` | PASS |
| SUG W7.shotgun_shot | whole blast at 2 m, aimed part only: head 66 < neck 216 mL/s, and limbs 8 < hands 9.9 (random scatter) | observation |
| SUG W18 | point-blank blast with 5 pellets on the head: 52.8 / 60 HP, jaw + face destroyed, not lethal (1 s: UNCONSCIOUS) while one 9mm headshot kills | observation |

## Problems (owner, location, evidence, suggested fix)
**P1 - shotgun range falloff reduces damage but not bleed or penetration.** Owner weapons-ui-agent, `scripts/weapons/hitscan_weapon.gd _trace()` lines 80-91
(owner of the bullet rule, penetrating-agent, only consumes `ev.extra.energy`).
Evidence (S6b): single pellet, 24 m vs 2 m: `amount` 1.6 -> 11.0 but nominal bleed identical in 20 of 20 zones (head 2.7, neck 108, chest 8.0, upper arm 6.6 mL/s) and the
exit wound exists at every range (pellet penetration 0.12 > neck thickness 0.11). The falloff multiplier is applied to `amt` only; `ev.extra["energy"]`
and `ev.penetration` are not multiplied, so severity (via damage) falls with range but bleed (via energy) and exit wounds do not.
At 24 m a pellet to the neck still opens an arterial exit wound bleeding 108 mL/s.
Fix: compute `fall_mult` once and apply it to `amt`, to `ev.extra["energy"]` (and to `ev.penetration`) before `_deliver`.

## Duplicated logic and hard-coded rules (re-check after milestone 5)
| # | decision implemented in more than one place | where | owners | risk / suggestion |
|---|---|---|---|---|
| D-1 | **Hit strength of a bullet** is computed twice: `ev.amount` (velocity ratio, falloff) and `ev.extra.energy` (1/2 m v^2, no falloff, pass-through loss) | `hitscan_weapon.gd`; `bullet.gd strength_of`; `head.gd _chunk_hit` (energy x `energy_scale`) | weapons / penetrating / head-neck | caused P1. Derive both from one value in the weapon |
| D-2 | **"Energy of a round"** is known in three files with three units: `penetrating.json calibers.*.ref_energy_j` (9mm 577.6 J and buckshot 280 J are the shipped 1/2 m v^2; **rifle 1700 J vs 1620 J shipped**, so the full rifle never reaches strength 1), `head_neck.json chunk_rules` (J x 0.075 vs `spill_energy` 90 = 1200 J), and the velocity fallback `ref_velocity`/`fallback_min_speed` (bullet.gd) / `ev.amount` (head.gd fallback) | penetrating / head-neck | derived constants copied by hand; store caliber energy once (or compute it from weapons.json) and give the spill rule a J threshold |
| D-3 | **Type multipliers applied twice to chunk damage**: `core.json type_mult` (ctx.damage) x `head_neck.json chunk_rules.type_chunk_mult`: blunt 0.5 x 0.6 = 0.30, slash 0.8 x 0.4 = 0.32, stab 0.9 x 0.5 = 0.45, bullet 1.0 | bleed / head-neck | the effective factor is in neither file; use one table |
| D-4 | **Head lethality has three routes with three cause strings**: whole-head `lethal_damage` per event (chunk rows face / cranium / occiput + `parts.head.lethal_damage`, equal today, D6) -> `headshot` / `stabbed_head`..., chunk `lethal_on_destroy` -> `skull_destroyed`, accumulated HP -> `head_destroyed`. The brain's scream list names only `headshot` and `decapitated` and handles chunks with its own `_chunk_gone` | head-neck / ai | same kill gives different causes by margin (rifle cranium 405 J = `skull_destroyed`, 980 J = `headshot`); one cause table |
| D-5 | **Destroyed-chunk bookkeeping** mirrored in `BodyPart.chunks_destroyed`, `NpcBody._chunk_gone`, brain `_chunk_gone`, and GoreFX | bleed / dismember / ai / fx | all fed by one signal, fine today; the immortal skull-vault filter lives in `_apply_gates` (filter) and `_commit_chunks` (hp floor) |
| D-6 | **Immortal rule** now in 11 spots across 4 files: `_apply_gates` (sever, lethal / destroy, chunk filter, knockdown), `_commit` head-HP floor, `_commit_chunks` HP floor, `blood_system` floor, brain `_die`, `_on_lethal`, `_on_blood_level_changed`, `_effective_blood_level` | bleed / ai | intentional by contract and tested (G3-G5, S3c); keep one helper per system |
| D-7 | **Whether a cut severs**: weapon `can_dismember = speed > dismember_min_velocity` (knife 6.0, machete 4.0), part threshold `ev.amount >= dismember` (`limb_base.wants_sever`), settings / immortal gate | weapons / arms / bleed | hands: the weapon gate is binding (knife 6.0 vs 4.5 from the rule, machete 4.0 vs 2.7), so `hand dismember 18` is hidden |
| D-8 | **Part thickness** has two sources: row `thickness` (exit-wound test) and `HitscanWeapon._thickness()` (ray through the part box, drives rifle energy loss); default 0.15 hard-coded | weapons / rows | two thickness numbers for one part; keep one |
| D-9 | **Chunk geometry**: the contract `head_chunk_from_local` thresholds (z > 0.35, y < -0.35 ...) and `head_neck.json chunks.*.center` (spill wound positions) describe the same zones twice; `head.gd _chunk_by_key` rebuilds the reverse lookup that `BodyIds.HEAD_CHUNK_KEYS` already holds | contract / head-neck | derive centres from the contract or add `BodyIds.head_chunk_from_key` |
| D-10 | **Blunt force** is reconstructed in `head.gd _chunk_hit` (`per_amount = ctx.base_damage / ev.amount`, i.e. dmg_mult x type_mult recomputed) next to `DamageSystem.apply` computing `base_damage` | head-neck / bleed | pass the factor on the context |
| D-11 | **Wound severity scale** still produced by four formulas (bullet `damage/sev_div x caliber x s^0.35`, slash `/40`, stab depth / thickness, bruise accumulation) and consumed by thresholds in ai.json (clutch 0.6, limp 0.3, scream 0.5, bruise 0.3), blood.json (`clot_max_severity` 0.35), core.json (fracture 0.6, dropped sever 0.8) | penetrating / bleed / ai | unchanged since the first report; document one severity scale |
| D-12 | **Knockdown threshold** `ai.json knockdown_min_duration` 2.0 interprets stuns from `head_neck.json` (graze 1.5-3.5, concussion 1-8, jaw 2.5, face 6.0), `torso.json` (winded) and `arms.json` (`break_stun`) | ai / head-neck / torso / arms | T14 / W14 pass; values sit around 2.0 |
| D-13 | Tunables still hard-coded: `torso.gd` clamp 0.6 / 1.5, `head.gd` default 55 and `kill_through` rule, `hitscan_weapon.gd` energy cutoff 5 %, thickness 0.15 | torso / head-neck / weapons | move to json; the mechanism rules' severity formulas were moved already |
| D-14 | Dead tags: `drop_item`, `limp_cause`, `organ_hit` are written but never read (the brain re-derives them from signals); `bullet_strength`, `stab_strength`, `force` are debug-only | arms / legs / torso | delete or consume |
| D-15 | EXPLOSIVE = slash encoded in `_mech`, `type_name()` default (damage_system.gd) and `limb_base.is_cut`; type naming `stab` (rules) vs `blade_stab` (ai.json) | bleed / arms / ai | D3 guards the vocabularies; change together when EXPLOSIVE is implemented |

## Suggestions (design-level, not failures)
1. **A point-blank shotgun blast to the head is not lethal** (W18): 5 pellets, 52.8 / 60 HP, jaw + face destroyed, 1 s later UNCONSCIOUS; the survivor has 7 HP and no face. A single 9mm
   headshot kills. Pellets are judged one by one (16 damage each against `lethal_damage` 48). Make 2+ destroyed chunks (or face + jaw) lethal, or count total chunk damage in a short window.
2. **A rifle round entering through the jaw takes the face too and still does not kill** (rifle fast, jaw: `c:jaw+face`, stun 6 s) while the same round through the face kills. Apply the spilled chunk's own lethality
   (face `lethal_damage` 48 vs rifle 90) to spilled chunks.
3. **Shotgun blast lethality order (aimed part only, 2 m): head 66 < neck 216 mL/s, limbs < hands** because pellets scatter over neighbouring parts. Compare blasts by pellets-on-part, not by part, or accept.
4. **Bleed per pellet is large**: one buckshot pellet to the neck is 108 mL/s (a third of a 9mm neck shot, `bleed_mult` 0.3 of a 260 base), so 4 pellets out-bleed a 9mm neck shot (320 mL/s); neck pellets also leave arterial exit wounds.
5. **Mass changes only force-based outcomes**: a 12 kg hammer and a 0.1 kg one differ in fracture / stun / chunks only (15 of 20 hammer zones unchanged in HP + stun + fracture + chunks); HP, bruise and bleed ignore momentum.
6. **Hammer vs bat**: the hammer (6 cm2) destroys the face and (lethally) the skull at its normal swing (7.4 m/s), stuns 8 s at 11 m/s and kills by 8 m/s; the bat (32 cm2) never destroys face / skull in its range and only the jaw at 15 m/s; the hammer breaks the thigh at 6 m/s, the bat at 17. Intended contact-area effect, but the spread is wide.
7. **Handgun head kill edge**: lethal only at 380 m/s (51 vs `lethal_damage` 48, ~6 %), at 250 m/s the face is destroyed with 6 s stun and the target survives. A per-type lethal threshold in `head_neck.json` would make the edge explicit.
8. **HP of torso, neck and limbs still has no consequence** except through fracture accumulation; **blunt to the neck** (bat 15 m/s: 29 of 40 HP) gives only a bruise, no stun.
9. **Knife swing reach**: arms and neck need 11.25 m/s (Shift free-swing); with the machete present this may be intended, otherwise lower the knife-relevant `dismember` thresholds or update DECISIONS.md.
10. **Chest / abdomen gunshots are slow killers** (9mm: 70 % / 80 % blood at 20 s, state IDLE again after the 8-14 s panic) because the brain only reacts to blood level changes.
11. **Sever cliff**: machete / knife upper-arm slash bleed jumps from ~7 mL/s to 180 mL/s arterial at the sever threshold (same for the dropped-sever deep cut).
