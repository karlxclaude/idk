# Spark

A browser game about the origin of life: from inorganic chemistry at a hydrothermal vent, about 4 billion years ago, to the first centralized brain.

You are the thing evolving. Each of the ten stages is a different mini-game, and each one ends at the chemical or biological milestone that really had to happen before the next step was possible.

## Play

Open `index.html` in a browser. No build step, no server, no dependencies.

- Mouse or touch to steer and drag. Space (or click) for stage actions such as dividing.
- Press ` (backquote) or the **Stages** button for the stage-select / debug menu.
- **Codex** re-opens every milestone card you have unlocked. Contested ideas are tagged *hypothesis*.
- Progress is saved in `localStorage`.

## Stages

| # | Stage | Mechanic | Unlock |
|---|-------|----------|--------|
| 1 | Primordial chemistry | Catch gas molecules in an iron-sulfur pore; heat or lightning drives reactions | 6 amino acids, 4 nucleotides |
| 2 | Polymerization | Drag blocks onto chains; water hydrolyzes, clay protects | RNA strand of 10, peptide of 6 |
| 3 | Protocell | Steer your RNA through fatty acids until the membrane closes | Membrane closed, then grown |
| 4 | RNA world | Copy yourself with errors; copies compete for nucleotides | Population 20, mean copying skill 70% |
| 5 | First cell | ATP synthase, then pumps to sustain the gradient; buy ribosome, enzymes, DNA | All three built |
| 6 | Asexual reproduction | Eat, grow, divide; traits mutate; rivals compete | Lineage of 15 |
| 7 | Endosymbiosis | Surface/volume energy wall, rising oxygen; keep an engulfed bacterium | 4 mitochondria, large size |
| 8 | Sexual reproduction | Mate to mix genes; parasites crack the clone colony | 3 waves survived, 10 kin |
| 9 | Multicellularity | Divide with sticky cells; assign feeder / mover / sensor jobs | 12 cells, 3 of each role, full energy |
| 10 | Nervous system | Reflex-only nerve net, then a cephalized flatworm you can steer | 10 meals with a brain |

## Code layout

```
index.html              shell and script order
css/style.css           HUD, popups, codex
js/engine/core.js       loop, canvas, input, stage manager, save
js/engine/gfx.js        glow helpers, particles, background
js/engine/audio.js      Web Audio ambient drone and blips, mute
js/engine/codex.js      every codex entry (milestone popups are codex entries)
js/engine/ui.js         objective bar, timeline, popups, codex, stage select
js/stages/stageNN_*.js  one file per stage
js/main.js              boot
```

Each stage registers itself with `Spark.registerStage({...create()})` and returns an object with `enter`, `update(dt)`, `draw(ctx)` and pointer/key handlers. Stages call `Spark.unlock(codexId)` at milestones and `Spark.completeStage()` when the unlock condition is met.

`Spark.debugSpeed = 3` in the console runs the simulation three times faster, which is handy for testing.
