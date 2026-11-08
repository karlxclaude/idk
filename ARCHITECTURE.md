# EVERHUNGER Architecture

TypeScript + PixiJS v8 + Vite. The game is **data-driven**: tiers, archetypes, behaviors, renderers,
backgrounds, mechanics, abilities, upgrades and player appearances are all plain definitions that
register themselves from their folder. The engine (`src/core`) knows nothing about specific content.

Everything in this file was checked against the source. File paths are relative to the repo root.
Interfaces (`types.ts`, registries) are described in detail; volatile internals are not.

## 1. Module map

| Folder | Responsibility |
|---|---|
| `src/main.ts` | Bootstrap: URL options, state, Pixi app, `Game`, audio, UI, debug, autosave, continue/new-game window events. |
| `src/core/` | Engine: `Game.ts` (orchestrator, implements `GameContext`), `loop.ts`, `camera.ts`, `events.ts` (typed bus), `input.ts`, `state.ts`, `save.ts`, `autosave.ts`, `stats.ts`, `registry.ts` (generic `Registry`), `context.ts`, `debug.ts`, `textures.ts`, `math.ts`, `pool.ts`, `spatialHash.ts`. |
| `src/scales/` | Tier definitions and everything a tier opts into: `types.ts` (`TierConfig`), `registry.ts` (`TIERS`, `getTier`, `nextTierIndex`), `tiers/`, `ScaleShift.ts`, `Background.ts` + `backgroundRegistry.ts` + `backgrounds/`, `mechanicRegistry.ts` + `mechanics/`, `validate.ts` (dev-time dangling-id check), `stubTier.ts` (helper for placeholder tiers). |
| `src/entities/` | Entity model: `types.ts` (archetype/behavior/renderer interfaces), `Entity.ts`, `World.ts` (pool, spatial hash, spawn/despawn), `Spawner.ts`, `Collision.ts`, `Player.ts`, `appearance.ts` (+ `appearances/`), `registries.ts` (auto-registration), `define.ts` (typed identity helpers), and the content folders `archetypes/`, `behaviors/`, `renderers/`. |
| `src/fx/` | `FX.ts` facade (burst, floatText, flash, shake, hitStop, vibrate), `particles.ts`, `floatingText.ts`, `screenOverlay.ts` (vignette/flash), `filters/` (chromatic aberration, radial blur for the shift). |
| `src/ui/` | DOM overlays: `hud.ts`, `menus.ts` (pause, settings, scale map), `title/`, `titleCard.ts`, `shop/`, `dom.ts` (theme injection). `index.ts` mounts them. |
| `src/audio/` | `AudioEngine.ts` (event-driven), `sfx.ts`, `music.ts`, `synth.ts`. Fully procedural WebAudio. |
| `src/upgrades/` | `registry.ts` (`UpgradeDef`), `defs/`, `purchase.ts` (buy + equip), `progression.ts` (grants a tier's ability after it is completed). |
| `src/abilities/` | `registry.ts` (`AbilityDef`), `defs/`, `AbilitySystem.ts` (slots + cooldowns). |

## 2. Game loop

`src/core/loop.ts` (`GameLoop`) is driven by the Pixi ticker (`app.ticker.add` in `Game`'s constructor).

- **Fixed step**: `update(dt)` runs at `fixedDt = 1/60` in *sim time*. Real delta is clamped to 0.1 s,
  multiplied by `timeScale`, accumulated, and consumed in at most `maxStepsPerFrame = 5` steps
  (the accumulator is dropped if the cap is hit, avoiding a spiral of death).
- **Hooks**: `LoopHooks { update(dt); realUpdate(realDt); render(alpha, realDt) }`.
  `realUpdate` runs once per frame in real time (scale shift, camera shake, FX). `render(alpha)` runs once
  per frame; `alpha = acc / fixedDt` is used to interpolate the camera (`Camera.interpolate`), entities and the player between the previous and current sim state.
- **Pause**: `setPaused(bool)` zeroes the sim delta. `Game.setPaused` also emits `pause`. The `pause` action
  toggles it (ignored during a shift), and the tab being hidden auto-pauses.
- **Hit-stop**: `hitStop(ms)` freezes the sim for `ms` *real* milliseconds (stacks as max, not sum). `FX.hitStop` calls it; `Game.eat` and `Game.hurt` use it.
- **Frozen**: `loop.frozen` freezes the sim independently of pause. `ScaleShift` sets it for the zoom-out phase.
- **Sim step order** (`Game.update`): player update, split, abilities, `world.update`, mechanics `update`, collisions
  (eat / hurt / bump), `world.compact`, spawner, respawn timer, camera follow, floating-origin rebase,
  progress + scale shift trigger.

## 3. Log-scale camera, floating origin, and the global 10^x scale

Defined in `src/core/camera.ts` and `Game.rebase` / `Game.enterTier`.

- **Every tier has its own local coordinate space.** The player always starts a tier at `REFERENCE_RADIUS = 20`
  local units at (0, 0). Entity sizes in `SpawnEntry` are relative to the player's radius by default.
  Local numbers therefore never get astronomically large or small, regardless of how many orders of magnitude
  the story spans.
- **The absolute scale is an exponent, never a meter value.** `TierConfig.scaleExponent` = log10 of the
  player's starting radius in meters (tier 1 = -10, tier 12 = 30). The live value is
  `Camera.metersExponent(scaleExponent, localLength) = scaleExponent + log10(localLength / REFERENCE_RADIUS)`.
  `Game.update` writes this into `camera.displayExponent` every step; the HUD formats it with
  `formatScale(exp)` ("10^-35 m" style, with superscripts). Because only a log10 number is stored,
  precision never degrades across 40 decades.
- **Zoom** (`camera.zoom`, pixels per local unit) follows `zoomFor(radius)`, which keeps the player at a roughly
  constant on-screen size (`clamp(sqrt(w*h)*0.045, 18, 60)` px). Zoom is smoothed in log space (`follow`, `interpolate`).
- **Floating origin**: when the player is more than `REBASE_DISTANCE_RADII = 250` player radii from (0, 0) on either
  axis, `Game.rebase(dx, dy)` subtracts the offset from the player, the camera (current, previous, rendered),
  every entity (`World.rebase`), FX (`FX.rebase`) and every mechanic that implements `rebase`.
  The accumulated offset is kept in `camera.originX/originY` so parallax backgrounds can still compute absolute
  positions (`LayerCamera.x = originX + rx`). An `originRebased {dx, dy}` event is emitted. Anything that stores world positions
  (new mechanics, behaviors keeping state in `e.data`) must handle this event or implement `MechanicInstance.rebase`.
- **Screen shake** is camera trauma (`addShake`, `updateShake`), scaled by `camera.shakeScale` (accessibility).
- During a scale shift `followEnabled` is false and `ScaleShift` drives zoom/position directly while it animates `displayExponent` between the two tiers' `scaleExponent` values.

## 4. The scale-shift pipeline

Trigger: `Game.update` calls `triggerScaleShift()` when `player.mass >= tier.growthTarget`.
`Game.triggerScaleShift` calls `ScaleShift.start(nextTierIndex(tier.index))`. `nextTierIndex` wraps the last tier to 1 (New Game+).
Implementation: `src/scales/ScaleShift.ts` (durations `SHIFT_OUT_DURATION = 1.4 s`, `SHIFT_IN_DURATION = 2.0 s`, both real time).

1. **`start`**: `loop.frozen = true`, camera follow off, `controlLocked = true`, pressed actions cleared. Installs the
   `RadialBlurFilter` and `ChromaticAberrationFilter` on `layers.scene`. FX: player gulp, flash, shake, vibrate.
   Emits **`scaleShiftStart {from, to}`** (audio: riser and ducking).
2. **Phase OUT** (`update`, t < 1.4 s): camera zooms out `10^1.6` in log space with an ease-in curve, filter strength and vignette ramp up, `displayExponent` eases toward the target tier's exponent. Reduced-flashing lowers filter maxima.
3. **`mid()`** (one frame, hidden behind a white flash):
   1. Filters are removed and `layers.scene` is rendered into a `RenderTexture` snapshot.
   2. The snapshot is masked into a circle with a rim tinted `from.palette.playerGlow`, producing the **speck texture** (512 px).
   3. If `from.index === TIER_COUNT && toIndex === 1`: `state.ngPlus++` and **`ngPlus {count}`** is emitted.
   4. `Game.enterTier(toIndex, {viaShift: true})` tears down the old world (mechanics, background, entities, FX) and builds the new one
      (player reset, appearance, background, mechanics, spawner, abilities reset), emitting **`tierEnter {tier, viaShift: true, ngPlus}`** and **`tierProgress`**.
      The previous speck texture (`game.lastWorldTexture`) is destroyed and replaced by the new one.
   5. **Speck carry-over**: a real edible `prevSpeck` entity (archetype in `entities/archetypes/generic.ts`, renderer `speck`) is spawned
      near the new player with `data: { texture, label: 'Consumed: <old tier name>', mainSpeck: true }`, `nutritionMul: 4`, `essenceBonus: 10`.
      The old world is literally a snack in the new one. Separately, `Spawner.setTier` adds `tier.previousSpeck` echo specks (count, size, colors, label, nutrition, essence) for tiers with `index > 1`.
   6. The camera is snapped so the speck exactly covers the circle the old world occupied on screen (`zIn0`), with `zIn1 = zoomFor(player.radius)` as the destination.
   7. Sim unfreezes, the player is invulnerable for `SHIFT_IN_DURATION + 1` s, a flash and shake play, and **`scaleShiftMid {from, to}`** is emitted (audio: "whoomp").
4. **Phase IN** (2.0 s): the camera zooms out (ease-out, log) while panning from the speck to the player, so the old world visibly shrinks into one particle. Filters fade out, the new background fades in. The UI shows the title card on `tierEnter`.
5. **`end()`**: filters cleared, follow and control restored, **`scaleShiftEnd {from, to}`** emitted.
   Listeners: autosave flushes, `progression.ts` grants `from.abilityId` into `state.ownedAbilities` (dispatching `everhunger:abilityGranted`), the shop opens (`everhunger:openShop`), audio plays a shimmer.

`Game.jumpToTier(i)` (debug, Scale Map) skips all of this and calls `enterTier(i, {viaShift: false})`.

## 5. Data-driven tier format

One file per tier in `src/scales/tiers/`, `export default defineTier({...})`. `src/scales/registry.ts` globs `./tiers/*.ts`, sorts by `index`,
and warns if indexes are not contiguous from 1. Tier-local `archetypes` are registered into `archetypeRegistry` at load.

`TierConfig` (see `src/scales/types.ts` for full docs):

| Field | Meaning |
|---|---|
| `id`, `index`, `name` | Stable id, 1-based unique contiguous ladder position, display name. |
| `scaleLabel`, `scaleExponent` | Label string and log10(meters) of the player's starting radius. |
| `palette` | `TierPalette`: `bgTop`, `bgBottom`, `bgCenter?`, `fog`, `fogAlpha`, `accent`, `glow`, `player`, `playerGlow`, `particles?`. |
| `background` | `BackgroundLayerDef[]`, back to front: `type`, `depth` (0 fixed to screen, 1 moves with world, >1 foreground), `color/colors`, `alpha`, `density`, `blend`, `scale`, `speed`, `params`. |
| `ambient` | `AmbientParticleConfig[]` rendered by the `sparks` layer type (`depth <= 1` behind, `> 1` in front). |
| `music` | `MusicParams`: `root`, `octave`, `mode`, `tempo`, `timbre`, `mood`, `layers`, `reverb?`. |
| `spawns`, `hazards` | `SpawnEntry[]`: `archetype`, `count` (target alive), `size` (relative to player radius unless `sizeMode: 'absolute'`), `colors`, `colors2`, `progress: [from, to]` window, `group`, `nutritionMul`, `essenceBonus`, `data`. |
| `mechanics` | `MechanicRef[]` (`id`, `params`) from `src/scales/mechanics/`. |
| `abilityId` | Ability bound to the `ability1` action (unknown ids fall back to `pulse`). |
| `playerStage` | Player appearance id (unknown falls back to `blob`). |
| `growthTarget` | Mass that fills the size meter (player starts at mass 1; radius = 20 * sqrt(mass)). |
| `nutrition?`, `eatRatio?`, `dangerRatio?` | Tier-wide nutrition multiplier (default 0.5) and eat/danger thresholds. |
| `previousSpeck` | Echo specks of the conquered world: `count`, `size`, `label`, `colors`, `nutritionMul`, `essence`. |
| `titleCard` | `title`, `subtitle?`, `flavor?`. |
| `archetypes?`, `maxEntities?` | Tier-local archetypes; entity cap (default 260 set in `Game.enterTier`). |

Trimmed real example (`src/scales/tiers/tier02_molecularReef.ts`):

```ts
export default defineTier({
  id: 'molecularReef', index: 2, name: 'Molecular Reef',
  scaleLabel: '10⁻⁸ m', scaleExponent: -8,
  palette: { bgTop: 0x03221f, bgBottom: 0x0a0522, bgCenter: 0x0c5a52, fog: 0x0b3a40, fogAlpha: 0.3,
             accent: 0x5dffb0, glow: 0xc27aff, player: 0xeafff5, playerGlow: 0x5dffb0 },
  background: [
    { type: 'gradient', depth: 0, alpha: 0.55 },
    { type: 'reefKelp', depth: 0.14, density: 7, colors: [0x5a2aa8, 0x2a5aa8], alpha: 0.4, params: { height: 0.85 } },
    { type: 'dots', depth: 0.4, color: 0x9fffe0, density: 0.9, blend: 'add' },
  ],
  ambient: [{ count: 34, colors: [0x5dffb0, 0xc27aff], size: [2, 6], drift: 12, flicker: 0.3, depth: 0.7 }],
  music: { root: 'D', octave: 2, mode: 'mixolydian', tempo: 92,
           timbre: { pad: 'sine', bass: 'triangle' }, mood: 'Bubbly, crystalline...',
           layers: ['drone', 'bubbles', 'pulse', 'arp'], reverb: 0.6 },
  spawns: [
    { archetype: 't02_water', count: 18, size: [0.12, 0.24], group: { size: [4, 8], spread: 3 } },
    { archetype: 't02_enzyme', count: 2, size: [1.5, 2.4], progress: [0.12, 1] },
  ],
  hazards: [{ archetype: 't02_radical', count: 1, size: [1.7, 2.5], progress: [0.3, 1] }],
  mechanics: [{ id: 't02_bonding' }],
  abilityId: 'bondSnap', playerStage: 'cell', growthTarget: 15, nutrition: 0.5,
  previousSpeck: { count: 3, size: [0.3, 0.5], label: 'a glittering atom', colors: [0x5ad1ff], nutritionMul: 1.5, essence: 2 },
  titleCard: { title: 'Molecular Reef', subtitle: 'Chemistry Blooms', flavor: 'Bonds form and break...' },
});
```

### Tier ladder

| # | id | Name | `scaleExponent` | `abilityId` | `playerStage` | `growthTarget` |
|---|---|---|---|---|---|---|
| 1 | `elemental` | Elemental | -10 | `quantumLeap` | `blob` | 16 |
| 2 | `molecularReef` | Molecular Reef | -8 | `bondSnap` | `cell` | 15 |
| 3 | `primordialPond` | Primordial Pond | -5 | `flagellumBurst` | `cell` | 16 |
| 4 | `abyss` | The Abyss | 0 | `bioluminescentLure` | `creature` | 16 |
| 5 | `livingShore` | Living Shore | 2 | `tidalSurge` | `beast` | 18 |
| 6 | `civilization` | Civilization | 4 | `gridlock` | `beast` | 20 |
| 7 | `planetary` | Planetary | 7 | `tectonicQuake` | `planet` | 15 |
| 8 | `stellar` | Stellar | 12 | `solarFlare` | `starCore` | 15 |
| 9 | `galactic` | Galactic | 21 | `spiralArm` | `starCore` | 15 |
| 10 | `cosmicWeb` | Cosmic Web | 24 | `darkMatterTug` | `cosmicEntity` | 18 |
| 11 | `observableUniverse` | Observable Universe | 26 | `inflationPulse` | `cosmicEntity` | 18 |
| 12 | `eternalInflation` | Eternal Inflation | 30 | `bubbleNucleation` | `fractal` | 20 |

(Values may be rebalanced; the tier files are authoritative.)

### Validation
`src/scales/validate.ts` (`validateContent`, run in dev from `main.ts`) logs dangling renderer/behavior/archetype/background/mechanic/ability/appearance ids and `growthTarget <= 1`. Registries also `console.warn` on unknown ids at use time.

## 6. Entity system

Types: `src/entities/types.ts`. Units: radii and positions are tier-local; behavior speeds are in **own radii per second**.

- **`EntityArchetype`** (pure data): `id`, `renderer: {id, params}`, `behaviors: [{id, params}]`, `radius`, `colors`, `colors2`,
  `massValue`, `essence`, `edible` (`'normal' | 'closeInSizeOnly' | 'never'`), `closeBehavior` (`'bump' | 'hurt' | 'none'`),
  `damage`, `closeDamage`, `drag`, `maxSpeed`, `spin`, `lifetime`, `tags`, `persistent`, `hitScale`, `bounce`.
  With `ratio = entity.radius / player.radius`: `ratio < eatRatio` is eaten, `ratio > dangerRatio` hurts, the band between follows `closeBehavior`
  (or the `closeInSizeOnly` risk-eat rule). Mass gain: `(r/20)^2 * massValue * nutritionMul * tier.nutrition * stats.nutrition * mechanicMultiplier` (`Game.eat`).
- **`BehaviorDef<P>`**: `id`, `defaults`, optional `init(e, p, ctx)`, `update(e, p, ctx, dt)` (60 Hz; mutate `e.vx/vy/alpha`, keep per-entity state in `e.data`). Params are `{...defaults, ...archetypeParams}`, resolved and cached by `resolveBehaviors`. Built-ins in `behaviors/core.ts`: `drift, wander, flee, chase, flicker, orbit, schooling, lure, gravityWell, pulse, faceVelocity, separate`.
- **`RendererDef<P>`**: `id`, `defaults`, `create(arch, p, ctx)` returns a Pixi `Container` whose **body radius is 1 unit** (the world scales it by `entity.radius`);
  built once per pooled view, bake textures here. Optional `reset(view, e, p, ctx)` (per-entity tint) and `update(view, e, p, ctx, realDt)` (per frame, only while visible). Built-ins in `renderers/core.ts`: `glowOrb, ring, spiky, polygon, quark, nucleon, cluster, speck`. Unknown ids fall back to `glowOrb`.
- **`Entity`/`World`**: entities and their views are pooled; `World` keeps a spatial hash (`core/spatialHash.ts`), `spawn(archetypeId, x, y, SpawnOptions)`, `despawn(e, reason)`, `within(x, y, r)`, `rebase`. `Spawner` keeps each `SpawnEntry` at its target `count` (scaled by `densityScale`: quality and NG+), honouring `progress` windows and groups.
- **Auto-registration by folder** (`src/entities/registries.ts`): `import.meta.glob('./<folder>/**/*.ts', { eager: true })` feeds
  `behaviorRegistry` (`behaviors/`), `rendererRegistry` (`renderers/`), `archetypeRegistry` (`archetypes/`), `appearanceRegistry` (`appearances/`).
  `Registry.addModules` (`src/core/registry.ts`) registers each module's `default` export (a single def or an array); duplicate ids warn and override.
  The same pattern is used for `scales/tiers`, `scales/mechanics`, `scales/backgrounds`, `abilities/defs`, `upgrades/defs`.
  **Adding content = adding a file; no shared registry file is edited.**
- **Helper files with no default export** (e.g. `renderers/t04_kit.ts`, `renderers/t05_kit.ts`, `renderers/t07_common.ts`, `renderers/t12_soap.ts`, `renderers/t11_cmbTex.ts`, `appearances/_kit.ts`, `mechanics/t10_webField.ts`): `addModules` skips modules whose `default` is `undefined`,
  so shared helpers can live next to content safely. **Content files must import helpers from `./define` (or other helper files), never from `registries.ts`**, to avoid an init cycle (the registries import the content eagerly).
- `define.ts` exports identity helpers for typing: `defineArchetypes`, `defineBehaviors`, `defineRenderers`, `defineAppearance`.
- Archetype ids are globally unique. Convention: `tNN_name` for tier-specific, `generic_*` for reusable ones (`generic_food`, `generic_drifter`, `generic_school`, `generic_big`, `generic_predator`, `generic_hazard`, `generic_well`) and the special `prevSpeck`.
  Spawn entries can re-skin generic archetypes with `colors`/`colors2`.

## 7. Mechanics, backgrounds, appearances, abilities, upgrades

- **Mechanics** (`src/scales/mechanicRegistry.ts`, files in `scales/mechanics/`): `MechanicDef { id, defaults, create(params, ctx) }` returns a `MechanicInstance`
  with optional `update(dt)` (60 Hz), `render(alpha, realDt)`, `onEat(e, ratio)` (return a mass multiplier), `rebase(dx, dy)`, and required `destroy()`.
  Tiers opt in via `TierConfig.mechanics`; `Game.enterTier` instantiates them and `teardownTier` destroys them. They may draw into `ctx.layers.worldUnder`. They commonly emit the generic `mechanic` event. Examples: `ionize`, `t02_bonding`, `t05_tides`, `t06_cityGrid`, `t07_orbitals`, `t08_blackhole`, `t09_galacticForces`, `t10_filaments`, `t11_hubbleFlow`, `t12_eternalInflation`.
- **Background layers** (`src/scales/backgroundRegistry.ts`, `Background.ts`, files in `scales/backgrounds/`): `BackgroundLayerType { id, create(def, tier, ctx) }` returns
  `{ view, update(LayerCamera), resize?, destroy }`. `view` is in screen space; `LayerCamera` carries absolute `x/y` (origin included), `zoom`, `zoomRatio`, size, time. `TierBackground` builds layers from `tier.background` plus `tier.ambient` (as `sparks`), splits them into `back` (depth <= 1) and `front` (depth > 1) containers, and swaps `nebula` for the cheaper `blobs` on `quality: 'low'`. Built-ins: `gradient, nebula, dots, sparks, blobs`; tier-specific ones are prefixed (`reefKelp`, `lightShafts`, `t04_*` ... `t12_*`).
- **Player appearances** (`src/entities/appearance.ts`, files in `entities/appearances/`): `PlayerAppearanceDef { id, create(tier, ctx) }` returns
  `{ view (radius 1), update(player, ctx, realDt), onEat?, onHurt?, destroy }`. Selected by `TierConfig.playerStage`; ids: `blob, cell, creature, beast, planet, starCore, cosmicEntity, fractal`. `_kit.ts` holds shared helpers.
- **Abilities** (`src/abilities/registry.ts`, `AbilitySystem.ts`, `defs/`): `AbilityDef { id, name, description, cooldown, icon?, activate(ctx) -> boolean, update?(ctx, dt) }`.
  Slots: `ability1` = current tier's `abilityId`; `ability2..4` = `state.ownedAbilities[0..2]`. Completing a tier permanently grants its ability (`upgrades/progression.ts`);
  the shop's `equipAbility` reorders the owned list (`upgrades/purchase.ts`). `dash` and `split` are separate built-in actions. Activation emits `abilityUsed`.
- **Upgrades** (`src/upgrades/registry.ts`, `defs/core.ts`): `UpgradeDef { id, name, description, maxLevel, cost(level), apply(stats, level), icon?, unlockTier?, effect?(level), grantsAbility? }`.
  Owned levels live in `state.ownedUpgrades`; `computeStats(state)` (`core/stats.ts`) folds all of them into `PlayerStats` starting from `BASE_STATS`.
  Call `game.refreshStats()` after a purchase. Built-ins: `speed, magnet, armor, dash, split, glow, digest, siphon, gravity`.

## 8. Event bus

`src/core/events.ts`: `EventBus<GameEvents>` with `on(type, fn) -> off`, `once`, `off`, `emit`, `clear`. Handler exceptions are caught and logged. The singleton is `events` (also `game.events`). Payload shapes are a public contract.

| Event | Payload |
|---|---|
| `eat` | `{ entity: Entity; archetypeId: string; massGained: number; essenceGained: number; x; y; sizeRatio: number; playerMass: number }` |
| `bump` | `{ entity: Entity; x; y; sizeRatio }` |
| `hurt` | `{ source: Entity \| null; massLost: number; x; y; sizeRatio }` |
| `death` | `{ tierIndex: number; x; y }` |
| `respawn` | `{ tierIndex: number; mass: number }` |
| `tierProgress` | `{ tierIndex: number; progress: number; mass: number; target: number }` (progress 0..1, at most once per sim step) |
| `tierEnter` | `{ tier: TierConfig; viaShift: boolean; ngPlus: number }` |
| `scaleShiftStart` | `{ from: TierConfig; to: TierConfig }` |
| `scaleShiftMid` | `{ from: TierConfig; to: TierConfig }` |
| `scaleShiftEnd` | `{ from: TierConfig; to: TierConfig }` |
| `essenceChanged` | `{ essence: number; delta: number }` |
| `abilityUsed` | `{ id: string; action: Action \| null; x; y }` (dash uses id `'dash'`) |
| `pause` | `{ paused: boolean }` |
| `originRebased` | `{ dx: number; dy: number }` (all local coordinates were shifted by `-dx, -dy`) |
| `ngPlus` | `{ count: number }` |
| `settingsChanged` | `{ settings: Settings }` |
| `mechanic` | `{ mechanic: string; kind: string; x; y; value?: number }` |
| `action` | `{ action: Action }` (raw action press before gameplay handles it) |

To add an event: add a key to `GameEvents`, emit it from the engine, subscribe elsewhere.

## 9. Window CustomEvents between UI modules

Plain DOM `CustomEvent`s on `window` (not the typed bus), used for UI and app-level glue:

| Name | Dispatched by | Handled by | `detail` |
|---|---|---|---|
| `everhunger:continue` | `ui/title/index.ts` | `main.ts` (restores save, `enterTier`, enables autosave) | none |
| `everhunger:newGame` | `ui/title/index.ts` | `main.ts` (clears save, default state, `game.start(1)`) | none |
| `everhunger:openTitle` | `ui/menus.ts` (pause menu) | `ui/index.ts` | none |
| `everhunger:openScaleMap` | `ui/title/index.ts` | `ui/index.ts` | none |
| `everhunger:openSettings` | `ui/title/index.ts` | `ui/index.ts` | none |
| `everhunger:openShop` | `ui/menus.ts`, scale shift flow | `ui/shop/index.ts` | none |
| `everhunger:settingsChanged` | `ui/menus.ts` | `main.ts` (persists settings) | `Settings` (or `{settings}`) |
| `everhunger:upgradePurchased` | `upgrades/purchase.ts` | UI listeners | `{ id, level, cost }` |
| `everhunger:abilityEquipped` | `upgrades/purchase.ts` | UI listeners | `{ slot, id }` |
| `everhunger:abilityGranted` | `upgrades/progression.ts` | UI listeners | `{ id }` |

Re-check with `grep -rn "everhunger:" src` when adding more.

## 10. Save schema, autosave, settings, accessibility

`src/core/state.ts` defines `GameState` (JSON-serialisable): `version: 1`, `tierIndex`, `mass`, `essence`, `totalEssence`, `ownedUpgrades` (id to level), `ownedAbilities`,
`maxTierReached`, `unlockedTiers`, `ngPlus`, `settings`, `stats { eaten, deaths, playTimeSec, biggestEatRatio }`.

`src/core/save.ts` (`saveStore`, `LocalStorageSaveStore`):
- Envelope `{ v: 2, savedAt, game }` under localStorage key `everhunger.save.v2`. Legacy raw v1 state under `everhunger.save.v1` is migrated on read.
- **Settings are stored separately** under `everhunger.settings.v1`; the game envelope is written with default settings (`persistable`).
- `sanitizeGame` validates and clamps every field (so hand-edited or corrupt saves load safely). All storage access is try/catch-wrapped.
- Export/import: `exportString` / `importString` (base64 of the JSON envelope).
- API: `hasSave, loadGame, saveGame, clearSave, loadSettings, saveSettings, exportString, importString` (plus legacy `load/save/clear`).

`src/core/autosave.ts` (`installAutosave(game, startEnabled)`): flushes immediately on `scaleShiftEnd`, `ngPlus`, pause; throttles (4 s) on `tierEnter` and `essenceChanged`;
runs a 30 s periodic throttled save; also flushes on `visibilitychange` (hidden) and `pagehide`. It will not write the untouched boot state, and starts disabled when a save exists
(until the player chooses Continue or New Game, or `?tier=` forces a session) so an existing save is never clobbered.

`Settings`: `masterVolume`, `musicVolume`, `sfxVolume`, `reduceFlashing`, `reduceShake`, `quality ('low'|'medium'|'high')`, `touchMode ('follow'|'joystick')`, `haptics`, `showFps`.
`Game.applySettings(s)` updates input touch mode and `FX.applySettings`, then emits `settingsChanged`.
- `reduceShake`: camera `shakeScale` becomes 0.08 (heavily attenuated, not fully off).
- `reduceFlashing`: overlay flashes scaled to 0.35; the scale shift uses smaller chromatic aberration/radial blur and a dimmer mid flash.
- `quality`: particle cap/density, floating text cap, spawner density (`low` = 0.7x), nebula to blobs background swap on `low`.
- `haptics` gates `FX.vibrate`; `showFps` shows the HUD fps counter.

## 11. Audio architecture

`src/audio/` is fully procedural WebAudio, with no asset files. `AudioEngine` (created in `main.ts`, `init()` registers listeners) is **driven only by the event bus** and has no reference to `Game`.
- **Unlock**: the `AudioContext` is created on the first `pointerdown/keydown/touchend/click`. It suspends when the tab is hidden. A global capture `click` handler plays a UI click for buttons.
- **Master bus** (`synth.ts`, `createBus`): compressor/limiter, reverb and volume stages (master / music / sfx from `Settings`, applied on `settingsChanged`). Ducks while paused or shifting.
- **SFX** (`sfx.ts`): synthesized one-shots, rate-limited with soft/hard voice caps. Event mapping: `eat`, `bump`, `hurt`, `death`, `respawn`, `abilityUsed` (by ability id), `essenceChanged`, `mechanic`, `ngPlus`, `pause`, plus shift sounds (`scaleShiftStart` riser, `scaleShiftMid` whoomp, `scaleShiftEnd`/non-shift `tierEnter` shimmer). Eat pitches follow the tier's key and a combo counter.
- **Adaptive music** (`music.ts`): one voice set per tier built from `TierConfig.music` (`root`, `octave`, `mode` from `MODES` in `synth.ts`, `tempo`, `timbre`, `layers`, `reverb`). Layer kinds: `drone, bass, pulse, arp, lead, shimmer` (aliases such as `pad`, `perc`, `melody`, `texture` map onto them). The drone is always on; the other layers fade in with `tierProgress` in the order listed in `layers`. Notes are scheduled by a lookahead timer. `tierEnter` crossfades to the new tier's music.

## 12. Debug keys and URL params

`src/core/debug.ts` (`readUrlOptions`, `installDebug`):

| Param | Effect |
|---|---|
| `?tier=N` | Start at tier N (1..12); skips the title screen and enables autosave. |
| `?seed=123` | Fixed RNG seed (`new Rng(seed)`). |
| `?debug=1` | Turns on the FPS display (`settings.showFps`). |
| `?quality=low\|medium\|high` | Override render quality. |
| `?nodebugkeys=1` | Disable the debug hotkeys below. |

Debug keys (action names in `core/input.ts`): `]` fill the size meter (forces a scale shift), `[` +20% of tier mass, `\` jump to the next tier instantly. All are ignored mid-shift.
`window.__game` is the `Game` instance (always installed). Handy: `__game.shift.speed = 0.2` (slow-motion shift), `__game.jumpToTier(7)`.

## 13. How-tos

### Add a tier
1. Create `src/scales/tiers/tierNN_name.ts` with `export default defineTier({...})` and an `index` that continues the ladder contiguously. `TIER_COUNT`, the scale map, tier-wrap to New Game+ and `?tier=` all derive from `TIERS`.
2. Set `scaleExponent` (log10 meters of the player's starting radius) and `scaleLabel`.
3. Reference only registered ids: `archetype`, background `type`, `mechanics`, `abilityId`, `playerStage`. Add anything missing (below). Put tier-local archetypes in `archetypes: [...]` or a file in `src/entities/archetypes/`.
4. Fill `palette`, `music`, `previousSpeck` and `titleCard`. Tune `growthTarget`.
5. Run `npm run dev` and watch the console for `[validate]` notes, then test with `?tier=N&debug=1`.
(`stubTier.ts` builds a minimal placeholder tier if you only need the ladder to be walkable.)

### Add an archetype
New file `src/entities/archetypes/tNN_name.ts`:
```ts
import { defineArchetypes } from '../define';
export default defineArchetypes([
  { id: 't13_thing', renderer: { id: 'glowOrb' }, behaviors: [{ id: 'wander', params: { speed: 1 } }],
    colors: [0xff8800], massValue: 1, essence: 1 },
]);
```
Reference it from a tier's `spawns` / `hazards` by id.

### Add a behavior
New file in `src/entities/behaviors/`, `export default defineBehaviors([{ id: 'myBehavior', defaults: {...}, init?, update(e, p, ctx, dt) { ... } }])`.
Speeds in own radii per second (`p.speed * e.radius`); per-entity state in `e.data`; honour `originRebased` if you store absolute positions.

### Add a renderer
New file in `src/entities/renderers/`, `export default defineRenderers([{ id, create(arch, p, ctx) -> Container (body radius 1), reset?, update? }])`.
Bake textures once with `bakeTexture(key, size, draw)` from `src/core/textures.ts`; never allocate per frame. Share code through a helper file with no default export.

### Add a background layer
New file in `src/scales/backgrounds/` exporting a default `BackgroundLayerType` (`{ id, create(def, tier, ctx) -> { view, update(cam), resize?, destroy } }`), then use `{ type: '<id>', depth, ... }` in a tier's `background`.
Screen-space view; use `cam.x/y` (absolute) and `cam.zoom` for parallax, and respect `ctx.state.settings.quality`.

### Add a mechanic
New file in `src/scales/mechanics/` exporting a default `MechanicDef` (`{ id, defaults, create(params, ctx) -> MechanicInstance }`). Clean up everything in `destroy()`, implement `rebase(dx, dy)` for any stored world positions, and add `{ id: '<id>', params }` to a tier's `mechanics`.
Emit `ctx.events.emit('mechanic', {...})` for audio/FX hooks.

### Add an ability, upgrade, or appearance
Drop a file with a default-exported def into `src/abilities/defs/`, `src/upgrades/defs/` or `src/entities/appearances/`, then reference its id (`abilityId`, `playerStage`; upgrades appear in the shop automatically, gated by `unlockTier`).

### Swap in real sprites
All art is currently baked procedurally on a 2D canvas, then cached by key in `src/core/textures.ts`.
1. Bake-key swap: before the first use of a key, call `registerTexture(key, Texture.from(url))` (or `Assets.load` then register). Any renderer calling `bakeTexture(sameKey, ...)` gets the real texture instead, because the cache is checked first. Built-in keys are `core:glow`, `core:disc`, `core:orb`, `core:ring`, `core:spark`, `core:dot`, `core:vignette`; renderers use `rendererId:name`-style keys.
2. Per-archetype: write a renderer whose `create` returns a `Sprite` (anchor 0.5) sized so the body radius is 1 unit (`sprite.width = sprite.height = 2`, plus any padding), and point the archetype's `renderer.id` at it. Tint via `reset(view, e)` using `e.color`; most built-in textures are white so tint works.
3. Player: add an appearance in `src/entities/appearances/` whose `view` is a sprite with radius 1.
4. Register art before the game starts (top of `main.ts`) or at the top of the renderer module, so it exists before the first `create`. Keep `bakeTexture` as the fallback.
