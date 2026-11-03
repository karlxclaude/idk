// Injury hazard per exposure (spec 5.5): base rate x intensity x fatigue x technique x load spike x sleep
// x tissue gap x prior injury x genetic proneness. Calibrated to injuries per 1000 h by activity.
import { MUSCLE_REGIONS, type MuscleId } from '../data/muscles';
import type { SimContext } from './context';
import { sumLast, tissueGap } from './adaptation';
import { clamp } from './math';
import type { Rng } from './rng';
import type { Hazard } from './session';
import { HISTORY_DAYS, type CharacterState, type Injury, type InjuryType } from './types';

const STRAIN_TISSUES = new Set(['hamstrings', 'adductors', 'pec', 'biceps', 'quads', 'calf', 'lats']);
const TENDON_TISSUES: Record<string, MuscleId> = {
  patellarTendon: 'vasti', achilles: 'gastrocnemius', elbow: 'tricepsLatMed', shoulder: 'frontDelts', wrist: 'forearms',
};
const JOINT_TISSUES = new Set(['knee', 'hip', 'shoulder', 'wrist', 'elbow']);
const BONE_TISSUES = new Set(['tibia', 'shin', 'foot']);

/** Acute (7 d) vs chronic (28 d, weekly-averaged) training load ratio. */
export function acwr(ctx: SimContext, s: CharacterState): number {
  const M = ctx.P.model;
  const acute = sumLast(s.fatigue.acuteLoadHist, s.day, 7);
  const chronic = sumLast(s.fatigue.acuteLoadHist, s.day, HISTORY_DAYS) / 4;
  if (chronic < M.acwrMinChronic) return acute > M.acwrNoviceAcute ? M.acwrNoviceBase + acute / M.acwrNoviceSlope : 1;
  return acute / chronic;
}

export interface InjuryDayCtx {
  sleepH: number;
  eaSeverity: number;
  readiness: number;
}

export function dayMultiplier(ctx: SimContext, s: CharacterState, dc: InjuryDayCtx): number {
  const I = ctx.P.injury;
  const M = ctx.P.model;
  const ratio = acwr(ctx, s);
  const spike = ratio > I.acwrThreshold ? 1 + I.acwrHazardPerUnit * (ratio - I.acwrThreshold) : 1;
  const sleep = 1 + (I.sleepHazardMax - 1) * clamp((ctx.P.fatigue.sleepNeedH - dc.sleepH) / M.injurySleepSpanH, 0, 1);
  const age = 1 + (I.ageHazardAt60 - 1) * clamp((s.ageYears - M.injuryAgeStart) / M.injuryAgeSpan, 0, M.injuryAgeMaxFactor);
  return spike * sleep * age * s.genetics.injuryProneness;
}

function priorMultiplier(ctx: SimContext, s: CharacterState, tissue: string): number {
  const I = ctx.P.injury;
  let m = 1;
  for (const inj of s.injuryHistory) {
    if (inj.tissue !== tissue) continue;
    const since = s.day - (inj.startDay + inj.durationDays);
    if (since < 0) continue;
    m = Math.max(m, 1 + (I.priorInjuryMultiplier - 1) * Math.exp(-since / I.priorInjuryDecayDays));
  }
  return m;
}

function preventionMultiplier(ctx: SimContext, s: CharacterState, tissue: string, preventionSets: Record<string, number>): number {
  const I = ctx.P.injury;
  if (tissue === 'hamstrings' && (preventionSets.nordic ?? 0) >= I.preventionDoseSetsPerWeek) return 1 - I.nordicHamstringReduction;
  if (tissue === 'adductors' && (preventionSets.copenhagen ?? 0) >= I.preventionDoseSetsPerWeek) return 1 - I.copenhagenGroinReduction;
  return 1;
}

function typeFor(tissue: string): InjuryType {
  if (tissue === 'lowBack') return 'lowBack';
  if (BONE_TISSUES.has(tissue)) return 'stressFracture';
  if (tissue in TENDON_TISSUES) return 'tendinopathy';
  if (JOINT_TISSUES.has(tissue)) return 'jointIrritation';
  if (STRAIN_TISSUES.has(tissue)) return 'strain';
  return 'strain';
}

function musclesFor(tissue: string, fallback: MuscleId[]): MuscleId[] {
  switch (tissue) {
    case 'hamstrings': return ['hamstrings'];
    case 'adductors': return ['adductors'];
    case 'pec': return ['midLowerChest', 'upperChest'];
    case 'biceps': return ['biceps', 'brachialis'];
    case 'lowBack': return ['spinalErectors'];
    case 'knee': case 'patellarTendon': return ['vasti', 'rectusFemoris'];
    case 'achilles': case 'calf': return ['gastrocnemius', 'soleus'];
    case 'shoulder': return ['frontDelts', 'sideDelts', 'midLowerChest'];
    case 'elbow': return ['tricepsLatMed', 'tricepsLong', 'biceps'];
    case 'wrist': return ['forearms'];
    case 'hip': return ['gluteMax', 'gluteMed', 'adductors'];
    case 'tibia': case 'shin': case 'foot': return ['soleus', 'tibialisAnterior', 'gastrocnemius'];
    default: return fallback;
  }
}

function durationFor(ctx: SimContext, type: InjuryType): number {
  const I = ctx.P.injury;
  switch (type) {
    case 'strain': return I.durationStrainDays;
    case 'tendinopathy': return I.durationTendinopathyDays;
    case 'jointIrritation': return I.durationJointIrritationDays;
    case 'lowBack': return I.durationLowBackDays;
    case 'stressFracture': return I.durationStressFractureDays;
  }
}

/**
 * Resolve today's hazards. Returns new injuries (already added to state).
 * Expected injuries = hazard x multipliers; probability = 1 - exp(-expected).
 */
export function injuryCheck(ctx: SimContext, s: CharacterState, hazards: Hazard[], dc: InjuryDayCtx, rng: Rng, preventionSets: Record<string, number>): Injury[] {
  const I = ctx.P.injury;
  const M = ctx.P.model;
  const out: Injury[] = [];
  if (hazards.length === 0) return out;
  const dayMult = dayMultiplier(ctx, s, dc);
  const bmdZ = (s.body.bmd - 1) / M.bmdZScoreSd;
  for (const h of hazards) {
    const tissues = h.tissues.length ? h.tissues : ['muscle'];
    const weightOf = (t: string) => (BONE_TISSUES.has(t) ? M.boneTissueWeight : 1);
    const weightSum = tissues.reduce((a, t) => a + weightOf(t), 0);
    for (const tissue of tissues) {
      const perTissue = (h.hazard * weightOf(tissue)) / weightSum;
      let m = dayMult * priorMultiplier(ctx, s, tissue) * preventionMultiplier(ctx, s, tissue, preventionSets);
      const tm = TENDON_TISSUES[tissue];
      if (tm) m *= 1 + (I.tissueGapHazardPer30pct - 1) * (tissueGap(ctx, s, tm) / M.tissueGapRef);
      if (BONE_TISSUES.has(tissue)) {
        m *= (bmdZ < 0 ? I.stressFractureBmdHazardPerSd ** -bmdZ : 1) * (1 + (I.stressFractureLowEaMultiplier - 1) * dc.eaSeverity) * ((M.boneImpactOffset + h.impact) / (M.boneImpactOffset + 1));
      }
      const expected = perTissue * m;
      if (rng.chance(1 - Math.exp(-expected))) {
        if (s.injuries.some((x) => x.tissue === tissue)) continue;
        const type = typeFor(tissue);
        const dur = Math.max(M.minInjuryDays, Math.round(durationFor(ctx, type) * rng.lognormal(1, I.durationSigma)));
        const inj: Injury = { id: s.nextInjuryId++, type, tissue, muscles: musclesFor(tissue, h.muscles), startDay: s.day, durationDays: dur, severity: clamp(dur / (durationFor(ctx, type) * 2), M.severityMin, 1) };
        s.injuries.push(inj);
        out.push(inj);
      }
    }
  }
  return out;
}

/** Heal injuries; rehab speeds return. */
export function healStep(ctx: SimContext, s: CharacterState, rehab: boolean): Injury[] {
  const healed: Injury[] = [];
  const keep: Injury[] = [];
  for (const inj of s.injuries) {
    if (rehab) inj.durationDays -= ctx.P.injury.rehabSpeedup * ctx.P.model.rehabDailyFraction;
    if (s.day >= inj.startDay + inj.durationDays) {
      healed.push(inj);
      s.injuryHistory.push(inj);
    } else keep.push(inj);
  }
  s.injuries = keep;
  return healed;
}

/** Muscles that cannot be loaded hard because of an active injury. */
export function restrictedMuscles(s: CharacterState): Set<MuscleId> {
  const out = new Set<MuscleId>();
  for (const inj of s.injuries) for (const m of inj.muscles) out.add(m);
  return out;
}

export function isRestricted(ctx: SimContext, muscles: Partial<Record<MuscleId, number>>, restricted: Set<MuscleId>): boolean {
  if (restricted.size === 0) return false;
  for (const k in muscles) if ((muscles[k as MuscleId] as number) >= ctx.P.model.primaryActivation && restricted.has(k as MuscleId)) return true;
  return false;
}

export const ALL_MUSCLES = MUSCLE_REGIONS;
