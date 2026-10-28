# PROGRESS

Resume-from-here notes. Keep this current.

## Current phase

**Phase 3 — characters, genetics, archetypes.** Phases 0–2 complete; Phase 4 food database prebuilt (173 foods).

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

### Phase 4 prep — food database
- `data/foods/spec/*.json` (11 group files) -> `node scripts/build-foods.mjs <SR Legacy CSV dir>` -> `data/foods/foods.generated.json` (173 foods; 7 manual supplement entries with `fdcId: null`).
- Known substitutions are recorded in each food's `notes` (kefir -> buttermilk, All-Bran -> bran flakes, Mars -> Milky Way, mixed berries -> frozen blueberries, 93/7 beef -> 90/10).

## Next

- Phase 3: archetypes (12), creator logic, trait-effect tests.
- Phase 4: USDA food DB (SR Legacy CSV is downloaded to the scratchpad; re-download from fdc.nal.usda.gov if missing), groceries, jobs, time budget, micronutrient tests.
- Phase 5: UI, mini-games, saves. Phase 6: balance report.

## Known issues

- 16 sources unresolved online (books, practitioner, reports, Hickson 1981/1982, Hobson 2012, Toombs 2012, Fryar NHANES tables): constants carry `verified: false`.
- Arm hypertrophy in the Hubal-like run is lower in mean than Hubal (see SIMPLIFICATIONS).
- Cross-education is defined as a constant but only applies once unilateral exercises and per-limb injuries exist (Phase 2/3).
- Injury rates are calibrated per exposure but not yet validated against the per-1000 h targets in a population run (Phase 6).
