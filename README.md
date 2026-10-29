# Gore Sandbox

Physics-driven injury sandbox (Godot 4.4 + Jolt, GDScript). Adult, fictional, single-player.

Open the folder in Godot 4.4+ and run `scenes/main.tscn`.
Controls: WASD/mouse, 1/2/3 weapon (handgun/knife/bat), LMB fire/swing, RMB knife thrust,
hold Shift for mouse-driven free swing, N spawn NPC, F1 debug overlay, Esc release mouse.

Tests (headless): `godot --headless --path . res://tests/<name>.tscn` for smoke, ai, damage, body,
weapons_fx, acceptance (~150 s; `-- only=<section>` for one section).

Docs: `docs/ARCHITECTURE.md`, `docs/CONTRACTS.md`, `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/REVIEW.md`.
