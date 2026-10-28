// Character creator: visible sliders -> CharacterProfile; hidden traits sampled (random) or set (customLab).
import { z } from 'zod';
import { DEFAULT_PARAMS } from '../data/constants';
import type { CharacterProfile } from './character';
import { createCharacter } from './character';
import type { SimContext } from './context';
import { clamp } from './math';
import type { CharacterState, Genetics, Sex } from './types';

export interface SliderDef {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit: string;
}

export function visibleSliders(ctx: SimContext): SliderDef[] {
  const { genetics: G, model: M } = ctx.P;
  const lo = 1 - G.creatorSegmentRange;
  const hi = 1 + G.creatorSegmentRange;
  return [
    { id: 'sex', label: 'Sex (0 = male, 1 = female)', min: 0, max: 1, step: 1, default: 0, unit: 'flag' },
    { id: 'ageYears', label: 'Age', min: G.creatorAgeMin, max: G.creatorAgeMax, step: 1, default: G.creatorAgeDefault, unit: 'years' },
    { id: 'heightCm', label: 'Height', min: M.heightMinCm, max: M.heightMaxCm, step: 1, default: G.heightMeanMen, unit: 'cm' },
    { id: 'bodyFat', label: 'Body fat', min: M.bodyFatMin, max: M.bodyFatMax, step: G.creatorBodyFatStep, default: G.bodyFatMeanMen, unit: 'ratio' },
    { id: 'ffmi', label: 'Untrained FFMI', min: M.ffmiUntrainedMin, max: M.ffmiUntrainedMax, step: 0.1, default: G.ffmiUntrainedMeanMen, unit: 'kg/m2' },
    { id: 'liftingYears', label: 'Years lifting', min: 0, max: G.creatorYearsMax, step: 0.5, default: 0, unit: 'years' },
    { id: 'enduranceYears', label: 'Years of endurance training', min: 0, max: G.creatorYearsMax, step: 0.5, default: 0, unit: 'years' },
    { id: 'femurMult', label: 'Femur length (relative to torso)', min: lo, max: hi, step: G.creatorMultStep, default: 1, unit: 'x mean' },
    { id: 'torsoMult', label: 'Torso length', min: lo, max: hi, step: G.creatorMultStep, default: 1, unit: 'x mean' },
    { id: 'armMult', label: 'Arm length', min: lo, max: hi, step: G.creatorMultStep, default: 1, unit: 'x mean' },
  ];
}

export const VISIBLE_SLIDERS: readonly SliderDef[] = visibleSliders({ P: DEFAULT_PARAMS } as SimContext);

export type CreatorMode = 'random' | 'customLab';

export interface CreatorInput {
  sex: Sex;
  ageYears: number;
  heightCm?: number;
  bodyFat?: number;
  ffmi?: number;
  liftingYears?: number;
  enduranceYears?: number;
  femurMult?: number;
  torsoMult?: number;
  armMult?: number;
  mode: CreatorMode;
  lab?: Partial<Genetics>;
}

const num = z.number().finite();
const revealedSchema = z.object({ fiberType: z.boolean(), responders: z.boolean(), ceiling: z.boolean(), metabolism: z.boolean() }).partial();
const labSchema = z
  .object({
    responderHyp: num, responderStr: num, responderAer: num, typeIVL: num, ffmiCeiling: num, bmrFactor: num,
    neatResponsiveness: num, fitnessTau: num, fatigueTau: num, tendonStiffness: num, injuryProneness: num,
    caffeineHalfLifeH: num, creatineResponder: z.boolean(), actn3xx: z.boolean(),
    neuralFastGain: num, noviceSkill: num, sweatRate: num, sweatSodium: num, androidFat: num, revealed: revealedSchema,
  })
  .partial();

export const CreatorInputSchema = z.object({
  sex: z.enum(['male', 'female']),
  ageYears: num.min(DEFAULT_PARAMS.genetics.creatorAgeMin).max(DEFAULT_PARAMS.genetics.creatorAgeMax),
  heightCm: num.positive().optional(),
  bodyFat: num.min(0).max(1).optional(),
  ffmi: num.positive().optional(),
  liftingYears: num.min(0).optional(),
  enduranceYears: num.min(0).optional(),
  femurMult: num.positive().optional(),
  torsoMult: num.positive().optional(),
  armMult: num.positive().optional(),
  mode: z.enum(['random', 'customLab']),
  lab: labSchema.optional(),
});

function slider(ctx: SimContext, id: string): SliderDef {
  const s = visibleSliders(ctx).find((x) => x.id === id);
  if (!s) throw new Error(`unknown slider ${id}`);
  return s;
}

function clampTo(ctx: SimContext, id: string, v: number): number {
  const s = slider(ctx, id);
  return clamp(v, s.min, s.max);
}

/** Clamp custom-lab overrides to the model ranges. */
function clampLab(ctx: SimContext, sex: Sex, lab: Partial<Genetics>): Partial<Omit<Genetics, 'revealed'>> {
  const { genetics: G, model: M } = ctx.P;
  const male = sex === 'male';
  const out: Partial<Omit<Genetics, 'revealed'>> = {};
  const c = <K extends keyof Omit<Genetics, 'revealed'>>(key: K, lo: number, hi: number): void => {
    const v = lab[key];
    if (typeof v === 'number') (out as Record<string, number>)[key] = clamp(v, lo, hi);
  };
  c('responderHyp', G.creatorMultiplierMin, G.creatorMultiplierMax);
  c('responderStr', G.creatorMultiplierMin, G.creatorMultiplierMax);
  c('responderAer', G.creatorMultiplierMin, G.creatorMultiplierMax);
  c('injuryProneness', G.creatorMultiplierMin, G.creatorMultiplierMax);
  c('typeIVL', G.typeIMin, G.typeIMax);
  if (male) c('ffmiCeiling', M.ffmiCeilingMinMen, M.ffmiCeilingMaxMen);
  else c('ffmiCeiling', M.ffmiCeilingMinWomen, M.ffmiCeilingMaxWomen);
  c('bmrFactor', M.bmrFactorMin, M.bmrFactorMax);
  c('neatResponsiveness', M.neatRespMin, M.neatRespMax);
  c('fitnessTau', M.fitnessTauMin, M.fitnessTauMax);
  c('fatigueTau', M.fatigueTauMin, M.fatigueTauMax);
  c('tendonStiffness', M.tendonStiffMin, M.tendonStiffMax);
  c('caffeineHalfLifeH', M.caffeineHalfLifeMinH, M.caffeineHalfLifeMaxH);
  c('noviceSkill', M.noviceSkillMin, M.noviceSkillMax);
  c('sweatRate', M.sweatRateMin, M.sweatRateMax);
  c('sweatSodium', M.sweatSodiumMin, M.sweatSodiumMax);
  c('androidFat', M.androidFatMin, M.androidFatMax);
  if (typeof lab.neuralFastGain === 'number') out.neuralFastGain = Math.max(0, lab.neuralFastGain);
  if (typeof lab.creatineResponder === 'boolean') out.creatineResponder = lab.creatineResponder;
  if (typeof lab.actn3xx === 'boolean') out.actn3xx = lab.actn3xx;
  return out;
}

export function buildProfile(ctx: SimContext, input: CreatorInput): CharacterProfile {
  const G = ctx.P.genetics;
  const profile: CharacterProfile = {
    sex: input.sex,
    ageYears: clampTo(ctx, 'ageYears', input.ageYears),
    liftingYears: input.liftingYears === undefined ? undefined : clampTo(ctx, 'liftingYears', input.liftingYears),
    enduranceYears: input.enduranceYears === undefined ? undefined : clampTo(ctx, 'enduranceYears', input.enduranceYears),
  };
  if (input.heightCm !== undefined) profile.heightCm = clampTo(ctx, 'heightCm', input.heightCm);
  if (input.bodyFat !== undefined) profile.bodyFat = clampTo(ctx, 'bodyFat', input.bodyFat);
  if (input.ffmi !== undefined) profile.ffmi = clampTo(ctx, 'ffmi', input.ffmi);
  // Segment multipliers scale the population mean fractions (sliders chosen => no random segment noise).
  const anthro: NonNullable<CharacterProfile['anthro']> = {};
  if (input.femurMult !== undefined) anthro.thigh = G.thighFraction * clampTo(ctx, 'femurMult', input.femurMult);
  if (input.torsoMult !== undefined) anthro.torso = G.torsoFraction * clampTo(ctx, 'torsoMult', input.torsoMult);
  if (input.armMult !== undefined) {
    const m = clampTo(ctx, 'armMult', input.armMult);
    anthro.upperArm = G.upperArmFraction * m;
    anthro.forearm = G.forearmFraction * m;
  }
  if (Object.keys(anthro).length > 0) profile.anthro = anthro;
  if (input.mode === 'customLab' && input.lab) profile.genetics = clampLab(ctx, input.sex, input.lab);
  return profile;
}

export function createFromCreator(ctx: SimContext, input: CreatorInput, seed: string | number): CharacterState {
  const state = createCharacter(ctx, buildProfile(ctx, input), seed);
  if (input.mode === 'customLab') state.genetics.revealed = { fiberType: true, responders: true, ceiling: true, metabolism: true };
  return state;
}
