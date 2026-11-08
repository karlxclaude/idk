# EVERHUNGER

**Eat. Grow. Become everything.**

You are a speck of hunger at 10⁻¹⁰ meters. Swallow what is smaller than you, flee what is bigger, and fill your size meter.
Then the camera pulls back across orders of magnitude and the entire world you just conquered shrinks into **one edible particle**
of the next scale. Twelve scales later you are eternal inflation itself, and the cycle begins again as New Game+.

Built with TypeScript, PixiJS v8 and Vite. All art and audio is procedural: there are no asset files.

## Features

- **12 scale tiers**, from quantum foam to eternal inflation, each with its own palette, parallax backgrounds, creatures, music and special mechanic.
- **The Scale Shift**: a seamless log-scale zoom transition. The world you just beat becomes an edible speck in the next tier.
- **Eat-or-be-eaten** rules based on relative size, with bumps, hurts, close-in-size risk eating, and hazards.
- **Per-tier abilities** (one per tier, kept forever once the tier is completed) plus dash and split.
- **Essence shop**: spend currency on upgrades (speed, magnet, armor, dash, split, glow, digest, siphon, gravity).
- **Adaptive procedural music** whose layers fade in as your size meter fills, plus synthesized sound effects.
- **Juice**: hit-stop, screen shake, particles, chromatic aberration and radial blur on shifts.
- **Player evolution**: the avatar changes form as you climb (blob, cell, creature, beast, planet, star core, cosmic entity, fractal).
- **Autosave**, Scale Map, New Game+ with rising density.
- **Desktop and touch** support, with accessibility options.
- **Data-driven content**: new tiers, creatures and mechanics are added by dropping in a file.

## Controls

### Desktop

| Input | Action |
|---|---|
| Mouse | Steer toward the cursor (speed scales with distance) |
| `W` `A` `S` `D` / arrow keys | Steer (overrides the mouse) |
| `Space` / `Shift` / right mouse button | Dash |
| `F` | Split |
| `Q` or `1` | Tier ability (ability 1) |
| `E` or `2` | Ability 2 |
| `R` or `3` | Ability 3 |
| `4` | Ability 4 |
| `Esc` / `P` | Pause |

Abilities 2 to 4 are unlocked by completing tiers; equip them in the Evolution shop.

### Touch

- **Follow mode** (default): the player moves toward your finger while it is down.
- **Joystick mode**: drag relative to where you first touched (switch in Settings, "Touch steering").
- Tap with a **second finger** to dash.
- On-screen buttons sit in a thumb cluster at the bottom right: Dash (large), Ability 1, Ability 2, Split, Abilities 3 and 4. A pause button is in the HUD.

### Debug (testing)

`]` fills the size meter (forces a scale shift), `[` adds 20% of the tier's mass, `\` jumps to the next tier.
URL params: `?tier=N`, `?seed=123`, `?debug=1`, `?quality=low|medium|high`, `?nodebugkeys=1`. See [ARCHITECTURE.md](ARCHITECTURE.md#12-debug-keys-and-url-params).

## Quick start

```bash
npm install
npm run dev        # Vite dev server on http://localhost:5173
npm run build      # type-check (tsc --noEmit) then production build into dist/
npm run preview    # serve the production build
npm run typecheck  # type-check only
```

There is no automated test script yet (`npm test` is not defined in `package.json`). `npm run typecheck` / `npm run build` is the current correctness gate,
and in dev mode the game logs `[validate]` notes for any dangling content ids.

## The scales

| # | Tier | Starting scale | Player form |
|---|---|---|---|
| 1 | Elemental | 10⁻¹⁰ m | blob |
| 2 | Molecular Reef | 10⁻⁸ m | cell |
| 3 | Primordial Pond | 10⁻⁵ m | cell |
| 4 | The Abyss | 10⁰ m | creature |
| 5 | Living Shore | 10² m | beast |
| 6 | Civilization | 10⁴ m | beast |
| 7 | Planetary | 10⁷ m | planet |
| 8 | Stellar | 10¹² m | star core |
| 9 | Galactic | 10²¹ m | star core |
| 10 | Cosmic Web | 10²⁴ m | cosmic entity |
| 11 | Observable Universe | 10²⁶ m | cosmic entity |
| 12 | Eternal Inflation | beyond 10²⁷ m | fractal |

Finishing tier 12 loops back to tier 1 as New Game+ (more creatures per tier each cycle).

## Accessibility

Open **Settings** from the title screen or the pause menu:

- **Reduce screen shake**: camera shake is heavily attenuated.
- **Reduce flashing**: full-screen flashes are dimmed and the scale-shift chromatic aberration, blur and flash are toned down.
- **Haptics**: toggle vibration feedback on touch devices.
- **Quality** (low / medium / high): lowers particle counts, entity density and shader-heavy backgrounds on weaker devices.
- **Touch steering**: follow or joystick.
- **Volume** sliders for master, music and effects, and a mute toggle.
- **Show FPS** overlay.

Settings are stored separately from the save game and persist between sessions.

## Documentation

See **[ARCHITECTURE.md](ARCHITECTURE.md)** for the module map, game loop, log-scale camera and floating origin, the scale-shift pipeline,
the tier data format, the event bus, save format, audio design, and step-by-step guides for adding tiers, creatures, behaviors, renderers,
backgrounds, mechanics, and real sprites.
