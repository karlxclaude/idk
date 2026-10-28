// Paid lab tests that reveal hidden traits, with measurement error. Noise streams are keyed by (seed, day, 'lab', test).
import type { SimContext } from './context';
import { bodyFatFraction, fatFreeMass, normalizedFfmi, heightM } from './body';
import { vo2maxRel } from './performance';
import { streamRng } from './rng';
import type { CharacterState, Genetics } from './types';

export type LabTestId = 'biopsy' | 'labVo2max' | 'dxa' | 'bloodPanel' | 'responseProfile';
export type RevealFlags = Partial<Genetics['revealed']>;

export interface LabTestMeta {
  id: LabTestId;
  name: string;
  /** Dotted path into ctx.P (group.key) of the cost constant. */
  costConstantId: string;
  reveals: ReadonlyArray<keyof Genetics['revealed']>;
  note: string;
}

export const LAB_TESTS: readonly LabTestMeta[] = [
  { id: 'biopsy', name: 'Muscle biopsy (vastus lateralis)', costConstantId: 'economy.testBiopsyCost', reveals: ['fiberType'], note: 'Type I % with a few points of sampling error.' },
  { id: 'labVo2max', name: 'Laboratory VO2max', costConstantId: 'economy.testVo2LabCost', reveals: [], note: 'Relative VO2max with ~3% error; reveals no hidden flag.' },
  { id: 'dxa', name: 'DXA scan', costConstantId: 'economy.testDxaCost', reveals: ['ceiling'], note: 'Body fat, lean mass and FFMI. The FFMI ceiling is only read out after about 2 years of training (genetics.labCeilingMinTrainingHours); before that only the current FFMI is shown.' },
  { id: 'bloodPanel', name: 'Blood panel', costConstantId: 'economy.testBloodPanelCost', reveals: [], note: 'Ferritin and 25(OH)D with small noise.' },
  { id: 'responseProfile', name: 'Genetic and metabolic panel', costConstantId: 'genetics.labResponseProfileCost', reveals: ['responders', 'metabolism'], note: 'HEUR / design: real DNA tests predict training response poorly, so readouts are very noisy.' },
];

export interface LabResult {
  readings: Record<string, number>;
  revealedFlags: RevealFlags;
}

export function labTestCost(ctx: SimContext, testId: LabTestId): number {
  const meta = LAB_TESTS.find((t) => t.id === testId);
  if (!meta) throw new Error(`unknown lab test ${testId}`);
  const [group, key] = meta.costConstantId.split('.') as [string, string];
  return ((ctx.P as unknown as Record<string, Record<string, number>>)[group] as Record<string, number>)[key] as number;
}

export function runLabTest(ctx: SimContext, state: CharacterState, testId: LabTestId, seed: string | number, day: number): LabResult {
  const { P } = ctx;
  const G = P.genetics;
  const rng = streamRng(seed, day, `lab|${testId}`);
  const g = state.genetics;
  const readings: Record<string, number> = {};
  const revealedFlags: RevealFlags = {};
  const noisy = (v: number, cv: number): number => v * Math.max(0, rng.normal(1, cv));

  switch (testId) {
    case 'biopsy': {
      readings.typeIPct = Math.min(G.typeIMax, Math.max(G.typeIMin, rng.normal(g.typeIVL, G.labBiopsyTypeISd)));
      revealedFlags.fiberType = true;
      break;
    }
    case 'labVo2max': {
      readings.vo2maxRel = noisy(vo2maxRel(ctx, state), G.labVo2ErrorSd);
      break;
    }
    case 'dxa': {
      const toPct = 100;
      readings.bodyFatPct = Math.max(0, bodyFatFraction(state, P) * toPct + rng.normal(0, P.energy.dxaErrorSd));
      const lean = noisy(fatFreeMass(state, P), G.labDxaLeanErrorSd);
      readings.leanMassKg = lean;
      const h = heightM(state);
      readings.ffmi = lean / (h * h);
      readings.ffmiNormalized = normalizedFfmi(state, P) * (lean / fatFreeMass(state, P));
      if (state.trainingHours >= G.labCeilingMinTrainingHours) {
        readings.ffmiCeiling = rng.normal(g.ffmiCeiling, G.labCeilingNoiseSd);
        revealedFlags.ceiling = true;
      }
      break;
    }
    case 'bloodPanel': {
      readings.ferritinNgMl = noisy(state.nutrition.ironStoreMg / G.labFerritinMgPerNgMl, G.labFerritinNoiseCv);
      readings.vitDNgMl = noisy(state.nutrition.vitDngml, G.labVitDNoiseCv);
      break;
    }
    case 'responseProfile': {
      readings.responderHyp = noisy(g.responderHyp, G.labResponseNoiseSd);
      readings.responderStr = noisy(g.responderStr, G.labResponseNoiseSd);
      readings.responderAer = noisy(g.responderAer, G.labResponseNoiseSd);
      readings.bmrFactor = noisy(g.bmrFactor, G.labBmrNoiseSd);
      revealedFlags.responders = true;
      revealedFlags.metabolism = true;
      break;
    }
  }
  Object.assign(g.revealed, revealedFlags);
  return { readings, revealedFlags };
}
