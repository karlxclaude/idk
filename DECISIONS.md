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
