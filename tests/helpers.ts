import { makeContext, type SimContext } from '../engine/context';
import { createCharacter, type CharacterProfile } from '../engine/character';
import type { WeeklyPlan, IntakeTarget } from '../engine/plan';
import type { CharacterState, Session } from '../engine/types';
import { quantile, mean } from '../engine/math';

export const ctx: SimContext = makeContext();

/** Average-responder untrained man: median genetics, lean-ish. */
export function averageMan(over: Partial<CharacterProfile> = {}, seed = 'avg'): CharacterState {
  return createCharacter(ctx, {
    sex: 'male', ageYears: 22, heightCm: 177, ffmi: 18.5, bodyFat: 0.16,
    genetics: { responderHyp: 1, responderStr: 1, responderAer: 1, ffmiCeiling: 23.5, injuryProneness: 1, creatineResponder: true, typeIVL: 50, bmrFactor: 1, neatResponsiveness: 0.33, noviceSkill: 0.3, neuralFastGain: 0.1 },
    ...over,
  }, seed);
}

export function goodPlan(week: Array<{ sessions: Session[] }>, intake: Partial<IntakeTarget> = {}, extra: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    week, sleepH: 8, bedHour: 23,
    intake: { balanceKcal: 250, proteinGkg: 1.8, ...intake },
    disableRandomEvents: true,
    supplements: { vitDIU: 1000 },
    ...extra,
  };
}

export function pct(a: number, b: number): number {
  return (b / a - 1) * 100;
}

export function summary(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return { min: s[0] as number, p05: quantile(s, 0.05), median: quantile(s, 0.5), mean: mean(s), p95: quantile(s, 0.95), max: s[s.length - 1] as number };
}
