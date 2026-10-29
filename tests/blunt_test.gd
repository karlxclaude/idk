## Blunt mechanism test (milestone 5): momentum- and contact-area-aware ctx.force.
## Run: godot --headless --path . res://tests/blunt_test.tscn
## Real NPCs, weapon-style BLUNT events built here (bat numbers from data/weapons.json).
extends Node3D

const BluntRule := preload("res://scripts/damage/mechanisms/blunt.gd")

var _fails := 0
var _bat: Dictionary = {}


func _check(name: String, ok: bool, info: String = "") -> void:
	print("%s  %s  %s" % ["PASS" if ok else "FAIL", name, info])
	if not ok:
		_fails += 1


func _fresh(seed_: int = 1) -> Npc:
	var n := Npc.spawn(self, Transform3D(Basis(), Vector3.ZERO), seed_)
	n.blood.set_physics_process(false)
	return n


## Weapon-style blunt event: amount from the bat's velocity law, mass and velocity as MeleeWeapon sets them.
func _ev(n: Npc, part: int, amount: float, mass: float, speed: float, head_area := 0.0) -> DamageEvent:
	var e := DamageEvent.new()
	e.type = DamageEvent.Type.BLUNT
	e.part_id = part
	e.amount = amount
	e.impactor_mass = mass
	e.impactor_velocity = Vector3(0, 0, -speed)
	e.direction = Vector3(0, 0, -1)
	e.hit_normal = Vector3(0, 0, 1)
	e.hit_position = n.body.get_part_global_transform(part).origin
	e.weapon_id = &"blunt_test"
	if head_area > 0.0:
		e.extra["head_area"] = head_area
	return e


func _bat_amount(speed: float) -> float:
	var s := clampf(pow(speed / float(_bat.velocity_ref), float(_bat.damage_velocity_exponent)), 0.0, float(_bat.max_damage_scale))
	return float(_bat.base_damage) * s


## Run only the blunt mechanism rule on a fresh context (no commit) and return it.
func _ctx(n: Npc, ev: DamageEvent) -> HitContext:
	var ctx := HitContext.new()
	ctx.npc = n
	ctx.ev = ev
	ctx.part = n.damage.get_part(ev.part_id)
	ctx.part_cfg = n.damage._rows[ev.part_id]
	ctx.region = n.damage.region_of(ev)
	ctx.base_damage = ev.amount * float(ctx.part_cfg.get("dmg_mult", 1.0)) \
		* float(DataDB.table("injury/core").get("type_mult", {}).get("blunt", 1.0))
	var r: InjuryRule = BluntRule.new()
	r.setup(DataDB.table("injury/blunt"), n.damage)
	r.apply(ctx)
	return ctx


func _ready() -> void:
	var floor_body := StaticBody3D.new()
	var col := CollisionShape3D.new()
	var box := BoxShape3D.new(); box.size = Vector3(100, 1, 100)
	col.shape = box; floor_body.add_child(col); floor_body.position.y = -0.5
	add_child(floor_body)
	await get_tree().physics_frame
	for w in DataDB.table("weapons").weapons:
		if w.id == "bat":
			_bat = w
	_check("0 bat definition found", not _bat.is_empty())

	await _t_mass()
	await _t_monotonic()
	await _t_area()
	await _t_hammer()
	await _t_bat_baseline()
	await _t_fallbacks()
	print("BLUNT TEST ", "FAILED" if _fails > 0 else "OK")
	get_tree().quit(1 if _fails > 0 else 0)


func _t_mass() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var p := BodyIds.Part.LOWER_ARM_L
	var light := _ctx(n, _ev(n, p, 25.0, 0.1, 8.0)).force
	var heavy := _ctx(n, _ev(n, p, 25.0, 9.0, 8.0)).force
	_check("1a same speed, 9 kg gives more force than 0.1 kg", heavy > light * 1.5, "light=%.1f heavy=%.1f" % [light, heavy])
	var plain := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0))
	_check("1b mass-matched bat keeps force ~ amount", absf(plain.force / 25.0 - 1.0) < 0.05, "force=%.2f" % plain.force)
	n.queue_free()


func _t_monotonic() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var p := BodyIds.Part.UPPER_LEG_L
	var prev := -1.0
	var ok := true
	var series := []
	for m in [0.5, 0.9, 1.5, 2.5, 4.0]:
		var f := _ctx(n, _ev(n, p, 25.0, m, 8.0)).force
		series.append(snappedf(f, 0.1))
		ok = ok and f > prev
		prev = f
	_check("2a force strictly increases with mass (fixed amount, speed)", ok, str(series))
	prev = -1.0
	ok = true
	series = []
	for v in [3.0, 5.0, 8.0, 10.0, 14.0]:
		var f := _ctx(n, _ev(n, p, 25.0, 0.9, v)).force
		series.append(snappedf(f, 0.1))
		ok = ok and f > prev
		prev = f
	_check("2b force strictly increases with speed (fixed amount, mass)", ok, str(series))
	# with the bat's own amount law, faster swings give strictly more force too
	prev = -1.0
	ok = true
	for v in [5.1, 7.5, 10.2, 12.0, 15.3]:
		var f := _ctx(n, _ev(n, p, _bat_amount(v), 0.9, v)).force
		ok = ok and f > prev
		prev = f
	_check("2c bat swing speeds give monotonic force", ok)
	prev = -1.0
	ok = true
	series = []
	for a in [30.0, 20.0, 10.0, 5.0]:
		var f := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0, a)).force
		series.append(snappedf(f, 0.1))
		ok = ok and f > prev
		prev = f
	_check("2d smaller head area gives more force", ok, str(series))
	n.queue_free()


func _t_area() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var p := BodyIds.Part.LOWER_ARM_L
	var none := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0))
	var bat_area := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0, 30.0))
	var wide := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0, 200.0))
	var small := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0, 5.0))
	_check("3a missing head_area is neutral (factor 1)", is_equal_approx(float(none.tags.area_factor), 1.0))
	_check("3b reference-area head is neutral", absf(bat_area.force / none.force - 1.0) < 0.01)
	_check("3c very wide head spreads force (clamped, not zero)", wide.force < none.force and wide.force > none.force * 0.5,
		"%.1f vs %.1f" % [wide.force, none.force])
	_check("3d small head concentrates force and HP damage", small.force > none.force * 1.5 and small.damage > none.damage,
		"force %.1f vs %.1f, dmg %.2f vs %.2f" % [small.force, none.force, small.damage, none.damage])
	var tiny := _ctx(n, _ev(n, p, 25.0, 0.9, 10.0, 0.0001))
	_check("3e tiny/degenerate area is clamped", tiny.force <= none.force * 2.6 and is_finite(tiny.force), "%.1f" % tiny.force)
	n.queue_free()


## Equal momentum and equal amount: the hammer-like hit fractures a lower arm, the bat-like hit only bruises.
func _t_hammer() -> void:
	var p := BodyIds.Part.LOWER_ARM_L
	var bat_n := _fresh(1)
	var ham_n := _fresh(2)
	await get_tree().physics_frame
	var bat_broke := []
	var ham_broke := []
	bat_n.part_broken.connect(func(id): bat_broke.append(id))
	ham_n.part_broken.connect(func(id): ham_broke.append(id))
	# bat: 0.9 kg x 10 m/s; hammer: 1.2 kg x 7.5 m/s (same 9 kg m/s); same amount, same part
	var bat_ev := _ev(bat_n, p, 28.0, 0.9, 10.0, 33.0)
	var ham_ev := _ev(ham_n, p, 28.0, 1.2, 7.5, 6.0)
	_check("4a equal momentum", absf(bat_ev.impactor_mass * bat_ev.impactor_velocity.length() - ham_ev.impactor_mass * ham_ev.impactor_velocity.length()) < 0.01)
	var bat_f := _ctx(bat_n, bat_ev).force
	var ham_f := _ctx(ham_n, ham_ev).force
	var thr := float(DataDB.table("injury/arms").parts.lower_arm_l.fracture_force)
	_check("4b hammer force above, bat force below, lower-arm fracture_force", ham_f >= thr and bat_f < thr, "bat=%.1f hammer=%.1f thr=%.0f" % [bat_f, ham_f, thr])
	bat_n.apply_damage(bat_ev)
	ham_n.apply_damage(ham_ev)
	var bp_b := bat_n.damage.get_part(p)
	var bp_h := ham_n.damage.get_part(p)
	_check("4c bat-like hit only bruises (no fracture, bruise > 0)", not bp_b.broken and bat_broke.is_empty() and bp_b.bruise > 0.0, "bruise=%.3f" % bp_b.bruise)
	_check("4d hammer-like hit fractures the lower arm", bp_h.broken and ham_broke == [p])
	bat_n.queue_free(); ham_n.queue_free()


## Bat baseline: normal swing force within +-10% of the old ctx.force (= ev.amount); outcomes unchanged on key zones.
func _t_bat_baseline() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var zones := [BodyIds.Part.HEAD, BodyIds.Part.TORSO, BodyIds.Part.UPPER_ARM_L, BodyIds.Part.LOWER_ARM_L,
		BodyIds.Part.HAND_L, BodyIds.Part.UPPER_LEG_L, BodyIds.Part.LOWER_LEG_L, BodyIds.Part.FOOT_L]
	var ok := true
	var worst := 0.0
	for z in zones:
		var amt := _bat_amount(10.2)
		var f := _ctx(n, _ev(n, z, amt, float(_bat.mass), 10.2)).force
		worst = maxf(worst, absf(f / amt - 1.0))
		ok = ok and absf(f / amt - 1.0) <= 0.10
	_check("5a bat normal swing (10.2 m/s) force within +-10% of amount", ok, "worst dev=%.1f%%" % (worst * 100.0))
	var slow := _bat_amount(5.1)
	var fast := _bat_amount(15.3)
	var fs := _ctx(n, _ev(n, BodyIds.Part.LOWER_ARM_L, slow, float(_bat.mass), 5.1)).force
	var ff := _ctx(n, _ev(n, BodyIds.Part.LOWER_ARM_L, fast, float(_bat.mass), 15.3)).force
	print("INFO  bat force/amount: slow(5.1)=%.2f fast(15.3)=%.2f" % [fs / slow, ff / fast])
	# outcomes at the normal swing (old behaviour: lower arm bruise only, hand fracture, foot fracture, chest winded)
	var arm_n := _fresh(5)
	var hand_n := _fresh(6)
	var foot_n := _fresh(7)
	var chest_n := _fresh(8)
	await get_tree().physics_frame
	var amt2 := _bat_amount(10.2)
	var mk := func(npc: Npc, part: int) -> DamageEvent:
		return _ev(npc, part, amt2, float(_bat.mass), 10.2)
	arm_n.apply_damage(mk.call(arm_n, BodyIds.Part.LOWER_ARM_L))
	hand_n.apply_damage(mk.call(hand_n, BodyIds.Part.HAND_L))
	foot_n.apply_damage(mk.call(foot_n, BodyIds.Part.FOOT_L))
	var stunned := []
	chest_n.stunned.connect(func(d, c): stunned.append(c))
	chest_n.apply_damage(mk.call(chest_n, BodyIds.Part.TORSO))
	_check("5b normal bat: lower arm not broken", not arm_n.damage.get_part(BodyIds.Part.LOWER_ARM_L).broken)
	_check("5c normal bat: hand fractures", hand_n.damage.get_part(BodyIds.Part.HAND_L).broken)
	_check("5d normal bat: foot fractures", foot_n.damage.get_part(BodyIds.Part.FOOT_L).broken)
	_check("5e normal bat: torso winded", &"winded" in stunned, str(stunned))
	for x in [n, arm_n, hand_n, foot_n, chest_n]:
		x.queue_free()


func _t_fallbacks() -> void:
	var n := _fresh()
	await get_tree().physics_frame
	var p := BodyIds.Part.UPPER_ARM_L
	var e := _ev(n, p, 20.0, 0.0, 0.0)  # no mass / velocity (older tests, scripted hits)
	var c := _ctx(n, e)
	_check("6a no mass/velocity: force == amount", is_equal_approx(c.force, 20.0), "%.2f" % c.force)
	var e2 := _ev(n, p, 20.0, 0.9, 0.0)
	_check("6b zero velocity: force == amount", is_equal_approx(_ctx(n, e2).force, 20.0))
	var huge := _ctx(n, _ev(n, p, 20.0, 500.0, 50.0))
	_check("6c extreme momentum is clamped", huge.force <= 20.0 * (1.0 + 0.6 * 3.0) + 0.01, "%.1f" % huge.force)
	n.queue_free()
