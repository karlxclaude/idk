// Phase 4 integration: game state, economy, access, labs, determinism, speed.
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../data/archetypes';
import { availableExercises, exerciseAllowed, financialStress, InsufficientFundsError, monthlyFixedCosts, post, newLedger } from '../engine/economy';
import {
  advanceDay, advanceDays, buyCertification, buyHomeGym, buyLabTest, buyMembership, cancelMembership, ctxForGame, mealPlanForKcal, newGame,
  setPlan, weeklyGroceryRun, type GameState,
} from '../engine/game';
import { CertificationRequiredError } from '../engine/jobs';
import { bodyMass } from '../engine/body';
import { ctx } from './helpers';

const DAYS = 28;
const DAYS_PER_WEEK = 7;

function weeklyNet(g: GameState): number[] {
  const out: number[] = [];
  for (let w = 0; w * DAYS_PER_WEEK < DAYS; w++) {
    out.push(g.ledger.entries.filter((e) => e.day >= w * DAYS_PER_WEEK && e.day < (w + 1) * DAYS_PER_WEEK).reduce((a, e) => a + e.amount, 0));
  }
  return out;
}

describe('newGame + advanceDays for every archetype', () => {
  for (const a of ARCHETYPES) {
    it(`${a.id}: 28 days, plausible cash`, () => {
      const g = newGame(ctx, { archetypeId: a.id, seed: `g-${a.id}` });
      const start = g.ledger.cash;
      advanceDays(ctx, g, DAYS);
      expect(g.character.day).toBe(DAYS);
      expect(g.history).toHaveLength(DAYS);
      const net = weeklyNet(g);
      const mass = bodyMass(g.character, ctx.P);
      expect(Number.isFinite(mass)).toBe(true);
      expect(Number.isFinite(g.ledger.cash)).toBe(true);
      // Default job (data entry, above minimum wage) must be self-supporting.
      expect(net.every((n) => n > 0)).toBe(true);
      console.log(`${a.id.padEnd(24)} cash ${start} -> ${g.ledger.cash.toFixed(0)}  weekly net ${net.map((n) => n.toFixed(0)).join(' / ')}  mass ${mass.toFixed(1)} kg  kcal in/out ${g.history.at(-1)?.kcalIn.toFixed(0)}/${g.history.at(-1)?.kcalOut.toFixed(0)}`);
    });
  }

  it('without a job cash falls with rent and food', () => {
    const g = newGame(ctx, { archetypeId: 'beginner_50', seed: 'nojob' });
    setPlan(ctx, g, { job: null });
    const start = g.ledger.cash;
    advanceDays(ctx, g, DAYS);
    const fixed = monthlyFixedCosts(ctx, g.access, g.plan.supplements, g.plan.coaching);
    const rentLike = (fixed / ctx.P.economy.daysPerMonth) * DAYS;
    const income = g.ledger.entries.filter((e) => e.category === 'income').length;
    expect(income).toBe(0);
    expect(g.ledger.cash).toBeLessThan(start - rentLike);
    console.log(`no job: cash ${start} -> ${g.ledger.cash.toFixed(0)}  (fixed costs alone ${rentLike.toFixed(0)}; weekly net ${weeklyNet(g).map((n) => n.toFixed(0)).join(' / ')})`);
  });

  it('a minimum-wage-class job (retail stocking) nets near zero or better per week', () => {
    const g = newGame(ctx, { archetypeId: 'desk_worker', seed: 'retail' });
    setPlan(ctx, g, { job: { id: 'retail_stocking', performanceMode: ctx.P.economy.defaultJobPerformance } });
    advanceDays(ctx, g, DAYS);
    const net = weeklyNet(g);
    console.log(`retail stocking weekly net ${net.map((n) => n.toFixed(0)).join(' / ')}  cash ${g.ledger.cash.toFixed(0)}`);
    for (const n of net) expect(n).toBeGreaterThan(-ctx.P.economy.rentMonthly / 4);
    expect(net.reduce((a, b) => a + b, 0)).toBeGreaterThan(0);
  });
});

describe('determinism and serialization', () => {
  it('same seed + inputs -> deep-equal state after 28 days; state survives JSON and structuredClone', () => {
    const run = () => {
      const g = newGame(ctx, { archetypeId: 'former_gymnast', seed: 'det' });
      advanceDays(ctx, g, DAYS, { jobPerformance: 0.8 });
      return g;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);
    expect(structuredClone(a)).toEqual(a);
    // JSON round trip (DayReport.tdee.adaptive can be -0, which JSON writes as 0, so compare the serialized forms).
    expect(JSON.stringify(JSON.parse(JSON.stringify(a)))).toBe(JSON.stringify(a));
    // A restored game continues identically.
    const c = JSON.parse(JSON.stringify(a)) as GameState;
    advanceDays(ctx, a, DAYS_PER_WEEK);
    advanceDays(ctx, c, DAYS_PER_WEEK);
    expect(JSON.stringify(c)).toBe(JSON.stringify(a));
  });
});

describe('gym access', () => {
  const strongmanEx = availableExercises(['strongman']).find((e) => e.gymTier === 'strongman');
  it('budget blocks a strongman exercise, strongman membership allows it', () => {
    expect(strongmanEx).toBeDefined();
    const id = (strongmanEx as { id: string }).id;
    expect(exerciseAllowed(['budget'], id)).toBe(false);
    expect(exerciseAllowed(['strongman'], id)).toBe(true);
    expect(exerciseAllowed(['commercial'], 'bench_press')).toBe(true);
    expect(exerciseAllowed(['budget'], 'leg_press')).toBe(false);
    expect(exerciseAllowed(['powerlifting'], 'leg_press')).toBe(true);
    expect(exerciseAllowed([], 'pull_up')).toBe(true); // bodyweight is always available
    expect(availableExercises(['strongman']).length).toBeGreaterThan(availableExercises(['budget']).length);
  });

  it('advanceDay drops sessions the character cannot access, memberships upgrade', () => {
    const g = newGame(ctx, { archetypeId: 'desk_worker', seed: 'access' });
    cancelMembership(g, 'commercial');
    buyMembership(g, 'budget');
    const r = advanceDay(ctx, g); // day 0 is a training day with commercial-only exercises
    expect(r.report.events.some((e) => e.includes('unavailable'))).toBe(true);
    expect(r.report.sets.every((s) => exerciseAllowed(g.access, s.exerciseId))).toBe(true);
    buyMembership(g, 'powerlifting');
    expect(g.access).not.toContain('budget');
    expect(g.access).toContain('powerlifting');
    expect(monthlyFixedCosts(ctx, ['commercial'], ['creatine'], false)).toBe(
      ctx.P.economy.rentMonthly + ctx.P.economy.utilitiesMonthly + ctx.P.economy.gymCommercialMonthly + ctx.P.economy.creatineMonthly,
    );
  });

  it('home gym purchase charges once and refuses when broke', () => {
    const g = newGame(ctx, { archetypeId: 'desk_worker', seed: 'home' });
    g.ledger.cash = ctx.P.economy.homeGymBasicCost - 1;
    expect(() => buyHomeGym(ctx, g, 'homeBasic')).toThrow(InsufficientFundsError);
    g.ledger.cash = ctx.P.economy.homeGymBasicCost + 5;
    buyHomeGym(ctx, g, 'homeBasic');
    expect(g.ledger.cash).toBeCloseTo(5);
    expect(g.access).toContain('homeBasic');
  });
});

describe('lab tests and certification', () => {
  it('charges cash, sets the revealed flag, stores the result; refuses when broke', () => {
    const g = newGame(ctx, { archetypeId: 'hidden_low_responder', seed: 'lab' });
    const cost = ctx.P.economy.testBiopsyCost;
    const before = g.ledger.cash;
    expect(g.character.genetics.revealed.fiberType).toBe(false);
    const res = buyLabTest(ctx, g, 'biopsy');
    expect(res.readings.typeIPct).toBeGreaterThan(0);
    expect(g.ledger.cash).toBeCloseTo(before - cost);
    expect(g.character.genetics.revealed.fiberType).toBe(true);
    expect(g.labResults).toHaveLength(1);
    g.ledger.cash = cost - 1;
    g.character.genetics.revealed.fiberType = false;
    expect(() => buyLabTest(ctx, g, 'biopsy')).toThrow(InsufficientFundsError);
    expect(g.ledger.cash).toBeCloseTo(cost - 1);
    expect(g.character.genetics.revealed.fiberType).toBe(false);
    expect(g.labResults).toHaveLength(1);
  });

  it('personal trainer needs a paid certification', () => {
    const g = newGame(ctx, { archetypeId: 'desk_worker', seed: 'pt' });
    expect(() => setPlan(ctx, g, { job: { id: 'personal_trainer', performanceMode: 0.7 } })).toThrow(CertificationRequiredError);
    buyCertification(ctx, g, 'personal_trainer');
    expect(g.certifications).toContain('personal_trainer');
    setPlan(ctx, g, { job: { id: 'personal_trainer', performanceMode: 0.7 } });
    advanceDays(ctx, g, DAYS_PER_WEEK);
    expect(g.ledger.entries.some((e) => e.category === 'income')).toBe(true);
  });
});

describe('financial stress', () => {
  it('rises as the cash runway falls and feeds the character stress', () => {
    const monthly = monthlyFixedCosts(ctx, ['commercial'], [], false);
    expect(financialStress(ctx, monthly * 3, monthly)).toBe(0);
    const mid = financialStress(ctx, monthly / 2, monthly);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(financialStress(ctx, 0, monthly)).toBe(1);
    expect(financialStress(ctx, -50, monthly)).toBe(1);
    expect(financialStress(ctx, monthly / 4, monthly)).toBeGreaterThan(mid);

    const run = (cash: number) => {
      const g = newGame(ctx, { archetypeId: 'desk_worker', seed: 'fin' });
      setPlan(ctx, g, { job: null });
      g.ledger.cash = cash;
      advanceDays(ctx, g, 20);
      return g;
    };
    const broke = run(0);
    const rich = run(1e6);
    expect(broke.history.at(-1)?.financialStress).toBe(1);
    expect(rich.history.at(-1)?.financialStress).toBe(0);
    expect(broke.character.fatigue.stress).toBeGreaterThan(rich.character.fatigue.stress);
  });

  it('ledger posts move cash', () => {
    const l = newLedger(100);
    post(l, 3, -40, 'rent', 'x');
    expect(l.cash).toBe(60);
    expect(l.entries[0]).toEqual({ day: 3, amount: -40, category: 'rent', note: 'x' });
  });
});

describe('speed', () => {
  it('365 days run in under ~3 s', () => {
    const g = newGame(ctx, { archetypeId: 'stocky_powerlifter_build', seed: 'speed' });
    const t0 = performance.now();
    advanceDays(ctx, g, 365);
    const ms = performance.now() - t0;
    console.log(`365 days: ${ms.toFixed(0)} ms, cash ${g.ledger.cash.toFixed(0)}, ledger entries ${g.ledger.entries.length}, reports ${g.reports.length}`);
    expect(ms).toBeLessThan(3000);
    expect(g.reports.length).toBeLessThanOrEqual(ctx.P.economy.reportsKept);
  });
});

describe('meals feed intake', () => {
  it('a vegan meal plan has lower protein quality than the omnivore plan', () => {
    const kcal = 2800;
    const make = (template: string) => {
      const g = newGame(ctx, { archetypeId: 'hidden_high_responder', seed: 'meals' });
      g.plan.meals = mealPlanForKcal(ctx, template, kcal, bodyMass(g.character, ctx.P));
      advanceDays(ctx, g, DAYS_PER_WEEK);
      return g;
    };
    const omni = make('Omnivore training day');
    const vegan = make('Vegan day');
    const qo = omni.lastIntake?.proteinQuality ?? 0;
    const qv = vegan.lastIntake?.proteinQuality ?? 0;
    console.log(`protein quality omnivore ${qo.toFixed(3)} vs vegan ${qv.toFixed(3)}; intake kcal ${omni.reports.at(-1)?.intakeKcal.toFixed(0)} / ${vegan.reports.at(-1)?.intakeKcal.toFixed(0)}`);
    expect(qv).toBeLessThan(qo);
    expect(vegan.reports.at(-1)?.intakeKcal).toBeCloseTo(kcal, -2);
  });

  it('weekly grocery run buys the list once and the pantry then covers the week', () => {
    const g = newGame(ctx, { archetypeId: 'hidden_high_responder', seed: 'shop' });
    const usd = weeklyGroceryRun(ctx, g);
    expect(usd).toBeGreaterThan(0);
    const cashAfterShop = g.ledger.cash;
    advanceDays(ctx, g, DAYS_PER_WEEK);
    // Perishables can spoil before use, so a few top-ups are possible, but far less than buying everything daily.
    const topUps = g.ledger.entries.filter((e) => e.category === 'groceries').slice(1).reduce((a, e) => a - e.amount, 0);
    console.log(`week shop $${usd.toFixed(0)}, top-ups during the week $${topUps.toFixed(0)}, cash after shop ${cashAfterShop.toFixed(0)}`);
    expect(topUps).toBeLessThan(usd / 2);
    expect(weeklyGroceryRun(ctx, g)).toBeLessThan(usd);
    expect(ctxForGame(g).P.economy.acceleratedGainMultiplier).toBeDefined();
  });
});
