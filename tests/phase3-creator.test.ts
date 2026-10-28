// Phase 3: archetypes, character creator and paid lab tests.
import { describe, expect, it } from 'vitest';
import { ARCHETYPES } from '../data/archetypes';
import { FULL_BODY_WEEK } from '../data/programs';
import { bodyFatFraction, bodyMass, fatFreeMass } from '../engine/body';
import { createCharacter } from '../engine/character';
import { createFromCreator, CreatorInputSchema, visibleSliders, buildProfile, type CreatorInput } from '../engine/creator';
import { LAB_TESTS, labTestCost, runLabTest, type LabTestId } from '../engine/labTests';
import { countermovementJump, vo2maxRel } from '../engine/performance';
import { runDays } from '../engine/runner';
import type { CharacterState } from '../engine/types';
import { ctx, goodPlan } from './helpers';

const P = ctx.P;
const make = (id: string, seed: string | number = 'arch') => {
  const a = ARCHETYPES.find((x) => x.id === id);
  if (!a) throw new Error(`no archetype ${id}`);
  return createCharacter(ctx, a.profile, seed);
};
const all = () => ARCHETYPES.map((a) => ({ a, s: createCharacter(ctx, a.profile, 'arch') }));
const log = (name: string, o: Record<string, number | string>) => console.log(`[creator] ${name}`, JSON.stringify(o, (_k, v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)));

describe('Phase 3 archetypes', () => {
  it('has exactly 12 archetypes with unique ids, backstories and hidden summaries', () => {
    expect(ARCHETYPES).toHaveLength(12);
    expect(new Set(ARCHETYPES.map((a) => a.id)).size).toBe(12);
    for (const a of ARCHETYPES) {
      expect(a.backstory.trim().length).toBeGreaterThan(0);
      expect(a.hiddenSummary.trim().length).toBeGreaterThan(0);
    }
  });

  it('every archetype creates with human-range height, mass and body fat; at least 3 women', () => {
    for (const a of ARCHETYPES) {
      const s = createCharacter(ctx, a.profile, 'arch');
      const mass = bodyMass(s, P), bf = bodyFatFraction(s, P);
      expect(s.anthro.heightCm, a.id).toBeGreaterThan(140);
      expect(s.anthro.heightCm, a.id).toBeLessThan(210);
      expect(mass, a.id).toBeGreaterThan(40);
      expect(mass, a.id).toBeLessThan(130);
      expect(bf, a.id).toBeGreaterThan(0.05);
      expect(bf, a.id).toBeLessThan(0.45);
    }
    expect(ARCHETYPES.filter((a) => a.profile.sex === 'female').length).toBeGreaterThanOrEqual(3);
  });
});

describe('Phase 3 archetype mechanics', () => {
  it('desk worker body fat is above 25%', () => {
    const bf = bodyFatFraction(make('desk_worker'), P);
    log('desk bf', { bf });
    expect(bf).toBeGreaterThan(0.25);
  });

  it('endurance runner has the highest relative VO2max of all 12', () => {
    const v = all().map(({ a, s }) => ({ id: a.id, v: vo2maxRel(ctx, s) }));
    log('vo2', Object.fromEntries(v.map((x) => [x.id, x.v])));
    const top = v.reduce((m, x) => (x.v > m.v ? x : m));
    expect(top.id).toBe('endurance_runner');
  });

  it('former sprinter and tall jumper out-jump the desk worker and the 50-year-old', () => {
    const cmj = (id: string) => countermovementJump(ctx, make(id));
    const lows = [cmj('desk_worker'), cmj('beginner_50')];
    log('cmj', { sprinter: cmj('former_sprinter_35'), jumper: cmj('tall_jumper'), desk: lows[0] as number, fifty: lows[1] as number });
    for (const id of ['former_sprinter_35', 'tall_jumper']) for (const low of lows) expect(cmj(id), id).toBeGreaterThan(low);
  });

  it('detrained wrestler has muscle memory (high-water mark above current mass)', () => {
    const s = make('detrained_wrestler');
    const ms = Object.values(s.muscles);
    const memory = ms.filter((m) => m.highWater > m.mass + 1e-9).length;
    const neural = Object.values(s.patterns).filter((p) => p.highWater > p.neural + 1e-9).length;
    log('wrestler memory', { musclesWithMemory: memory, patternsWithMemory: neural });
    expect(memory).toBeGreaterThan(0);
    expect(neural).toBeGreaterThan(0);
    // control: untrained desk worker has none
    expect(Object.values(make('desk_worker').muscles).filter((m) => m.highWater > m.mass + 1e-9).length).toBe(0);
  });

  it('gymnast has skill above novice on pull_up', () => {
    const g = make('former_gymnast').skills['pull_up'];
    const d = make('desk_worker').skills['pull_up'];
    log('pullup skill', { gym: g?.skill ?? -1, desk: d?.skill ?? -1 });
    expect(g).toBeDefined();
    expect(g!.skill).toBeGreaterThan(d?.skill ?? 0);
    expect(g!.skill).toBeGreaterThan(0.3);
  });

  it('hidden low/high responders look identical but diverge in lean gain after 16 weeks', () => {
    const lo = make('hidden_low_responder'), hi = make('hidden_high_responder');
    expect(lo.sex).toBe(hi.sex);
    expect(lo.ageYears).toBe(hi.ageYears);
    expect(lo.anthro.heightCm).toBe(hi.anthro.heightCm);
    expect(Math.abs(bodyFatFraction(lo, P) - bodyFatFraction(hi, P))).toBeLessThan(0.005);
    expect(Math.abs(bodyMass(lo, P) - bodyMass(hi, P))).toBeLessThan(1);
    const l0 = fatFreeMass(lo, P), h0 = fatFreeMass(hi, P);
    runDays(ctx, lo, goodPlan(FULL_BODY_WEEK), 112);
    runDays(ctx, hi, goodPlan(FULL_BODY_WEEK), 112);
    const gLo = fatFreeMass(lo, P) - l0, gHi = fatFreeMass(hi, P) - h0;
    log('responders', { gLo, gHi, ratio: gHi / gLo });
    expect(gLo).toBeGreaterThan(0);
    expect(gHi).toBeGreaterThan(1.5 * gLo);
  }, 90000);
});

describe('Phase 3 creator', () => {
  it('schema rejects age 17 and 70', () => {
    const base = { sex: 'male', mode: 'random' } as const;
    expect(CreatorInputSchema.safeParse({ ...base, ageYears: 17 }).success).toBe(false);
    expect(CreatorInputSchema.safeParse({ ...base, ageYears: 70 }).success).toBe(false);
    expect(CreatorInputSchema.safeParse({ ...base, ageYears: 30 }).success).toBe(true);
  });

  it('random mode: different seeds give different hidden genetics, same visible sliders', () => {
    const input: CreatorInput = { sex: 'male', ageYears: 28, heightCm: 178, bodyFat: 0.17, ffmi: 19, mode: 'random' };
    const a = createFromCreator(ctx, input, 'seedA'), b = createFromCreator(ctx, input, 'seedB');
    expect(a.sex).toBe(b.sex);
    expect(a.ageYears).toBe(b.ageYears);
    expect(a.anthro.heightCm).toBe(b.anthro.heightCm);
    expect(bodyFatFraction(a, P)).toBeCloseTo(bodyFatFraction(b, P), 2);
    const keys = ['responderHyp', 'responderStr', 'typeIVL', 'ffmiCeiling'] as const;
    expect(keys.some((k) => a.genetics[k] !== b.genetics[k])).toBe(true);
    expect(a.genetics.revealed).toEqual({ fiberType: false, responders: false, ceiling: false, metabolism: false });
  });

  it('customLab mode reveals all flags and honours clamped overrides', () => {
    const s = createFromCreator(ctx, { sex: 'male', ageYears: 25, mode: 'customLab', lab: { responderHyp: 1.3, typeIVL: 1000, ffmiCeiling: 99 } }, 'lab');
    expect(s.genetics.revealed).toEqual({ fiberType: true, responders: true, ceiling: true, metabolism: true });
    expect(s.genetics.responderHyp).toBeCloseTo(1.3, 6);
    expect(s.genetics.typeIVL).toBe(P.genetics.typeIMax);
    expect(s.genetics.ffmiCeiling).toBe(P.model.ffmiCeilingMaxMen);
    const low = createFromCreator(ctx, { sex: 'female', ageYears: 25, mode: 'customLab', lab: { responderStr: -5 } }, 'lab');
    expect(low.genetics.responderStr).toBe(P.genetics.creatorMultiplierMin);
  });

  it('femurMult slider raises anthro.thigh', () => {
    const f = visibleSliders(ctx).find((x) => x.id === 'femurMult')!;
    const base = createFromCreator(ctx, { sex: 'male', ageYears: 25, femurMult: 1, mode: 'random' }, 's');
    const long = createFromCreator(ctx, { sex: 'male', ageYears: 25, femurMult: f.max, mode: 'random' }, 's');
    expect(buildProfile(ctx, { sex: 'male', ageYears: 25, femurMult: f.max, mode: 'random' }).anthro?.thigh).toBeGreaterThan(P.genetics.thighFraction);
    expect(long.anthro.thigh).toBeGreaterThan(base.anthro.thigh);
  });
});

describe('Phase 3 lab tests', () => {
  const subject = (seed: string | number = 'lab'): CharacterState => createFromCreator(ctx, { sex: 'male', ageYears: 27, heightCm: 178, bodyFat: 0.2, ffmi: 19, mode: 'random' }, seed);

  it('biopsy reveals fiber type, reading within 15 points of truth', () => {
    const s = subject();
    expect(s.genetics.revealed.fiberType).toBe(false);
    const r = runLabTest(ctx, s, 'biopsy', 'lab', 10);
    expect(s.genetics.revealed.fiberType).toBe(true);
    expect(Math.abs((r.readings.typeIPct as number) - s.genetics.typeIVL)).toBeLessThan(15);
  });

  it('biopsy noise is unbiased: mean of 50 readings within 2 points', () => {
    const s = subject();
    let sum = 0;
    for (let i = 0; i < 50; i++) sum += runLabTest(ctx, s, 'biopsy', `seed${i}`, i).readings.typeIPct as number;
    const m = sum / 50;
    log('biopsy mean', { mean: m, truth: s.genetics.typeIVL });
    expect(Math.abs(m - s.genetics.typeIVL)).toBeLessThan(2);
  });

  it('DXA body fat within +-5 percentage points of truth', () => {
    const s = subject();
    const r = runLabTest(ctx, s, 'dxa', 'lab', 3);
    expect(Math.abs((r.readings.bodyFatPct as number) - bodyFatFraction(s, P) * 100)).toBeLessThanOrEqual(5);
  });

  it('blood panel returns ferritin and vitamin D', () => {
    const r = runLabTest(ctx, subject(), 'bloodPanel', 'lab', 3);
    expect(r.readings.ferritinNgMl).toBeGreaterThan(0);
    expect(r.readings.vitDNgMl).toBeGreaterThan(0);
  });

  it('responseProfile reveals responders', () => {
    const s = subject();
    expect(s.genetics.revealed.responders).toBe(false);
    const r = runLabTest(ctx, s, 'responseProfile', 'lab', 3);
    expect(r.revealedFlags.responders).toBe(true);
    expect(s.genetics.revealed.responders).toBe(true);
    expect(r.readings.responderHyp).toBeGreaterThan(0);
  });

  it('every test costs >= 0 and the biopsy is the most expensive', () => {
    const costs = LAB_TESTS.map((t) => [t.id, labTestCost(ctx, t.id as LabTestId)] as const);
    log('costs', Object.fromEntries(costs));
    for (const [, c] of costs) expect(c).toBeGreaterThanOrEqual(0);
    const biopsy = labTestCost(ctx, 'biopsy');
    for (const [id, c] of costs) if (id !== 'biopsy') expect(biopsy, id).toBeGreaterThan(c);
  });
});
