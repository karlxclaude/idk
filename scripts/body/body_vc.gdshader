// Baked body meshes: vertex colour rgb = region weights (skin, shirt, pants; all zero = shoes).
// One shader, per-NPC material instance carries the colours (skin tone / clothes variation).
shader_type spatial;

uniform vec3 skin_color : source_color = vec3(0.85, 0.66, 0.55);
uniform vec3 shirt_color : source_color = vec3(0.25, 0.3, 0.5);
uniform vec3 pants_color : source_color = vec3(0.2, 0.2, 0.28);
uniform vec3 shoe_color : source_color = vec3(0.1, 0.08, 0.07);

void fragment() {
	vec3 w = COLOR.rgb;
	float ws = max(0.0, 1.0 - w.r - w.g - w.b);
	ALBEDO = skin_color * w.r + shirt_color * w.g + pants_color * w.b + shoe_color * ws;
	ROUGHNESS = mix(0.5, 0.88, clamp(w.g + w.b + ws, 0.0, 1.0));
}
