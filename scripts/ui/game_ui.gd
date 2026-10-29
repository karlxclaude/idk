## HUD: crosshair, weapon name, Spawn NPC / Clear buttons, setting toggles, content label.
class_name GameUI
extends CanvasLayer

signal spawn_requested
signal clear_requested

var weapon_label: Label


func _ready() -> void:
	layer = 5
	var root := Control.new()
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
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
	var spawn := Button.new()
	spawn.text = "Spawn NPC (N)"
	spawn.focus_mode = Control.FOCUS_NONE
	spawn.pressed.connect(func(): spawn_requested.emit())
	box.add_child(spawn)
	var clear := Button.new()
	clear.text = "Clear all"
	clear.focus_mode = Control.FOCUS_NONE
	clear.pressed.connect(func(): clear_requested.emit())
	box.add_child(clear)
	_toggle(box, "Panic", &"panic_enabled")
	_toggle(box, "Scream", &"scream_enabled")
	_toggle(box, "Ragdoll only", &"ragdoll_only")
	var help := Label.new()
	help.text = "WASD move, Space jump, 1/2/3 weapon, LMB attack, RMB stab\nShift+mouse free swing, F1 debug, Esc frees mouse"
	help.add_theme_font_size_override("font_size", 12)
	box.add_child(help)

	weapon_label = Label.new()
	weapon_label.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	weapon_label.position += Vector2(12, -36)
	weapon_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(weapon_label)


func set_weapon_name(n: String) -> void:
	weapon_label.text = n


func _toggle(parent: Control, label: String, setting: StringName) -> void:
	var cb := CheckBox.new()
	cb.text = label
	cb.focus_mode = Control.FOCUS_NONE
	cb.button_pressed = GameSettings.get(setting)
	cb.toggled.connect(func(on: bool): GameSettings.set_setting(setting, on))
	parent.add_child(cb)
