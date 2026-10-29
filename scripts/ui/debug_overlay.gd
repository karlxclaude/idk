## Debug overlay (F1 toggles GameSettings.debug_overlay): per-NPC info panels from get_debug_info()
## plus contract-level summaries, and a billboard Label3D above every NPC.
class_name DebugOverlay
extends Node3D

var cfg: Dictionary = {}
var audio: AudioCues = null
var _layer: CanvasLayer
var _box: VBoxContainer
var _panels: Dictionary = {}   # npc id -> Label
var _labels: Dictionary = {}   # npc id -> Label3D
var _audio_label: Label
var _t := 0.0


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
	_t -= delta
	if not GameSettings.debug_overlay:
		return
	var npcs := get_tree().get_nodes_in_group(&"npc")
	var h := float(cfg.get("label_height", 1.5))
	var live := {}
	for npc in npcs:
		if is_instance_valid(npc):
			live[npc.get_instance_id()] = true
			var l3: Label3D = _labels.get(npc.get_instance_id())
			if l3 == null:
				l3 = _make_label3d()
				_labels[npc.get_instance_id()] = l3
			l3.global_position = npc.get_center() + Vector3.UP * h
	if _t > 0.0:
		return
	_t = float(cfg.get("refresh", 0.2))
	var shown := 0
	for npc in npcs:
		if not is_instance_valid(npc):
			continue
		var id: int = npc.get_instance_id()
		var text := describe_npc(npc)
		(_labels[id] as Label3D).text = text.get_slice("\n", 0) + "\n" + _blood_line(npc)
		var panel: Label = _panels.get(id)
		if shown >= int(cfg.get("max_panels", 6)):
			if panel:
				panel.visible = false
			continue
		shown += 1
		if panel == null:
			panel = Label.new()
			panel.add_theme_font_size_override("font_size", 11)
			panel.add_theme_color_override("font_shadow_color", Color.BLACK)
			_box.add_child(panel)
			_panels[id] = panel
		panel.visible = true
		panel.text = text
	for id in _panels.keys():
		if not live.has(id):
			_panels[id].queue_free()
			_panels.erase(id)
	for id in _labels.keys():
		if not live.has(id):
			_labels[id].queue_free()
			_labels.erase(id)
	if audio:
		_audio_label.text = "audio: " + ", ".join(audio.recent.slice(maxi(audio.recent.size() - 5, 0)))


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


func _blood_line(npc: Node) -> String:
	if npc.get("blood") == null or npc.blood == null:
		return ""
	var b: BloodState = npc.blood.state
	return "blood %.0f/%.0f %s" % [b.volume, b.max_volume, BodyIds.BloodLevel.keys()[b.level]]


## Multi-line description of one NPC. First line is "Npc<id> STATE".
func describe_npc(npc: Node) -> String:
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
		for w in ws.slice(0, 8):
			if w is Wound:
				lines.append("  " + w.describe())
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
