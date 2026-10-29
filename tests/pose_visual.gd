## Visual rig for PoseDriver (no physics): captures PNGs of poses. Run (needs a display, e.g. Xvfb):
##   xvfb-run -a -s "-screen 0 1600x900x24" godot --path . --rendering-driver opengl3 res://tests/pose_visual.tscn
## Output dir: first user arg after `--` or res://tests/captures/.
extends Node3D

const P := BodyIds.Part
const DT := 1.0 / 60.0

var _layout := {}
var _cfgp := {}
var _all := {}
var _rigs: Array = []
var _out := "res://tests/captures/"


func _ready() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() > 0:
		_out = args[0]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(_out))
	_build_layout()
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.55, 0.62, 0.7)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.6, 0.6, 0.65)
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 30, 0)
	add_child(sun)
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new(); pm.size = Vector2(60, 60)
	fl.mesh = pm
	var fm := StandardMaterial3D.new(); fm.albedo_color = Color(0.35, 0.4, 0.35)
	fl.material_override = fm
	add_child(fl)
	var cam := Camera3D.new()
	cam.fov = 38
	add_child(cam)
	cam.current = true

	var groups := [
		["A_basic", [["idle", &"idle", 0.0, 120, {}], ["walk", &"walk", 1.4, 130, {}], ["walk2", &"walk", 1.4, 138, {}], ["run", &"run", 4.0, 133, {}]]],
		["B_limp", [["limpL", &"limp", 1.0, 150, {"limp": "l"}], ["limpL2", &"limp", 1.0, 164, {"limp": "l"}], ["limpR", &"limp", 1.0, 150, {"limp": "r"}], ["limpL3", &"limp", 1.0, 178, {"limp": "l"}]]],
		["C_clutch", [["chest", &"clutch", 0.0, 120, {"clutch": P.TORSO}], ["thigh", &"clutch", 0.0, 120, {"clutch": P.UPPER_LEG_R}],
			["forearm", &"clutch", 0.0, 120, {"clutch": P.LOWER_ARM_R}], ["wound", &"clutch", 0.0, 120, {"clutch": P.TORSO, "wound": true}]]],
		["D_crawl_broken", [["crawl", &"crawl", 0.4, 140, {}], ["crawl2", &"crawl", 0.4, 156, {}],
			["broken", &"idle", 0.0, 120, {"broken": [P.LOWER_ARM_L, P.UPPER_LEG_R]}], ["brokenwalk", &"walk", 1.2, 140, {"broken": [P.LOWER_ARM_L, P.UPPER_LEG_R]}]]],
		["E_stagger", [["stagger", &"stagger", 0.0, 100, {}], ["crawl_brokenarm", &"crawl", 0.4, 140, {"broken": [P.LOWER_ARM_R]}],
			["limp_broken", &"limp", 0.8, 150, {"broken": [P.LOWER_LEG_L]}], ["idle2", &"idle", 0.0, 60, {}]]],
	]
	for g in groups:
		for yaw_name in ["front", "side", "back"]:
			var yaw: float = {"front": 0.0, "side": PI * 0.5, "back": PI}[yaw_name]
			_clear()
			var x := 0.0
			for r in g[1]:
				_make_rig(r, Vector3(x, 0, 0), yaw)
				x += 1.3
			for rig in _rigs:
				_simulate(rig)
			var cx := x * 0.5 - 0.65
			var cpos := Vector3(cx, 1.15, 4.6) if yaw_name != "back" else Vector3(cx, 1.15, 4.6)
			if yaw_name == "back":
				cpos = Vector3(cx, 1.15, -4.6)
			cam.position = cpos
			cam.look_at(Vector3(cx, 0.85, 0))
			await get_tree().process_frame
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			var img := get_viewport().get_texture().get_image()
			var path: String = _out + g[0] + "_" + yaw_name + ".png"
			img.save_png(path)
			print("captured ", path)
	get_tree().quit(0)


func _clear() -> void:
	for r in _rigs:
		(r["root"] as Node3D).queue_free()
	_rigs.clear()


func _build_layout() -> void:
	var cfg := DataDB.table("body_parts")
	var order: Array[int] = []
	var rest := {}
	var joint_rest := {}
	var limits := {}
	var half := {}
	for pid in [P.TORSO, P.NECK, P.HEAD, P.UPPER_ARM_L, P.LOWER_ARM_L, P.UPPER_ARM_R, P.LOWER_ARM_R, P.UPPER_LEG_L,
			P.LOWER_LEG_L, P.UPPER_LEG_R, P.LOWER_LEG_R, P.HAND_L, P.HAND_R, P.FOOT_L, P.FOOT_R]:
		var key := BodyIds.key(pid)
		if not cfg["parts"].has(key):
			continue
		var d: Dictionary = cfg["parts"][key]
		order.append(pid)
		rest[pid] = _v3(d["rest"])
		half[pid] = _v3(d["half"])
		if d.get("joint") != null:
			joint_rest[pid] = _v3(d["joint"])
		var lim = d.get("limits")
		if lim != null:
			limits[pid] = {"x_min": deg_to_rad(float(lim["x"][0])), "x_max": deg_to_rad(float(lim["x"][1])),
				"y": deg_to_rad(float(lim["y"])), "z": deg_to_rad(float(lim["z"]))}
	var jp := {}
	var cfj := {}
	for pid in order:
		_all[pid] = true
		if pid == P.TORSO:
			continue
		jp[pid] = joint_rest[pid] - rest[BodyIds.PARENT[pid]]
		cfj[pid] = rest[pid] - joint_rest[pid]
	_cfgp = cfg
	_layout = {"order": order, "rest": rest, "joint_rest": joint_rest, "jp": jp, "cfj": cfj, "limits": limits,
		"half": half, "hip_height": float(cfg.get("hip_height", 0.88))}


static func _v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func _make_rig(spec: Array, pos: Vector3, yaw: float) -> void:
	var root := Node3D.new()
	add_child(root)
	var d := PoseDriver.new()
	d.setup(_layout)
	var opt: Dictionary = spec[4]
	if opt.has("limp"):
		d.set_limp_side(opt["limp"])
	if opt.has("broken"):
		d.set_broken_parts(opt["broken"])
	if opt.get("wound", false):
		d.set_clutch_wound(P.TORSO, Vector3(0.1, 0.12, 0.11), Vector3(0, 0, 1))
	var meshes := {}
	for pid in _layout["order"]:
		var pd: Dictionary = _cfgp["parts"][BodyIds.key(pid)]
		var h: Vector3 = _layout["half"][pid]
		var mi := MeshInstance3D.new()
		if String(pd.get("shape", "capsule")) == "box":
			var bm := BoxMesh.new(); bm.size = h * 2.0; mi.mesh = bm
		else:
			var cm := CapsuleMesh.new(); cm.radius = h.x; cm.height = h.y * 2.0; mi.mesh = cm
		var m := StandardMaterial3D.new()
		var col := Color(0.85, 0.66, 0.55)
		match String(pd.get("color", "skin")):
			"shirt": col = Color(0.25, 0.3, 0.55)
			"pants": col = Color(0.3, 0.25, 0.18)
		if BodyIds.is_hand(pid):
			col = Color(0.9, 0.35, 0.3)
		if BodyIds.is_foot(pid):
			col = Color(0.15, 0.15, 0.15)
		m.albedo_color = col
		mi.material_override = m
		root.add_child(mi)
		meshes[pid] = mi
	var mover := Transform3D(Basis(Vector3.UP, yaw), pos)
	_rigs.append({"root": root, "driver": d, "meshes": meshes, "spec": spec, "mover": mover})


func _simulate(rig: Dictionary) -> void:
	var spec: Array = rig["spec"]
	var d: PoseDriver = rig["driver"]
	var opt: Dictionary = spec[4]
	var cpart: int = opt.get("clutch", -1)
	var xfs := {}
	var cpos := Vector3.ZERO
	if cpart >= 0:
		cpos = (d.rest_pose(rig["mover"], _all)[cpart] as Transform3D).origin
	for i in int(spec[3]):
		xfs = d.update(spec[1], spec[2], DT, rig["mover"], _all, cpart, cpos)
		if cpart >= 0:
			cpos = (xfs[cpart] as Transform3D).origin
	for pid in xfs:
		(rig["meshes"][pid] as MeshInstance3D).global_transform = xfs[pid]
