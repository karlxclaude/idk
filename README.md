# EVERHUNGER

**A life at twenty microns.**

You are a single cell in murky pond water. Swim, engulf what is smaller than you, stay away from what is bigger,
and grow until you divide. Every division starts a new generation; your sister cells drift along as a small colony.

Built with TypeScript, PixiJS v8 and Vite. All art and audio is procedural: there are no asset files.

## What makes it feel alive

- **Soft-body membrane**: a ring of spring-connected points inflated by pressure. It wobbles when you accelerate,
  flattens against sediment grains and other cells, and bulges toward nearby food like a pseudopod.
- **Organelles with inertia**: nucleus, vacuoles, mitochondria and ribosome specks drift inside the translucent cytoplasm
  and lag behind the cell when it moves.
- **Phagocytosis**: food is wrapped by the membrane, pulled into a vacuole and dissolved over a couple of seconds.
  Mass is transferred while it dissolves, so growth is gradual.
- **Mitosis**: when the cell is big enough it elongates, pinches at the equator with two nuclei moving apart, and
  splits into two cells of the same lineage.
- **Biological motion**: flagella beat faster the harder you swim; paramecia row with cilia; everything has drag and momentum.
- **A living pond**: bacteria run and tumble, algae sink slowly, debris tumbles in the current. Amoebas, paramecia and
  predatory cells wander, hunt smaller cells and flee bigger ones.
- **Murky water**: depth-layered parallax particles that shrink as the camera zooms out, drifting light caustics and
  a microscope vignette.
- **No hard cuts**: every screen change is an eased fade; the camera lerps its follow and zooms out as you grow.

There are no power-ups, boosts, shields or abilities. Progress comes only from eating; danger comes only from bigger organisms.

## Controls

| Input | Action |
|---|---|
| Mouse | Swim toward the cursor (speed scales with distance) |
| `W` `A` `S` `D` / arrows | Swim (overrides the mouse) |
| Touch | Swim toward the finger while it is down, then coast |
| `Esc` / `P` or the ▐▐ button | Pause |

## Quick start

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # type-check then production build into dist/
npm run preview    # serve the production build
npm test           # unit tests (soft body, world simulation, helpers)
npm run test:e2e   # browser playtest: title, eating, mitosis, pause, death, restart on desktop and phone
```

`npm run test:e2e` uses the pre-installed Playwright Chromium; pass `--shots DIR` to save screenshots.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the module map and tuning notes.
