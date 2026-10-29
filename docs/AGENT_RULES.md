## Common rules (all agents)
- Project: /home/user/idk, Godot 4.4.1 + Jolt, GDScript only. Binary: `godot` on PATH.
- Read docs/CONTRACTS.md and scripts/contracts/*.gd, scripts/core/*.gd, scripts/npc/npc.gd first. NEVER edit them.
  If you need a contract change, stop and put it in your report.
- Edit ONLY files in your ownership list. Keep the existing public function signatures in your stub files.
- Other agents are building the other systems right now in parallel; their files are still stubs. Code only against the
  contract APIs, never their internals. Your tests must work against stubs (use fakes/direct calls where needed).
- All tunables go in your data file(s) (JSON, read via DataDB.table("name")). Pick sane defaults; don't over-tune.
- Parse-check: `godot --headless --path /home/user/idk --import` (needed after adding class_name scripts), then
  run your test scene: `godot --headless --path /home/user/idk res://tests/<file>.tscn`. Fix all script errors.
- Write one README.md in your scripts folder (<30 lines). Log non-obvious choices as bullet lines in your report
  (orchestrator writes DECISIONS.md). Add `TODO(roadmap: <name>)` comments at the plug-in points listed in docs/ROADMAP.md that fall in your files.
- Do NOT git commit. Do not ask questions; decide and report.
- Final report (short): what you built, public functions exposed, tunables added, test result output, known issues.
- Agents run concurrently in the same checkout. If a parse/import error is in a file you do NOT own, it is another
  agent mid-edit: wait ~30 s and retry; never touch it. If `--import` collides, just rerun it.
