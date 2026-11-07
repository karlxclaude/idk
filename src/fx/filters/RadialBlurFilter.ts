/** Zoom/radial blur toward the screen centre. `strength` 0..~0.3 (fraction of distance sampled). */
import { Filter, GlProgram } from 'pixi.js';
import { FILTER_VERTEX } from './shared';

const FRAG = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform highp vec4 uInputSize;
uniform float uStrength;

const int SAMPLES = 10;

void main() {
  vec2 center = (uInputClamp.xy + uInputClamp.zw) * 0.5;
  vec2 dir = center - vTextureCoord;
  float d = length(dir * uInputSize.xy / min(uInputSize.x, uInputSize.y)) * 2.0;
  // Crisp centre, smoothly increasing smear toward the edges.
  float fall = smoothstep(0.08, 1.0, d);
  // Tiny per-pixel jitter hides banding with few samples.
  float j = fract(sin(dot(vTextureCoord * uInputSize.xy, vec2(12.9898, 78.233))) * 43758.5453);
  vec4 acc = vec4(0.0);
  vec3 glow = vec3(0.0);
  float total = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float t = (float(i) + j) / float(SAMPLES);
    float w = 1.0 - t * 0.5;
    vec2 uv = clamp(vTextureCoord + dir * uStrength * fall * t, uInputClamp.xy, uInputClamp.zw);
    vec4 s = texture(uTexture, uv);
    acc += s * w;
    glow += max(s.rgb - 0.45, 0.0) * w;
    total += w;
  }
  vec4 col = acc / total;
  // Bloom-ish: bright streaks bleed additively. Saturation/contrast lift keeps the blur from
  // averaging the scene down to a flat grey.
  float k = clamp(uStrength * 3.5, 0.0, 1.0);
  col.rgb += glow / total * (0.9 * k);
  float l = dot(col.rgb, vec3(0.299, 0.587, 0.114));
  col.rgb = mix(vec3(l), col.rgb, 1.0 + 0.45 * k);
  col.rgb = (col.rgb - 0.5) * (1.0 + 0.12 * k) + 0.5;
  col.rgb = max(col.rgb, 0.0);
  finalColor = col;
}
`;

export class RadialBlurFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: FRAG, name: 'eh-radial-blur' }),
      resources: { rbUniforms: { uStrength: { value: 0, type: 'f32' } } },
    });
  }
  get strength(): number {
    return this.resources.rbUniforms.uniforms.uStrength;
  }
  set strength(v: number) {
    this.resources.rbUniforms.uniforms.uStrength = v;
  }
}
