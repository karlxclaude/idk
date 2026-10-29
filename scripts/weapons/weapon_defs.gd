## Loads data/weapons.json. Adding a weapon is a data-only change.
class_name WeaponDefs
extends RefCounted


## All weapon definitions sorted by slot.
static func all() -> Array:
	var out: Array = []
	for d in DataDB.table("weapons").get("weapons", []):
		if typeof(d) == TYPE_DICTIONARY:
			out.append(d)
	out.sort_custom(func(a, b): return int(a.get("slot", 0)) < int(b.get("slot", 0)))
	return out


static func get_def(id: String) -> Dictionary:
	for d in all():
		if d.get("id", "") == id:
			return d
	return {}


static func free_swing_cfg() -> Dictionary:
	return DataDB.table("weapons").get("free_swing", {})
