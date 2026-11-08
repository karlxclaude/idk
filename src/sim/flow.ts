/** Cheap smooth "water current" field: a sum of drifting sines. Deterministic, allocation free. */
const out = { x: 0, y: 0 };
export function flowAt(x: number, y: number, t: number, scale = 1) {
  const s = 0.0025 / scale;
  const a = x * s, b = y * s;
  out.x = Math.sin(b * 1.3 + t * 0.21) * 0.6 + Math.sin(a * 0.7 + b * 0.4 - t * 0.13) * 0.4 + Math.cos(b * 2.9 - t * 0.37) * 0.15;
  out.y = Math.cos(a * 1.1 - t * 0.17) * 0.6 + Math.sin(a * 0.5 - b * 0.8 + t * 0.11) * 0.4 + Math.sin(a * 3.1 + t * 0.29) * 0.15;
  return out;
}
