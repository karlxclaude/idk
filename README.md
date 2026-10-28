# PHENOTYPE

An evidence-based human performance and life simulator. You develop a body — muscle, strength, power, speed, jump, aerobic fitness, body composition — under the constraints of money, work, sleep, stress and food, and test it in lifting meets, sprint and jump meets, races and personal-record days. Every rate, ceiling and tradeoff comes from the research literature (or is labelled as a heuristic), and every change can be explained.

> This is a game, not medical or nutrition advice.

## Run

```bash
npm install
npm run dev        # web build at http://localhost:5173
npm run build      # production build to dist/
npm test           # full test suite (Phase 1 benchmarks included)
npm run typecheck
```

Headless tools:

```bash
npm run sim -- --seed 7 --years 2           # simulate one character, print a report
npm run balance                              # 1,000-character runs -> BALANCE_REPORT.md
npm run sources:md                           # regenerate SOURCES.md from data/sources.json
```

## Layout

- `engine/` — pure, deterministic TypeScript. No UI imports. Ticks one day at a time.
- `data/` — constants (`data/constants/*.ts`), sources (`data/sources.json`), exercises, foods, jobs, genetics, with zod schemas.
- `ui/` — React app. `minigames/` — Canvas mini-games.
- `tests/` — Vitest; `tests/phase1-benchmarks.test.ts` holds the physiology acceptance bands.
- `scripts/` — headless simulations, balance report, source verification.

## Tuning constants

Every number the engine uses is a constant in `data/constants/<group>.ts` with:

```ts
{ id, value, unit, range: [min, max], confidence: 'H'|'M'|'L'|'HEUR', sourceIds, verified, note }
```

- Change `value` within `range`; the schema rejects values outside it.
- Dose-response shapes are `curve()` definitions; each point is its own constant (`group.curve@x`).
- At runtime use `withOverrides(DEFAULT_PARAMS, { hypertrophy: { kHypPerDay: 0.002 } })` to test a change without editing files.
- After changing sources or constants run `npm run sources:md` so `SOURCES.md` and `constantsInformed` stay in sync.
- `SIMPLIFICATIONS.md` lists what each subsystem leaves out; `DECISIONS.md` records why things are the way they are.

## Documents

`DECISIONS.md` · `PROGRESS.md` · `SIMPLIFICATIONS.md` · `SOURCES.md` · `BALANCE_REPORT.md`
