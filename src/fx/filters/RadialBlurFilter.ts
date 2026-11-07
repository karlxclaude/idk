/** Zoom/radial blur toward the screen centre. `strength` 0..~0.3 (fraction of distance sampled). */
import { Filter, GlProgram } from 'pixi.js';
import { FILTER_VERTEX } from './shared';

const FRAG = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform float uStrength;

const int SAMPLES = 12;

void main() {
  vec2 center = (uInputClamp.xy + uInputClamp.zw) * 0.5;
  vec2 dir = center - vTextureCoord;
  vec4 acc = vec4(0.0);
  float total = 0.0;
  for (int i = 0; i < SAMPLES; i++) {
    float t = float(i) / float(SAMPLES - 1);
    float w = 1.0 - t * 0.6;
    vec2 uv = clamp(vTextureCoord + dir * uStrength * t, uInputClamp.xy, uInputClamp.zw);
    acc += texture(uTexture, uv) * w;
    total += w;
  }
  finalColor = acc / total;
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
