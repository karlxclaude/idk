# PROGRESS

Resume-from-here notes. Keep this current.

## Current phase

**Phase 5 — UI and mini-games.** Phases 0–4 complete; the 7 mini-games, coach notes and events logic are done.

## Done

### Phase 0 (scaffold) — complete
- Tooling: Vite + React + TS strict, Vitest, zod, Dexie. `npm test`, `npm run typecheck`, `npm run sources:md`, `npm run sim`.
- `engine/rng.ts` seeded sfc32 with per-day/per-subsystem streams. `data/schemas.ts` constant + source schemas.
- `data/sources.json`: 173 sources, 157 resolved on PubMed/Crossref; `SOURCES.md` generated, with a corrections list.

### Phase 1 (physiology engine) — complete
- Engine modules: `character` (genetics sampling, body build, training history), `body`, `strength` (force index, 1RM, reps model, load selection), `session` (set-by-set lifting with within-session fatigue; plyo, sprint and cardio sessions), `adaptation` (hypertrophy, neural pools, skill, power/sprint pools, aerobic, tendon, bone), `fatigue` (Banister per quality, sleep debt, stress, overreaching FOR/NFOR/OTS, illness, readiness), `energy` (tissue BMR, TEF, NEAT, EPOC, adaptive thermogenesis, constrained TEE, Forbes/Hall partitioning), `nutrition` (protein quality, EA/REDs, iron, vitamin D, Mg, B12, Ca, hydration, creatine, beta-alanine, caffeine, hunger), `injury` (per-exposure hazard with ACWR, sleep, tissue gap, prior injury, prevention exercises, stress fractures), `performance` (F-v profile, Samozino jump and sprint, race times, 2K row), `sim` (daily tick), `runner`, `plan`.
- Constants: 871 including curve points, 12 groups (`model.ts` holds structural choices). `engine/units.ts` holds definitions and formula coefficients.
- Data: `data/muscles.ts` (27 regions), `data/exercises/core.ts` (40 benchmark exercises), `data/programs.ts`, `data/diets.ts`, `data/climate.ts`, `data/planDefaults.ts`.
- Tests: 14 benchmarks pass (`tests/phase1-benchmarks.test.ts`); actual values are written to `docs/phase1-benchmarks.json`. `tests/no-magic-numbers.test.ts` guards engine code.

### Phase 2 (exercise database) — complete
- 284 exercises: 41 benchmark entries in `data/exercises/core.ts` plus 243 in 17 category modules under `data/exercises/lib/` (aggregated by `library.ts`).
- Schema gained `legDrive`; `secondsPerRep` max 120 (holds, carries).
- `scripts/check-exercises.ts <file>` validates one module (schema, refLoad within 5% of computed 1RM, reps at 75% in 6–18, limited-evidence wording).
- `tests/phase2-exercises.test.ts`: count, schema, coverage, spot checks (seated vs lying leg curl; Larsen vs competition bench), transfer matrix properties.
- `npm run transfer` writes the sparse generated transfer matrix to `docs/transfer-matrix.json`.
- Authoring guide: `docs/EXERCISE_AUTHORING.md`. Most library entries carry `verified: false` (activation values are anatomical estimates).

### Phase 3 (characters and genetics) — complete
- `data/archetypes.ts`: 12 archetypes with backstory and hidden summary (3 women).
- `engine/creator.ts`: visible sliders from constants, zod `CreatorInputSchema`, random vs custom-lab mode (lab overrides clamped, all traits revealed).
- `engine/labTests.ts`: biopsy, lab VO2max, DXA, blood panel, response profile; noisy readings and reveal flags.
- Tests: `tests/phase3-traits.test.ts` (14 paired trait-effect tests), `tests/phase3-creator.test.ts` (archetypes, creator, lab tests).

### Phase 4 (economy and nutrition) — complete
- `engine/meals.ts` (foods -> Intake, meal cost with regional multiplier and cooked yield, meal and day templates), `engine/groceries.ts` (pantry, FIFO, spoilage, weekly shopping list).
- `data/supplements.ts` (14: evidence / conditional / useless), `engine/nutrition.ts` `ergogenicPerf` (beta-alanine, bicarbonate, nitrate in timed efforts).
- `data/jobs.ts` + `engine/jobs.ts` (7 jobs, pay, Compendium METs, strain, stress, mini-game difficulty, auto-resolve, certification).
- `engine/timeBudget.ts` (48 half-hour blocks, weekly templates with overrides, validation, DayInputs patch).
- `engine/economy.ts` (gym tiers gate exercises, ledger, pro-rata bills, financial stress), `engine/game.ts` (GameState, newGame, advanceDay integrating all of the above; 365 days ~0.16 s).
- Tests: `phase4-nutrition` (iron -> VO2max, winter vitamin D, low EA -> stress fractures, B12, magnesium economy), `phase4-supplements`, `phase4-jobs`, `phase4-time`, `phase4-game`.

### Phase 5 progress
- `minigames/` — 7 job mini-games (pure seeded logic + React component each), registry in `minigames/index.ts`; 40 logic tests.
- `engine/events.ts` — field tests with measurement error, 9 competitions with local-field placement, fees and prizes.
- `data/coachNotes.ts` — 88 cited coach notes with state triggers.

### Phase 4 prep — food database
- `data/foods/spec/*.json` (11 group files) -> `node scripts/build-foods.mjs <SR Legacy CSV dir>` -> `data/foods/foods.generated.json` (173 foods; 7 manual supplement entries with `fdcId: null`).
- Known substitutions are recorded in each food's `notes` (kefir -> buttermilk, All-Bran -> bran flakes, Mars -> Milky Way, mixed berries -> frozen blueberries, 93/7 beef -> 90/10).

## Next

- Phase 5: UI, mini-games, saves. Phase 6: balance report.

## Known issues

- Running is too slow for a given VO2max: VO2max 40.8 gives a 31:50 5K (about 24:00 expected), and the Cooper test reads ~32. Check `economyRun` and `sustainableFraction` in Phase 6.
- Running injuries ~13/1000 h for recreational runners vs Videbæk's 7.7; bone-stress share ~24%. Calibrate in Phase 6.
- Anemia needs >~7 months of low iron intake from default stores (realistic, but slow for gameplay).
- Coaching is a cost with no modelled effect.

- 16 sources unresolved online (books, practitioner, reports, Hickson 1981/1982, Hobson 2012, Toombs 2012, Fryar NHANES tables): constants carry `verified: false`.
- Arm hypertrophy in the Hubal-like run is lower in mean than Hubal (see SIMPLIFICATIONS).
- Cross-education is defined as a constant but only applies once unilateral exercises and per-limb injuries exist (Phase 2/3).
- Injury rates are calibrated per exposure but not yet validated against the per-1000 h targets in a population run (Phase 6).
