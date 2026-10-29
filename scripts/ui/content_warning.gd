## Startup mature-content notice. Shown until the player presses Continue once; the choice is remembered
## in user:// (ConfigFile). `reset()` makes it show again on the next start.
class_name ContentWarning
extends CanvasLayer

signal accepted

var store_path := "user://settings.cfg"
var _root: Control


static func needs_show_at(path: String) -> bool:
	var cf := ConfigFile.new()
	if cf.load(path) != OK:
		return true
	return not bool(cf.get_value("content", "accepted", false))


static func remember_at(path: String, accepted_flag: bool) -> void:
	var cf := ConfigFile.new()
	cf.load(path)
	cf.set_value("content", "accepted", accepted_flag)
	cf.save(path)


func needs_show() -> bool:
	return needs_show_at(store_path)


## "Show again": the next start displays the notice.
func reset() -> void:
	remember_at(store_path, false)


func _ready() -> void:
	layer = 100
	_root = Control.new()
	_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.mouse_filter = Control.MOUSE_FILTER_STOP
	add_child(_root)
	var bg := ColorRect.new()
	bg.color = Color(0.03, 0.0, 0.0, 1.0)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_root.add_child(bg)
	var box := VBoxContainer.new()
	box.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	box.grow_horizontal = Control.GROW_DIRECTION_BOTH
	box.grow_vertical = Control.GROW_DIRECTION_BOTH
	box.add_theme_constant_override("separation", 18)
	_root.add_child(box)
	var title := Label.new()
	title.text = "MATURE CONTENT"
	title.add_theme_font_size_override("font_size", 40)
	title.add_theme_color_override("font_color", Color(0.85, 0.1, 0.1))
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(title)
	var msg := Label.new()
	msg.text = "Graphic violence against fictional characters.\nAdults only."
	msg.add_theme_font_size_override("font_size", 22)
	msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	box.add_child(msg)
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 24)
	box.add_child(row)
	var cont := Button.new()
	cont.text = "Continue"
	cont.custom_minimum_size = Vector2(160, 44)
	cont.pressed.connect(_on_continue)
	row.add_child(cont)
	var quit := Button.new()
	quit.text = "Quit"
	quit.custom_minimum_size = Vector2(160, 44)
	quit.pressed.connect(func(): get_tree().quit())
	row.add_child(quit)
	cont.grab_focus()


func _on_continue() -> void:
	remember_at(store_path, true)
	accepted.emit()
	queue_free()
