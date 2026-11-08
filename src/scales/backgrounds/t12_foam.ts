/**
 * Tier 12 background layer types:
 *  - 't12_film': animated thin-film shader, drifting pastel rainbow swirls like light on soap.
 *  - 't12_foam': parallax foam of iridescent soap bubbles that slowly inflate and bob.
 *    density = bubble count, scale = size multiplier, params.min/max = size range (fraction of screen).
 */
import { Container, Filter, GlProgram, Sprite, Texture } from 'pixi.js';
import { FILTER_VERTEX } from '../../fx/filters/shared';
import { Rng } from '../../core/math';
import { soapTex } from '../../entities/renderers/t12_soap';
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
  float t = uTime * 0.06;
  vec2 q = vec2(fbm(p + vec2(t, 0.0)), fbm(p + vec2(5.2, 1.3) - vec2(0.0, t)));
  float n = fbm(p + 2.2 * q + vec2(t * 0.6, -t * 0.4));
  // thin-film interference: film thickness -> cosine rainbow
  float thick = n * 2.6 + q.x * 1.2 + t * 0.8;
  vec3 col = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + thick));
  float a = uAlpha * smoothstep(0.25, 0.85, n);
  finalColor = vec4(col * a, a);
}
`;
const film: BackgroundLayerType = {
  id: 't12_film',
  create(def, tier, ctx) {
    const view = new Container();
    const sprite = new Sprite(Texture.WHITE);
    const filter = new Filter({
      glProgram: GlProgram.from({ vertex: FILTER_VERTEX, fragment: FRAG, name: 'eh-t12-film' }),
      resources: {
        film: {
          uTime: { value: Math.random() * 100, type: 'f32' },
          uOffset: { value: new Float32Array([Math.random() * 40, Math.random() * 40]), type: 'vec2<f32>' },
          uScale: { value: 3, type: 'f32' },
          uAspect: { value: new Float32Array([1, 1]), type: 'vec2<f32>' },
          uAlpha: { value: def.alpha ?? 0.4, type: 'f32' },
        },
      },
      resolution: ctx.state.settings.quality === 'high' ? 0.5 : 0.33,
      padding: 0,
    });
    if (def.blend === 'add' || def.blend === 'screen') sprite.blendMode = def.blend;
    sprite.filters = [filter];
    view.addChild(sprite);
    const u = filter.resources.film.uniforms;
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
        const scale = (def.scale ?? 1) * 2 * Math.pow(cam.zoomRatio, -def.depth * 0.35);
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

const foam: BackgroundLayerType = {
  id: 't12_foam',
  create(def) {
    const view = new Container();
    const n = Math.max(3, Math.round(def.density ?? 12));
    const rng = new Rng(Math.floor(def.depth * 1000) + n * 17);
    const lo = (def.params?.min as number) ?? 0.08, hi = (def.params?.max as number) ?? 0.26;
    // jittered grid so the foam covers the screen evenly
    const cols = Math.ceil(Math.sqrt(n * 1.4));
    const rows = Math.ceil(n / cols);
    const items = Array.from({ length: n }, (_, i) => {
      const s = new Sprite(soapTex(i % 5));
      s.anchor.set(0.5);
      if (def.blend === 'add') s.blendMode = 'add';
      view.addChild(s);
      return {
        s,
        bx: ((i % cols) + rng.range(0.1, 0.9)) / cols,
        by: (Math.floor(i / cols) + rng.range(0.1, 0.9)) / rows,
        size: rng.range(lo, hi),
        rot: rng.angle(),
        sp: rng.range(-0.15, 0.15),
        ph: rng.range(0, 10),
      };
    });
    let W = 800, H = 600;
    return {
      view,
      resize(w, h) { W = w; H = h; },
      update(cam) {
        const pw = W * 1.3, ph = H * 1.3;
        const ox = -cam.x * cam.zoom * def.depth, oy = -cam.y * cam.zoom * def.depth;
        for (const it of items) {
          let x = (it.bx * pw + ox + Math.sin(cam.time * 0.2 + it.ph) * 14) % pw; if (x < 0) x += pw;
          let y = (it.by * ph + oy + Math.cos(cam.time * 0.17 + it.ph) * 14) % ph; if (y < 0) y += ph;
          it.s.position.set(x - W * 0.15, y - H * 0.15);
          it.s.width = it.s.height = Math.max(W, H) * it.size * (def.scale ?? 1) * (1 + 0.05 * Math.sin(cam.time * 0.35 + it.ph));
          it.s.rotation = it.rot + cam.time * it.sp;
          it.s.alpha = (def.alpha ?? 0.3) * (0.8 + 0.2 * Math.sin(cam.time * 0.8 + it.ph * 2));
        }
      },
      destroy() { view.destroy({ children: true }); },
    };
  },
};
export default [film, foam];
