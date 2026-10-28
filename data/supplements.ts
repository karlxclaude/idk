// Supplement catalog (Phase 4). Evidence tiers follow the IOC consensus (Maughan 2018).
import type { DayInputs } from '../engine/types';

type Sup = DayInputs['supplements'];

export interface Supplement {
  id: string;
  name: string;
  category: 'evidence' | 'conditional' | 'useless';
  dose: string;
  /** Key in the economy constants (monthly USD). */
  costConstantId: string;
  /** Returns the updated supplement inputs, or null when the engine has no effect to apply. */
  apply: (s: Sup) => Sup | null;
  caffeineMgPerKg?: number;
  evidence: string;
  sourceIds: string[];
  effectSummary: string;
}

export const SUPPLEMENTS: Supplement[] = [
  {
    id: 'creatine', name: 'Creatine monohydrate', category: 'evidence',
    dose: '5 g/day (or loading 20 g/day for 5-7 days, then 5 g/day)', costConstantId: 'creatineMonthly',
    apply: (s) => ({ ...s, creatine: true }),
    evidence: 'Creatine monohydrate is the best-supported ergogenic supplement for strength and lean mass (Kreider 2017); the IOC consensus (Maughan 2018) lists it as evidence-backed. Roughly a quarter of people are non-responders.',
    sourceIds: ['kreider2017', 'maughan2018'],
    effectSummary: 'Muscle creatine saturates over about 4 weeks (about 1 week loading); small strength and power boost plus 0.5-1 kg of water.',
  },
  {
    id: 'caffeine', name: 'Caffeine', category: 'evidence',
    dose: '3-6 mg/kg, 30-60 min before training', costConstantId: 'caffeineMonthly',
    apply: () => null, // dosed through the plan's caffeine schedule, not a supplement flag
    caffeineMgPerKg: 4,
    evidence: 'Caffeine improves muscular strength, power and endurance at 3-6 mg/kg (Grgic 2018; Guest 2021 ISSN position stand). Tolerance blunts the effect in habitual users and evening doses cost sleep.',
    sourceIds: ['grgic2018caffeine', 'guest2021', 'maughan2018'],
    effectSummary: 'Acute strength, power and endurance boost scaled by dose and habituation; evening doses reduce sleep.',
  },
  {
    id: 'betaAlanine', name: 'Beta-alanine', category: 'evidence',
    dose: '4-6 g/day split into doses, 4+ weeks', costConstantId: 'betaAlanineMonthly',
    apply: (s) => ({ ...s, betaAlanine: true }),
    evidence: 'Saunders 2017 meta-analysis: small benefit (about 2-3%) in 0.5-10 minute high-intensity efforts after several weeks of loading; little for strength or longer events.',
    sourceIds: ['saunders2017', 'hobson2012', 'maughan2018'],
    effectSummary: 'Muscle carnosine loads over about 4 weeks; small gain in 0.5-10 min efforts.',
  },
  {
    id: 'nitrate', name: 'Dietary nitrate (beetroot)', category: 'evidence',
    dose: '~6-8 mmol nitrate (about 500 mL beetroot juice) 2-3 h before', costConstantId: 'nitrateMonthly',
    apply: (s) => ({ ...s, nitrate: true }),
    evidence: 'Jones 2014: nitrate lowers the oxygen cost of exercise and modestly improves endurance performance, mostly in recreational rather than elite athletes.',
    sourceIds: ['jones2014', 'maughan2018'],
    effectSummary: 'Small endurance-economy benefit in sub-elite athletes.',
  },
  {
    id: 'bicarb', name: 'Sodium bicarbonate', category: 'evidence',
    dose: '0.2-0.3 g/kg, 60-180 min before high-intensity efforts', costConstantId: 'bicarbMonthly',
    apply: (s) => ({ ...s, bicarb: true }),
    evidence: 'Grgic 2021 meta-analysis: bicarbonate improves high-intensity exercise performance by buffering acidosis, at the cost of frequent GI distress.',
    sourceIds: ['grgic2021bicarb', 'maughan2018'],
    effectSummary: 'Small gain in 1-10 min high-intensity efforts; GI side effects.',
  },
  {
    id: 'vitD', name: 'Vitamin D', category: 'conditional',
    dose: '2000 IU/day', costConstantId: 'vitDMonthly',
    apply: (s) => ({ ...s, vitDIU: 2000 }),
    evidence: 'Helps only when 25(OH)D is low (below 20 ng/mL, IOM 2011); winter at northern latitudes is the usual cause. Supplementing a sufficient person adds nothing (Maughan 2018).',
    sourceIds: ['ross2011', 'iom2011', 'heaney2003', 'maughan2018'],
    effectSummary: 'Raises 25(OH)D; removes a small muscle and bone penalty only if deficient.',
  },
  {
    id: 'iron', name: 'Iron', category: 'conditional',
    dose: '~30-65 mg elemental iron/day, only after a ferritin test', costConstantId: 'ironMonthly',
    apply: (s) => ({ ...s, ironMg: 40 }),
    evidence: 'Iron corrects deficiency and anemia (common in female and distance athletes) and restores VO2max; it does nothing for iron-replete athletes and can cause GI harm (Maughan 2018).',
    sourceIds: ['maughan2018'],
    effectSummary: 'Refills iron stores and hemoglobin if depleted; otherwise no benefit.',
  },
  {
    id: 'b12', name: 'Vitamin B12', category: 'conditional',
    dose: '~25-100 ug/day (vegans, low animal-food intake)', costConstantId: 'b12Monthly',
    apply: (s) => ({ ...s, b12: true }),
    evidence: 'Needed for people eating little animal food; deficiency causes anemia. No performance benefit when intake is adequate (Maughan 2018).',
    sourceIds: ['maughan2018'],
    effectSummary: 'Prevents or reverses B12 depletion and related anemia; no effect otherwise.',
  },
  {
    id: 'magnesium', name: 'Magnesium', category: 'conditional',
    dose: '~200-350 mg/day', costConstantId: 'magnesiumMonthly',
    apply: (s) => ({ ...s, magnesium: true }),
    evidence: 'Corrects low magnesium status when dietary intake is below the RDA; supplementation in replete people shows no ergogenic effect (Maughan 2018).',
    sourceIds: ['maughan2018'],
    effectSummary: 'Lifts magnesium status toward the RDA; only matters if intake is low.',
  },
  {
    id: 'bcaa', name: 'BCAAs', category: 'useless',
    dose: '5-10 g/day (not recommended)', costConstantId: 'bcaaMonthly',
    apply: () => null,
    evidence: 'With adequate protein, BCAAs add nothing: whole proteins already supply them, and isolated BCAAs do not stimulate muscle protein synthesis maximally.',
    sourceIds: ['maughan2018'],
    effectSummary: 'No effect when protein intake is adequate.',
  },
  {
    id: 'testBooster', name: 'Test boosters', category: 'useless',
    dose: 'Per label (not recommended)', costConstantId: 'testBoosterMonthly',
    apply: () => null,
    evidence: 'Over-the-counter testosterone boosters (tribulus, ZMA, fenugreek) do not raise testosterone or lean mass in healthy men; the IOC consensus (Maughan 2018) finds no support.',
    sourceIds: ['maughan2018'],
    effectSummary: 'No physiological effect.',
  },
  {
    id: 'fatBurner', name: 'Fat burners', category: 'useless',
    dose: 'Per label (not recommended)', costConstantId: 'fatBurnerMonthly',
    apply: () => null,
    evidence: 'Fat burners are mostly caffeine plus filler; the thermogenic effect is trivial next to a calorie deficit, so you pay supplement prices for coffee.',
    sourceIds: ['maughan2018'],
    effectSummary: 'No meaningful fat loss beyond the caffeine they contain.',
  },
  {
    id: 'glutamine', name: 'Glutamine', category: 'useless',
    dose: '5-10 g/day (not recommended)', costConstantId: 'glutamineMonthly',
    apply: () => null,
    evidence: 'Glutamine does not improve muscle growth, strength or recovery in healthy people who eat enough protein; the gut and muscle already have plenty.',
    sourceIds: ['maughan2018'],
    effectSummary: 'No effect on hypertrophy or recovery.',
  },
  {
    id: 'hmb', name: 'HMB', category: 'useless',
    dose: '3 g/day', costConstantId: 'hmbMonthly',
    apply: () => null,
    evidence: 'HMB may help untrained or older people, but the effect is trivial in trained lifters with adequate protein and training (Maughan 2018).',
    sourceIds: ['maughan2018'],
    effectSummary: 'Trivial effect in trained people.',
  },
];
