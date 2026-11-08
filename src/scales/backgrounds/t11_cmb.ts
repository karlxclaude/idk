/**
 * Tier 11 background layer types:
 *  - 't11_cmb': Planck-style cosmic microwave background mottling (blue / cream / orange fbm
 *    shader, custom Pixi v8 filter on a reduced-resolution full-screen sprite).
 *  - 't11_horizon': a faint, huge, slowly turning particle-horizon ring with a red-shifted edge.
 */
import { Container, Filter, GlProgram, Sprite, Texture } from 'pixi.js';
import { FILTER_VERTEX } from '../../fx/filters/shared';
import { bakeTexture } from '../../core/textures';
import type { BackgroundLayerType } from '../backgroundRegistry';

const FRAG = /* glsl */ `
in vec2 vTextureCoord;
in vec2 vUv;
out vec4 finalColor;

uniform float uTime;
uniform vec2 uOffset;
uniform float uScale;
uniform vec2 uAspect;
uniform float uAlpha;
uniform float uWarm;

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
  for (int i = 0; i < 6; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec2(3.1, 7.7);
    a *= 0.52;
  }
  return v;
}
vec3 ramp(float t) {
  vec3 c0 = vec3(0.05, 0.08, 0.40);
  vec3 c1 = vec3(0.17, 0.42, 0.84);
  vec3 c2 = vec3(0.92, 0.87, 0.74);
  vec3 c3 = vec3(1.00, 0.58, 0.22);
  vec3 c4 = vec3(0.70, 0.15, 0.10);
  if (t < 0.28) return mix(c0, c1, t / 0.28);
  if (t < 0.52) return mix(c1, c2, (t - 0.28) / 0.24);
  if (t < 0.76) return mix(c2, c3, (t - 0.52) / 0.24);
  return mix(c3, c4, (t - 0.76) / 0.24);
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect * uScale + uOffset;
  float t = uTime * 0.012;
  float n = fbm(p + vec2(t, -t * 0.6));
  n += (noise(p * 9.0 + t) - 0.5) * 0.14;
  float v = clamp((n - 0.5) * 2.1 + 0.5 + uWarm, 0.0, 1.0);
  vec3 col = ramp(v);
  // keep it deep: only the hottest / coldest spots really glow
  float a = uAlpha * (0.35 + 0.65 * smoothstep(0.1, 0.9, abs(v - 0.45) * 2.0));
  finalColor = vec4(col * a, a);
}
`;
const cmb: BackgroundLayerType = {
  id: 't11_cmb',
  create(def, tier, ctx) {
    const view = new Container();
    const sprite = new Sprite(Texture.WHITE);
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: FRAG, name: 'eh-t11-cmb' }),
      resources: {
        cmb: {
          uTime: { value: Math.random() * 100, type: 'f32' },
          uOffset: { value: new Float32Array([Math.random() * 40, Math.random() * 40]), type: 'vec2<f32>' },
          uScale: { value: 3, type: 'f32' },
          uAspect: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uAlpha: { value: def.alpha ?? 0.5, type: 'f32' },
          uWarm: { value: (def.params?.warm as number) ?? 0, type: 'f32' },
        },
      },
      resolution: ctx.state.settings.quality === 'high' ? 0.5 : 0.33,
      padding: 0,
    });
    if (def.blend === 'add' || def.blend === 'screen') sprite.blendMode = def.blend;
    sprite.filters = [filter];
    view.addChild(sprite);
    const u = filter.resources.cmb.uniforms;
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
        const scale = (def.scale ?? 1) * 2.4 * Math.pow(cam.zoomRatio, -def.depth * 0.35);
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

const ringTex = () =>
  bakeTexture('bg:t11:horizon', 512, (c, s) => {
    const m = s / 2;
    for (const [r0, r1, a] of [[0.9, 1, 0.5], [0.97, 1, 0.9], [0.8, 0.98, 0.12]] as const) {
      const g = c.createRadialGradient(m, m, m * r0, m, m, m * r1);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.9, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
    }
  });

const horizon: BackgroundLayerType = {
  id: 't11_horizon',
  create(def, tier) {
    const view = new Container();
    const s = new Sprite(ringTex());
    s.anchor.set(0.5);
    s.tint = def.color ?? 0xff6a3a;
    s.blendMode = 'add';
    view.addChild(s);
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        // a huge ring centred on a far-off point of the sky; parallax moves it slowly
        const size = Math.max(W, H) * (def.scale ?? 2.4);
        s.width = s.height = size;
        s.position.set(W * 0.5 + (0.28 * W - cam.x * cam.zoom * def.depth), H * 0.5 + (0.22 * H - cam.y * cam.zoom * def.depth));
        s.rotation = cam.time * 0.01;
        s.alpha = (def.alpha ?? 0.25) * (0.85 + 0.15 * Math.sin(cam.time * 0.5));
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default [cmb, horizon];
