# SIMPLIFICATIONS

Every place the physiology is simplified: what the game does, why, and what a fuller model would do. Organised by subsystem. Entries are added as the engine grows.

## Muscle and hypertrophy

- **~24 muscle regions, each a single scalar mass.** Real muscles have regional hypertrophy (Pedrosa 2022; Maeo 2023) and heads with different moment arms. A fuller model would track proximal/mid/distal regions per muscle and per-head activation.
- **Hypertrophy is an exponential approach to one genetic ceiling (p = 1).** The true dynamics involve myonuclear accretion, satellite cells and connective tissue. The single ODE reproduces the empirical "slowdown with training age" and the practitioner year-by-year table, which is what the game needs.
- **Early lean gain includes a lumped "water/glycogen" pool** that fills over ~2 weeks (Damas 2016; Seynnes 2007). Real edema/glycogen dynamics are muscle-specific and training-specific.
- **Protein, sleep, stress, alcohol, age, and energy balance are multiplicative modifiers.** Real effects interact (e.g. protein matters more in a deficit). Multiplicative is readable and lets the "Why?" panel show one factor per cause.
- **Energy deficit effect is split into a hypertrophy multiplier and a Forbes-based lean-loss term.** The literature only gives net lean change (Murphy & Koehler 2022: ~500 kcal/day nets zero). The split is a modelling choice that lets strength keep improving while lean mass stalls.
- **Muscle memory is a 2.5× rate multiplier toward the high-water mark.** The myonuclear-retention mechanism is contested in humans (Psilander 2019 vs Bruusgaard 2010); epigenetic memory (Seaborne 2018) is weak evidence. The whole mechanism is tagged `L`.
- **Insertions and muscle belly length do not change hypertrophy rate** (no evidence they do). They change leverage (±10% moment arm) and visuals only.

## Strength and skill

- **1RM = force index × neural × skill × leverage × fiber × readiness × modifiers.** No joint torque model, no moment-arm curves through range of motion. The "resistance profile" field in the exercise database is used only for stimulus (length bias), not for sticking points.
- **Reps at %1RM from an Epley/Brzycki blend** with exercise, fiber-type, sex and fatigue modifiers. Real rep ability depends on the load–velocity profile of the individual lift; velocity-based modelling is out of scope.
- **Neural adaptation is per movement pattern; skill is per exercise.** Two pattern-level pools: a fast early-neural pool (weeks; voluntary activation and coordination) and a slow neuromuscular-quality pool (years; lumps specific tension, intermuscular coordination and architecture, i.e. everything that makes strength rise 2–5× faster than CSA). A fuller model would separate voluntary activation, antagonist co-activation, fascicle angle and lateral force transmission. Transfer between exercises uses a generated matrix (pattern similarity × muscle-overlap cosine), not motor-learning theory.
- **Strength scaling is anchored to a reference man.** Each exercise has a `refLoad` (expected 1RM of a reference untrained 75 kg, 175 cm man). Characters scale from it by muscle force index (mass × moment arm / segment length), skill, neural pools, leverage and fiber type. A musculoskeletal model would compute joint torques through the range of motion.
- **Cross-education is a flat fraction** (10%) of unilateral strength gain applied to the untrained side.

## Power, sprint, jump

- **Jump uses Samozino 2008 with a linear F–v relationship evaluated at mean push-off velocity.** No simulation of the countermovement itself; the SSC bonus and arm-swing bonus are multipliers.
- **Sprint uses the mono-exponential velocity model (Samozino 2016).** No reaction time, air resistance optional (off by default), no stride-level mechanics. vmax and τ come from F0h, technique and sprint-specific adaptation.
- **F0 and V0 are derived from relative lower-body strength and fiber type**, not measured per joint.

- **Hubal 2005 is reproduced in distribution shape, not in mean.** The model's arm-only program gives median biceps CSA +7.5% (Hubal mean ~+19%). The spread (CV 0.7, range −4 to +40% with MRI noise) and 1RM range (+2 to +157%) match qualitatively. A fuller model would give arm muscles a higher relative headroom/rate than legs.

## Fatigue and recovery

- **One Banister fitness–fatigue pair per quality (strength, power, aerobic).** Real fatigue has peripheral and central components with different time courses; local damage is tracked separately per muscle as a single decaying scalar.
- **Readiness is a weighted sum of deficits** (systemic fatigue, sleep debt, stress, local damage, illness). The weights are design choices.
- **Overreaching states are discrete** (FOR / NFOR / OTS) driven by the fatigue-to-fitness ratio and days above threshold. The Meeusen consensus describes a continuum with many markers.
- **Illness is a daily Bernoulli draw** modulated by readiness and stress.

## Aerobic

- **VO2max is one scalar in mL/kg/min with a genetic ceiling.** Central (stroke volume, Hb mass) and peripheral (capillaries, mitochondria) components are collapsed except for detraining (two-pool decay) and the Hb-mass link used for anaemia.
- **Three-zone model anchored on LT1/LT2 fractions of VO2max.** No lactate kinetics; thresholds drift toward trainable maxima at a slow rate.
- **Economy is a single value per modality** that improves with volume and strength/plyo stimulus.
- **Glycogen is a whole-body store** (muscle + liver) depleted by exercise kcal at zone-dependent rates and refilled by carbohydrate. Its effective capacity falls in a sustained energy deficit (the early water drop of a diet) and rises ~30% with training status.

## Energy balance and body composition

- **BMR is tissue-based** (muscle 13, adipose 4.5 kcal/kg/day, organs scaled sub-linearly from non-muscle lean mass) and cross-checked against Mifflin–St Jeor in tests. Organ masses are not tracked individually.
- **Lean change in a surplus without training** goes to non-muscle lean (adipose-associated lean tissue), and is lost first in a deficit. Real overfeeding also adds some skeletal muscle.
- **Partitioning uses Hall's Forbes extension** for the composition of weight change, with lean sparing from training, protein and sleep layered on top. The energy cost of muscle gain is a single constant (~2000 kcal/kg).
- **Adaptive thermogenesis is a single pool** (max ~7% of TDEE, τ 30 days) acting mostly through NEAT.
- **Water weight** = glycogen × 3 + sodium shift + creatine water. No menstrual-cycle water changes unless the optional small effect is on.
- **Fat distribution is visual only.**

## Nutrition and micronutrients

- **Protein quality uses a DIAAS-based weight** that matters less at high intakes; leucine threshold is optional.
- **Micronutrients are single stores** (iron mg, 25(OH)D ng/mL, Mg days, B12 months, Ca) with linear intake/loss and hard thresholds for effects. Real kinetics (hepcidin regulation, fat-soluble storage) are far richer.
- **Energy availability** = (intake − exercise energy) / FFM with a 30 kcal/kg threshold; effects ramp in over two weeks.
- **Hydration** tracks a daily sweat loss vs intake balance; no plasma osmolality.

## Injury

- **Hazard model is multiplicative per exposure**, calibrated to injuries/1000 h. Tissue-level mechanics (tendon strain, bone microdamage) are reduced to a capacity gap and a BMD z-score.
- **ACWR load spike** is kept because it is familiar, but is tunable to zero and tagged contested.

## Economy and time

- **24 h in 48 half-hour blocks**; activities are whole blocks. Mini-game performance maps to earnings and fatigue via simple linear scalings of readiness.
