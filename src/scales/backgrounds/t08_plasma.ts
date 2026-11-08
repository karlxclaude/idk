/**
 * Tier 8 background layer types:
 *  - 't08_plasma': animated ridged-noise plasma filaments (custom Pixi v8 Filter on a reduced-resolution
 *    full-screen sprite). colors: [deep, mid, hot]. scale = feature size, speed = flow.
 *  - 't08_starGlows': big soft out-of-focus stars drifting in parallax (additive bokeh).
 */
import { Container, Filter, GlProgram, Sprite, Texture } from 'pixi.js';
import { FILTER_VERTEX } from '../../fx/filters/shared';
import { Rng } from '../../core/math';
import { Tex } from '../../core/textures';
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
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.07 + vec2(3.1, 7.7);
    a *= 0.5;
  }
  return v;
}
float ridge(vec2 p) {
  float v = 0.0, a = 0.55;
  for (int i = 0; i < 4; i++) {
    float n = 1.0 - abs(noise(p) * 2.0 - 1.0);
    v += a * n * n;
    p = p * 2.1 + vec2(1.3, 4.1);
    a *= 0.5;
  }
  return v;
}
void main() {
  vec2 p = (vUv - 0.5) * uAspect * uScale + uOffset;
  float t = uTime * 0.06;
  vec2 q = vec2(fbm(p + vec2(t, 0.3 * t)), fbm(p + vec2(4.7, 2.1) - vec2(0.5 * t, t)));
  vec2 w = p + 2.4 * (q - 0.5) + vec2(sin(t * 3.0 + p.y), cos(t * 2.3 + p.x)) * 0.25;
  float r = ridge(w + vec2(t, -t * 0.7));
  float core = smoothstep(0.55, 1.1, r);
  float haze = fbm(w * 0.7 - t) ;
  vec3 col = mix(uColorA, uColorB, smoothstep(0.25, 0.75, haze + r * 0.4));
  col = mix(col, uColorC, core);
  float a = (0.25 * smoothstep(0.3, 0.9, haze) + 0.85 * core) * uAlpha;
  finalColor = vec4(col * a, a);
}
`;

const rgb = (c: number) => new Float32Array([((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]);

const plasma: BackgroundLayerType = {
  id: 't08_plasma',
  create(def, tier, ctx) {
    const view = new Container();
    const sprite = new Sprite(Texture.WHITE);
    const cols = def.colors ?? [tier.palette.bgTop, tier.palette.accent, tier.palette.glow];
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: FRAG, name: 'eh-t08-plasma' }),
      resources: {
        plasma: {
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
      resolution: ctx.state.settings.quality === 'high' ? 0.45 : 0.3,
      padding: 0,
    });
    if (def.blend === 'add' || def.blend === 'screen') sprite.blendMode = def.blend;
    sprite.filters = [filter];
    view.addChild(sprite);
    const u = filter.resources.plasma.uniforms;
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

const glows: BackgroundLayerType = {
  id: 't08_starGlows',
  create(def, tier) {
    const view = new Container();
    const n = Math.max(2, Math.round(def.density ?? 8));
    const rng = new Rng(Math.floor(def.depth * 1000) + n * 7);
    const colors = def.colors ?? [tier.palette.glow];
    const items = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(Tex.glow());
      s.anchor.set(0.5);
      s.blendMode = 'add';
      s.tint = colors[i % colors.length];
      view.addChild(s);
      return { s, bx: rng.next(), by: rng.next(), size: rng.range(0.06, 0.22), ph: rng.range(0, 10) };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.5, ph = H * 1.5;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const it of items) {
          let x = (it.bx * pw + ox) % pw; if (x < 0) x += pw;
          let y = (it.by * ph + oy) % ph; if (y < 0) y += ph;
          it.s.position.set(x - W * 0.25, y - H * 0.25);
          it.s.width = it.s.height = Math.max(W, H) * it.size * (def.scale ?? 1);
          it.s.alpha = (def.alpha ?? 0.3) * (0.7 + 0.3 * Math.sin(cam.time * 0.5 + it.ph));
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};

export default [plasma, glows];
