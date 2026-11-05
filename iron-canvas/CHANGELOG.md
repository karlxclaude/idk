# Iron Canvas — biomechanics and IK revision

`index.html` is the updated game; `before.html` is the untouched original. All numbers below come from the
headless harness (`tools/harness.cjs` + `tools/probe.js`, Chromium with SwiftShader software rendering, no GPU),
running a 3-round × 90 s AI-vs-AI fight at 120 Hz. Full reports: `verify/before/report.json`, `verify/after/report-fight.json`.

## Results

| Check | Before | After |
|---|---|---|
| Planted-foot slide per step (3,100+ planted phases) | p95 16.9 mm, max 1.2 m, 275 phases > 5 mm | p95 0 mm, **max 0.89 mm**, 0 > 5 mm |
| Knee hyperextension (rendered skeleton, ~200k frames) | 1,628 frames, worst −105° | **0 frames** (min flexion +1.7°) |
| Elbow hyperextension | 6 frames (−3.6°); ragdoll 27 frames | **0 frames** (min +1.1°); ragdoll 0 |
| Glove error at full extension (reachable punches) | median 4.0 cm, 260 of 269 > 1 cm | **median 0.10 cm, p95 0.18 cm**, 1 of 282 > 1 cm (1.87 cm) |
| Console errors | 0 | 0 |
| Knockdowns / finishes in 270 s | 4 / 0 | 6 / 1 |
| Sim cost (no rendering) | 0.22 ms/frame, 0.08 ms per fighter | 0.28–0.49 ms/frame, 0.13–0.19 ms per fighter |

Peak speeds (completed strikes, after), against the cited mean ± SD:

| Strike | Measured mean | Cited | Within 1 SD | Within 2 SD |
|---|---|---|---|---|
| Jab (glove) | 9.25 m/s | 9.14 ± 2.06 [W05] | 80 % | 94 % |
| Cross | 8.68 | 9.14 ± 2.06 [W05] (8.1 ± 2.1 [DL20]) | 95 % | 100 % |
| Hook | 11.19 | 11.2 ± 2.0 [DL20] | 80 % | 95 % |
| Uppercut (n = 8) | 10.15 | 10.2 ± 1.8 [DL20] | 75 % | 100 % |
| Leg kick (foot) | 14.73 | 13.24 ± 2.30 [GS17] | **43 %** | 97 % |

Before, the cross and hook speeds were spiky (cross max 239 m/s, hook p95 33 m/s) from pose snaps.

Performance: the extra IK, balance and ragdoll-limit work costs about 0.1 ms per fighter per frame on this
container's CPU — under 1 % of a 60 fps frame. Rendering is unchanged except the F3 overlay (off by default).
GPU frame time could not be measured (no GPU here). A new **Settings → Body physics: Full / Lite** toggle halves the
IK and ragdoll-limit passes for weak devices (defaults to Lite on low-power touch devices).

Screenshots: `verify/compare-{jab,cross,kick,hit,ko}.png` (before | after), raw shots in `verify/before`
and `verify/after`, F3 overlay shots in `verify/after/overlay-*.png`.

## What changed

**Data (section 6, `BIOMECH_REFS` block).** Every measured constant names its source; 32 values are marked
`tuned, no source`.
- Ragdoll particle masses come from measured segment masses [K22], scaled by each fighter's mass. Limb segments
  split by the lever rule so each keeps its measured centre of mass; 10 oz gloves added.
- Joint limits: knee 137.7°, elbow 144.6°, ~1° past straight, pronation 76.9°, supination 85.0°, hip flexion
  130.4° / extension 17.4°, shoulder flexion 168.8°, ankle 12.7° / 54.6° [CDC]. Hip abduction/adduction/rotation,
  shoulder abduction/rotation, wrist and MTP limits from the Rajagopal model's coordinate ranges [R16].
- Strikes have a target peak speed and an effective mass: jab/cross from [W05] and [DL20], hook and uppercut
  speeds from [DL20], kick foot speed and phase timing (6 / 14 / 11 % of execution to contact) from [GS17].

**Strikes and damage (sections 7, 13).**
- Each punch's extension curve is solved at the start so the knuckles reach the target speed at contact;
  the kick uses [GS17]'s preparation / chamber / extension phases.
- A landed shot's impulse is **J = m_eff · v · cleanness**, with v the closing speed the glove or shin actually
  reached (the target's own movement included). The old hand-set `mom` values are gone; damage scales with J.
- Head shots get linear and rotational head acceleration scaled from [W05] (2.9 kg × 9.14 m/s → 58 g,
  6343 rad/s²). The head snap is driven by the rotational acceleration; stun builds with it; the knockdown chance
  per clean head shot comes from [RD13]'s combined concussion probability (gain tuned), on top of the HP check.

**IK (section 6, Rig).**
- Legs: two toe bones (MTP joints) added. Feet roll — heel strike, flat, push-off on the ball — and pivot about
  whichever end carries them. Knee poles follow the foot and are limited by hip rotation. Knee flexion is kept
  inside the measured range. When a loaded foot can't be reached the hips drop (the rig re-solves) instead of the
  knee locking; a foot still out of reach steps. Airborne feet hang off the shin at a real ankle angle.
- Arms: clavicle protraction on long reaches; forearm twist split 50/50 between forearm and wrist;
  swing-twist wrist limits; elbow hinge limits. The glove tip is walked onto its target with a damped correction,
  so gloves land within 1 cm. Twist is unwrapped and rate-limited so a request near 180° can't flip the hand.
- Trunk and neck: the fixed-split FK is replaced by a short weighted CCD chain (pelvis → lumbar → thoracic, and
  neck → head) with per-joint limits; each joint takes its share by range of motion and the pelvis picks up twist
  the spine can't reach. Look-at is split between neck and head the same way.
- `three/examples/jsm/CCDIKSolver` was not used: it solves position goals on the scene's bones, while this rig
  solves orientation goals in its own group space before the ragdoll blend. The CCD here is written for that.

**Balance (section 7).** Whole-body centre of mass from the [K22]-weighted particles, support polygon from the
planted feet's contact points, and capture point x + v/ω₀ [BV18]. When the capture point leaves the polygon after a
hit, a missed lunge or a kick, the nearer foot steps toward it and the step "catches" the body; if no step can
reach it right after a clean shot, it is a knockdown. A kick or check cut short by a hit now lands the foot with a
step instead of snapping it to the floor.

**Ragdoll (section 6).** The PBD body is kept and gets angular constraints: elliptical cone + twist at hips,
shoulders and neck, hinge maximums at knees and elbows, ankle flexion / twist / roll limits, and a final full
hinge pass so contacts can't leave a joint bent backward. Planted feet stay planted and keep their orientation
while the body above them is physical. On a knockdown physics takes the whole skeleton within ~2 frames.

**Debug overlay (F3).** COM and its ground point, support polygon, capture point (green inside / red outside),
glove target vs knuckles, ankle target vs ankle, joint-limit hits (amber = rig clamp, red = ragdoll correction),
and a panel with margin, hip drop, last strike's peak speed and glove error, last hit's J, v, head g, rad/s²,
concussion probability and knockdown chance. Listed on the Controls screen.

## Rapier

Benchmarked, not adopted. `@dimforge/rapier3d-compat@0.19.3` (Apache-2.0, checked in its package.json) runs two
16-body jointed ragdolls with PD motors at 0.51 ms/frame mean (4 substeps) here, so speed is not the problem
(`tools/rapier-bench/`). It was not switched in because: it would add ~836 KB gzipped; the replay system
snapshots bone rotations and would need full rigid-body state or deterministic re-simulation; the existing
animation blend would need rewriting as pose targets plus gain tuning; and a standing, hit-reacting active ragdoll
is days of tuning. The improved PBD body meets the checks above.

## Mocap

None used. `ASSET_CREDITS` in the file says so; no motion-capture or other assets were added.

## Couldn't do / hand-tuned

- **Kick speed spread:** mean 14.7 m/s is in range, but only 43 % of kicks fall within ±1 SD (97 % within 2 SD),
  because contact can happen at different points of the swing. Fixing it means reworking kick contact timing.
- **Not verified from a source** (marked `tuned, no source`): spine and neck limits per joint, clavicle protraction,
  ankle twist/roll, hook and uppercut effective mass and rotational share, the head-snap and stun scales, the
  knockdown gain, the push from J, stance roll, step roll profile, and the body-speed calibration (`VBODY`, kick
  factor) fitted in the harness.
- **Sources corrected:** the Rajagopal model's SimTK release is MIT-licensed (© 2015 Stanford University), not
  Apache-2.0. Soucie 2011 is paywalled; the numbers come from the CDC's public reference table for that study.
  De Leva 1996 is paywalled and wasn't used; [K22] (open access) supplies the segment table instead.
- **Concussion ≠ knockout:** [RD13] is football concussion data, used as a relative risk scale for knockdowns.
- **Fighter masses** still come from the existing build formula (tuned).
- **Ragdoll flail at knockdown:** a limp body's hands can briefly move ~25–30 m/s in the first frames of a fall
  (seen before the change too).
