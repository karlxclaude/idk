import type { IntakeTarget, WeeklyPlan } from '../../engine/plan';

export function goodPlan(week: WeeklyPlan['week'], intake: Partial<IntakeTarget> = {}): WeeklyPlan {
  return {
    week, sleepH: 8, bedHour: 23,
    intake: { balanceKcal: 250, proteinGkg: 1.8, ...intake },
    disableRandomEvents: true,
    supplements: { vitDIU: 1000 },
  };
}
