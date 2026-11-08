# EVERHUNGER Architecture

TypeScript + PixiJS v8 + Vite. Roughly 2.5k lines. Simulation (`src/sim`) knows nothing about Pixi;
rendering (`src/render`) reads simulation state every frame and never mutates it (except the food `viewId` cache).

## Module map

| File | Responsibility |
|---|---|
| `src/main.ts` | Creates the Pixi app, `Game`, `UI`, audio; exposes `window.__game` for tests. |
| `src/Game.ts` | Orchestrator: fixed-step loop hooks, camera follow, phases (`title`, `playing`, `dying`, `dead`), pause, restart, transitions. |
| `src/core/loop.ts` | Fixed 60 Hz simulation with render interpolation, `timeScale` (slow motion on death), pause. |
| `src/core/camera.ts` | Eased follow camera; zoom is derived from the player radius and interpolated in log space. `zoomBias` drives the start/death zooms. |
| `src/core/input.ts` | Mouse / touch / keyboard steering and the pause key. |
| `src/core/math.ts`, `pool.ts`, `spatialHash.ts`, `textures.ts` | Helpers: easing, seeded RNG, object pool, uniform-grid broadphase, canvas-baked textures. |
| `src/sim/SoftBody.ts` | Membrane ring: radial springs to a lagging anchor, edge springs, pressure, positional contacts, `bulge()` forces, per-point `restMul` for mitosis. Typed arrays, zero allocation per step. |
| `src/sim/Organism.ts` | Player, kin, amoeba, paramecium, predator. Movement with drag/momentum, radius easing, organelle drift with inertia, flagella/cilia phases, mitosis pinch shape. |
| `src/sim/Food.ts` | Bacteria / algae / debris particles and their capture → digest state machine. |
| `src/sim/World.ts` | Spawning in a ring around the player, despawning, AI (`wander`, `seek`, `chase`, `flee`), contacts, phagocytosis, mitosis, grains. |
| `src/sim/flow.ts` | Smooth drifting current field used by food and (weakly) organisms. |
| `src/render/OrganismView.ts` | One pooled `Graphics` per visible organism: membrane spline, cytoplasm layers, organelles, flagella; paramecium slipper with cilia. Level of detail by on-screen radius. |
| `src/render/FoodView.ts` | Pooled sprites from baked textures, wiggle/tumble animation, vacuole rings around food being digested. |
| `src/render/GrainView.ts` | Static sediment grains, drawn once per grain. |
| `src/render/Background.ts` | Water gradient, three parallax particle layers, two additive caustic tiling sprites, vignette. |
| `src/ui/ui.ts` | DOM overlay (title, HUD, pause, death, fade). All transitions are CSS eased. |
| `src/audio.ts` | Web Audio ambience plus eat / gulp / divide / death cues. |

## Core loop

1. `Game.update(dt)` (fixed 1/60 s): read steering, set `world.viewRadius` from the settled camera zoom, `world.step(dt)`, camera follow.
2. `World.step`: maintain population → AI + movement → rebuild spatial hashes → food interactions (bulge / capture) →
   solid interactions (grains, separation, engulf) → shapes (soft bodies, organelles, division timers) → food drift / digestion.
3. `Game.render(alpha)`: interpolate camera, position the world container, update the four views.

## Size model

`mass = radius²`. Food yields `r² × FOOD_YIELD[kind]` transferred over `DIGEST_TIME`; engulfed cells give 70% of their mass over
`ENGULF_TIME`. `targetRadius = √mass` and `radius` eases toward it. Everything spawns relative to the player radius, so
difficulty is scale-invariant while the camera zooms out across generations. The player divides at `divideRadius = birthRadius × 1.55`;
daughters have `radius / √2`, so each generation is about 9% larger.

## Tuning knobs

- `SoftBody.kRest / kEdge / kPressure / damping / anchorRate`: jelly stiffness and lag (set per kind in `Organism.init`).
- `World`: `EAT_RATIO` (1.18), spawn counts in `maintainPopulation`, NPC size ranges in `spawnNpc`.
- `KIND` table in `Organism.ts`: speeds, colours, flagella and mitochondria counts, sense radius.
- `Camera.zoomFor`: on-screen cell size; `followRate`, `zoomRate`.

## Tests

- `npm test`: Vitest unit tests for math, pool, spatial hash, soft body stability and a 10-second world simulation (eating, mitosis, engulfment).
- `npm run test:e2e`: Playwright drives the production build on desktop and phone viewports through the whole flow and fails on console errors.
