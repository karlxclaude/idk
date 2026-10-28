// Job definitions (spec 8, phase 4). Wages and METs are NOT duplicated here: each job names the key of the
// economy constant (data/constants/economy.ts) that holds its default wage and its 2024 Adult Compendium MET
// (source id `herrmann2024`, Herrmann et al. 2024, J Sport Health Sci), so both stay configurable through Params.
import type { Params } from './constants';
import { design } from './constants/define';

export type JobId = 'warehouse_picker' | 'bike_delivery' | 'line_cook' | 'retail_stocking' | 'data_entry' | 'construction_labor' | 'personal_trainer';
export type MiniGameId = 'spatial_packing' | 'route_timing' | 'rhythm_timing' | 'sorting' | 'typing_accuracy' | 'load_balance' | 'client_programming';
type EconomyKey = keyof Params['economy'];

export interface JobDef {
  id: JobId;
  name: string;
  miniGame: MiniGameId;
  /** Economy constant holding the default hourly wage (config value; MA minimum wage or typical MA rate). */
  wageKey: EconomyKey;
  /** Economy constant holding the Compendium MET for the work. */
  metKey: EconomyKey;
  /** Compendium source id (data/sources.json). */
  metSourceId: 'herrmann2024';
  shiftHours: number;
  shiftsPerWeek: number;
  /** Shift start hour of day. */
  startHour: number;
  /** Injury / fatigue exposure 0..1. */
  strain: number;
  /** Psychological stress load 0..1. */
  stress: number;
  /** Exercise-schema tissue ids loaded by the work. */
  riskTissues: string[];
  /** Cycling counted as cardio (replaces that part of the job MET hours). */
  aerobicStimulus?: { exerciseId: string; minutesPerShift: number; zone: 1 | 2 | 3 };
  /** 0..1 extra leg-recovery cost (interference with leg training). */
  legRecoveryCost?: number;
  requiresCertification?: boolean;
  /** Economy constant holding the certification price. */
  certificationCostKey?: EconomyKey;
  note: string;
}

export const JOBS: readonly JobDef[] = [
  { id: 'warehouse_picker', name: 'Warehouse picker', miniGame: 'spatial_packing', wageKey: 'wageWarehouse', metKey: 'metWarehouse', metSourceId: 'herrmann2024', shiftHours: 8, shiftsPerWeek: 5, startHour: 7, strain: 0.6, stress: 0.4, riskTissues: ['lowBack', 'shoulder', 'knee'], note: 'High MET, repeated lifting: back-injury risk.' },
  { id: 'bike_delivery', name: 'Bike delivery', miniGame: 'route_timing', wageKey: 'wageDelivery', metKey: 'metDelivery', metSourceId: 'herrmann2024', shiftHours: 6, shiftsPerWeek: 5, startHour: 11, strain: 0.4, stress: 0.5, riskTissues: ['knee', 'achilles', 'wrist'], aerobicStimulus: { exerciseId: 'stationary_bike', minutesPerShift: 180, zone: 1 }, legRecoveryCost: 0.5, note: 'Burns calories, builds aerobic base (cycling Z1), taxes the legs.' },
  { id: 'line_cook', name: 'Line cook', miniGame: 'rhythm_timing', wageKey: 'wageLineCook', metKey: 'metLineCook', metSourceId: 'herrmann2024', shiftHours: 9, shiftsPerWeek: 5, startHour: 15, strain: 0.45, stress: 0.7, riskTissues: ['lowBack', 'calf', 'wrist'], note: 'Long standing shifts, time pressure.' },
  { id: 'retail_stocking', name: 'Retail stocking', miniGame: 'sorting', wageKey: 'wageRetail', metKey: 'metRetail', metSourceId: 'herrmann2024', shiftHours: 7, shiftsPerWeek: 5, startHour: 6, strain: 0.3, stress: 0.3, riskTissues: ['lowBack', 'shoulder'], note: 'Light-moderate lifting and walking.' },
  { id: 'data_entry', name: 'Data entry', miniGame: 'typing_accuracy', wageKey: 'wageDataEntry', metKey: 'metDataEntry', metSourceId: 'herrmann2024', shiftHours: 8, shiftsPerWeek: 5, startHour: 9, strain: 0.1, stress: 0.3, riskTissues: ['wrist', 'shoulder'], note: 'Sedentary, low NEAT.' },
  { id: 'construction_labor', name: 'Construction labor', miniGame: 'load_balance', wageKey: 'wageConstruction', metKey: 'metConstruction', metSourceId: 'herrmann2024', shiftHours: 9, shiftsPerWeek: 5, startHour: 6, strain: 0.85, stress: 0.5, riskTissues: ['lowBack', 'knee', 'shoulder', 'elbow'], note: 'Heavy, high fatigue.' },
  { id: 'personal_trainer', name: 'Personal trainer', miniGame: 'client_programming', wageKey: 'wagePersonalTrainer', metKey: 'metPersonalTrainer', metSourceId: 'herrmann2024', shiftHours: 6, shiftsPerWeek: 5, startHour: 16, strain: 0.2, stress: 0.35, riskTissues: ['lowBack', 'shoulder'], requiresCertification: true, certificationCostKey: 'ptCertificationCost', note: 'Unlock: paid certification. Clients run on the same engine (logic hook only).' },
];

export const JOB_BY_ID: ReadonlyMap<string, JobDef> = new Map(JOBS.map((j) => [j.id, j]));

/** Engine tuning for the job mini-game layer. Read by engine/jobs.ts as `.value`. */
export const JOB_MODEL = {
  sleepDebtWeight: design(0.3, 'ratio', [0.1, 0.5], 'Max mini-game difficulty penalty from full sleep debt.'),
  sleepDebtSpanH: design(20, 'h', [10, 40], 'Sleep debt (h) at which the sleep penalty saturates.'),
  stressWeight: design(0.25, 'ratio', [0.1, 0.5], 'Max mini-game penalty from full stress.'),
  difficultyFloor: design(0.4, 'ratio', [0.2, 0.7], 'Lowest performance multiplier a miserable character can reach.'),
  payFloor: design(0.8, 'ratio', [0.5, 1], 'Pay multiplier at zero performance (docked hours / no tips).'),
  payCeiling: design(1.3, 'ratio', [1, 1.6], 'Pay multiplier at perfect performance (tips / bonus / piece rate).'),
  stressEventScale: design(0.03, 'stress/day', [0, 0.1], 'Extra daily stress (DayInputs.stressEvents) at job stress 1 and zero performance.'),
  legStrainWeight: design(0.2, 'ratio', [0, 0.5], 'Added jobStrain per unit of legRecoveryCost.'),
  minPlaysForAuto: design(1, 'plays', [1, 5], 'Mini-game plays required before auto-resolve unlocks.'),
} as const;
