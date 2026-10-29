## Shared (orchestrator-owned). Loads every res://data/<name>.json once.
## Usage: DataDB.table("weapons"), DataDB.get_value("blood", "max_volume", 5000.0)
extends Node

var _tables: Dictionary = {}


func table(name: String) -> Dictionary:
	if not _tables.has(name):
		_tables[name] = _load(name)
	return _tables[name]


func get_value(table_name: String, key: String, default = null):
	return table(table_name).get(key, default)


## Re-read all data files (debug hot-reload).
func reload() -> void:
	_tables.clear()


func _load(name: String) -> Dictionary:
	var path := "res://data/%s.json" % name
	if not FileAccess.file_exists(path):
		push_error("DataDB: missing %s" % path)
		return {}
	var parsed = JSON.parse_string(FileAccess.get_file_as_string(path))
	if typeof(parsed) != TYPE_DICTIONARY:
		push_error("DataDB: %s is not a JSON object" % path)
		return {}
	return parsed
