/** Radial RGB-split filter. `amount` = max channel offset in pixels at the screen edge. */
import { Filter, GlProgram } from 'pixi.js';
import { FILTER_VERTEX } from './shared';

const FRAG = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec4 uInputClamp;
uniform highp vec4 uInputSize;
uniform float uAmount;

void main() {
  vec2 center = (uInputClamp.xy + uInputClamp.zw) * 0.5;
  vec2 dir = vTextureCoord - center;
  // Normalised radial distance: 0 at centre, ~1 at the edge midpoints. Smooth quadratic falloff.
  float d = length(dir * uInputSize.xy / min(uInputSize.x, uInputSize.y)) * 2.0;
  float fall = smoothstep(0.05, 1.1, d);
  fall *= fall;
  vec2 off = normalize(dir + 1e-6) * uAmount * fall * uInputSize.zw;
  vec4 c = texture(uTexture, vTextureCoord);
  // Three taps per outer channel smear the split into a soft fringe instead of a hard ghost.
  float r = 0.0, b = 0.0;
  for (int i = 0; i < 3; i++) {
    float k = (float(i) + 1.0) / 3.0;
    r += texture(uTexture, clamp(vTextureCoord + off * k, uInputClamp.xy, uInputClamp.zw)).r;
    b += texture(uTexture, clamp(vTextureCoord - off * k, uInputClamp.xy, uInputClamp.zw)).b;
  }
  finalColor = vec4(r / 3.0, c.g, b / 3.0, c.a);
}
`;

export class ChromaticAberrationFilter extends Filter {
  constructor() {
    super({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: FRAG, name: 'eh-chromatic' }),
      resources: { caUniforms: { uAmount: { value: 0, type: 'f32' } } },
    });
  }
  get amount(): number {
    return this.resources.caUniforms.uniforms.uAmount;
  }
  set amount(v: number) {
    this.resources.caUniforms.uniforms.uAmount = v;
  }
}
