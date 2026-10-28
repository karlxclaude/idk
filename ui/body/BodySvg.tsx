// SVG renderer for BodyShape: layered skin/fat outline + lean silhouette + muscle shapes (front and side views).
import type { CSSProperties } from 'react';
import type { MuscleId } from '../../data/muscles';
import { CENTER_X, VIEW_H, VIEW_W, type BodyShape, type Station, type TrunkStation } from './model';

export type BodyView = 'front' | 'side';

export interface BodySvgProps {
  shape: BodyShape;
  view: BodyView;
  /** Muscle id to tint. */
  highlight?: MuscleId | null;
  /** Per-region 0..1 tint (volume or growth). */
  heatmap?: Partial<Record<MuscleId, number>>;
  /** Rendered pixel height (width follows the aspect ratio). */
  height?: number;
  className?: string;
  style?: CSSProperties;
  /** Stable id suffix for clipPaths when several figures share a page. */
  idSuffix?: string;
}

interface Pt { x: number; y: number }
interface RPt extends Pt { r: number }

const f = (n: number): string => (Math.round(n * 10) / 10).toString();

/** Catmull-Rom spline through points as a cubic bezier path. */
function smooth(pts: Pt[], closed = true, k = 1 / 6): string {
  const n = pts.length;
  if (n < 2) return '';
  const g = (i: number): Pt => (closed ? (pts[((i % n) + n) % n] as Pt) : (pts[Math.min(n - 1, Math.max(0, i))] as Pt));
  let d = `M${f((pts[0] as Pt).x)} ${f((pts[0] as Pt).y)}`;
  const segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const p0 = g(i - 1);
    const p1 = g(i);
    const p2 = g(i + 1);
    const p3 = g(i + 2);
    d += `C${f(p1.x + (p2.x - p0.x) * k)} ${f(p1.y + (p2.y - p0.y) * k)} ${f(p2.x - (p3.x - p1.x) * k)} ${f(p2.y - (p3.y - p1.y) * k)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return closed ? d + 'Z' : d;
}

function ell(cx: number, cy: number, rx: number, ry: number, rotDeg = 0): string {
  const a = (rotDeg * Math.PI) / 180;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const p = (x: number, y: number): string => `${f(cx + x * ca - y * sa)} ${f(cy + x * sa + y * ca)}`;
  return `M${p(-rx, 0)}A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 1 ${p(rx, 0)}A${f(rx)} ${f(ry)} ${f(rotDeg)} 1 1 ${p(-rx, 0)}Z`;
}

/** Lens/spindle between two points; maximum width `w` (half-width) at fraction `pos`; `off` shifts it sideways. */
function spindle(a: Pt, b: Pt, w: number, pos = 0.5, off = 0): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const prof: Array<[number, number]> = [[0, 0.0], [pos * 0.5, 0.72], [pos, 1], [pos + (1 - pos) * 0.5, 0.74], [1, 0.0]];
  const at = (t: number, k: number, side: number): Pt => ({
    x: a.x + dx * t + nx * (off + side * w * k),
    y: a.y + dy * t + ny * (off + side * w * k),
  });
  const left = prof.map(([t, k]) => at(t, k, 1));
  const right = prof.slice(1, -1).reverse().map(([t, k]) => at(t, k, -1));
  return smooth([...left, ...right], true, 1 / 5);
}

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpP = (a: Pt, b: Pt, t: number): Pt => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

function soften(rs: number[], s: number): number[] {
  let cur = rs;
  for (let pass = 0; pass < 2; pass++) {
    cur = cur.map((r, i) => {
      if (i === 0 || i === cur.length - 1) return r;
      return lerp(r, ((cur[i - 1] as number) + (cur[i + 1] as number)) / 2, s);
    });
  }
  return cur;
}

/** Closed tube outline around an axis polyline with per-point radius. */
function tube(pts: RPt[], capEnd = 0.85, capStart = 0.4): string {
  const n = pts.length;
  const left: Pt[] = [];
  const right: Pt[] = [];
  let lastDir: Pt = { x: 0, y: 1 };
  let firstDir: Pt = { x: 0, y: 1 };
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)] as RPt;
    const b = pts[Math.min(n - 1, i + 1)] as RPt;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    const dir = { x: dx / l, y: dy / l };
    if (i === 0) firstDir = dir;
    if (i === n - 1) lastDir = dir;
    const p = pts[i] as RPt;
    left.push({ x: p.x - dir.y * p.r, y: p.y + dir.x * p.r });
    right.push({ x: p.x + dir.y * p.r, y: p.y - dir.x * p.r });
  }
  const last = pts[n - 1] as RPt;
  const first = pts[0] as RPt;
  const end: Pt = { x: last.x + lastDir.x * last.r * capEnd, y: last.y + lastDir.y * last.r * capEnd };
  const start: Pt = { x: first.x - firstDir.x * first.r * capStart, y: first.y - firstDir.y * first.r * capStart };
  return smooth([...left, end, ...right.reverse(), start], true);
}

type Radius = 'lean' | 'skin';

interface Ctx {
  S: BodyShape;
  view: BodyView;
  cm: (x: number) => number;
}

// ---------- geometry of limbs ----------

interface Limb {
  pts: RPt[];
  /** Axis points & radii for muscle placement along the thigh/upper arm (first segment) and shank/forearm. */
  seg1: { a: Pt; b: Pt; st: Station[] };
  seg2: { a: Pt; b: Pt; st: Station[] };
}

function axisPts(a: Pt, b: Pt, st: Station[], kind: Radius, soft: number): RPt[] {
  const rs = soften(st.map((q) => q[kind]), soft);
  return st.map((q, i) => ({ ...lerpP(a, b, q.t), r: rs[i] as number }));
}

function legGeom(c: Ctx, sgn: number, kind: Radius, far = false): Limb {
  const { S, view } = c;
  const soft = S.softness * 0.5;
  let hip: Pt;
  let knee: Pt;
  let ankle: Pt;
  const fatSpread = (S.trunk[5] as TrunkStation).skinHalf - (S.trunk[5] as TrunkStation).leanHalf;
  if (view === 'front') {
    const o = S.legOffset + fatSpread * 0.15;
    hip = { x: CENTER_X + sgn * o, y: S.y.hip - S.seg.thigh * 0.04 };
    knee = { x: CENTER_X + sgn * o * 0.92, y: S.y.knee };
    ankle = { x: CENTER_X + sgn * o * 0.84, y: S.y.ankle };
  } else {
    const sh = far ? -c.cm(4.5) : 0;
    hip = { x: CENTER_X + sh * 0.3, y: S.y.hip - S.seg.thigh * 0.04 };
    knee = { x: CENTER_X + c.cm(1.0) + sh * 0.6, y: S.y.knee };
    ankle = { x: CENTER_X - c.cm(0.5) + sh, y: S.y.ankle };
  }
  const p1 = axisPts(hip, knee, S.thigh, kind, soft);
  const p2 = axisPts(knee, ankle, S.shank, kind, soft).slice(1);
  return { pts: [...p1, ...p2], seg1: { a: hip, b: knee, st: S.thigh }, seg2: { a: knee, b: ankle, st: S.shank } };
}

function armGeom(c: Ctx, sgn: number, kind: Radius): Limb {
  const { S, view } = c;
  const soft = S.softness * 0.5;
  const sh = S.trunk[3] as TrunkStation;
  const spread = (sh.skinHalf - sh.leanHalf) * 0.9 + ((S.trunk[4] as TrunkStation).skinHalf - (S.trunk[4] as TrunkStation).leanHalf) * 0.5;
  let s0: Pt;
  let el: Pt;
  let wr: Pt;
  if (view === 'front') {
    s0 = { x: CENTER_X + sgn * S.armOffset, y: S.y.shoulder + c.cm(1.5) };
    el = { x: CENTER_X + sgn * (S.armOffset + c.cm(2.2) + spread), y: S.y.elbow };
    wr = { x: CENTER_X + sgn * (S.armOffset + c.cm(4.4) + spread * 1.2), y: S.y.wrist };
  } else {
    s0 = { x: CENTER_X - c.cm(0.3), y: S.y.shoulder + c.cm(1.5) };
    el = { x: CENTER_X + c.cm(0.8), y: S.y.elbow };
    wr = { x: CENTER_X + c.cm(2.8), y: S.y.wrist };
  }
  const up = axisPts(s0, el, S.upperArm, kind, soft);
  const fo = axisPts(el, wr, S.forearm, kind, soft).slice(1);
  const dx = wr.x - el.x;
  const dy = wr.y - el.y;
  const l = Math.hypot(dx, dy) || 1;
  const hl = c.cm(17);
  const hand = (t: number, r: number): RPt => ({ x: wr.x + (dx / l) * hl * t, y: wr.y + (dy / l) * hl * t, r: c.cm(r) });
  const hp = [hand(0.18, 2.9), hand(0.5, 3.3), hand(0.82, 2.7), hand(1, 1.2)];
  return { pts: [...up, ...fo, ...hp], seg1: { a: s0, b: el, st: S.upperArm }, seg2: { a: el, b: wr, st: S.forearm } };
}

function trunkPath(c: Ctx, kind: Radius): string {
  const T = c.S.trunk;
  const key = kind === 'lean' ? 'lean' : 'skin';
  const soft = c.S.softness * 0.5;
  if (c.view === 'front') {
    const hs = soften(T.map((t) => (key === 'lean' ? t.leanHalf : t.skinHalf)), soft);
    const left = T.map((t, i) => ({ x: CENTER_X - (hs[i] as number), y: t.y }));
    const right = T.map((t, i) => ({ x: CENTER_X + (hs[i] as number), y: t.y })).reverse();
    return smooth([...left, ...right], true);
  }
  const ant = soften(T.map((t) => (key === 'lean' ? t.leanAnt : t.skinAnt)), soft);
  const post = soften(T.map((t) => (key === 'lean' ? t.leanPost : t.skinPost)), soft);
  const front = T.map((t, i) => ({ x: CENTER_X + (ant[i] as number), y: t.y }));
  const back = T.map((t, i) => ({ x: CENTER_X - (post[i] as number), y: t.y })).reverse();
  return smooth([...front, ...back], true);
}

function headPath(c: Ctx): string {
  const { S, view } = c;
  const { rx, ry } = S.head;
  const top = S.y.top;
  const cx = view === 'front' ? CENTER_X : CENTER_X + c.cm(1.4);
  const fatJaw = 1 + S.softness * 0.18;
  if (view === 'front') {
    const pts: Pt[] = [
      { x: cx, y: top },
      { x: cx + rx * 0.82, y: top + ry * 0.35 },
      { x: cx + rx, y: top + ry * 0.85 },
      { x: cx + rx * 0.74 * fatJaw, y: top + ry * 1.5 },
      { x: cx + rx * 0.3 * fatJaw, y: top + ry * 1.93 },
      { x: cx, y: top + ry * 2 },
      { x: cx - rx * 0.3 * fatJaw, y: top + ry * 1.93 },
      { x: cx - rx * 0.74 * fatJaw, y: top + ry * 1.5 },
      { x: cx - rx, y: top + ry * 0.85 },
      { x: cx - rx * 0.82, y: top + ry * 0.35 },
    ];
    return smooth(pts, true);
  }
  const pts: Pt[] = [
    { x: cx - rx * 0.1, y: top },
    { x: cx + rx * 0.75, y: top + ry * 0.3 },
    { x: cx + rx * 1.0, y: top + ry * 0.85 },
    { x: cx + rx * 1.12, y: top + ry * 1.12 }, // nose
    { x: cx + rx * 0.92, y: top + ry * 1.28 },
    { x: cx + rx * 0.95, y: top + ry * 1.55 },
    { x: cx + rx * 0.4 * fatJaw, y: top + ry * 1.95 },
    { x: cx - rx * 0.35, y: top + ry * 1.9 },
    { x: cx - rx * 1.05, y: top + ry * 1.2 },
    { x: cx - rx * 1.1, y: top + ry * 0.6 },
    { x: cx - rx * 0.7, y: top + ry * 0.12 },
  ];
  return smooth(pts, true);
}

function neckPath(c: Ctx, kind: Radius): string {
  const { S, view } = c;
  const r = kind === 'lean' ? S.neckR.lean : S.neckR.skin;
  const cx = view === 'front' ? CENTER_X : CENTER_X + c.cm(0.6);
  const y0 = S.y.chin - c.cm(4);
  const y1 = S.y.neckBase + c.cm(3);
  const flare = view === 'front' ? 1.12 : 1.05;
  const tilt = view === 'side' ? c.cm(0.9) : 0;
  return smooth([
    { x: cx - r + tilt, y: y0 }, { x: cx - r * 0.97, y: lerp(y0, y1, 0.5) }, { x: cx - r * flare, y: y1 },
    { x: cx + r * flare, y: y1 }, { x: cx + r * 0.97, y: lerp(y0, y1, 0.5) }, { x: cx + r + tilt, y: y0 },
  ], true, 1 / 8);
}

function footPath(c: Ctx, sgn: number, far = false): string {
  const { S, view } = c;
  const fl = S.seg.foot;
  if (view === 'front') {
    const leg = legGeom(c, sgn, 'skin');
    const a = leg.seg2.b;
    return ell(a.x + sgn * c.cm(1.2), S.y.floor - fl * 0.5, c.cm(4.4), fl * 0.62, sgn * 12);
  }
  const shift = far ? -c.cm(4.5) : 0;
  const ax = CENTER_X - c.cm(0.5) + shift;
  const r = c.cm(3.6);
  const pts: Pt[] = [
    { x: ax - r, y: S.y.ankle - fl * 0.3 },
    { x: ax - r * 1.15, y: S.y.floor - fl * 0.55 },
    { x: ax - r * 0.85, y: S.y.floor - 1 },
    { x: ax + c.cm(8), y: S.y.floor },
    { x: ax + c.cm(17), y: S.y.floor - 1.5 },
    { x: ax + c.cm(18.5), y: S.y.floor - fl * 0.45 },
    { x: ax + c.cm(11), y: S.y.floor - fl * 0.85 },
    { x: ax + r * 1.0, y: S.y.ankle - fl * 0.2 },
  ];
  return smooth(pts, true);
}

// ---------- muscle shape lists ----------

interface MShape { ids: MuscleId[]; d: string; kind?: 'line' }

function along(l: Limb, seg: 1 | 2, t: number): { p: Pt; r: number } {
  const g = seg === 1 ? l.seg1 : l.seg2;
  const i = Math.min(g.st.length - 1, Math.max(0, Math.round(t * (g.st.length - 1))));
  return { p: lerpP(g.a, g.b, t), r: (g.st[i] as Station).lean };
}

/** Perpendicular unit offset for a segment (pointing +x-ish). */
function normalOf(a: Pt, b: Pt): Pt {
  const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  return { x: (b.y - a.y) / -l, y: (b.x - a.x) / l };
}

function seg(l: Limb, which: 1 | 2, t0: number, t1: number, wFrac: number, pos: number, offFrac: number, nrm: number): string {
  const g = which === 1 ? l.seg1 : l.seg2;
  const n = normalOf(g.a, g.b);
  const A = along(l, which, t0);
  const B = along(l, which, t1);
  const mid = along(l, which, (t0 + t1) / 2);
  const o = mid.r * offFrac * nrm;
  const a = { x: A.p.x + n.x * o, y: A.p.y + n.y * o };
  const b = { x: B.p.x + n.x * o, y: B.p.y + n.y * o };
  return spindle(a, b, mid.r * wFrac, pos);
}

function frontMuscles(c: Ctx): MShape[] {
  const { S, cm } = c;
  const G = S.group;
  const T = S.trunk;
  const out: MShape[] = [];
  const nh = (S.fullness.biceps - 1) * 1.2;
  for (const s of [-1, 1]) {
    const arm = armGeom(c, s, 'lean');
    const leg = legGeom(c, s, 'lean');
    const sgn = s;
    // delts
    out.push({
      ids: ['frontDelts', 'sideDelts'],
      d: ell(CENTER_X + sgn * (S.armOffset + cm(1.0)), S.y.shoulder + cm(5.5), cm(4.5 * G.delts), cm(7.2 * G.delts), sgn * 8),
    });
    // traps slope
    out.push({
      ids: ['upperTraps'],
      d: spindle({ x: CENTER_X + sgn * S.neckR.lean * 0.9, y: S.y.neckBase - 2 }, { x: CENTER_X + sgn * S.frame.shoulderHalf * 0.85, y: S.y.shoulder + cm(1.2) }, cm(1.5 * G.traps), 0.5, sgn * cm(0.4)),
    });
    // neck (sternocleidomastoid)
    out.push({ ids: ['neckFlexors'], d: spindle({ x: CENTER_X + sgn * S.neckR.lean * 0.9, y: S.y.chin - cm(2) }, { x: CENTER_X + sgn * cm(1.3), y: S.y.neckBase + cm(2.5) }, cm(0.9 * G.neck), 0.4) });
    // pecs
    out.push({
      ids: ['upperChest', 'midLowerChest'],
      d: ell(CENTER_X + sgn * cm(6.6), S.y.chest + cm(3.4), cm(6.9 * G.chest), cm(5.0 * G.chest), sgn * 14),
    });
    // lats (flare beside ribs)
    const ch = T[2] as TrunkStation;
    const rb = T[3] as TrunkStation;
    const wa = T[4] as TrunkStation;
    out.push({
      ids: ['lats'],
      d: smooth([
        { x: CENTER_X + sgn * (ch.leanHalf - cm(0.2)), y: S.y.chest + cm(1) },
        { x: CENTER_X + sgn * (rb.leanHalf - cm(0.1)), y: rb.y },
        { x: CENTER_X + sgn * (wa.leanHalf - cm(0.2)), y: wa.y },
        { x: CENTER_X + sgn * (wa.leanHalf - cm(1.8)), y: wa.y - cm(1) },
        { x: CENTER_X + sgn * (rb.leanHalf - cm(2.8 * G.lats)), y: rb.y },
        { x: CENTER_X + sgn * (ch.leanHalf - cm(1.8)), y: S.y.chest + cm(3) },
      ], true),
    });
    // obliques
    out.push({
      ids: ['obliques'],
      d: smooth([
        { x: CENTER_X + sgn * cm(5.3), y: rb.y - cm(2) },
        { x: CENTER_X + sgn * (rb.leanHalf - cm(3)), y: rb.y },
        { x: CENTER_X + sgn * (wa.leanHalf - cm(0.5)), y: wa.y },
        { x: CENTER_X + sgn * ((T[5] as TrunkStation).leanHalf - cm(2.2)), y: S.y.hip - cm(1.5) },
        { x: CENTER_X + sgn * cm(5.5), y: S.y.hip - cm(5) },
      ], true),
    });
    // abs: three rows per side
    for (let i = 0; i < 3; i++) {
      const y0 = S.y.chest + cm(10.5) + i * cm(7.5);
      const w = cm((3.9 - 0) * (0.82 + 0.18 * G.abs));
      out.push({ ids: ['rectusAbdominis'], d: ell(CENTER_X + sgn * (w / 2 + cm(0.5)), y0 + cm(2.5), w / 2, cm(2.4 + 0.2 * G.abs), 0) });
    }
    // upper arm: biceps (front) and a lateral triceps strip
    out.push({ ids: ['biceps', 'brachialis'], d: seg(arm, 1, 0.16, 0.8, 0.8, 0.5 + nh, 0.0, 1) });
    out.push({ ids: ['tricepsLong', 'tricepsLatMed'], d: seg(arm, 1, 0.2, 0.78, 0.45, 0.4, 0.65, sgn) });
    // forearm
    out.push({ ids: ['forearms'], d: seg(arm, 2, 0.06, 0.95, 0.85, 0.28 + (S.fullness.forearms - 1), 0, 1) });
    // quads: rectus + lateral vastus + teardrop medial
    const fq = (S.fullness.vasti - 1) * 1.2;
    out.push({ ids: ['rectusFemoris'], d: seg(leg, 1, 0.1, 0.86, 0.5, 0.5, 0.0, 1) });
    out.push({ ids: ['vasti'], d: seg(leg, 1, 0.18, 0.92, 0.5, 0.62 + fq, 0.52, sgn) });
    out.push({ ids: ['vasti'], d: seg(leg, 1, 0.58, 0.97, 0.38, 0.7 + fq, 0.5, -sgn) });
    out.push({ ids: ['adductors'], d: seg(leg, 1, 0.08, 0.62, 0.32, 0.4, 0.85, -sgn) });
    // lower leg
    const fc = (S.fullness.gastrocnemius - 1) * 1.2;
    out.push({ ids: ['gastrocnemius', 'soleus'], d: seg(leg, 2, 0.06, 0.62, 0.42, 0.4 + fc, 0.5, sgn) });
    out.push({ ids: ['tibialisAnterior'], d: seg(leg, 2, 0.1, 0.8, 0.28, 0.4, 0.05, 1) });
  }
  return out;
}

function sideMuscles(c: Ctx): MShape[] {
  const { S, cm } = c;
  const G = S.group;
  const T = S.trunk;
  const out: MShape[] = [];
  const arm = armGeom(c, 1, 'lean');
  const leg = legGeom(c, 1, 'lean');
  const ch = T[2] as TrunkStation;
  const rb = T[3] as TrunkStation;
  const wa = T[4] as TrunkStation;
  const hp = T[5] as TrunkStation;
  const X = CENTER_X;
  // traps: neck to mid back
  out.push({ ids: ['upperTraps', 'midTrapsRhomboids'], d: spindle({ x: X - S.neckR.lean * 0.5, y: S.y.neckBase - cm(3) }, { x: X - ch.leanPost * 0.55, y: S.y.chest + cm(9) }, cm(2.0 * G.traps), 0.35, -cm(0.4)) });
  // lats
  out.push({ ids: ['lats'], d: spindle({ x: X - ch.leanPost * 0.5, y: S.y.chest + cm(3) }, { x: X - wa.leanPost * 0.85, y: wa.y + cm(1) }, cm(2.3 * G.lats), 0.4, -cm(0.5)) });
  // erectors
  out.push({ ids: ['spinalErectors'], d: spindle({ x: X - rb.leanPost * 0.78, y: S.y.chest + cm(8) }, { x: X - hp.leanPost * 0.78, y: S.y.hip - cm(2) }, cm(1.5 * G.erectors), 0.5) });
  // pecs
  out.push({ ids: ['upperChest', 'midLowerChest'], d: ell(X + ch.leanAnt * 0.5, S.y.chest + cm(3.2), cm(3.6 * G.chest), cm(5.0 * G.chest), 8) });
  // abs & obliques
  out.push({ ids: ['rectusAbdominis'], d: spindle({ x: X + rb.leanAnt * 0.84, y: rb.y - cm(5) }, { x: X + hp.leanAnt * 0.84, y: S.y.hip - cm(1) }, cm(1.1 * (0.8 + 0.2 * G.abs)), 0.5) });
  out.push({ ids: ['obliques'], d: spindle({ x: X + rb.leanAnt * 0.2, y: rb.y - cm(3) }, { x: X + wa.leanAnt * 0.1, y: S.y.hip - cm(1) }, cm(2.6 * G.obliques), 0.5, cm(0.2)) });
  // neck
  out.push({ ids: ['neckFlexors', 'neckExtensors'], d: spindle({ x: X + cm(1.0), y: S.y.chin - cm(2) }, { x: X + cm(0.2), y: S.y.neckBase + cm(2.5) }, cm(1.1 * G.neck), 0.4, -cm(0.5)) });
  // delt
  out.push({ ids: ['frontDelts', 'sideDelts', 'rearDelts'], d: ell(X + cm(0.2), S.y.shoulder + cm(5.8), cm(4.5 * G.delts), cm(7.2 * G.delts), 6) });
  // arm
  const nh = (S.fullness.biceps - 1) * 1.2;
  out.push({ ids: ['biceps', 'brachialis'], d: seg(arm, 1, 0.2, 0.82, 0.55, 0.5 + nh, 0.55, 1) });
  out.push({ ids: ['tricepsLong', 'tricepsLatMed'], d: seg(arm, 1, 0.16, 0.82, 0.6, 0.38, 0.5, -1) });
  out.push({ ids: ['forearms'], d: seg(arm, 2, 0.06, 0.95, 0.85, 0.28 + (S.fullness.forearms - 1), 0, 1) });
  // glutes
  const rxG = hp.leanPost * 0.55;
  out.push({ ids: ['gluteMax', 'gluteMed'], d: ell(X - (hp.leanPost - rxG), S.y.hip + cm(0.5), rxG, cm(6.4 * Math.pow(G.glutes, 0.7)), 0) });
  // thigh: quads front, hamstrings back
  const fq = (S.fullness.vasti - 1) * 1.2;
  out.push({ ids: ['vasti', 'rectusFemoris'], d: seg(leg, 1, 0.1, 0.95, 0.62, 0.55 + fq, 0.34, 1) });
  const fh = (S.fullness.hamstrings - 1) * 1.2;
  out.push({ ids: ['hamstrings'], d: seg(leg, 1, 0.12, 0.9, 0.6, 0.45 + fh, 0.34, -1) });
  out.push({ ids: ['adductors'], d: seg(leg, 1, 0.1, 0.6, 0.3, 0.4, 0.0, 1) });
  // calf
  const fc = (S.fullness.gastrocnemius - 1) * 1.2;
  out.push({ ids: ['gastrocnemius'], d: seg(leg, 2, 0.04, 0.62, 0.62, 0.38 + fc, 0.34, -1) });
  out.push({ ids: ['soleus'], d: seg(leg, 2, 0.3, 0.8, 0.4, 0.4, 0.3, -1) });
  out.push({ ids: ['tibialisAnterior'], d: seg(leg, 2, 0.1, 0.78, 0.3, 0.4, 0.5, 1) });
  return out;
}

// ---------- component ----------

function heatOf(ids: MuscleId[], heat?: Partial<Record<MuscleId, number>>): number {
  if (!heat) return 0;
  let m = 0;
  for (const id of ids) m = Math.max(m, heat[id] ?? 0);
  return Math.min(1, Math.max(0, m));
}

export function BodySvg({ shape, view, highlight, heatmap, height = 360, className, style, idSuffix = '' }: BodySvgProps) {
  const c: Ctx = { S: shape, view, cm: (x) => x * shape.u };
  const S = shape;
  const sides = [-1, 1];

  const silhouette = (kind: Radius): string[] => {
    const d: string[] = [];
    if (view === 'front') {
      for (const s of sides) {
        d.push(tube(legGeom(c, s, kind).pts, 0.7, 0.3));
        d.push(footPath(c, s));
      }
      d.push(trunkPath(c, kind));
      d.push(neckPath(c, kind));
      d.push(headPath(c));
      for (const s of sides) d.push(tube(armGeom(c, s, kind).pts, 0.8, 0.2));
    } else {
      d.push(tube(armGeom(c, 1, kind).pts, 0.8, 0.2));
      d.push(tube(legGeom(c, 1, kind).pts, 0.7, 0.3));
      d.push(footPath(c, 1));
      d.push(trunkPath(c, kind));
      d.push(neckPath(c, kind));
      d.push(headPath(c));
    }
    return d;
  };

  const skin = silhouette('skin');
  const lean = silhouette('lean');
  const muscles = view === 'front' ? frontMuscles(c) : sideMuscles(c);

  const def = S.definition;
  const fillOp = 0.07 + 0.38 * def;
  const strokeOp = 0.06 + 0.85 * Math.pow(def, 1.3);
  const clipId = `bodyclip-${view}${idSuffix}`;

  const farLeg = view === 'side' ? tube(legGeom(c, 1, 'skin', true).pts, 0.7, 0.3) : null;
  const farFoot = view === 'side' ? footPath(c, 1, true) : null;

  const line = 'var(--line, #3b2f2a)';
  const skinC = 'var(--skin, #e9bfa0)';
  const muscleC = 'var(--muscle, #b5483d)';
  const accent = 'var(--accent, #f59e0b)';

  return (
    <svg
      role="img"
      aria-label={`${view} view body silhouette`}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      height={height}
      width={(height * VIEW_W) / VIEW_H}
      className={className}
      style={{ display: 'block', ...style }}
    >
      <defs>
        <clipPath id={clipId}>
          {skin.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </clipPath>
      </defs>
      {/* ground shadow */}
      <ellipse cx={CENTER_X} cy={S.y.floor + 2} rx={view === 'front' ? 62 + S.fat.waist * 2 : 50} ry={4} fill={line} opacity={0.12} />
      {/* far leg (side view) */}
      {farLeg && farFoot && (
        <g>
          <path d={farLeg} fill={skinC} stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
          <path d={farFoot} fill={skinC} stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
          <path d={farLeg} fill="#000" opacity={0.16} />
          <path d={farFoot} fill="#000" opacity={0.16} />
        </g>
      )}
      {/* layer 1: skin + fat outline (stroke pass) */}
      <g fill={skinC} stroke={line} strokeWidth={2} strokeLinejoin="round">
        {skin.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {/* fill-only pass hides interior seams where parts overlap */}
      <g fill={skinC} stroke="none">
        {skin.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {/* layer 2: lean silhouette under the fat */}
      <g clipPath={`url(#${clipId})`}>
        <g fill={muscleC} opacity={0.1 + 0.2 * def} stroke={line} strokeOpacity={0.15 + 0.3 * def} strokeWidth={0.8}>
          {lean.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
        {/* layer 3: muscle shapes */}
        <g strokeLinejoin="round">
          {muscles.map((m, i) => {
            const h = heatOf(m.ids, heatmap);
            const hl = highlight ? m.ids.includes(highlight) : false;
            return (
              <g key={i}>
                <path d={m.d} fill={muscleC} fillOpacity={fillOp} stroke={line} strokeOpacity={strokeOp} strokeWidth={1.1} />
                {(h > 0 || hl) && <path d={m.d} fill={accent} fillOpacity={hl ? 0.75 : 0.15 + 0.65 * h} stroke={hl ? accent : 'none'} strokeWidth={1.4} />}
              </g>
            );
          })}
        </g>
        {/* anatomical detail lines */}
        <g stroke={line} strokeOpacity={0.12 + 0.5 * def} strokeWidth={1} fill="none" strokeLinecap="round">
          {view === 'front' && (
            <>
              <path d={`M${CENTER_X} ${f(S.y.chest + c.cm(1))}L${CENTER_X} ${f(S.y.hip - c.cm(2))}`} />
              <path d={`M${f(CENTER_X - S.neckR.lean)} ${f(S.y.neckBase + c.cm(3))}Q${f(CENTER_X - S.neckR.lean * 2.4)} ${f(S.y.neckBase + c.cm(1.5))} ${f(CENTER_X - S.frame.shoulderHalf * 0.8)} ${f(S.y.shoulder + c.cm(1))}`} />
              <path d={`M${f(CENTER_X + S.neckR.lean)} ${f(S.y.neckBase + c.cm(3))}Q${f(CENTER_X + S.neckR.lean * 2.4)} ${f(S.y.neckBase + c.cm(1.5))} ${f(CENTER_X + S.frame.shoulderHalf * 0.8)} ${f(S.y.shoulder + c.cm(1))}`} />
            </>
          )}
        </g>
      </g>
      {/* navel and kneecaps (front) */}
      {view === 'front' && (
        <g fill={line} opacity={0.35}>
          <ellipse cx={CENTER_X} cy={S.y.waist + c.cm(1)} rx={1.4} ry={2} />
        </g>
      )}
      {/* eye / face hint */}
      <circle cx={view === 'front' ? CENTER_X - S.head.rx * 0.38 : CENTER_X + c.cm(1.4) + S.head.rx * 0.55} cy={S.y.top + S.head.ry * 0.9} r={1.3} fill={line} opacity={0.6} />
      {view === 'front' && <circle cx={CENTER_X + S.head.rx * 0.38} cy={S.y.top + S.head.ry * 0.9} r={1.3} fill={line} opacity={0.6} />}
    </svg>
  );
}

export default BodySvg;
