## Debug overlay (F1 toggles GameSettings.debug_overlay): per-NPC info panels from get_debug_info()
## plus contract-level summaries, and a billboard Label3D above every NPC.
class_name DebugOverlay
extends Node3D

var cfg: Dictionary = {}
var audio: AudioCues = null
var _layer: CanvasLayer
var _box: VBoxContainer
var _panel_pool: Array[Label] = []
var _panel_owner: Dictionary = {}   # npc id -> panel slot (nearest NPCs only)
var _npcs: Array = []
var _cursor := 0
var _list_t := 0.0
var _audio_ms := 0
var _last_upd: Dictionary = {}
var _labels: Dictionary = {}   # npc id -> Label3D
var _audio_label: Label


func _ready() -> void:
	cfg = DataDB.table("gore").get("overlay", {})
	_layer = CanvasLayer.new()
	_layer.layer = 10
	add_child(_layer)
	var scroll := ScrollContainer.new()
	scroll.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	scroll.custom_minimum_size.x = 380
	scroll.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_layer.add_child(scroll)
	_box = VBoxContainer.new()
	_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	scroll.add_child(_box)
	_audio_label = Label.new()
	_audio_label.add_theme_font_size_override("font_size", 11)
	_box.add_child(_audio_label)
	GameSettings.changed.connect(_on_setting)
	_apply_visibility()


func _on_setting(setting: StringName, _v) -> void:
	if setting == &"debug_overlay":
		_apply_visibility()


func _apply_visibility() -> void:
	_layer.visible = GameSettings.debug_overlay
	for l in _labels.values():
		l.visible = GameSettings.debug_overlay


func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.physical_keycode == KEY_F1:
		GameSettings.set_setting(&"debug_overlay", not GameSettings.debug_overlay)


func _process(delta: float) -> void:
	if not GameSettings.debug_overlay:
		return
	_list_t -= delta
	if _list_t <= 0.0:
		_list_t = float(cfg.get("list_refresh", 0.5))
		_refresh_list()
	var h := float(cfg.get("label_height", 1.5))
	for id in _panel_owner:   # nearest NPCs track smoothly every frame, the rest on their staggered update
		var near = instance_from_id(id)
		if near != null and is_instance_valid(near) and _labels.has(id):
			_labels[id].global_position = near.get_center() + Vector3.UP * h
	# stagger: at most `per_frame` NPCs get their text rebuilt per frame, each at most every `refresh` s
	var now := Time.get_ticks_msec()
	var min_gap := int(float(cfg.get("refresh", 0.2)) * 1000.0)
	var far_gap := int(float(cfg.get("far_refresh", 1.0)) * 1000.0)
	var budget := int(cfg.get("per_frame", 2))
	var n := _npcs.size()
	var tries := 0
	while budget > 0 and tries < n:
		tries += 1
		_cursor = (_cursor + 1) % n
		var npc = _npcs[_cursor]
		if not is_instance_valid(npc):
			continue
		var id: int = npc.get_instance_id()
		if now - int(_last_upd.get(id, -100000)) < (min_gap if _panel_owner.has(id) else far_gap):
			continue
		_last_upd[id] = now
		budget -= 1
		_update_npc(npc, id)
	if audio and now - _audio_ms > 250:
		_audio_ms = now
		var txt := "audio: " + ", ".join(audio.recent.slice(maxi(audio.recent.size() - 5, 0)))
		if txt != _audio_label.text:
			_audio_label.text = txt


## Rebuild the NPC list (cheap, 2 Hz), pick the nearest few for full panels, create/free labels.
func _refresh_list() -> void:
	_npcs = get_tree().get_nodes_in_group(&"npc")
	var live := {}
	var cam := get_viewport().get_camera_3d()
	var cp := cam.global_position if cam else Vector3.ZERO
	var scored: Array = []
	for npc in _npcs:
		if not is_instance_valid(npc):
			continue
		var id: int = npc.get_instance_id()
		live[id] = true
		if not _labels.has(id) and bool(cfg.get("world_labels", true)):
			_labels[id] = _make_label3d()
		scored.append([npc.global_position.distance_squared_to(cp), npc])
	scored.sort_custom(func(a, b): return a[0] < b[0])
	_panel_owner.clear()
	var max_p := mini(int(cfg.get("max_panels", 4)), scored.size())
	for i in max_p:
		_panel_owner[scored[i][1].get_instance_id()] = i
	while _panel_pool.size() < max_p:
		var l := Label.new()
		l.add_theme_font_size_override("font_size", 11)
		l.add_theme_color_override("font_shadow_color", Color.BLACK)
		_box.add_child(l)
		_panel_pool.append(l)
	for i in _panel_pool.size():
		_panel_pool[i].visible = i < max_p
	for id in _labels.keys():
		if not live.has(id):
			_labels[id].queue_free()
			_labels.erase(id)
			_last_upd.erase(id)


func _update_npc(npc: Node, id: int) -> void:
	var l3: Label3D = _labels.get(id)
	if l3:
		l3.global_position = npc.get_center() + Vector3.UP * float(cfg.get("label_height", 1.5))
	var head := "Npc%d %s" % [npc.npc_id, BodyIds.state_name(npc.get_state())]
	if _panel_owner.has(id):
		var text := describe_npc(npc, _panel_owner[id] == 0)
		var panel: Label = _panel_pool[_panel_owner[id]]
		if text != panel.text:
			panel.text = text
		head = text.get_slice("\n", 0)
	if l3:
		var t := head + "\n" + (_blood_line(npc) if _panel_owner.has(id) else _blood_pct(npc))
		if t != l3.text:
			l3.text = t


func _make_label3d() -> Label3D:
	var l := Label3D.new()
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.pixel_size = 0.004
	l.font_size = 48
	l.outline_size = 12
	l.visible = GameSettings.debug_overlay
	add_child(l)
	return l


## Far NPCs: coarse blood percentage (steps of 10%) so the label text rarely changes.
func _blood_pct(npc: Node) -> String:
	if npc.get("blood") == null or npc.blood == null:
		return ""
	return "blood %d%%" % (int(npc.blood.state.fraction() * 10.0) * 10)


func _blood_line(npc: Node) -> String:
	if npc.get("blood") == null or npc.blood == null:
		return ""
	var b: BloodState = npc.blood.state
	return "blood %d/%d %s" % [int(b.volume / 50.0) * 50, int(b.max_volume), BodyIds.BloodLevel.keys()[b.level]]


## Multi-line description of one NPC. First line is "Npc<id> STATE".
func describe_npc(npc: Node, with_dump := true) -> String:
	var lines: Array[String] = ["Npc%d %s" % [npc.npc_id, BodyIds.state_name(npc.get_state())]]
	if npc.get("blood") != null and npc.blood != null:
		var b: BloodState = npc.blood.state
		lines.append("blood %.0f/%.0f (%.0f%%) %s  ext %.1f/s int %.1f/s  hr %.0f" % [b.volume, b.max_volume,
			b.fraction() * 100.0, BodyIds.BloodLevel.keys()[b.level], b.external_rate, b.internal_rate, b.heart_rate])
	if npc.get("brain") != null and npc.brain != null:
		lines.append("pain %.2f  exertion %.2f" % [npc.brain.get_pain(), npc.brain.get_exertion()])
	if npc.get("damage") != null and npc.damage != null:
		var parts: Array[String] = []
		for bp in npc.damage.get_parts():
			if bp is BodyPart:
				parts.append("%s %.0f/%.0f%s%s" % [BodyIds.key(bp.part_id), bp.hp, bp.max_hp,
					" BRK" if bp.broken else "", " SEV" if bp.severed else ""])
		if parts.size() > 0:
			lines.append("parts: " + " | ".join(parts))
	if npc.get("wounds") != null and npc.wounds != null:
		var ws: Array = npc.wounds.get_wounds()
		lines.append("wounds: %d" % ws.size())
		for w in ws.slice(0, 5):
			if w is Wound:
				lines.append("  " + w.describe())
	if not with_dump:
		return "\n".join(lines)
	var dbg: Dictionary = npc.get_debug_info()
	for k in ["body", "damage", "wounds", "blood", "brain"]:
		var sub = dbg.get(k, {})
		if typeof(sub) == TYPE_DICTIONARY and not sub.is_empty():
			lines.append("%s: %s" % [k, _compact(sub)])
	return "\n".join(lines)


static func _compact(v, depth := 0) -> String:
	match typeof(v):
		TYPE_FLOAT:
			return "%.2f" % v
		TYPE_DICTIONARY:
			if depth > 2:
				return "{..}"
			var parts: Array[String] = []
			for k in v:
				parts.append("%s=%s" % [k, _compact(v[k], depth + 1)])
			return "{" + ", ".join(parts) + "}"
		TYPE_ARRAY:
			if depth > 2 or v.size() > 12:
				return "[%d]" % v.size()
			var parts2: Array[String] = []
			for x in v:
				parts2.append(_compact(x, depth + 1))
			return "[" + ", ".join(parts2) + "]"
		_:
			return str(v)
