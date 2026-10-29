## Procedural cue synthesis (no assets). render(cue, rng) -> mono PackedFloat32Array at RATE Hz.
## Cues are layered from a few cheap primitives (noise, sine sweeps, formant vowels) and pitch-randomized.
class_name AudioSynth
extends RefCounted

const RATE := 22050
const CUES: Array[StringName] = [&"gunshot", &"knife_hit", &"bat_hit", &"scream", &"grunt", &"gurgle", &"pain_breath",
	&"bone_crack", &"sever", &"body_fall", &"flesh_thud", &"slash_swish", &"skull_crack", &"labored_breath"]


static func has_cue(cue: StringName) -> bool:
	return cue in CUES


static func render(cue: StringName, rng: RandomNumberGenerator) -> PackedFloat32Array:
	var pr := rng.randf_range(0.88, 1.12)   # pitch randomization
	var out: PackedFloat32Array
	match cue:
		&"flesh_thud":
			out = _thud(0.16, 140.0 * pr, 55.0, 0.9)
			_mix(out, _noise(0.16, rng, 0.12, 40.0), 0.0, 0.3)
		&"knife_hit":
			out = _swish(0.14, rng, 2500.0 * pr, 0.35)
			_mix(out, _thud(0.12, 170.0 * pr, 70.0, 0.9), 0.05, 1.0)
		&"bat_hit":
			out = _thud(0.22, 110.0 * pr, 45.0, 1.0)
			_mix(out, _crack(0.08, rng, 1.0), 0.0, 0.5)
		&"bone_crack":
			out = _crack(0.2, rng, pr)
			_mix(out, _crunch(0.18, rng), 0.02, 0.6)
		&"skull_crack":
			out = _crack(0.18, rng, 0.7 * pr)
			_mix(out, _thud(0.2, 90.0 * pr, 40.0, 1.0), 0.0, 0.8)
			_mix(out, _crunch(0.22, rng), 0.03, 0.7)
		&"slash_swish":
			out = _swish(0.22, rng, 3200.0 * pr, 1.0)
		&"sever":
			out = _swish(0.12, rng, 2800.0 * pr, 0.6)
			_mix(out, _crunch(0.25, rng), 0.05, 0.9)
			_mix(out, _thud(0.2, 100.0 * pr, 50.0, 1.0), 0.08, 0.8)
		&"gurgle":
			out = _gurgle(0.55, rng, pr)
		&"scream":
			out = _vowel(0.6, rng, 620.0 * pr, Vector3(800, 1250, 2600), 0.05, 0.9)
		&"grunt":
			out = _vowel(0.2, rng, 120.0 * pr, Vector3(520, 900, 2400), 0.0, 0.5)
		&"pain_breath", &"labored_breath":
			out = _breath(0.9, rng, pr)
		&"body_fall":
			out = _thud(0.3, 75.0 * pr, 35.0, 1.0)
			_mix(out, _noise(0.3, rng, 0.2, 12.0), 0.02, 0.3)
		&"gunshot":
			out = _noise(0.25, rng, 1.0, 14.0)
			_mix(out, _thud(0.2, 90.0 * pr, 40.0, 1.0), 0.0, 1.0)
		_:
			out = _thud(0.08, 300.0 * pr, 200.0, 0.8)
	_normalize(out, 0.8)
	return out


## Wrap mono samples into a 16-bit AudioStreamWAV.
static func to_stream(samples: PackedFloat32Array) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(samples.size() * 2)
	for i in samples.size():
		bytes.encode_s16(i * 2, int(clampf(samples[i], -1.0, 1.0) * 32767.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	return w


static func peak(samples: PackedFloat32Array) -> float:
	var p := 0.0
	for v in samples:
		p = maxf(p, absf(v))
	return p


# ---------------- primitives ----------------

static func _n(dur: float) -> int:
	return maxi(int(dur * RATE), 1)


static func _mix(dst: PackedFloat32Array, src: PackedFloat32Array, at: float, gain: float) -> void:
	var off := int(at * RATE)
	for i in src.size():
		if off + i < dst.size():
			dst[off + i] += src[i] * gain


static func _normalize(a: PackedFloat32Array, target: float) -> void:
	var p := peak(a)
	if p > 0.0001:
		var g := target / p
		for i in a.size():
			a[i] *= g


## Sine sweeping f0 -> f1 with exponential decay.
static func _thud(dur: float, f0: float, f1: float, gain: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var ph := 0.0
	for i in n:
		var t := float(i) / n
		var f := lerpf(f0, f1, 1.0 - exp(-t * 6.0))
		ph += TAU * f / RATE
		out[i] = sin(ph) * exp(-t * 5.0) * minf(float(i) / 40.0, 1.0) * gain
	return out


## White noise, one-pole lowpassed by `bright` (1 = white), exponential decay `decay`.
static func _noise(dur: float, rng: RandomNumberGenerator, bright: float, decay: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var y := 0.0
	for i in n:
		y += (rng.randf_range(-1.0, 1.0) - y) * clampf(bright, 0.02, 1.0)
		out[i] = y * exp(-float(i) / n * decay)
	return out


## Sharp high transient (noise through a differentiator) with very fast decay.
static func _crack(dur: float, rng: RandomNumberGenerator, pitch: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var prev := 0.0
	for i in n:
		var x := rng.randf_range(-1.0, 1.0)
		out[i] = (x - prev * 0.6) * exp(-float(i) / n * (30.0 / maxf(pitch, 0.3)))
		prev = x
	return out


## Crunchy texture: random impulses smoothed, amplitude-modulated.
static func _crunch(dur: float, rng: RandomNumberGenerator) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var y := 0.0
	var env := 0.0
	for i in n:
		if rng.randf() < 0.012:
			env = rng.randf_range(0.5, 1.0)
		env *= 0.992
		y += (rng.randf_range(-1.0, 1.0) * env - y) * 0.55
		out[i] = y * (1.0 - float(i) / n)
	return out


## Band-limited noise whose centre sweeps upward: a whoosh.
static func _swish(dur: float, rng: RandomNumberGenerator, centre: float, gain: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	var bp := 0.0
	for i in n:
		var t := float(i) / n
		var f := lerpf(centre * 0.4, centre, t)
		var a := clampf(TAU * f / RATE, 0.01, 0.9)
		var x := rng.randf_range(-1.0, 1.0)
		lp += (x - lp) * a
		bp += (lp - bp) * a
		out[i] = (lp - bp) * sin(PI * t) * 4.0 * gain
	return out


## Bubbly modulated noise + low tone.
static func _gurgle(dur: float, rng: RandomNumberGenerator, pitch: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	var rate := rng.randf_range(16.0, 26.0)
	var ph := 0.0
	for i in n:
		var t := float(i) / n
		lp += (rng.randf_range(-1.0, 1.0) - lp) * 0.12
		var bub := pow(maxf(sin(TAU * rate * t * dur + sin(t * 9.0) * 2.0), 0.0), 3.0)
		ph += TAU * (150.0 + 90.0 * bub) * pitch / RATE
		out[i] = (lp * 2.0 + sin(ph) * 0.5) * bub * sin(PI * t)
	return out


## Noise breath cycles (in/out) for labored breathing.
static func _breath(dur: float, rng: RandomNumberGenerator, pitch: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var lp := 0.0
	var bp := 0.0
	var cycles := 2.0
	for i in n:
		var t := float(i) / n
		var env := pow(maxf(sin(TAU * cycles * t), 0.0), 1.5) * (0.6 + 0.4 * sin(TAU * cycles * t * 3.0))
		var a := 0.12 * pitch * (0.7 if fmod(t * cycles, 1.0) < 0.5 else 1.0)
		lp += (rng.randf_range(-1.0, 1.0) - lp) * a
		bp += (lp - bp) * 0.25
		out[i] = (lp - bp * 0.5) * env * 3.0
	return out


## Formant-ish vowel: vibrato-modulated sawtooth through three resonators. roughness adds noise (scream).
static func _vowel(dur: float, rng: RandomNumberGenerator, f0: float, formants: Vector3, rough: float, gain: float) -> PackedFloat32Array:
	var n := _n(dur)
	var out := PackedFloat32Array()
	out.resize(n)
	var ph := 0.0
	var y1 := Vector3.ZERO
	var y2 := Vector3.ZERO
	var fr := [formants.x, formants.y, formants.z]
	var bw := [90.0, 110.0, 160.0]
	var c1 := [0.0, 0.0, 0.0]
	var c2 := [0.0, 0.0, 0.0]
	for k in 3:
		var r := exp(-PI * bw[k] / RATE)
		c1[k] = 2.0 * r * cos(TAU * fr[k] / RATE)
		c2[k] = -r * r
	var drift := rng.randf_range(-0.15, 0.15)
	for i in n:
		var t := float(i) / n
		var f := f0 * (1.0 + 0.25 * sin(PI * t) * (1.0 + drift) + 0.03 * sin(TAU * 6.0 * t * dur))
		ph += f / RATE
		var src := (fmod(ph, 1.0) * 2.0 - 1.0) + rng.randf_range(-1.0, 1.0) * rough
		var s := 0.0
		for k in 3:
			var yn: float = src + c1[k] * y1[k] + c2[k] * y2[k]
			y2[k] = y1[k]
			y1[k] = yn
			s += yn * (1.0 if k == 0 else 0.6)
		out[i] = s * 0.02 * gain * minf(t * 30.0, 1.0) * pow(1.0 - t, 0.7)
	return out
