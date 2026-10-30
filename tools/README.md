# Tools (orchestrator-owned)

`visual_capture.tscn` renders the real main scene under a virtual X display and saves PNGs of a
scripted scenario (spawn, neck shot, bleed-out, second NPC, arm sever) to `tools/captures/`:

    xvfb-run -a -s "-screen 0 1600x900x24" godot --path . --rendering-driver opengl3 res://tools/visual_capture.tscn

Agents may copy it into their own test folder to check visuals; view PNGs with the Read tool.

`demo_playthrough.tscn` is a scripted playthrough driving the real Player node (aim, weapon select, fire/swing, grab/throw).
Record it with Godot Movie Maker under xvfb, then convert for phones:

    xvfb-run -a -s "-screen 0 1280x720x24" godot --path . --rendering-driver opengl3 \
      --write-movie demo.avi --fixed-fps 30 --resolution 1280x720 res://tools/demo_playthrough.tscn
    ffmpeg -i demo.avi -c:v libx264 -crf 27 -pix_fmt yuv420p -c:a aac -b:a 96k -movflags +faststart demo.mp4

Dry run without rendering (prints DEMO| events): `godot --headless --fixed-fps 30 --path . res://tools/demo_playthrough.tscn -- only=B`
(scenes A neck shot, B machete + grab/throw, C shotgun + rifle, D hammer). Rendering runs at ~30% real time on this machine.
