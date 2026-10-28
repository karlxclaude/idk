// Pure geometry model for the body visual. No React: turns a CharacterState into BodyShape parameters.
// All lengths in the returned shape are SVG user units where the standing figure is FIGURE_H units tall.
import { MUSCLE_REGIONS, MUSCLE_MASS_FRACTIONS, type MuscleId } from '../../data/muscles';
import type { Params } from '../../data/constants';
import { bodyFatFraction, bodyMass, fatFreeMass, measuredMuscleSize, normalizedFfmi } from '../../engine/body';
import { makeContext } from '../../engine/context';
import { referenceCharacter } from '../../engine/character';
import type { CharacterState } from '../../engine/types';

export const FIGURE_H = 400;
export const FLOOR_Y = 415;
export const CENTER_X = 150;
export const VIEW_W = 300;
export const VIEW_H = 430;

// ---- Visual tuning (design constants for the picture, not simulation parameters) ----
const REF_HEIGHT_CM = 175;
const GIRTH_MIN = 0.55;
const GIRTH_MAX = 1.7;
/** Fat thickness (cm) per kg of fat mass per unit regional weight. */
const FAT_CM_PER_KG = 0.2;
const FAT_MAX_CM = 9;
const FRAME_EXP = 0.7;
const HEAD_FRACTION = 0.128; // head height / body height
const CROTCH_DROP = 0.06; // crotch below hip joint, fraction of height
/** Belly-length -> fullness: visual only (never feeds back into girth). */
const FULLNESS_PER_ARM = 0.18;
const FULLNESS_MIN = 0.8;
const FULLNESS_MAX = 1.25;

export type Group =
  | 'chest' | 'delts' | 'traps' | 'lats' | 'arm' | 'forearm' | 'abs' | 'obliques' | 'erectors'
  | 'glutes' | 'quads' | 'hams' | 'adductors' | 'calves' | 'neck';

const GROUPS: Record<Group, MuscleId[]> = {
  chest: ['upperChest', 'midLowerChest'],
  delts: ['frontDelts', 'sideDelts', 'rearDelts'],
  traps: ['upperTraps', 'midTrapsRhomboids'],
  lats: ['lats'],
  arm: ['biceps', 'brachialis', 'tricepsLong', 'tricepsLatMed'],
  forearm: ['forearms'],
  abs: ['rectusAbdominis'],
  obliques: ['obliques'],
  erectors: ['spinalErectors'],
  glutes: ['gluteMax', 'gluteMed'],
  quads: ['rectusFemoris', 'vasti'],
  hams: ['hamstrings'],
  adductors: ['adductors'],
  calves: ['gastrocnemius', 'soleus', 'tibialisAnterior'],
  neck: ['neckFlexors', 'neckExtensors'],
};

export type FatRegion = 'neck' | 'chest' | 'waist' | 'hip' | 'thigh' | 'calf' | 'upperArm' | 'forearm';

/** One cross-section of a limb or the trunk. Radii in units. */
export interface Station {
  /** Fraction along the segment (0 proximal, 1 distal) or normalized height for the trunk. */
  t: number;
  /** Lean (muscle + bone) half-width/radius. */
  lean: number;
  /** Skin radius = lean + fat. */
  skin: number;
}

export interface TrunkStation {
  y: number;
  /** Front-view half-width. */
  leanHalf: number;
  skinHalf: number;
  /** Side-view anterior and posterior extents from the body axis. */
  leanAnt: number;
  skinAnt: number;
  leanPost: number;
  skinPost: number;
}

export interface BodyShape {
  heightCm: number;
  /** Units per cm. */
  u: number;
  sex: CharacterState['sex'];
  bodyFat: number; // 0..1
  bodyMassKg: number;
  ffmi: number;
  /** Visible muscle definition 0..1 (falls with body fat). */
  definition: number;
  /** Fat softness 0..1 (rounding of outline). */
  softness: number;
  /** Per-region girth multiplier (sqrt of size ratio vs the reference man). */
  girth: Record<MuscleId, number>;
  /** Mass-weighted girth multiplier per anatomical group. */
  group: Record<Group, number>;
  /** Visual fullness of each belly (insertion-derived, visual only). */
  fullness: Record<MuscleId, number>;
  /** Fat thickness per body region (units). */
  fat: Record<FatRegion, number>;
  /** Segment lengths (units). */
  seg: { thigh: number; shank: number; upperArm: number; forearm: number; torso: number; foot: number; head: number; neck: number };
  /** Key vertical landmarks (SVG y). */
  y: { top: number; chin: number; neckBase: number; shoulder: number; chest: number; waist: number; hip: number; crotch: number; knee: number; ankle: number; floor: number; elbow: number; wrist: number };
  frame: { shoulderHalf: number; hipHalf: number; wristR: number; factor: number };
  trunk: TrunkStation[];
  thigh: Station[];
  shank: Station[];
  upperArm: Station[];
  forearm: Station[];
  neckR: { lean: number; skin: number };
  head: { rx: number; ry: number };
  /** Horizontal offset of each leg centre from the body axis (front view). */
  legOffset: number;
  /** Horizontal shoulder-joint offset from the axis. */
  armOffset: number;
}

const refCache = new WeakMap<Params, CharacterState>();
function referenceFor(P: Params): CharacterState {
  let r = refCache.get(P);
  if (!r) {
    r = referenceCharacter(makeContext({ params: P }));
    refCache.set(P, r);
  }
  return r;
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Per-region ratio of (edema-inclusive) size to the reference man's size. */
export function sizeRatios(state: CharacterState, P: Params): Record<MuscleId, number> {
  const ref = referenceFor(P);
  const out = {} as Record<MuscleId, number>;
  for (const m of MUSCLE_REGIONS) out[m] = measuredMuscleSize(state, P, m) / Math.max(1e-6, measuredMuscleSize(ref, P, m));
  return out;
}

/** Regional fat weights: central (android) fat accumulates on the trunk, peripheral (gynoid) fat on limbs and hips. */
export function fatWeights(androidFat: number): Record<FatRegion, number> {
  const a = clamp(androidFat, 0, 1);
  return {
    waist: 0.4 + 1.3 * a,
    chest: 0.45 + 0.3 * a,
    hip: 0.9 + 0.2 * a,
    neck: 0.5 + 0.5 * a,
    thigh: 1.1 - 0.8 * a,
    upperArm: 0.9 - 0.8 * a,
    forearm: 0.5 - 0.4 * a,
    calf: 0.7 - 0.6 * a,
  };
}

export function bodyShape(state: CharacterState, P: Params): BodyShape {
  const heightCm = state.anthro.heightCm;
  const H = FIGURE_H;
  const u = H / heightCm;
  const cm = (x: number): number => x * u;
  const bf = bodyFatFraction(state, P);

  // --- muscle girth ---
  const ratio = sizeRatios(state, P);
  const girth = {} as Record<MuscleId, number>;
  const fullness = {} as Record<MuscleId, number>;
  for (const m of MUSCLE_REGIONS) {
    girth[m] = clamp(Math.sqrt(ratio[m]), GIRTH_MIN, GIRTH_MAX);
    // Belly length is visual only: lower leverage (insertion nearer the joint) reads as a longer, fuller belly.
    fullness[m] = clamp(1 + FULLNESS_PER_ARM * (1 - state.muscles[m].momentArm), FULLNESS_MIN, FULLNESS_MAX);
  }
  const group = {} as Record<Group, number>;
  for (const g of Object.keys(GROUPS) as Group[]) {
    let w = 0;
    let s = 0;
    for (const m of GROUPS[g]) {
      w += MUSCLE_MASS_FRACTIONS[m];
      s += MUSCLE_MASS_FRACTIONS[m] * girth[m];
    }
    group[g] = s / w;
  }

  // --- frame from wrist circumference ---
  const refWrist = P.genetics.wristCircMeanMen;
  const frameF = Math.pow(state.anthro.wristCm / refWrist, FRAME_EXP);
  const shoulderHalf = cm(19 * frameF);
  const hipBoneHalf = 14 * frameF;
  const wristR = cm(state.anthro.wristCm / (2 * Math.PI));

  // --- fat thickness ---
  const fatKg = state.body.fatMass;
  const w = fatWeights(state.genetics.androidFat);
  const fatCm = {} as Record<FatRegion, number>;
  for (const k of Object.keys(w) as FatRegion[]) fatCm[k] = clamp(fatKg * FAT_CM_PER_KG * w[k], 0, FAT_MAX_CM);
  const fat = {} as Record<FatRegion, number>;
  for (const k of Object.keys(fatCm) as FatRegion[]) fat[k] = cm(fatCm[k]);

  // --- segment lengths scaled to height ---
  const a = state.anthro;
  const seg = {
    thigh: a.thigh * H,
    shank: a.shank * H,
    upperArm: a.upperArm * H,
    forearm: a.forearm * H,
    torso: a.torso * H,
    foot: P.genetics.footHeightFraction * H,
    head: HEAD_FRACTION * H,
    neck: 0,
  };
  const yFloor = FLOOR_Y;
  const yAnkle = yFloor - seg.foot;
  const yKnee = yAnkle - seg.shank;
  const yHip = yKnee - seg.thigh;
  const yShoulder = yHip - seg.torso;
  const yTop = yFloor - H;
  const yChin = yTop + seg.head;
  seg.neck = Math.max(0, yShoulder - yChin);
  const yNeckBase = yShoulder - 0.03 * H;
  const yCrotch = yHip + CROTCH_DROP * H;
  const yElbow = yShoulder + seg.upperArm;
  const yWrist = yElbow + seg.forearm;
  const yChest = yShoulder + 0.2 * seg.torso;
  const yRib = yShoulder + 0.5 * seg.torso;
  const yWaist = yShoulder + 0.68 * seg.torso;

  const G = group;
  // --- trunk stations (front half-width, side anterior/posterior) in cm then units ---
  const neckLeanCm = 5.6 * (0.6 + 0.4 * G.neck) * Math.sqrt(frameF);
  const chestHalf = 12.2 * frameF + 1.6 * G.chest + 1.4 * G.lats;
  const ribHalf = 11.2 * frameF + 1.1 * G.chest + 2.0 * G.lats;
  const waistHalf = 9.4 * frameF + 0.9 * G.obliques + 0.6 * G.abs + 0.3 * G.lats;
  const hipHalf = hipBoneHalf + 1.5 * G.glutes - 0.3;
  const mk = (y: number, lh: number, fh: number, la: number, fa: number, lp: number, fp: number): TrunkStation => ({
    y,
    leanHalf: cm(lh),
    skinHalf: cm(lh + fh),
    leanAnt: cm(la),
    skinAnt: cm(la + fa),
    leanPost: cm(lp),
    skinPost: cm(lp + fp),
  });
  const fc = fatCm;
  const trunk: TrunkStation[] = [
    mk(yNeckBase, neckLeanCm + 0.6, fc.neck * 0.6, neckLeanCm + 0.4, fc.neck * 0.6, neckLeanCm + 1.2, fc.neck * 0.6),
    mk(yShoulder, 19 * frameF, fc.chest * 0.15, 8.5 + 1.2 * G.chest, fc.chest * 0.8, 7.6 + 1.4 * G.traps, fc.chest * 0.6),
    mk(yChest, chestHalf, fc.chest * 0.8, 9.2 + 2.0 * G.chest, fc.chest * 1.0, 8.0 + 1.2 * G.traps, fc.chest * 0.8),
    mk(yRib, ribHalf, fc.chest * 0.9, 9.0 + 1.0 * G.abs + 0.5 * G.chest, fc.waist * 1.0, 7.8 + 1.0 * G.erectors, fc.waist * 0.6),
    mk(yWaist, waistHalf, fc.waist, 8.4 + 0.8 * G.abs, fc.waist * 1.4, 7.4 + 0.9 * G.erectors, fc.waist * 0.7),
    mk(yHip, hipHalf, fc.hip, 8.8 + 0.4 * G.abs, fc.waist * 1.4 + fc.hip * 0.3, 8.8 + 3.2 * G.glutes, fc.hip * 0.9),
    mk(yCrotch, hipHalf * 0.82, fc.hip * 0.8, 7.6, fc.hip * 0.7, 9.0 + 2.6 * G.glutes, fc.hip * 0.9),
  ];

  const stations = (n: number, leanCm: (t: number) => number, fatC: number): Station[] => {
    const out: Station[] = [];
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      out.push({ t, lean: cm(leanCm(t)), skin: cm(leanCm(t) + fatC * (1 - 0.35 * t)) });
    }
    return out;
  };
  // Thigh: hip -> knee. Quads dominate front, hamstrings/adductors back/inner; use blended girth.
  const thighG = 0.55 * G.quads + 0.25 * G.hams + 0.2 * G.adductors;
  const thigh = stations(8, (t) => {
    const taper = 8.2 * thighG * (1 - 0.36 * t);
    const swell = 1 + 0.12 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * thighG * 0.5;
    return Math.max(4.2, taper * swell);
  }, fc.thigh);
  // Shank: knee -> ankle, calf belly high.
  const calfPos = 0.3;
  const shank = stations(8, (t) => {
    const belly = 1 + 0.85 * G.calves * Math.exp(-(((t - calfPos) / 0.22) ** 2));
    const base = 3.9 + 0.8 * (1 - t);
    return Math.max(2.6, base * belly);
  }, fc.calf);
  const upperArm = stations(6, (t) => {
    const belly = 1 + 0.22 * Math.exp(-(((t - 0.4) / 0.28) ** 2));
    const armR = 3.2 * Math.max(0.9, G.arm) * belly + 0.2;
    // Deltoid cap blends into the top of the arm (it sets the silhouette width at the shoulder).
    const deltR = 5.0 * G.delts * clamp(1 - t / 0.5, 0, 1);
    return Math.max(armR, deltR);
  }, fc.upperArm);
  const forearm = stations(6, (t) => {
    const belly = 1 + 0.35 * G.forearm * Math.exp(-(((t - 0.18) / 0.3) ** 2)) * 0.6;
    const taper = 3.0 * (1 - 0.43 * t);
    return Math.max(wristR / u, taper * Math.sqrt(G.forearm) * belly);
  }, fc.forearm);

  const legOffsetCm = hipHalf * 0.52 + 0.5 * fc.thigh;

  return {
    heightCm,
    u,
    sex: state.sex,
    bodyFat: bf,
    bodyMassKg: bodyMass(state, P),
    ffmi: normalizedFfmi(state, P),
    definition: clamp(1 - (bf - 0.07) / 0.3, 0.1, 1),
    softness: clamp((bf - 0.1) / 0.35, 0, 1),
    girth,
    group,
    fullness,
    fat,
    seg,
    y: { top: yTop, chin: yChin, neckBase: yNeckBase, shoulder: yShoulder, chest: yChest, waist: yWaist, hip: yHip, crotch: yCrotch, knee: yKnee, ankle: yAnkle, floor: yFloor, elbow: yElbow, wrist: yWrist },
    frame: { shoulderHalf, hipHalf: cm(hipBoneHalf), wristR, factor: frameF },
    trunk,
    thigh,
    shank,
    upperArm,
    forearm,
    neckR: { lean: cm(neckLeanCm), skin: cm(neckLeanCm + fc.neck * 0.7) },
    head: { rx: cm(7.8 + 0.18 * fc.neck), ry: cm(11.4) },
    legOffset: cm(legOffsetCm),
    armOffset: cm(19 * frameF - 1.2),
  };
}

export interface GrownMuscle { id: MuscleId; gainKg: number; gainPct: number }

/** Regions that have grown most vs their untrained set point, sorted by absolute gain (kg). */
export function topGrown(state: CharacterState, n = 3): GrownMuscle[] {
  const rows: GrownMuscle[] = MUSCLE_REGIONS.map((id) => {
    const st = state.muscles[id];
    return { id, gainKg: st.mass - st.baseline, gainPct: (st.mass / Math.max(1e-6, st.baseline) - 1) * 100 };
  });
  return rows.filter((r) => r.gainKg > 0.005).sort((x, y) => y.gainKg - x.gainKg).slice(0, n);
}

export { bodyMass, fatFreeMass };
