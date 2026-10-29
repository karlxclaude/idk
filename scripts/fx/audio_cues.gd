## Audio hook: listens to GameEvents.audio_cue. Cues are synthesized procedurally by AudioSynth (layered,
## pitch-randomized, a few cached variants each); a real asset is used instead if the path in
## data/gore.json "audio.cues" exists. Cues are also logged (ring buffer, shown by the debug overlay).
class_name AudioCues
extends Node3D

signal cue_played(cue: StringName)

const VARIANTS := 3

var recent: Array[String] = []
var cfg: Dictionary = {}
var _players: Array[AudioStreamPlayer3D] = []
var _next := 0
var _cache: Dictionary = {}       # cue -> Array[AudioStreamWAV]
var _last_ms: Dictionary = {}     # cue -> last play msec (anti-spam)
var _rng := RandomNumberGenerator.new()


func _ready() -> void:
	_rng.randomize()
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
	if _players.is_empty():
		return
	var now := Time.get_ticks_msec()
	if now - int(_last_ms.get(cue, -1000)) < int(cfg.get("min_gap_ms", 40)):
		return
	_last_ms[cue] = now
	var stream: AudioStream = _stream_for(cue)
	if stream == null:
		return
	var p := _players[_next]
	_next = (_next + 1) % _players.size()
	p.global_position = pos
	p.stream = stream
	p.pitch_scale = _rng.randf_range(0.93, 1.07)
	p.volume_db = float(cfg.get("blip_volume_db", -22.0)) + linear_to_db(clampf(intensity, 0.1, 1.5))
	p.play()


func _stream_for(cue: StringName) -> AudioStream:
	var entry: Dictionary = cfg.get("cues", {}).get(String(cue), {})
	var path := String(entry.get("path", ""))
	if path != "" and ResourceLoader.exists(path):
		return load(path)
	if not AudioSynth.has_cue(cue):
		return null
	if not _cache.has(cue):
		_cache[cue] = []
	var list: Array = _cache[cue]
	if list.size() < VARIANTS:
		var w := AudioSynth.to_stream(AudioSynth.render(cue, _rng))
		list.append(w)
		return w
	return list[_rng.randi() % list.size()]
