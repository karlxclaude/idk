// Baked body meshes: vertex colour rgb = region weights (skin, shirt, pants; all zero = shoes), alpha 0 = eyes.
// One shader; every body segment gets its own ShaderMaterial instance carrying the per-NPC colours and the
// per-part blood state (NpcBody.set_part_blood). All blood is procedural, evaluated in part-local space so it
// sticks to the segment as it moves: wound cores, soaked stains (cloth darkens and spreads, skin gets a glossy
// film), run-down streaks with drip lobes. Cheap: loops of 8 with early-outs, no textures.
shader_type spatial;

uniform vec3 skin_color : source_color = vec3(0.85, 0.66, 0.55);
uniform vec3 shirt_color : source_color = vec3(0.25, 0.3, 0.5);
uniform vec3 pants_color : source_color = vec3(0.2, 0.2, 0.28);
uniform vec3 shoe_color : source_color = vec3(0.1, 0.08, 0.07);

// blood (part-local): wounds = (x, y, z, hole radius m); stains = (x, y, z, radius m); runs = metres run along down_local
uniform vec4 wounds[8];
uniform vec4 stains[8];
uniform vec4 runs_a = vec4(0.0);  // runs[0..3] (plain vec4s: float[] uniforms upload wrongly in some drivers)
uniform vec4 runs_b = vec4(0.0);  // runs[4..7]
uniform int n_wounds = 0;
uniform int n_stains = 0;
uniform vec3 down_local = vec3(0.0, -1.0, 0.0);
uniform float wetness = 1.0;
uniform vec3 local_offset = vec3(0.0);  // gibs: mesh re-centred on its chunk; maps back to the head frame

varying vec3 v_local;
varying vec3 v_nrm;  // part-local surface normal: distances are measured along the surface, not through the body

float hash31(vec3 p) {
	p = fract(p * 0.1031);
	p += dot(p, p.zyx + 31.32);
	return fract((p.x + p.y) * p.z);
}

float vnoise(vec3 p) {
	vec3 i = floor(p);
	vec3 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = mix(mix(hash31(i), hash31(i + vec3(1, 0, 0)), f.x),
			mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y);
	float b = mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
			mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y);
	return mix(a, b, f.z);
}

void vertex() {
	v_local = VERTEX + local_offset;
	v_nrm = NORMAL;
}

void fragment() {
	vec3 w = COLOR.rgb;
	float ws = max(0.0, 1.0 - w.r - w.g - w.b);
	vec3 base = skin_color * w.r + shirt_color * w.g + pants_color * w.b + shoe_color * ws;
	base = mix(vec3(0.03, 0.025, 0.025), base, COLOR.a);  // alpha 0 = eyes
	float cloth = clamp(w.g + w.b + ws, 0.0, 1.0);
	float rough = mix(0.5, 0.88, cloth);

	float soak = 0.0;
	float core = 0.0;
	float rim = 0.0;
	if (n_stains > 0 || n_wounds > 0) {
		vec3 p = v_local;
		vec3 nl = normalize(v_nrm);
		vec3 down_t = down_local - nl * dot(down_local, nl);
		down_t = length(down_t) > 0.05 ? normalize(down_t) : down_local;
		float fabric = vnoise(p * 95.0);
		for (int i = 0; i < 8; i++) {
			if (i >= n_stains) {
				break;
			}
			vec4 s = stains[i];
			vec3 q = p - s.xyz;
			q -= nl * dot(q, nl);  // tangential offset
			float r = max(s.w, 0.002);
			float n_lo = vnoise(p * 16.0 + float(i) * 3.1);
			float n_mid = vnoise(p * mix(45.0, 75.0, cloth) + float(i) * 7.0);
			// cloth wicks blood outwards: wider, with a fibrous irregular edge; skin keeps a rounder pool
			float rr = r * mix(1.0, 1.5, cloth) * (0.8 + 0.4 * n_lo);
			float d = length(q) / rr;
			d += (n_mid - 0.5) * mix(0.3, 0.55, cloth) + (fabric - 0.5) * 0.16 * cloth;
			float m = 1.0 - smoothstep(0.3, 0.95, d);
			float L = i < 4 ? runs_a[i] : runs_b[i - 4];
			if (L > 0.003) {
				float t = dot(q, down_t);
				vec3 lat = q - down_t * t;
				float k = clamp(t / L, 0.0, 1.0);
				// streak narrows with distance; slow lobes make drip-like swellings, edge wobbles with low-freq noise
				float wd = r * 0.5 * mix(1.0, 0.32, k) * (1.0 + 0.3 * sin(t * 60.0 + n_lo * 5.0)) * mix(1.0, 1.35, cloth);
				float wob = (n_mid - 0.5) * wd * 0.5;
				float along = smoothstep(-0.004, 0.003, t) * (1.0 - smoothstep(L - 0.008, L, t));
				float streak = (1.0 - smoothstep(wd * 0.55, wd, length(lat) + wob)) * along;
				float bulb = 1.0 - smoothstep(wd * 0.9, wd * 1.6, length(q - down_t * L));
				m = max(m, max(streak, bulb * step(0.02, k)));
			}
			soak = max(soak, m);
		}
		for (int j = 0; j < 8; j++) {
			if (j >= n_wounds) {
				break;
			}
			vec4 wv = wounds[j];
			vec3 wq = p - wv.xyz;
			float dd = length(wq - nl * dot(wq, nl));
			float rj = max(wv.w, 0.001);
			float rag = vnoise(p * 150.0 + float(j) * 5.0);
			float re = rj * (0.75 + 0.55 * rag);
			float inner = smoothstep(re * 0.8, re, dd);
			core = max(core, 1.0 - inner);
			rim = max(rim, inner * (1.0 - smoothstep(re * 1.05, re * 1.8, dd)));
			soak = max(soak, 0.8 * (1.0 - smoothstep(re, re * 3.2, dd)));
		}
	}

	vec3 fresh = vec3(0.50, 0.012, 0.010);
	vec3 dried = vec3(0.26, 0.055, 0.035);
	vec3 bcol = mix(dried, fresh, wetness);
	// thick in the middle of a stain/streak (darker), thin at the edge; cloth soaks in darker and keeps some of its colour
	float thick = soak * soak;
	vec3 skin_blood = bcol * mix(1.0, 0.6, thick);
	vec3 cloth_blood = mix(base * 0.45, bcol * mix(0.9, 0.55, thick), 0.82);
	vec3 col = mix(base, mix(skin_blood, cloth_blood, cloth), soak * 0.94);
	col = mix(col, vec3(0.025, 0.0, 0.0), core);
	col = mix(col, mix(vec3(0.16, 0.025, 0.015), vec3(0.55, 0.025, 0.018), wetness), rim * 0.9);
	float wet_gloss = mix(0.9, mix(0.07, 0.4, cloth), wetness);
	float blood = max(soak, max(core, rim));
	ALBEDO = col;
	ROUGHNESS = mix(rough, wet_gloss, blood);
	SPECULAR = mix(0.5, 0.85, blood * wetness);
}
