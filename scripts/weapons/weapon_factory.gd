## Builds a Weapon node from a definition. Switches on `kind` only, never on `id`.
class_name WeaponFactory
extends RefCounted


static func create(def: Dictionary, source: Node = null) -> Weapon:
	var w: Weapon
	match String(def.get("kind", "")):
		"hitscan":
			w = HitscanWeapon.new()
		"melee":
			w = MeleeWeapon.new()
		_:
			push_error("WeaponFactory: unknown kind '%s'" % def.get("kind", ""))
			return null
	w.name = String(def.get("id", "weapon"))
	w.setup(def, source)
	return w
