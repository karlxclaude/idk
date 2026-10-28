# Exercise authoring guide

How to add exercises to PHENOTYPE's database. Every exercise is declared with `ex({...})` from `data/exercises/define.ts`, validated by `ExerciseSchema` in `data/exercises/schema.ts`, and consumed by the physiology engine. **Read `data/exercises/core.ts` first**: it holds 41 reference entries that show every convention below.

## Files

- `data/exercises/core.ts`: benchmark set (do not duplicate these ids).
- `data/exercises/upper.ts`, `lower.ts`, `athletic.ts`: the Phase 2 library, each exporting one `Exercise[]` built with `ex()`.
- Muscle region ids, movement patterns: `data/muscles.ts`. Categories, gym tiers, cardio modalities: `data/exercises/schema.ts`.

## Field conventions

| Field | Meaning / convention |
|---|---|
| `id` | snake_case, unique across all files. |
| `muscles` | Activation 0–1 per region. **1.0 = primary mover (counts as a full hard set), ~0.5 = synergist (half set, per Pelland's fractional method), 0.2–0.3 = stabiliser.** Only list regions with ≥ 0.15. Use only ids from `MUSCLE_REGIONS`. EMG is a weak proxy for hypertrophy; prefer anatomy + training-study logic. |
| `lengthBias` | 0–1 per region: how much the exercise loads that muscle at long length (0 = shortened bias, 1 = deep stretch under load). Only for regions listed in `muscles`. Examples: seated leg curl hamstrings 0.9 vs lying 0.5 (Maeo 2021); overhead triceps long head 0.95 vs pushdown 0.3 (Maeo 2023); incline curl biceps 0.95; hip thrust glutes 0.2. |
| `resistanceProfile` | ascending (hardest at lockout: hip thrust, jumps), descending (hardest at the bottom/start: deadlift), flat (cables/machines), bell (most free-weight lifts). |
| `axialLoad`, `systemicFatigue`, `localDamage` | 0–1. Deadlift ~1/1/0.6; squat 0.9/0.9/0.6; leg extension 0/0.3/0.5; lateral raise 0/0.15/0.3. Eccentric/lengthened emphasis raises `localDamage` (Nordic 0.8). |
| `skillDemand` | 0–1. Machines 0.1–0.2; free-weight compounds 0.5–0.75; Olympic lifts 0.9; calisthenics skills 0.7–0.95. |
| `learningRate` | 0.5–2. Simple isolation 2; machines 1.5; compounds 0.8–1; Olympic 0.6; advanced calisthenics 0.4–0.6. |
| `baseInjuryRisk` | 0–1, mapped to injuries/1000 h: lifts 0.35 ≈ powerlifting average (2.5/1000 h); isolation 0.1; strongman event 0.4–0.6; neck bridge 0.7. |
| `riskTissues` | From: `lowBack`, `knee`, `hip`, `shoulder`, `elbow`, `wrist`, `pec`, `biceps`, `hamstrings`, `adductors`, `quads`, `calf`, `achilles`, `patellarTendon`, `shin`, `tibia`, `foot`, `lats`, `neck`. |
| `adaptationBias` | Multipliers 0–2 on each quality: `hypertrophy`, `maxStrength`, `power`, `muscularEndurance`, `speed`, `jump`, `aerobic`. Defaults: hyp 1, str 1, power 0.5, endurance 0.8, others 0. Ballistic/Olympic: power 1.1–1.2. Plyo: power ~1, jump ~1. Sprint: speed ~1.1. Cardio: aerobic 1, others ~0. |
| `leverageExponents` | `femurTorso` (negative = long femurs hurt: squats −0.2 to −0.5), `armLength` (deadlift +0.3–0.4, bench −0.4), `torsoLength`. Clamped to ±15% in engine. |
| `metValue` | 2024 Adult Compendium: resistance training 3.5 (light) to 6 (vigorous); calisthenics 3.8–8; sprinting ~14+; running by pace 8–12; cycling 7–10; rowing 7–12; rucking 6–8. |
| `peakPowerLoadPct` | %1RM of peak power for ballistic lifts (Cormie 2011): jump squat ~0–30 (use 15), power clean 70–80 (use 75), bench throw ~30–45, push press ~50–60. |
| `loadType` | `external` (requires `refLoad`), `bodyweight` (requires `bodyweightFraction`; optional `refLoad` = expected 1RM of total system load, e.g. pull-up 78), `none` (plyo, sprint, holds, cardio). |
| `refLoad` | **Expected 1RM in kg of the reference untrained man (75 kg, 175 cm, starting technique).** Anchors: high-bar squat 70, low-bar 75, leg press 150, leg extension 50, RDL 70, conventional deadlift 90, hip thrust 90, competition bench 55, Larsen press 48, incline DB press 40 (sum of both bells), OHP 35, barbell row 55, cable row 55, lat pulldown 55, barbell curl 30, incline DB curl 26, overhead cable triceps 30, pushdown 35, DB lateral raise 10, standing calf raise 90. Scale others from these (e.g. front squat ≈ 0.8 × high-bar; close-grip bench ≈ 0.9 × bench; DB values = total of both dumbbells). For bodyweight lifts `refLoad` is total system load (BW × fraction + added) at 1RM. |
| `bodyweightFraction` | Fraction of body mass moved: pull-up/dip 1.0, push-up 0.64, inverted row 0.55, pistol squat ~0.85, Nordic 0.6, back extension 0.5. |
| `repsModifier` | Reps at a given %1RM vs. bench-type lifts: lower-body/machine 1.1–1.3 (Shimano 2006); Olympic 0.85; deadlift 0.95. |
| `secondsPerRep` | Time per rep (holds: seconds of the hold, up to 120; cardio: 60). |
| `legDrive` | Upper-body presses only: lower-body contribution (competition bench 0.6, Larsen 0). |
| `unilateral` | true for single-limb exercises. |
| `prevention` | `['nordic']` for Nordic hamstring variants, `['copenhagen']` for Copenhagen adductor variants. |
| `cardio` | Required for category `cardio`: `{ modality, defaultZone: 1|2|3, impact: 0–1 }`. |
| `sprint` | Required for category `sprint`: `{ f0h, vmax, technique }` biases 0–1 (acceleration/sled → f0h; flying sprints → vmax; drills → technique). |
| `evidenceNotes` | One sentence. Cite a study name when one applies (e.g. "Maeo 2021"). **Exercises with little evidence (Jefferson curl, tibialis raise, neck training, most drills) must say "Evidence is limited" and keep modest effects.** |
| `verified` | true only when the activation/length claims rest on a named study; otherwise false. |

## Gym tiers

`home` (bodyweight, bands, DBs), `budget` (barbells, racks, benches, DBs; no platform/chalk), `commercial` (machines, cables), `powerlifting` (platform, specialty bars: SSB, cambered, deadlift bar, axle), `strongman` (yoke, stones, log, frame, keg, tire), `track`, `outdoor`, `pool`.

## Validate

```bash
npx tsc --noEmit -p tsconfig.json
npx vitest run tests/phase2-exercises.test.ts
```
The test checks schema validity, unique ids, that the reference man's computed 1RM is within 5% of `refLoad`, rep sanity at 75% 1RM (6–18 reps), and coverage of every movement pattern and muscle region.
