# DECISIONS

Non-obvious choices made while building PHENOTYPE, in rough chronological order. Each entry: what was decided, why, and what it rules out.

## Tech stack

- **TypeScript (strict) + Vite + React 18 + Zustand + Recharts + Vitest + zod + Dexie.** Taken as the spec's default. Justification: one language across engine, data and UI; Vite gives fast iteration and a static build; Vitest shares the Vite config so the engine runs headless in tests; zod validates every data file at load time; Dexie wraps IndexedDB for saves. `vite-node` runs headless scripts (simulations, balance reports) without a separate build.
- **Mini-games on plain Canvas 2D**, not PixiJS. The games are simple 2D tasks (packing, routing, rhythm, sorting, typing, balance); Canvas keeps the bundle small and avoids a WebGL dependency.
- **`noUncheckedIndexedAccess: true`.** Catches a whole class of array-index bugs in a numerical engine at the cost of some `as number` casts in hot loops.

## Constants and sources

- **Constants live in `data/constants/*.ts`, not JSON.** TypeScript keeps the mandatory schema typed (`k()`/`design()` helpers), supports comments next to each value, and still validates with zod at load (`validateConstants()`). A JSON export is trivial if needed.
- **Curves are first-class.** Dose-response shapes (load, RIR, rest, protein, sleep, …) are piecewise-linear `curve()` definitions whose points are each registered as individually tunable constants `group.name@x`. The engine interpolates with `interp()` and never hard-codes a breakpoint.
- **`design` pseudo-source.** Pure game-design choices (prices, mini-game penalties, time-block sizes) cite the `design` source and are tagged `HEUR`, so the "every constant maps to a source" rule stays mechanically checkable.
- **Citation verification pipeline.** `scripts/source-queries.json` + `scripts/verify-sources.mjs` resolve each citation on PubMed and dump abstracts; `data/sources.json` was generated from the resolved records, with hand-written notes for the numbers checked. `scripts/sources-md.ts` regenerates `SOURCES.md` and fills `constantsInformed`. Twelve bibliographic corrections and one downgrade were found (see SOURCES.md).
- **Where a source contradicted the prompt, the source wins.** Examples: Kouri's FFMI height correction 6.3 (prompt said 6.1); Schumann's interference timing window 3 h (prompt said 6 h); Cormie 2010 "stronger respond better" was non-significant (downgraded to L).

## Engine architecture

- **Daily tick, sessions resolved set by set.** `engine/` is pure TS, no DOM imports. The day runs the fixed order in spec section 3 and produces a `DayReport` with factor breakdowns that the "Why?" panel renders.
- **Per-day, per-subsystem RNG streams** (`streamRng(seed, day, stream)`). Random draws in one subsystem never shift another subsystem's sequence, so adding a random event to injuries does not change body-weight noise for the same seed. Same seed + same inputs = identical output.
- **Metric internally, kg/lb only at display.**
- **Strength is calibrated through reference loads, not absolute specific tension.** Each exercise carries `refLoad`: the expected 1RM of a reference untrained 75 kg man at starting skill. The engine computes a muscle "force index" (Σ activation × mass^0.67) relative to that reference character, so lifts scale physically with muscle mass and leverage while staying in sensible absolute kilograms without a full musculoskeletal model.
- **Hypertrophy as exponential approach to a genetic ceiling with exponent p = 1.** `dM/dt = k·gap` reproduces the practitioner "year 1, then halving" pattern without categories. The starting gap (untrained = 70% of ceiling) and `kHypPerDay` together set year-1 gains.
- **Muscle mass vs lean mass.** Per-region skeletal muscle mass (SMM) sums to ~53% of fat-free mass in untrained men (Janssen 2000); non-muscle lean mass is tracked separately and changes slowly. Lean mass displayed = SMM + non-muscle lean + glycogen/water pools.
- **Two detraining clocks.** Neural strength and muscle mass each have a grace period (~2.5 weeks) before exponential decay; skill decays much more slowly. This reproduces "strength kept at 3 weeks, measurable loss at 8".
- **VO2max detraining uses a two-pool decay** (fast central / slow peripheral) fitted to Coyle 1984 (−7% at 21 d, −16% at 56 d).
- **Muscle memory is a rate multiplier toward the high-water mark**, explicitly labelled uncertain in code and SIMPLIFICATIONS.md.
- **Interference is a penalty on adaptation rates**, scaled by weekly endurance minutes (saturating at ~5 h), modality, and same-session timing (≥3 h gap removes most of the explosive-strength penalty, per Schumann 2022).
- **Injury is a per-exposure hazard**, calibrated to injuries per 1000 h by activity, with the ACWR load-spike term tunable down to zero because the model is contested.

## Phase 1 calibration decisions

- **FFMI ceiling mean 23.5 (not 23) and lean untrained start 18.5 (not Schutz's 18.9).** The practitioner year-1 band (6–11 kg) and the "about 23" ceiling claim cannot both hold from an average start: with a ~4 FFMI-unit gap the exponential approach gives ~5 kg in year 1. The ceiling claim is `[L]` and the year table `[HEUR]`, so both moved inside their ranges. The ceiling SD is 0.75, which puts ~2–3% of characters above 25.
- **Two neural components plus skill.** A single neural pool could not reproduce both Hubal's 1RM spread (0 → +250%, CV ~0.55) and multi-year strength progress. The model now has: per-exercise **skill** (technique; weeks; floor 0.88), a **fast early-neural pool** per movement pattern (weeks; gain ~ lognormal around 10%, scaled by the strength responder) and a **slow neuromuscular-quality pool** (years; +50% max). Each novice also gets an individual starting technique (`noviceSkill`). This reproduces Moritani & deVries ("neural factors dominate the first weeks") and Hubal's long right tail.
- **Neural target depends on load quality.** Pools approach the 28-day average strength-stimulus quality, so 30%-1RM training saturates them lower than 80%. That yields "similar hypertrophy, clearly more strength" for heavy loads (Schoenfeld 2017; Lopez 2021) without hard-coding load categories.
- **Test-day 1RM excludes soreness.** `testOneRepMax` is fully rested (readiness 1, no damage) but includes creatine's acute effect. Benchmarks use it; in-session loads use the fatigued value.
- **Glycogen falls in a sustained deficit** (capacity × (1 + balance/1500), floor 60%). This produces the early 1–2 kg "water" drop of a diet. Without it, Nedeltcheva's short-term FFM shares were impossible.
- **Short-sleep lean-loss multiplier 2.0 on tissue lean** (Nedeltcheva reports +60% on *total* FFM). Glycogen water is lost equally under both sleep conditions, so the tissue multiplier has to be larger to reproduce the total-FFM ratio. Result: lean share 0.57 (8.5 h) vs 0.76 (5.5 h); study: 0.52 vs 0.80.
- **NEAT scales linearly with body mass** (Hall 2011: activity cost ∝ weight). This is what makes weight loss slow dynamically. A fixed −500 kcal intake loses 14 kg in a year (3,500-kcal rule: 23.6 kg), and loss in weeks 40–52 is ~0.66× weeks 2–14, consistent with Hall's ~1–1.5 year time constant.
- **Power interference weight 0.35 (spec suggested ~0.25).** Wilson 2012 shows power ES falling 40% (0.91 → 0.55) and Schumann 2022 shows explosive SMD −0.28 with no hypertrophy penalty. At 0.25 the model's power and hypertrophy reductions were indistinguishable, because strength gains dominate jump F0 in a lift+plyo program.
- **Interference timing window 3 h** (Schumann 2022), not 6 h.
- **Hypertrophy benchmark diet = "lean bulk" controller** (`bodyFatTargetDiet`): +300 kcal at ≤15% body fat, shrinking 120 kcal per % above. A constant surplus for four years ends at 40% body fat, which isn't "good conditions"; bulk/cut cycling makes yearly numbers depend on phase timing.
- **Model shape constants live in `data/constants/model.ts`** (sampling bounds, mixing weights, initial-state heuristics), and unit conversions and published formula coefficients (Brzycki, Epley, Mifflin, Concept2) live in `engine/units.ts`. `tests/no-magic-numbers.test.ts` fails if a numeric literal outside a small structural allow-list appears in engine code.
- **Paired benchmark comparisons clone one character** (`structuredClone`), so anthropometry and moment arms are identical between arms of a comparison.

## Phase 2 exercise database decisions

- **Library authored per category by parallel agents, validated mechanically.** Each `data/exercises/lib/*.ts` module passes `scripts/check-exercises.ts` (schema, reference 1RM within 5% of `refLoad`, reps at 75% in 6–18) before merge. Activation and length-bias values are anatomical estimates unless `verified: true` names a study.
- **`legDrive` field** (0–1) for upper-body presses: competition bench 0.6, Larsen press 0. It feeds the spot check and future leg-drive skill transfer.
- **Strongman events use `movementPattern: 'strongman'`** (keg toss, Conan's wheel included), and their ballistic or carry character is expressed through `adaptationBias` and `peakPowerLoadPct`. Carries use `repsModifier` 0.75 and `secondsPerRep` 15–25, so one "rep" equals one carry.
- **Axle press sits in the `strongman` gym tier** (axles mostly appear in strongman gyms), even though the authoring guide lists axle under `powerlifting`.
- **Cardio library entries set `muscularEndurance: 0`.** The engine routes cardio stimulus through the aerobic model, not the lifting endurance bias.
- **Jump rope (impact 0.7) uses running injury rates** because the engine's running-impact threshold is 0.6.
- **Transfer matrix is generated, not hand-entered**: pattern similarity × muscle-overlap cosine × equipment factor (`exerciseTransfer`). `npm run transfer` exports it sparsely to `docs/transfer-matrix.json`.

## Phase 4 food database decisions

- **Foods come from USDA SR Legacy (April 2018 CSV)** through `scripts/build-foods.mjs` and per-group spec files. Seven powder supplements (whey isolate, casein, pea protein, maltodextrin, electrolyte mix, beet shot, mass gainer) are manual label-basis entries with `fdcId: null`, because SR Legacy lacks matching rows.
- **Prices are per unit as sold.** Dry legumes are priced per 454 g dry, while their nutrient rows are cooked, so cost per 100 g cooked is understated. The grocery layer in Phase 4 must apply a cooked-yield factor (~2.5×).
- **Satiety index** uses Holt 1995 values where the food matches and is otherwise `estimated`. DIAAS uses FAO 2013, Rutherfurd 2015 and Mathai 2017 where available.

## Phase 3 character decisions

- **Archetypes are profiles, not mechanics.** Each is a `CharacterProfile` with partial genetics and anthropometry overrides; outcomes come only from the underlying variables (no somatotypes).
- **The hidden low and high responders have identical visible stats.** Only `responderHyp`, `responderStr`, `ffmiCeiling` and `neuralFastGain` differ; 16 weeks on one program gives 1.6 vs 6.8 kg lean.
- **DXA reveals the FFMI ceiling only after ~200 training hours.** Before that, a ceiling estimate is meaningless; the state stores training hours rather than years.
- **The response-profile test is a game device** (`design`, noise SD 0.35 on responder multipliers): real DNA panels predict training response poorly.
- **Creatine non-responders keep a small residual effect** (`creatineNonResponderMax`), so "no effect" is tested as < 25% of a responder's effect.

## Phase 4 economy and nutrition decisions

- **Meals drive intake in the game loop.** `advanceDay` consumes the weekday's meals from the pantry (auto-buying missing items), converts them with `intakeFromMeals`, and only counts beverage water, because `hydrationStep` credits food water separately. Plain tap water is free.
- **Magnesium deficiency acts on movement economy** (Lukaski & Nielsen-style higher O2 cost): kcal per minute at a zone are unchanged but distance falls, so kcal per km rises.
- **Ergogenic aids act on timed efforts only** via `ergogenicPerf` (beta-alanine 0.5–10 min, bicarbonate 1–7 min minus expected GI distress, nitrate ≥5 min, attenuated above VO2max 60). Useless supplements map to no engine change.
- **Bone tissues get a lower share** when an exposure's hazard is split across tissues (`boneTissueWeight` 0.3), and the impact factor is normalised so full-impact running is 1. Before this, stress fractures were 57% of running injuries.
- **REDs severity reaches 1 at EA 15 kcal/kg FFM** (Loucks 2003 graded suppression), and the low-EA stress-fracture multiplier is 2.5 (range 1.5–4).
- **Jobs add systemic fatigue** (`jobFatigueLoadPerStrainHour`) outside the training ACWR and an occupational injury hazard on the job's risk tissues.
- **Gym tiers nest** (commercial ⊃ budget, powerlifting ⊃ commercial, strongman ⊃ powerlifting; track separate). Pool access is free because no pool price constant exists.
- **Financial stress** is 0 with ≥21 days of cash runway and rises linearly to 1 at zero cash; it feeds `stressStep`'s financial input.
- **Competition fields are synthetic lognormal distributions** around HEUR local medians; strength medians scale by body mass^0.67.
