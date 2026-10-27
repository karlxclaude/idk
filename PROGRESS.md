# PROGRESS

Resume-from-here notes. Keep this current.

## Current phase

**Phase 1 — physiology engine (headless) with benchmark tests.** Phase 0 complete.

## Done

### Phase 0 (scaffold) — complete
- Repo tooling: Vite + React + TS strict, Vitest, zod, Dexie installed; `npm test`, `npm run typecheck`, `npm run sources:md`.
- `engine/rng.ts`: seeded sfc32 RNG with per-day/per-subsystem streams.
- `data/schemas.ts`: mandatory constant schema and source schema (zod).
- `data/constants/*.ts`: 11 groups, 531 constants including curve points, all validated (`validateConstants()`); `DEFAULT_PARAMS`, `DEFAULT_CURVES`, `withOverrides()`.
- `data/sources.json` (173 sources, 157 resolved on PubMed/Crossref) and generated `SOURCES.md` with corrections list.
- Docs: `DECISIONS.md`, `SIMPLIFICATIONS.md`, `PROGRESS.md`.
- Tests: `tests/phase0.test.ts` (8 passing).

## Next

- Phase 1: engine state model (`engine/state.ts`), muscles (`engine/muscles.ts`), minimal exercise set for benchmarks, reps model, set/session resolver, stimulus accumulation, hypertrophy/strength/power/aerobic adaptation, Banister fatigue, energy balance + partitioning, detraining, measurement noise, `simulate()` loop, and `tests/phase1-benchmarks.test.ts` with the 14 benchmarks.

## Known issues

- 16 sources could not be resolved online (books, practitioner sources, reports, two Hickson papers, Hobson 2012, Toombs 2012, Fryar NHANES tables); their constants carry `verified: false`.
- OpenPowerlifting comparison bands are approximate (not fetched).
