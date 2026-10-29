## Offline bake (dismember-agent): generates one smooth lofted mesh per body part plus stump / severed caps
## per joint, from data/body_parts.json (rest layout) and data/body_mesh.json (ring profiles). Godot only.
## Run: godot --headless --path . res://tools/bake_body_meshes.tscn
## Output (res://assets/body/): <part>.mesh.res, <child>_cap_stump.res (lives on the PARENT segment, at the joint),
## <child>_cap_severed.res (lives on the child segment), manifest.json.
## Vertex colours: rgb = region weights (skin, shirt, pants; all zero = shoe), a = 1. Shaded at runtime by
## scripts/body/body_vc.gdshader so each NPC gets its own skin/clothes colours.
extends Node

const OUT := "res://assets/body/"
const P := BodyIds.Part

var _cfg: Dictionary
var _mc: Dictionary
var _n := 20
var _subdiv := 3
var _regions: Dictionary
var _rest := {}
var _joint := {}
var _half := {}
var _manifest := {"parts": {}, "joints": {}}


## Indexed triangle soup with orientation fixing (Godot front faces are clockwise).
class MB:
	var v := PackedVector3Array()
	var c := PackedColorArray()
	var g := PackedInt32Array()
	var idx := PackedInt32Array()

	func add(p: Vector3, col: Color, group := 0) -> int:
		v.append(p)
		c.append(col)
		g.append(group)
		return v.size() - 1

	func tri(a: int, b: int, d: int, out: Vector3) -> void:
		var n := (v[b] - v[a]).cross(v[d] - v[a])
		if n.length_squared() < 1e-16:
			return
		if n.dot(out) > 0.0:
			idx.append_array([a, d, b])
		else:
			idx.append_array([a, b, d])

	func mesh() -> ArrayMesh:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for i in v.size():
			st.set_smooth_group(g[i])
			st.set_color(c[i])
			st.add_vertex(v[i])
		for i in idx:
			st.add_index(i)
		st.generate_normals()
		return st.commit()


func _ready() -> void:
	_cfg = _json("res://data/body_parts.json")
	_mc = _json("res://data/body_mesh.json")
	_n = int(_mc.get("ring_verts", 20))
	_subdiv = int(_mc.get("subdiv", 3))
	_regions = _mc["regions"]
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT))
	for pid in BodyIds.PART_COUNT:
		var d: Dictionary = _cfg["parts"][BodyIds.key(pid)]
		_rest[pid] = _v3(d["rest"])
		if d.get("joint") != null:
			_joint[pid] = _v3(d["joint"])
		_half[pid] = _v3(d["half"])
	var body_tris := 0
	var head_mesh: ArrayMesh = null
	var head_tris := 0
	for pid in BodyIds.PART_COUNT:
		var m := _bake_part(pid)
		var path := OUT + BodyIds.key(pid) + ".mesh.res"
		var err := ResourceSaver.save(m, path)
		var tris := _tri_count(m)
		body_tris += tris
		if pid == P.HEAD:
			head_mesh = m
			head_tris = tris
		_manifest["parts"][BodyIds.key(pid)] = {"mesh": path, "tris": tris}
		print("part %-12s tris=%4d verts=%4d save=%d" % [BodyIds.key(pid), tris, m.surface_get_array_len(0), err])
	# the HEAD segment renders as 4 damage-zone chunks (BodyIds.head_chunk_from_local); they replace head.mesh.res at runtime
	var chunk_tris := _bake_head_chunks(head_mesh)
	body_tris += chunk_tris - head_tris
	_manifest["head_chunk_tris"] = chunk_tris
	var cap_tris := 0
	for pid in BodyIds.PART_COUNT:
		if pid == P.TORSO:
			continue
		cap_tris += _bake_caps(pid)
	_manifest["ring_verts"] = _n
	_manifest["body_tris"] = body_tris
	_manifest["cap_tris"] = cap_tris
	_manifest["total_tris"] = body_tris + cap_tris + int(_manifest.get("ball_tris", 0))
	var f := FileAccess.open(OUT + "manifest.json", FileAccess.WRITE)
	f.store_string(JSON.stringify(_manifest, " "))
	f.close()
	print("BAKE DONE body_tris=%d ball_tris=%d cap_tris=%d (visible body = body+balls, caps shown only on cuts)" % [
		body_tris, int(_manifest.get("ball_tris", 0)), cap_tris])
	get_tree().quit(0)


# ------------------------------------------------------------------ helpers

func _json(path: String) -> Dictionary:
	return JSON.parse_string(FileAccess.get_file_as_string(path))


func _v3(a) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


func _tri_count(m: ArrayMesh) -> int:
	var arr := m.surface_get_arrays(0)
	return (arr[Mesh.ARRAY_INDEX] as PackedInt32Array).size() / 3


func _side_sign(pid: int) -> float:
	return -1.0 if BodyIds.key(pid).ends_with("_r") else 1.0


func _base(pid: int) -> String:
	var k := BodyIds.key(pid)
	return k.substr(0, k.length() - 2) if (k.ends_with("_l") or k.ends_with("_r")) else k


func _col(region: String) -> Color:
	var w: Array = _regions[region]
	return Color(float(w[0]), float(w[1]), float(w[2]), 1.0)


## Joint ring spec of the joint where `child` hangs off its parent.
func _jspec(child: int) -> Dictionary:
	return (_mc["joints"] as Dictionary)[_base(child)]


## Joint point of `child` in the local frame of part `pid`.
func _jpoint_in(child: int, pid: int) -> Vector3:
	return (_joint[child] as Vector3) - (_rest[pid] as Vector3)


func _ring(centre: Vector3, rx: float, rz: float, axis: String) -> Array:
	var out: Array = []
	for i in _n:
		var a := TAU * float(i) / float(_n)
		if axis == "y":
			out.append(centre + Vector3(cos(a) * rx, 0.0, sin(a) * rz))
		else:
			out.append(centre + Vector3(cos(a) * rx, sin(a) * rz, 0.0))
	return out


func _cr(p0: float, p1: float, p2: float, p3: float, u: float) -> float:
	var r := 0.5 * ((2.0 * p1) + (-p0 + p2) * u + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * u * u
		+ (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * u * u * u)
	var lo := minf(p1, p2)
	var hi := maxf(p1, p2)
	var m := 0.15 * (hi - lo) + 0.0003
	return clampf(r, lo - m, hi + m)


## controls: Array of {t, v: PackedFloat32Array [rx, rz, cx, cz], w: Vector3}. Returns refined rings.
func _refine(ctl: Array) -> Array:
	var out: Array = []
	var cnt := ctl.size()
	for i in cnt - 1:
		var c0: Dictionary = ctl[maxi(i - 1, 0)]
		var c1: Dictionary = ctl[i]
		var c2: Dictionary = ctl[i + 1]
		var c3: Dictionary = ctl[mini(i + 2, cnt - 1)]
		for s in _subdiv:
			var u := float(s) / float(_subdiv)
			var v := PackedFloat32Array([0, 0, 0, 0])
			for k in 4:
				v[k] = _cr(c0.v[k], c1.v[k], c2.v[k], c3.v[k], u)
			out.append({"t": lerpf(c1.t, c2.t, u), "v": v, "w": (c1.w as Vector3).lerp(c2.w, u)})
	out.append(ctl[cnt - 1])
	return out


func _w(region: String) -> Vector3:
	var w: Array = _regions[region]
	return Vector3(float(w[0]), float(w[1]), float(w[2]))


func _wc(w: Vector3) -> Color:
	if w.x < 0.0:  # "eye" region: alpha 0 -> dark in body_vc.gdshader
		return Color(0, 0, 0, 0)
	return Color(w.x, w.y, w.z, 1.0)


# ------------------------------------------------------------------ lofts

## rings: Array of {c: Vector3, rx, rz, w: Vector3}; axis "y" or "z"; closes the ends with fans.
func _loft(b: MB, rings: Array, axis: String, close_start: String, close_end: String,
		start_push := 0.0, end_push := 0.0) -> void:
	var ids: Array = []
	for r in rings:
		var pts := _ring(r.c, r.rx, r.rz, axis)
		var row: Array = []
		for p in pts:
			row.append(b.add(p, _wc(r.w)))
		ids.append(row)
	for k in rings.size() - 1:
		for i in _n:
			var j := (i + 1) % _n
			var a: int = ids[k][i]
			var bb: int = ids[k][j]
			var c: int = ids[k + 1][i]
			var d: int = ids[k + 1][j]
			var out := b.v[a] - (rings[k].c as Vector3)
			b.tri(a, bb, c, out)
			b.tri(bb, d, c, out)
	var spine := ((rings[rings.size() - 1].c as Vector3) - (rings[0].c as Vector3))
	spine = spine.normalized() if spine.length() > 1e-6 else (Vector3.UP if axis == "y" else Vector3.BACK)
	_close(b, rings[0], ids[0], close_start, -spine, start_push, axis)
	_close(b, rings[rings.size() - 1], ids[ids.size() - 1], close_end, spine, end_push, axis)


func _close(b: MB, ring: Dictionary, row: Array, mode: String, out: Vector3, push: float, axis: String) -> void:
	if mode == "":
		return
	var col := _wc(ring.w)
	if mode == "dome":
		var cen := b.add((ring.c as Vector3) + out * push, col)
		for i in _n:
			b.tri(row[i], row[(i + 1) % _n], cen, out)
	else:  # flat: own flat-shaded vertices
		var pts := _ring(ring.c, ring.rx, ring.rz, axis)
		var cen := b.add(ring.c, col, -1)
		var vs: Array = []
		for p in pts:
			vs.append(b.add(p, col, -1))
		for i in _n:
			b.tri(vs[i], vs[(i + 1) % _n], cen, out)


## Dome over a joint ring (torso stubs): base rim = the ring, closed apex `len` along dir.
func _dome(b: MB, centre: Vector3, rx: float, rz: float, dir: Vector3, length: float, bulge: float, w: Vector3,
		k_n := 5) -> void:
	var rings: Array = []
	for k in k_n:
		var phi := float(k) / float(k_n) * PI * 0.5
		var s := sin(minf(2.0 * phi, PI * 0.5))
		var sc := (1.0 + (bulge - 1.0) * s * s) * cos(phi)
		rings.append({"c": centre + dir * length * sin(phi), "rx": rx * sc, "rz": rz * sc, "w": w})
	var ids: Array = []
	for r in rings:
		var row: Array = []
		for p in _ring(r.c, r.rx, r.rz, "y"):
			row.append(b.add(p, _wc(r.w)))
		ids.append(row)
	for k in rings.size() - 1:
		for i in _n:
			var j := (i + 1) % _n
			var out := b.v[ids[k][i]] - (rings[k].c as Vector3)
			b.tri(ids[k][i], ids[k][j], ids[k + 1][i], out)
			b.tri(ids[k][j], ids[k + 1][j], ids[k + 1][i], out)
	var last: Array = ids[ids.size() - 1]
	var apex := b.add(centre + dir * length, _wc(w))
	for i in _n:
		b.tri(last[i], last[(i + 1) % _n], apex, dir)


# ------------------------------------------------------------------ parts

func _bake_part(pid: int) -> ArrayMesh:
	var spec: Dictionary = _mc["parts"][_base(pid)]
	var sg := _side_sign(pid)
	var b := MB.new()
	var region: String = spec.get("region", "skin")
	var children := BodyIds.children_of(pid)
	# ---- main tube
	var y0 = spec["y0"]
	var y1 = spec["y1"]
	var start_pt: Vector3
	var end_pt: Vector3
	var start_spec: Dictionary = {}
	var end_spec: Dictionary = {}
	if typeof(y0) == TYPE_STRING:
		start_pt = _jpoint_in(pid, pid)
		start_spec = _jspec(pid)
	else:
		start_pt = Vector3(0, float(y0), 0)
	if typeof(y1) == TYPE_STRING:
		var ch: int = children[0]
		end_pt = _jpoint_in(ch, pid)
		end_spec = _jspec(ch)
	else:
		end_pt = Vector3(start_pt.x, float(y1), start_pt.z)
	var ctl: Array = []
	var raw: Array = spec["rings"]
	for i in raw.size():
		var e: Array = raw[i]
		var v := PackedFloat32Array([float(e[1]), float(e[2]), float(e[3]) * sg, float(e[4])])
		var reg: String = e[5] if e.size() > 5 else region
		if i == 0 and not start_spec.is_empty():
			v = PackedFloat32Array([start_spec.rx, start_spec.rz, start_spec.cx, start_spec.cz])
		if i == raw.size() - 1 and not end_spec.is_empty():
			v = PackedFloat32Array([end_spec.rx, end_spec.rz, end_spec.cx, end_spec.cz])
		ctl.append({"t": float(e[0]), "v": v, "w": _w(reg)})
	var rings: Array = []
	for r in _refine(ctl):
		var c := start_pt.lerp(end_pt, r.t) + Vector3(r.v[2], 0.0, r.v[3])
		rings.append({"c": c, "rx": r.v[0], "rz": r.v[1], "w": r.w})
	_loft(b, rings, "y", spec.get("close_start", ""), spec.get("close_end", ""), 0.0, float(spec.get("end_push", 0.0)))
	# ---- torso stubs (domes over every child joint ring)
	if spec.has("stubs"):
		for ch in children:
			var st: Dictionary = spec["stubs"][_base(ch)]
			var js := _jspec(ch)
			var cen := _jpoint_in(ch, pid) + Vector3(js.cx, 0.0, js.cz)
			_dome(b, cen, js.rx, js.rz, _v3(st["dir"]), float(st["len"]), float(st["bulge"]), _w(String(st.get("region", region))))
	# ---- extras (nose, thumb, shoe)
	for ex in spec.get("extras", []):
		var axis: String = ex["axis"]
		var ereg: String = ex.get("region", region)
		var er: Array = []
		for e in ex["rings"]:
			var c: Vector3
			var cx := float(e[3]) * sg
			if axis == "z":
				c = Vector3(cx, float(e[4]), float(e[0]))
			else:
				c = Vector3(cx, float(e[0]), float(e[4]))
			er.append({"c": c, "rx": float(e[1]), "rz": float(e[2]), "w": _w(ereg)})
		_loft(b, er, axis, ex.get("close_start", ""), ex.get("close_end", ""),
			float(ex.get("start_push", 0.0)), float(ex.get("end_push", 0.0)))
	var m := b.mesh()
	m.resource_name = BodyIds.key(pid)
	return m


# ------------------------------------------------------------------ caps

func _bake_caps(child: int) -> int:
	var parent: int = BodyIds.PARENT[child]
	var js := _jspec(child)
	var cc: Dictionary = _mc["cap"]
	var centre_child: Vector3 = _jpoint_in(child, child) + Vector3(js.cx, 0.0, js.cz)
	var centre_parent: Vector3 = _jpoint_in(child, parent) + Vector3(js.cx, 0.0, js.cz)
	# stump (parent side) faces toward the child body; severed (child side) faces back toward the parent.
	var dir_child: Vector3 = (_rest[child] as Vector3) - (_joint[child] as Vector3)
	var dir_up: Vector3 = Vector3.UP if dir_child.y >= 0.0 else Vector3.DOWN
	var stump := _cap_mesh(centre_parent, js.rx, js.rz, dir_up, js.bone_r, cc)
	var severed := _cap_mesh(centre_child, js.rx, js.rz, -dir_up, js.bone_r, cc)
	var key := BodyIds.key(child)
	# joint ball: half ellipsoid of the child's start ring reaching back into the parent; covers the wedge gap when the
	# rigid segments rotate about the joint (rotation-invariant). Hidden when the child is severed.
	var bspec: Dictionary = _mc["parts"][_base(child)]
	var braw: Array = bspec["rings"]
	var breg: String = braw[0][5] if (braw[0] as Array).size() > 5 else String(bspec.get("region", "skin"))
	var bb := MB.new()
	_dome(bb, centre_child, js.rx, js.rz, -dir_up, 0.9 * 0.5 * (js.rx + js.rz), 1.0, _w(breg), 4)
	var ball := bb.mesh()
	var bp := OUT + key + "_ball.res"
	ResourceSaver.save(ball, bp)
	var sp := OUT + key + "_cap_stump.res"
	var vp := OUT + key + "_cap_severed.res"
	ResourceSaver.save(stump, sp)
	ResourceSaver.save(severed, vp)
	_manifest["joints"][key] = {"parent": BodyIds.key(parent), "stump": sp, "severed": vp, "ball": bp,
		"centre_parent": [centre_parent.x, centre_parent.y, centre_parent.z],
		"centre_child": [centre_child.x, centre_child.y, centre_child.z],
		"rx": js.rx, "rz": js.rz, "bone_r": js.bone_r,
		"out_stump": [dir_up.x, dir_up.y, dir_up.z]}
	_manifest["ball_tris"] = int(_manifest.get("ball_tris", 0)) + _tri_count(ball)
	return _tri_count(stump) + _tri_count(severed)


func _col3(a) -> Color:
	return Color(float(a[0]), float(a[1]), float(a[2]), 1.0)


## Closed disc sealing the joint ring: flesh rim, flesh body, darker flesh around a raised off-white bone disc.
func _cap_mesh(centre: Vector3, rx: float, rz: float, out: Vector3, bone_r: float, cc: Dictionary) -> ArrayMesh:
	var b := MB.new()
	var dome := float(cc["dome"])
	var bdome := float(cc["bone_dome"])
	var specs := [
		{"sx": rx, "sz": rz, "d": 0.0, "col": _col3(cc["flesh_rim"])},
		{"sx": rx * 0.8, "sz": rz * 0.8, "d": dome * 0.8, "col": _col3(cc["flesh"])},
		{"sx": bone_r * 1.4, "sz": bone_r * 1.4, "d": dome, "col": _col3(cc["flesh_inner"])},
		{"sx": bone_r, "sz": bone_r, "d": bdome, "col": _col3(cc["bone"])},
	]
	var ids: Array = []
	for s in specs:
		var row: Array = []
		for p in _ring(centre + out * s.d, s.sx, s.sz, "y"):
			row.append(b.add(p, s.col))
		ids.append(row)
	for k in specs.size() - 1:
		for i in _n:
			var j := (i + 1) % _n
			b.tri(ids[k][i], ids[k][j], ids[k + 1][i], out)
			b.tri(ids[k][j], ids[k + 1][j], ids[k + 1][i], out)
	var apex := b.add(centre + out * bdome * 1.15, _col3(cc["bone"]))
	var last: Array = ids[ids.size() - 1]
	for i in _n:
		b.tri(last[i], last[(i + 1) % _n], apex, out)
	return b.mesh()


# ------------------------------------------------------------------ head chunks (milestone 5)

func _lt(a: Vector3, b: Vector3) -> bool:
	if a.x != b.x:
		return a.x < b.x
	if a.y != b.y:
		return a.y < b.y
	return a.z < b.z


## Splits a polygon (Array of {p, n, c}) by the plane coord[axis] == val; returns [below, above].
func _split(poly: Array, axis: int, val: float) -> Array:
	var lo: Array = []
	var hi: Array = []
	var cnt := poly.size()
	for i in cnt:
		var a: Dictionary = poly[i]
		var b: Dictionary = poly[(i + 1) % cnt]
		var da: float = a.p[axis] - val
		var db: float = b.p[axis] - val
		if da <= 0.0:
			lo.append(a)
		if da >= 0.0:
			hi.append(a)
		if (da < 0.0 and db > 0.0) or (da > 0.0 and db < 0.0):
			var f := a
			var g := b
			if _lt(b.p, a.p):  # canonical order: neighbouring triangles compute bit-identical cut points
				f = b
				g = a
			var t: float = (f.p[axis] - val) / (f.p[axis] - g.p[axis])
			var v := {"p": (f.p as Vector3).lerp(g.p, t), "n": (f.n as Vector3).lerp(g.n, t).normalized(),
				"c": (f.c as Color).lerp(g.c, t)}
			lo.append(v)
			hi.append(v)
	return [lo if lo.size() >= 3 else [], hi if hi.size() >= 3 else []]


func _pk(p: Vector3) -> Vector3i:
	return Vector3i((p * 10000.0).round())


func _bake_head_chunks(head: ArrayMesh) -> int:
	var half: Vector3 = _half[P.HEAD]
	var arrays := head.surface_get_arrays(0)
	var vp: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
	var vn: PackedVector3Array = arrays[Mesh.ARRAY_NORMAL]
	var vc: PackedColorArray = arrays[Mesh.ARRAY_COLOR]
	var ix: PackedInt32Array = arrays[Mesh.ARRAY_INDEX]
	# planes bounding the zones of BodyIds.head_chunk_from_local (thresholds mirrored here, verified below)
	var planes := [[1, -0.35 * half.y], [1, 0.45 * half.y], [2, 0.0], [2, 0.35 * half.z], [2, -0.35 * half.z]]
	var polys: Array = []
	for t in ix.size() / 3:
		var poly: Array = []
		for k in 3:
			var i := ix[t * 3 + k]
			poly.append({"p": vp[i], "n": vn[i], "c": vc[i]})
		polys.append(poly)
	for pl in planes:
		var next: Array = []
		for poly in polys:
			var r := _split(poly, pl[0], pl[1])
			if not (r[0] as Array).is_empty():
				next.append(r[0])
			if not (r[1] as Array).is_empty():
				next.append(r[1])
		polys = next
	# triangulate + classify with the contract function
	var tris: Array = []  # {v: [3 dicts], chunk}
	var bad := 0
	for poly in polys:
		for k in range(1, poly.size() - 1):
			var a: Dictionary = poly[0]
			var b: Dictionary = poly[k]
			var c: Dictionary = poly[k + 1]
			var area := ((b.p - a.p) as Vector3).cross(c.p - a.p).length()
			if area < 1e-10:
				continue
			var cen: Vector3 = (a.p + b.p + c.p) / 3.0
			var chunk := BodyIds.head_chunk_from_local(cen / half)
			for q in [a, b, c]:  # all corners must agree (planes match the contract thresholds)
				var nq := ((q.p as Vector3) * 0.97 + cen * 0.03) / half
				if BodyIds.head_chunk_from_local(nq) != chunk:
					bad += 1
					if bad < 6:
						print("mismatch corner ", q.p, " cen ", cen, " chunk ", chunk, " corner chunk ", BodyIds.head_chunk_from_local(nq))
			tris.append({"v": [a, b, c], "chunk": chunk})
	if bad > 0:
		push_warning("head chunk planes disagree with BodyIds.head_chunk_from_local (%d corners)" % bad)
	print("head chunk split: %d tris -> %d (corner mismatches %d)" % [ix.size() / 3, tris.size(), bad])
	# edge adjacency over the whole clipped head (for hole boundaries)
	var edge_map := {}
	for ti in tris.size():
		var v: Array = tris[ti].v
		for k in 3:
			var ka := _pk(v[k].p)
			var kb := _pk(v[(k + 1) % 3].p)
			var key := [ka, kb] if (ka.x < kb.x or (ka.x == kb.x and (ka.y < kb.y or (ka.y == kb.y and ka.z < kb.z)))) else [kb, ka]
			var ek := str(key)
			if not edge_map.has(ek):
				edge_map[ek] = []
			edge_map[ek].append([ti, k])
	var total := 0
	_manifest["head_chunks"] = {}
	for chunk in BodyIds.HeadChunk.values():
		var name: String = BodyIds.head_chunk_key(chunk)
		# chunk shell (indexed, de-duplicated)
		var verts := PackedVector3Array()
		var norms := PackedVector3Array()
		var cols := PackedColorArray()
		var inds := PackedInt32Array()
		var vmap := {}
		var csum := Vector3.ZERO
		var cn := 0
		for t in tris:
			if t.chunk != chunk:
				continue
			for q in t.v:
				var key := str([_pk(q.p), Vector3i((q.n * 1000.0).round())])
				if not vmap.has(key):
					vmap[key] = verts.size()
					verts.append(q.p)
					norms.append(q.n)
					cols.append(q.c)
					csum += q.p
					cn += 1
				inds.append(vmap[key])
		var centroid := csum / float(maxi(cn, 1))
		var shell := _mesh_from(verts, norms, cols, inds, Vector3.ZERO)
		shell.resource_name = "head_" + name
		var tcount := inds.size() / 3
		total += tcount
		# wound: hole boundary strip + shrunk inner shell (flesh -> bone -> dark cavity)
		var wb := MB.new()
		var shrink := 0.78
		var hole: Array = []  # {a, b, third}
		for ek in edge_map:
			var lst: Array = edge_map[ek]
			var own: Array
			if lst.size() == 1:
				# open edge of the head shell itself: only the neck-side start ring needs sealing against the neck
				own = lst[0]
				var ov: Array = tris[own[0]].v
				if tris[own[0]].chunk != chunk or ov[own[1]].p.y > -half.y + 0.0005 or ov[(own[1] + 1) % 3].p.y > -half.y + 0.0005:
					continue
			elif lst.size() == 2:
				var ca: int = tris[lst[0][0]].chunk
				var cb: int = tris[lst[1][0]].chunk
				if (ca == chunk) == (cb == chunk):
					continue
				own = lst[0] if ca == chunk else lst[1]
			else:
				continue
			var tv: Array = tris[own[0]].v
			hole.append({"a": tv[own[1]].p, "b": tv[(own[1] + 1) % 3].p, "t": tv[(own[1] + 2) % 3].p})
		var hole_pts: Array = []
		for h in hole:
			hole_pts.append((h.a as Vector3) * shrink)
		var cc: Dictionary = _mc["cap"]
		var flesh := _col3(cc["flesh"])
		var bone := _col3(cc["bone"])
		var dark := Color(0.09, 0.008, 0.008, 1.0)
		for h in hole:
			var a: Vector3 = h.a
			var b: Vector3 = h.b
			var a2 := a * shrink
			var b2 := b * shrink
			var out: Vector3 = ((h.t as Vector3) - (a + b) * 0.5)
			var ia := wb.add(a, flesh, -1)
			var ib := wb.add(b, flesh, -1)
			var ia2 := wb.add(a2, bone, -1)
			var ib2 := wb.add(b2, bone, -1)
			wb.tri(ia, ib, ib2, out)
			wb.tri(ia, ib2, ia2, out)
		var bowl_ids := {}
		for t in tris:
			if t.chunk != chunk:
				continue
			var tri_idx: Array = []
			var nsum := Vector3.ZERO
			for q in t.v:
				var key := _pk(q.p)
				var p2: Vector3 = (q.p as Vector3) * shrink
				if not bowl_ids.has(key):
					var d := 1e9
					for hp in hole_pts:
						d = minf(d, p2.distance_to(hp))
					var col: Color
					if d < 0.006:
						col = bone
					elif d < 0.016:
						col = bone.lerp(flesh, (d - 0.006) / 0.010)
					elif d < 0.032:
						col = flesh.lerp(dark, (d - 0.016) / 0.016)
					else:
						col = dark
					bowl_ids[key] = wb.add(p2, col, 0)
				tri_idx.append(bowl_ids[key])
				nsum += q.n
			wb.tri(tri_idx[0], tri_idx[1], tri_idx[2], nsum)
		var wound := wb.mesh()
		wound.resource_name = "head_wound_" + name
		var shell_path := OUT + "head_chunk_%s.mesh.res" % name
		var wound_path := OUT + "head_wound_%s.res" % name
		ResourceSaver.save(shell, shell_path)
		ResourceSaver.save(wound, wound_path)
		# gib: the same two meshes re-centred on the chunk centroid (RigidBody origin = chunk centre)
		var gib := _mesh_from(verts, norms, cols, inds, centroid)
		var gib_wound := _recentre(wound, centroid)
		var gib_path := OUT + "head_gib_%s.mesh.res" % name
		var gib_wound_path := OUT + "head_gib_%s_wound.res" % name
		ResourceSaver.save(gib, gib_path)
		ResourceSaver.save(gib_wound, gib_wound_path)
		_manifest["head_chunks"][name] = {"chunk": chunk, "mesh": shell_path, "wound": wound_path, "gib": gib_path,
			"gib_wound": gib_wound_path, "tris": tcount, "wound_tris": _tri_count(wound),
			"centroid": [centroid.x, centroid.y, centroid.z], "hole_edges": hole.size()}
		print("head chunk %-8s tris=%4d wound_tris=%4d hole_edges=%3d centroid=%s" % [name, tcount, _tri_count(wound), hole.size(), centroid])
	return total


func _mesh_from(verts: PackedVector3Array, norms: PackedVector3Array, cols: PackedColorArray, inds: PackedInt32Array,
		offset: Vector3) -> ArrayMesh:
	var v := PackedVector3Array()
	for p in verts:
		v.append(p - offset)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = v
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_COLOR] = cols
	arr[Mesh.ARRAY_INDEX] = inds
	var m := ArrayMesh.new()
	m.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return m


func _recentre(src: ArrayMesh, offset: Vector3) -> ArrayMesh:
	var a := src.surface_get_arrays(0)
	return _mesh_from(a[Mesh.ARRAY_VERTEX], a[Mesh.ARRAY_NORMAL], a[Mesh.ARRAY_COLOR], a[Mesh.ARRAY_INDEX], offset)
