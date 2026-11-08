# Spark — plan

Browser game about the origin of life, from vent chemistry to the first brain.
Plain HTML5 canvas + JavaScript, no build step: open `index.html`.

## Files
- `index.html` — shell, loads scripts in order.
- `css/style.css` — HUD / popups / codex styling.
- `js/engine/core.js` — game loop, canvas + DPR, input, stage manager, save state.
- `js/engine/gfx.js` — glow drawing helpers, particle system, background.
- `js/engine/audio.js` — Web Audio ambient drone and blips, mute toggle.
- `js/engine/codex.js` — all codex entries. Milestone popups are codex entries.
- `js/engine/ui.js` — objective bar, progress, timeline, popups, codex screen, stage select.
- `js/stages/stageNN_*.js` — one file per stage, registers itself with `Spark.registerStage`.
- `js/main.js` — boot.

## Stage API
Each stage file calls `Spark.registerStage({ id, index, title, subtitle, years, create() })`.
`create()` returns `{ enter, exit, update(dt), draw(ctx), pointerDown, pointerMove, pointerUp, key }`.
Stages call `Spark.unlock(codexId)` for milestones and `Spark.completeStage()` to advance.

## Stages and unlock conditions
1. Chemistry — catch molecules into a pore, use heat/lightning energy, make 6 amino acids + 4 nucleotides.
2. Polymerization — drag blocks onto chains; water hydrolyzes, clay protects. RNA >= 10, peptide >= 6.
3. Protocell — collect fatty acids around your RNA until the membrane closes, then grow.
4. RNA world — gather nucleotides, copy with errors, population evolves. Pop >= 20, mean fitness >= 0.7.
5. First cell — ATP synthase, then pumps to sustain the gradient; spend ATP on ribosome, enzymes, DNA.
6. Fission — eat, grow, divide with mutations, out-compete rivals. Lineage >= 15.
7. Endosymbiosis — surface/volume energy crunch, rising oxygen; keep an engulfed bacterium. >= 4 mitochondria.
8. Sex — find mates, mix genes, survive 3 parasite waves while the clone colony collapses.
9. Multicellularity — sticky division, assign feeder/mover/sensor roles. 12 cells, all roles, energy full.
10. Nervous system — reflex-only nerve net phase, then cephalized flatworm with steering. "You can think."
