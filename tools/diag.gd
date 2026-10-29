extends Node3D
func _ready() -> void:
	var f := StaticBody3D.new(); var c := CollisionShape3D.new(); var b := BoxShape3D.new(); b.size = Vector3(100,1,100); c.shape = b; f.add_child(c); f.position.y = -0.5; add_child(f)
	for yaw in [0.0, PI, PI/2]:
		var n := Npc.spawn(self, Transform3D(Basis(Vector3.UP, yaw), Vector3(0,0,5)), 3)
		n.brain.set_physics_process(false)
		await get_tree().physics_frame
		print("yaw=%.2f center %s fwd %s" % [yaw, n.get_center(), n.body.get_forward()])
		n.queue_free()
	get_tree().quit()
