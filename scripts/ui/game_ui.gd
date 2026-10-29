## HUD: crosshair, weapon name, HP bar + damage flash + faint fade, Spawn/Clear buttons and a
## compact collapsible settings panel covering every GameSettings toggle.
class_name GameUI
extends CanvasLayer

signal spawn_requested
signal clear_requested

const CLEANUP_STEPS := [0.0, 10.0, 30.0, 60.0, 120.0]

var weapon_label: Label
var hp_bar: ProgressBar
var flash: ColorRect
var fade: ColorRect
var panel: VBoxContainer
var _player: Player = null
var _cleanup_label: Label
var _scale_label: Label
var _flash_alpha := 0.45


func _ready() -> void:
	layer = 5
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	flash = _overlay_rect(root, Color(0.8, 0.0, 0.0, 0.0))
	fade = _overlay_rect(root, Color(0, 0, 0, 0.0))
	var cross := Label.new()
	cross.text = "+"
	cross.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	cross.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(cross)

	var box := VBoxContainer.new()
	box.position = Vector2(12, 12)
	root.add_child(box)
	var note := Label.new()
	note.text = "Fictional NPCs only. Adult single-player sandbox."
	box.add_child(note)
	hp_bar = ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(220, 14)
	hp_bar.show_percentage = false
	hp_bar.max_value = 100.0
	hp_bar.value = 100.0
	hp_bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color(0.75, 0.1, 0.1)
	hp_bar.add_theme_stylebox_override("fill", fill)
	box.add_child(hp_bar)
	var row := HBoxContainer.new()
	box.add_child(row)
	_button(row, "Spawn NPC (N)", func(): spawn_requested.emit())
	_button(row, "Clear all", func(): clear_requested.emit())
	var toggle := _button(box, "Settings  [+]", Callable())
	panel = VBoxContainer.new()
	panel.visible = false
	box.add_child(panel)
	toggle.pressed.connect(func():
		panel.visible = not panel.visible
		toggle.text = "Settings  [-]" if panel.visible else "Settings  [+]")
	_build_panel()
	var help := Label.new()
	help.text = "WASD move, Space jump, 1-7 weapon, LMB attack, RMB stab\nShift+mouse free swing, F1 debug, Esc frees mouse"
	help.add_theme_font_size_override("font_size", 12)
	box.add_child(help)

	weapon_label = Label.new()
	weapon_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	weapon_label.position += Vector2(12, -36)
	weapon_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(weapon_label)


func _build_panel() -> void:
	_toggle("Panic", &"panic_enabled")
	_toggle("Scream", &"scream_enabled")
	_toggle("Ragdoll only", &"ragdoll_only")
	_toggle("Fight back", &"fight_back")
	_toggle("Slow-mo on kill", &"slow_mo_on_kill")
	_toggle("Immortal dummy (new spawns)", &"immortal_dummy")
	_toggle("No dismemberment", &"no_dismemberment")
	var gr := HBoxContainer.new()
	panel.add_child(gr)
	var gl := Label.new(); gl.text = "Gore"; gr.add_child(gl)
	var ob := OptionButton.new()
	ob.focus_mode = Control.FOCUS_NONE
	for n in GameSettings.Gore.keys():
		ob.add_item(n)
	ob.selected = GameSettings.gore_intensity
	ob.item_selected.connect(func(i: int): GameSettings.set_setting(&"gore_intensity", i))
	gr.add_child(ob)
	_cleanup_label = Label.new()
	panel.add_child(_cleanup_label)
	var cs := HSlider.new()
	cs.min_value = 0; cs.max_value = CLEANUP_STEPS.size() - 1; cs.step = 1
	cs.custom_minimum_size.x = 200
	cs.focus_mode = Control.FOCUS_NONE
	cs.value_changed.connect(func(v: float):
		var t: float = CLEANUP_STEPS[int(v)]
		GameSettings.set_setting(&"auto_cleanup_time", t)
		_cleanup_label.text = "Auto-cleanup: " + ("off" if t <= 0.0 else "%d s" % int(t)))
	var idx := CLEANUP_STEPS.find(GameSettings.auto_cleanup_time)
	cs.value = maxi(idx, 0)
	_cleanup_label.text = "Auto-cleanup: " + ("off" if GameSettings.auto_cleanup_time <= 0.0 else "%d s" % int(GameSettings.auto_cleanup_time))
	panel.add_child(cs)
	_scale_label = Label.new()
	panel.add_child(_scale_label)
	var ts := HSlider.new()
	ts.min_value = 0.1; ts.max_value = 1.0; ts.step = 0.05
	ts.custom_minimum_size.x = 200
	ts.focus_mode = Control.FOCUS_NONE
	ts.value_changed.connect(func(v: float):
		GameSettings.set_setting(&"time_scale", v)
		_scale_label.text = "Time scale: %.2f" % v)
	ts.value = GameSettings.time_scale
	_scale_label.text = "Time scale: %.2f" % GameSettings.time_scale
	panel.add_child(ts)


func bind_player(p: Player) -> void:
	_player = p
	_flash_alpha = float(p.cfg.get("flash_alpha", 0.45))
	hp_bar.max_value = p.max_health
	hp_bar.value = p.health
	p.health_changed.connect(func(hp: float, _m: float): hp_bar.value = hp)
	p.damaged.connect(_on_damaged)
	p.fainted.connect(func(d: float):
		var t := create_tween().set_ignore_time_scale(true)
		t.tween_property(fade, "color:a", 1.0, d * 0.6))
	p.revived.connect(func():
		var t := create_tween().set_ignore_time_scale(true)
		t.tween_property(fade, "color:a", 0.0, 0.4))


func _on_damaged(_amount: float) -> void:
	flash.color.a = _flash_alpha
	var t := create_tween().set_ignore_time_scale(true)
	t.tween_property(flash, "color:a", 0.0, 0.5)


func set_weapon_name(n: String) -> void:
	weapon_label.text = n


func _overlay_rect(parent: Control, c: Color) -> ColorRect:
	var r := ColorRect.new()
	r.color = c
	r.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(r)
	return r


func _button(parent: Control, text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.focus_mode = Control.FOCUS_NONE
	if cb.is_valid():
		b.pressed.connect(cb)
	parent.add_child(b)
	return b


func _toggle(label: String, setting: StringName) -> void:
	var cb := CheckBox.new()
	cb.text = label
	cb.focus_mode = Control.FOCUS_NONE
	cb.button_pressed = GameSettings.get(setting)
	cb.toggled.connect(func(on: bool): GameSettings.set_setting(setting, on))
	panel.add_child(cb)
