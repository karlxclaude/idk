/**
 * Shared soap-film bubble texture for tier 12 (helper module: no default export, so it is not
 * registered). A transparent bubble with thin-film rainbow fringes toward the rim, a crisp skin
 * and specular glints. White-ish by design: the rainbow is baked, do not tint it.
 */
import { bakeTexture } from '../../core/textures';

const TAU = Math.PI * 2;

function rainbow(c: CanvasRenderingContext2D, m: number, phase: number, hue0: number, sat: number, light: number): CanvasGradient {
  const g: CanvasGradient = (c as any).createConicGradient
    ? (c as any).createConicGradient(phase, m, m)
    : c.createLinearGradient(0, 0, m * 2, m * 2);
  const N = 12;
  for (let i = 0; i <= N; i++) g.addColorStop(i / N, `hsl(${(hue0 + (i % N) * (360 / N)) % 360},${sat}%,${light}%)`);
  return g;
}

export function soapTex(variant: number) {
  return bakeTexture(`t12:soap:${variant}`, 256, (c, s) => {
    const m = s / 2;
    const R = m - 3;
    const hue0 = (variant * 67) % 360;
    // faint body, denser at the rim
    let g = c.createRadialGradient(m, m, 0, m, m, R);
    g.addColorStop(0, 'rgba(255,255,255,0.02)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.05)');
    g.addColorStop(0.92, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0.3)');
    c.fillStyle = g;
    c.beginPath(); c.arc(m, m, R, 0, TAU); c.fill();
    // thin-film fringes: conic rainbows masked into radial bands
    const layer = (phase: number, hue: number, bands: [number, number][], alpha: number) => {
      const t = document.createElement('canvas');
      t.width = t.height = s;
      const tc = t.getContext('2d')!;
      tc.fillStyle = rainbow(tc, m, phase, hue, 100, 68);
      tc.fillRect(0, 0, s, s);
      tc.globalCompositeOperation = 'destination-in';
      const mg = tc.createRadialGradient(m, m, 0, m, m, R);
      mg.addColorStop(0, 'rgba(0,0,0,0)');
      for (const [o, a] of bands) mg.addColorStop(o, `rgba(0,0,0,${a})`);
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      tc.fillStyle = mg;
      tc.fillRect(0, 0, s, s);
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = alpha;
      c.drawImage(t, 0, 0);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    };
    layer(0.4, hue0, [[0.55, 0], [0.82, 0.25], [0.93, 0.85], [0.985, 0.7]], 0.85);
    layer(2.6, hue0 + 140, [[0.4, 0], [0.62, 0.22], [0.76, 0.08], [0.8, 0]], 0.5);
    // crisp skin
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(m, m, R - 1, 0, TAU); c.stroke();
    // specular glints
    c.save();
    c.translate(m, m);
    c.rotate(-0.75);
    const hg = c.createRadialGradient(0, -R * 0.62, 0, 0, -R * 0.62, R * 0.3);
    hg.addColorStop(0, 'rgba(255,255,255,0.85)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg;
    c.beginPath(); c.ellipse(0, -R * 0.62, R * 0.3, R * 0.11, 0, 0, TAU); c.fill();
    c.restore();
    c.strokeStyle = 'rgba(255,255,255,0.4)';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath(); c.arc(m, m, R * 0.82, 0.55, 1.0); c.stroke();
    g = c.createRadialGradient(m + R * 0.5, m + R * 0.5, 0, m + R * 0.5, m + R * 0.5, R * 0.1);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(m, m, R, R);
  });
}
