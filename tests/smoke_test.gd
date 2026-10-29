## Orchestrator smoke test: project parses, an NPC spawns, a DamageEvent flows through.
## Run: godot --headless --path . res://tests/smoke_test.tscn
extends Node3D


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	var npc := Npc.spawn(self, Transform3D(Basis(), Vector3(0, 0, 0)), 1)
	await get_tree().physics_frame
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BULLET
	ev.amount = 30.0
	ev.part_id = BodyIds.Part.TORSO
	ev.hit_position = npc.body.get_part_global_transform(BodyIds.Part.TORSO).origin
	npc.apply_damage(ev)
	for i in 30:
		await get_tree().physics_frame
	print("SMOKE OK: ", npc.get_debug_info())
	get_tree().quit(0)
