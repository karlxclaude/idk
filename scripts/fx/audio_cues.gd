## Audio hook: listens to GameEvents.audio_cue. v1 logs cues (ring buffer, debug overlay) and plays
## tiny procedural blips, or a real asset if the path in data/gore.json "audio.cues" exists.
class_name AudioCues
extends Node3D

signal cue_played(cue: StringName)

const MIX_RATE := 22050.0

var recent: Array[String] = []
var cfg: Dictionary = {}
var _players: Array[AudioStreamPlayer3D] = []
var _next := 0


func _ready() -> void:
	cfg = DataDB.table("gore").get("audio", {})
	for i in int(cfg.get("max_players", 6)):
		var p := AudioStreamPlayer3D.new()
		p.max_distance = 40.0
		p.volume_db = float(cfg.get("blip_volume_db", -22.0))
		add_child(p)
		_players.append(p)
	GameEvents.audio_cue.connect(_on_cue)


func _on_cue(npc: Node, cue: StringName, pos: Vector3, intensity: float) -> void:
	if cue == &"scream" and not GameSettings.scream_enabled:
		return
	recent.append("%s @%.0f%%" % [cue, intensity * 100.0])
	while recent.size() > int(cfg.get("log_recent", 24)):
		recent.pop_front()
	cue_played.emit(cue)
	var entry: Dictionary = cfg.get("cues", {}).get(String(cue), {})
	if entry.is_empty() or _players.is_empty():
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.global_position = pos
	var path := String(entry.get("path", ""))
	if path != "" and ResourceLoader.exists(path):
		p.stream = load(path)
		p.play()
		return
	_blip(p, float(entry.get("freq", 200.0)), float(entry.get("dur", 0.08)), clampf(intensity, 0.1, 1.5))


func _blip(p: AudioStreamPlayer3D, freq: float, dur: float, vol: float) -> void:
	var gen := AudioStreamGenerator.new()
	gen.mix_rate = MIX_RATE
	gen.buffer_length = dur + 0.05
	p.stream = gen
	p.play()
	var pb := p.get_stream_playback() as AudioStreamGeneratorPlayback
	if pb == null:
		return
	var n := int(dur * MIX_RATE)
	var phase := 0.0
	for i in n:
		var env := 1.0 - float(i) / n
		phase += TAU * freq / MIX_RATE
		pb.push_frame(Vector2.ONE * sin(phase) * env * env * 0.5 * vol)
