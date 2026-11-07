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
  vec2 off = dir * uAmount * uInputSize.zw * 2.0;
  vec4 c = texture(uTexture, vTextureCoord);
  float r = texture(uTexture, clamp(vTextureCoord + off, uInputClamp.xy, uInputClamp.zw)).r;
  float b = texture(uTexture, clamp(vTextureCoord - off, uInputClamp.xy, uInputClamp.zw)).b;
  finalColor = vec4(r, c.g, b, c.a);
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
