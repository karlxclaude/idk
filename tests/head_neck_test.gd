## Head chunk / neck injury test: real NPCs, weapon-style events through npc.apply_damage aimed at head chunk zones.
## Run: godot --headless --path . res://tests/head_neck_test.tscn
extends Node3D

const HEAD := BodyIds.Part.HEAD
const HC := BodyIds.HeadChunk
## Centres of the head zones in normalized head-local space (see BodyIds.head_chunk_from_local).
const ZONE := {
	HC.JAW: Vector3(0, -0.7, 0.5), HC.FACE: Vector3(0, 0.1, 0.7),
	HC.CRANIUM: Vector3(0, 0.6, 0.0), HC.OCCIPUT: Vector3(0, 0.1, -0.7),
}

var _fails := 0


func _check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s  %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


## Spawned NPC plus recorders for the signals the tests look at.
class Rec:
	var npc: Npc
	var destroyed: Array = []
	var lethal: Array = []
	var stuns: Array = []

	func _init(n: Npc) -> void:
		npc = n
		n.head_chunk_destroyed.connect(func(c, _g, _e): destroyed.append(c))
		n.lethal_injury.connect(func(cause): lethal.append(cause))
		n.stunned.connect(func(d, cause): stuns.append([d, cause]))


func _spawn(immortal := false) -> Rec:
	var n := Npc.spawn(self, Transform3D(Basis(), Vector3.ZERO), 7)
	n.immortal = immortal
	var r := Rec.new(n)
	await get_tree().physics_frame
	n.blood.set_physics_process(false)
	return r


## Weapon-style event at a head zone: local normalized point -> world hit position on the real head segment.
func _hit(npc: Npc, zone: Vector3, amount: float, type := DamageEvent.Type.BULLET, pen := 0.45, extra := {}) -> void:
	var xf := npc.body.get_part_global_transform(HEAD)
	var ext := npc.body.get_part_half_extents(HEAD)
	var ev := DamageEvent.new()
	ev.type = type
	ev.part_id = HEAD
	ev.amount = amount
	ev.penetration = pen
	ev.hit_position = xf * (zone * ext)
	ev.direction = -xf.basis.z.normalized() if zone.z >= 0.0 else xf.basis.z.normalized()
	ev.hit_normal = -ev.direction
	ev.impactor_mass = 0.008
	ev.impactor_velocity = ev.direction * 380.0
	ev.extra = extra.duplicate()
	npc.apply_damage(ev)


func _frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	await get_tree().physics_frame

	_check("0 zone mapping", BodyIds.head_chunk_from_local(ZONE[HC.JAW]) == HC.JAW and BodyIds.head_chunk_from_local(ZONE[HC.FACE]) == HC.FACE
		and BodyIds.head_chunk_from_local(ZONE[HC.CRANIUM]) == HC.CRANIUM and BodyIds.head_chunk_from_local(ZONE[HC.OCCIPUT]) == HC.OCCIPUT)
	await _t_jaw()
	await _t_cranium()
	await _t_weak_face()
	await _t_repeated()
	await _t_accumulated_skull()
	await _t_spill()
	await _t_face_lethal()
	await _t_immortal()
	await _t_blunt()
	await _t_neck()
	print("HEAD NECK TEST ", "FAILED" if _fails > 0 else "OK")
	get_tree().quit(1 if _fails > 0 else 0)


func _t_jaw() -> void:
	var r := await _spawn()
	_hit(r.npc, ZONE[HC.JAW], 34.0)
	await _frames(20)
	var head := r.npc.damage.get_part(HEAD)
	_check("1a jaw 9mm: jaw destroyed, head_chunk_destroyed emitted once", r.destroyed == [HC.JAW] and head.chunks_destroyed == [HC.JAW], str(r.destroyed))
	_check("1b jaw 9mm: NPC alive, no lethal, head intact", not r.npc.is_dead() and r.lethal.is_empty() and not head.destroyed and head.hp > 0.0,
		"state=%s hp=%.1f lethal=%s" % [BodyIds.state_name(r.npc.get_state()), head.hp, r.lethal])
	_check("1c jaw 9mm: stunned (jaw_destroyed)", r.stuns.any(func(s): return s[1] == &"jaw_destroyed"), str(r.stuns))
	var heavy := false
	for w in r.npc.wounds.get_wounds_on(HEAD):
		heavy = heavy or (w.bleed_rate >= 25.0 and not w.is_arterial)
	_check("1d jaw loss leaves a heavy (non-arterial) bleed", heavy)
	r.npc.queue_free()


func _t_cranium() -> void:
	var r := await _spawn()
	_hit(r.npc, ZONE[HC.CRANIUM], 34.0)
	await _frames(20)
	_check("2a 9mm to the cranium is lethal", r.lethal.size() == 1 and r.npc.is_dead(), "lethal=%s state=%s" % [r.lethal, BodyIds.state_name(r.npc.get_state())])
	_check("2b cranium chunk destroyed once", r.destroyed == [HC.CRANIUM], str(r.destroyed))
	r.npc.queue_free()
	var o := await _spawn()
	_hit(o.npc, ZONE[HC.OCCIPUT], 34.0)
	await _frames(20)
	_check("2c 9mm to the occiput is lethal, occiput destroyed", o.npc.is_dead() and o.destroyed == [HC.OCCIPUT], str(o.destroyed))
	o.npc.queue_free()


func _t_weak_face() -> void:
	var r := await _spawn()
	_hit(r.npc, ZONE[HC.FACE], 8.0)
	await _frames(10)
	var head := r.npc.damage.get_part(HEAD)
	_check("3a weak face hit: no chunk destroyed, not lethal", r.destroyed.is_empty() and head.chunks_destroyed.is_empty() and r.lethal.is_empty() and not r.npc.is_dead())
	_check("3b weak face hit: stun (head_graze)", r.stuns.size() == 1 and r.stuns[0][1] == &"head_graze" and r.stuns[0][0] > 0.0, str(r.stuns))
	_check("3c face chunk took damage", head.chunk_hp[HC.FACE] < 30.0 and head.chunk_hp[HC.FACE] > 0.0, str(head.chunk_hp))
	r.npc.queue_free()


func _t_repeated() -> void:
	var r := await _spawn()
	var counts: Array = []
	for i in 4:
		_hit(r.npc, ZONE[HC.FACE], 12.0)
		counts.append(r.destroyed.size())
	var head := r.npc.damage.get_part(HEAD)
	_check("4a repeated face hits: destroyed exactly once (on the 2nd), alive meanwhile", r.destroyed == [HC.FACE] and counts[0] == 0 and counts[1] == 1 and counts[3] == 1, "counts=%s" % [counts])
	_check("4b face destroyed (not lethal): long stun, face_destroyed", r.stuns.any(func(s): return s[1] == &"face_destroyed" and s[0] >= 4.0), str(r.stuns))
	_check("4c chunk_hp stays 0 / destroyed list unique", head.chunks_destroyed == [HC.FACE] and head.chunk_hp[HC.FACE] == 0.0)
	r.npc.queue_free()


func _t_accumulated_skull() -> void:
	var r := await _spawn()
	for i in 3:
		_hit(r.npc, ZONE[HC.CRANIUM], 12.0)
	await _frames(20)
	var head := r.npc.damage.get_part(HEAD)
	_check("5a accumulated cranium damage destroys it: lethal skull_destroyed", r.lethal == [&"skull_destroyed"] and r.destroyed == [HC.CRANIUM] and r.npc.is_dead(), "lethal=%s destroyed=%s hp=%.1f" % [r.lethal, r.destroyed, head.hp])
	r.npc.queue_free()


func _t_spill() -> void:
	var low := await _spawn()
	_hit(low.npc, ZONE[HC.FACE], 34.0, DamageEvent.Type.BULLET, 0.45, {"energy": 450.0})
	_check("6a 9mm energy through the face: only the face goes", low.destroyed == [HC.FACE], str(low.destroyed))
	low.npc.queue_free()
	var big := await _spawn()
	_hit(big.npc, ZONE[HC.FACE], 40.0, DamageEvent.Type.BULLET, 0.8, {"energy": 2500.0})
	await _frames(10)
	_check("6b rifle-class energy through the face also takes the cranium, lethal", big.destroyed.has(HC.FACE) and big.destroyed.has(HC.CRANIUM) and big.destroyed.size() == 2 and big.npc.is_dead(),
		"destroyed=%s lethal=%s" % [big.destroyed, big.lethal])
	big.npc.queue_free()
	var jb := await _spawn()
	_hit(jb.npc, ZONE[HC.JAW], 40.0, DamageEvent.Type.BULLET, 0.8, {"energy": 2500.0})
	_check("6c big bullet through the jaw takes the face (lethal at that damage), jaw+face destroyed", jb.destroyed.has(HC.JAW) and jb.destroyed.has(HC.FACE), str(jb.destroyed))
	jb.npc.queue_free()
	var bl := await _spawn()
	_hit(bl.npc, ZONE[HC.FACE], 70.0, DamageEvent.Type.BLUNT, 0.0, {"energy": 5000.0})
	_check("6d blunt never spills into a neighbour", not bl.destroyed.has(HC.CRANIUM), str(bl.destroyed))
	bl.npc.queue_free()


func _t_face_lethal() -> void:
	var r := await _spawn()
	_hit(r.npc, ZONE[HC.FACE], 34.0)
	await _frames(15)
	_check("7a 9mm to the face: old-style headshot still kills", r.npc.is_dead() and r.lethal == [&"headshot"] and r.destroyed == [HC.FACE], "lethal=%s destroyed=%s" % [r.lethal, r.destroyed])
	r.npc.queue_free()
	var s := await _spawn()
	_hit(s.npc, ZONE[HC.CRANIUM], 20.0, DamageEvent.Type.BLADE_STAB, 0.2)
	_check("7b knife stab to the cranium does not gib the skull", s.destroyed.is_empty())
	s.npc.queue_free()


func _t_immortal() -> void:
	var r := await _spawn(true)
	_hit(r.npc, ZONE[HC.JAW], 34.0)
	_hit(r.npc, ZONE[HC.FACE], 34.0)
	_hit(r.npc, ZONE[HC.CRANIUM], 34.0)
	_hit(r.npc, ZONE[HC.OCCIPUT], 34.0, DamageEvent.Type.BULLET, 0.45, {"energy": 3000.0})
	await _frames(30)
	var head := r.npc.damage.get_part(HEAD)
	_check("8a immortal: jaw and face may be destroyed", r.destroyed.has(HC.JAW) and r.destroyed.has(HC.FACE), str(r.destroyed))
	_check("8b immortal: skull vault survives, no lethal, not dead, head not destroyed",
		not r.destroyed.has(HC.CRANIUM) and not r.destroyed.has(HC.OCCIPUT) and r.lethal.is_empty() and not r.npc.is_dead() and not head.destroyed,
		"destroyed=%s lethal=%s state=%s" % [r.destroyed, r.lethal, BodyIds.state_name(r.npc.get_state())])
	r.npc.queue_free()


func _t_blunt() -> void:
	# same momentum, small hammer head (concentrated) vs bat: the hammer cracks the skull chunk, the bat only stuns
	var bat := await _spawn()
	_hit(bat.npc, ZONE[HC.CRANIUM], 30.0, DamageEvent.Type.BLUNT, 0.0, {})
	_hit(bat.npc, ZONE[HC.CRANIUM], 30.0, DamageEvent.Type.BLUNT, 0.0, {})
	var bh := bat.npc.damage.get_part(HEAD)
	var bat_hp: float = bh.chunk_hp[HC.CRANIUM]
	var ham := await _spawn()
	_hit(ham.npc, ZONE[HC.CRANIUM], 30.0, DamageEvent.Type.BLUNT, 0.0, {"head_area": 3.0})
	_hit(ham.npc, ZONE[HC.CRANIUM], 30.0, DamageEvent.Type.BLUNT, 0.0, {"head_area": 3.0})
	var hh := ham.npc.damage.get_part(HEAD)
	_check("10a small-area blunt hits take more cranium chunk hp than the bat", hh.chunk_hp[HC.CRANIUM] < bat_hp, "bat=%.1f hammer=%.1f" % [bat_hp, hh.chunk_hp[HC.CRANIUM]])
	_check("10b bat head hit: concussion stun, no chunk lost", bat.stuns.size() == 2 and bat.stuns[0][1] == &"concussion" and bat.destroyed.is_empty(), str(bat.stuns))
	bat.npc.queue_free(); ham.npc.queue_free()


func _t_neck() -> void:
	var n := Npc.spawn(self, Transform3D(Basis(), Vector3(3, 0, 0)), 8)
	await get_tree().physics_frame
	n.blood.set_physics_process(false)
	var ev := DamageEvent.new()
	ev.type = DamageEvent.Type.BULLET
	ev.part_id = BodyIds.Part.NECK
	ev.amount = 25.0
	ev.penetration = 0.5
	ev.hit_position = n.body.get_part_global_transform(BodyIds.Part.NECK).origin
	ev.direction = Vector3(0, 0, -1)
	ev.hit_normal = Vector3(0, 0, 1)
	var arterial := [false]
	n.wounded.connect(func(w, _e): arterial[0] = arterial[0] or w.is_arterial)
	n.apply_damage(ev)
	var t := 0.0
	while n.blood.state.level != BodyIds.BloodLevel.FATAL and t < 120.0:
		n.blood.step(0.016)
		t += 0.016
	_check("9 neck bullet: arterial, bleeds out in 10-25 s (unchanged)", arterial[0] and t >= 10.0 and t <= 25.0, "t=%.1f" % t)
	n.queue_free()
