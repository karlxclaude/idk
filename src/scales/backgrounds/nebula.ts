/**
 * 'nebula': animated domain-warped fbm noise shader (custom Pixi v8 Filter on a full-screen
 * sprite, rendered at reduced resolution). colors: [a, b, c]. scale = feature size, speed = flow.
 */
import { Container, Filter, GlProgram, Sprite, Texture } from 'pixi.js';
import { FILTER_VERTEX } from '../../fx/filters/shared';
import type { BackgroundLayerType } from '../backgroundRegistry';

const FRAG = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
out vec4 finalColor;

uniform float uTime;
uniform vec2 uOffset;
uniform float uScale;
uniform vec2 uAspect;
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uColorC;
uniform float uAlpha;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect * uScale + uOffset;
  float t = uTime * 0.05;
  vec2 q = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t)));
  float n = fbm(p + 2.0 * q + vec2(t * 0.7, -t * 0.4));
  vec3 col = mix(uColorA, uColorB, smoothstep(0.2, 0.8, n));
  col = mix(col, uColorC, smoothstep(0.5, 0.95, length(q) * n * 1.3));
  float a = smoothstep(0.28, 0.9, n) * uAlpha;
  finalColor = vec4(col * a, a);
}
`;

const rgb = (c: number) => new Float32Array([((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]);

const layer: BackgroundLayerType = {
  id: 'nebula',
  create(def, tier, ctx) {
    const view = new Container();
    const sprite = new Sprite(Texture.WHITE);
    const cols = def.colors ?? [tier.palette.bgTop, tier.palette.accent, tier.palette.glow];
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: FRAG, name: 'eh-nebula' }),
      resources: {
        nebula: {
          uTime: { value: Math.random() * 100, type: 'f32' },
          uOffset: { value: new Float32Array([Math.random() * 50, Math.random() * 50]), type: 'vec2<f32>' },
          uScale: { value: 3, type: 'f32' },
          uAspect: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uColorA: { value: rgb(cols[0]), type: 'vec3<f32>' },
          uColorB: { value: rgb(cols[1] ?? cols[0]), type: 'vec3<f32>' },
          uColorC: { value: rgb(cols[2] ?? cols[1] ?? cols[0]), type: 'vec3<f32>' },
          uAlpha: { value: def.alpha ?? 0.6, type: 'f32' },
        },
      },
      resolution: ctx.state.settings.quality === 'high' ? 0.5 : 0.33,
      padding: 0,
    });
    if (def.blend === 'add' || def.blend === 'screen') sprite.blendMode = def.blend;
    sprite.filters = [filter];
    view.addChild(sprite);
    const u = filter.resources.nebula.uniforms;
    const seed = [u.uOffset[0], u.uOffset[1]];
    let H = 1;
    return {
      view,
      resize(w, h) {
        H = h;
        sprite.width = w;
        sprite.height = h;
        u.uAspect[0] = w / h;
        u.uAspect[1] = 1;
      },
      update(cam) {
        const scale = (def.scale ?? 1) * 2.2 * Math.pow(cam.zoomRatio, -def.depth * 0.35);
        u.uScale = scale;
        u.uTime = cam.time * (def.speed ?? 1) + seed[0];
        const k = (def.depth * cam.zoom * scale) / H;
        u.uOffset[0] = seed[0] + cam.x * k;
        u.uOffset[1] = seed[1] + cam.y * k;
      },
      destroy() {
        view.destroy({ children: true });
        filter.destroy();
      },
    };
  },
};
export default layer;
