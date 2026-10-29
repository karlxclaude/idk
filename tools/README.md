# Tools (orchestrator-owned)

`visual_capture.tscn` renders the real main scene under a virtual X display and saves PNGs of a
scripted scenario (spawn, neck shot, bleed-out, second NPC, arm sever) to `tools/captures/`:

    xvfb-run -a -s "-screen 0 1600x900x24" godot --path . --rendering-driver opengl3 res://tools/visual_capture.tscn

Agents may copy it into their own test folder to check visuals; view PNGs with the Read tool.
