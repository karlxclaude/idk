# Neon Overdrive: build plan (written by Opus, built by Sonnet)

An original arcade street racer in the nitro, takedown and drift style. Do not copy any
existing game's name, cars, tracks, logos, UI or music. All cars and tracks are made up.

## Deliverable

- One file: `/home/user/idk/overdrive/game.html`. Everything inline except Three.js.
- Three.js r128 UMD from cdnjs, loaded before your inline script:
  `<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>`
  No other external scripts. Fonts only from Google Fonts (give fallbacks). No images or
  audio files: build geometry in code and draw any textures with canvas.
- **Artifact page format:** do NOT write `<!doctype>`, `<html>`, `<head>` or `<body>` tags. The
  file starts with `<title>Neon Overdrive</title>`, then
  `<meta name="claude:viewport-fit-sides" content="cover">`, then the font `<link>`, then
  `<style>`, then markup, then scripts. The host wraps it in a skeleton.
- Include `[hidden]{display:none!important}` and `html,body{height:100%}` in your CSS.
  Toggle overlays with `el.hidden`.
- One deliberate dark look: set `color-scheme: dark` on `:root`, give `body` an explicit
  background, and define every color as a CSS token on `:root`.
- HUD padding uses `max(16px, env(safe-area-inset-left, 0px))` (and the right inset as well).
  No horizontal page scroll. It must work at 390px phone width.
- No `alert`, `confirm` or `prompt`. No localStorage dependence (wrap any use in try/catch).

## Game design

**Fantasy:** night-time city circuit, wet neon asphalt, 6 cars, 2 laps, about 2 minutes.

1. **Track.** A closed loop from `THREE.CatmullRomCurve3` (about 12 to 16 control points)
   with sweeping corners, one hairpin and one long straight. Total length is about 2.5 to
   3.5 km in world units (1 unit = 1 m).
   - Build the road as a ribbon mesh: sample about 1200 points along the curve, and at each
     point offset ±ROAD_HALF (about 9 m) along the horizontal normal (tangent × up).
   - Add glowing edge strips, dashed center lines, a start/finish gantry, and repeating
     street lamps and neon-trimmed buildings placed along both sides. Use InstancedMesh or
     merged geometry so it stays fast.
   - Add 3 jump ramps on straights.
2. **Car physics: track-space, arcade.** Each car has `s` (distance along the track, which
   wraps), `lat` (sideways offset from the centerline), `speed`, `latVel`, `y` and `vy`.
   World position = curve point at s plus normal × lat. Heading follows the tangent, plus a
   yaw from steering and drift.
   - Throttle is automatic. Brake/drift is on ↓ or S. Steering is ←/→ or A/D.
   - Top speed is about 260 km/h, and nitro adds about 90.
   - Leaving the road (|lat| > ROAD_HALF) slows you hard and scrapes you along a soft wall.
3. **Drift.** Steer while holding brake above about 120 km/h. The car yaws visually and
   slides outward, smoke particles come off the rear wheels, and nitro charges while you
   drift.
4. **Nitro.** Space or Shift. The bar charges from drifting, near-misses with traffic (passing
   within 2 m), airtime and takedowns. Nitro raises the FOV, shows an exhaust flame and
   speed-line particles, and adds a slight camera shake.
   - **Perfect nitro:** tapping nitro again inside a short window as the first burst ends
     gives a stronger blue burst.
5. **Rivals.** 5 AI racers, each with a distinct body color and name tag. They follow a
   racing line (lat offset that varies smoothly with s), have rubber-band speed and avoid
   each other loosely. The leader rubber-bands slightly so races stay close.
6. **Traffic.** Slower civilian cars spread around the track in the same direction. Hitting
   one without nitro makes you spin out and lose speed. Hitting one with nitro is a
   takedown: it flips away, and you get a refill and a "TAKEDOWN" popup.
   - Ramming a rival with nitro also takes it down: it spins out for 2 s.
7. **Ramps.** Launch upward. While airborne, the player can do a barrel roll by pressing
   left/right in the air, for a bonus. Land with a little bounce.
8. **Race flow.** Title overlay leads to a 3-2-1-GO countdown (cars held on the grid), then
   2 laps, then a results overlay.
   - Results show finishing position, time, best lap, takedowns, near-misses, top speed and
     drift distance, plus a "Race again" button.
9. **HUD.**
   - Position (e.g. 2/6) in big type, lap counter, race timer.
   - Speedometer in km/h with a nitro bar.
   - A small canvas minimap of the track loop, with dots for every car.
   - Popup text for TAKEDOWN, NEAR MISS, DRIFT +n, PERFECT NITRO and BARREL ROLL.
10. **Camera.** A smooth chase cam behind and above the player, looking ahead along the
    track. It lags slightly in corners and pulls back on nitro.
11. **Mobile.** On `(pointer: coarse)`, show on-screen buttons: steer left, steer right,
    drift, and nitro (pointer events, with hold support).
12. **Look.** Deep navy/violet night with magenta and cyan neon accents, glossy dark road,
    fog, and emissive materials. Cars are low-poly: a body, a cabin, wheels that spin, and
    head and tail lights. Display font: something sporty from Google Fonts (e.g. "Chakra
    Petch" or "Saira Condensed").

## Quality bar

- Runs at 60 fps on a laptop. Clamp dt to 0.05. Pixel ratio is capped at 2.
- No console errors.
- Race end triggers correctly after lap 2. Positions are computed from total distance
  (lap × trackLength + s).
- Before you finish, do a JS syntax check of the inline script with node, e.g. extract the
  script and run `new Function(src)`.

## When you get stuck: ask Fable

For hard parts (track-space physics, the curve normal and banking math, AI racing line,
collision between cars in track space), if you are stuck after a real attempt, ask the
advisor:
- Spawn an Agent with `model: "fable"` and a focused question, then carry on with its
  advice.
- If you cannot spawn agents, stop and return a section headed `ADVISOR QUESTION:` with the
  exact question and the relevant code. Opus will relay it to Fable and send the answer back.
