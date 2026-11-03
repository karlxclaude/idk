// Helper to declare exercises with sensible defaults; validated by ExerciseSchema at load.
import { ExerciseSchema, type Exercise, type ExerciseInput } from './schema';

type Bias = Partial<Exercise['adaptationBias']>;

const defaultBias: Exercise['adaptationBias'] = { hypertrophy: 1, maxStrength: 1, power: 0.5, muscularEndurance: 0.8, speed: 0, jump: 0, aerobic: 0 };

export type ExerciseDef = Omit<ExerciseInput, 'adaptationBias' | 'equipment' | 'riskTissues' | 'resistanceProfile' | 'axialLoad' | 'systemicFatigue' | 'localDamage' | 'skillDemand' | 'learningRate' | 'baseInjuryRisk' | 'metValue' | 'evidenceNotes' | 'verified'> & {
  adaptationBias?: Bias;
  equipment?: string[];
  riskTissues?: string[];
  resistanceProfile?: Exercise['resistanceProfile'];
  axialLoad?: number;
  systemicFatigue?: number;
  localDamage?: number;
  skillDemand?: number;
  learningRate?: number;
  baseInjuryRisk?: number;
  metValue?: number;
  evidenceNotes?: string;
  verified?: boolean;
};

export function ex(def: ExerciseDef): Exercise {
  const input: ExerciseInput = {
    equipment: ['barbell'],
    riskTissues: [],
    resistanceProfile: 'bell',
    axialLoad: 0.3,
    systemicFatigue: 0.5,
    localDamage: 0.5,
    skillDemand: 0.5,
    learningRate: 1,
    baseInjuryRisk: 0.3,
    metValue: 5,
    evidenceNotes: '',
    verified: false,
    ...def,
    adaptationBias: { ...defaultBias, ...(def.adaptationBias ?? {}) },
  };
  return ExerciseSchema.parse(input);
}

export function validateExercises(list: Exercise[]): Exercise[] {
  const seen = new Set<string>();
  for (const e of list) {
    if (seen.has(e.id)) throw new Error(`duplicate exercise id ${e.id}`);
    seen.add(e.id);
    if (e.loadType === 'external' && !e.refLoad) throw new Error(`exercise ${e.id} needs refLoad`);
    if (e.loadType === 'bodyweight' && e.bodyweightFraction === undefined) throw new Error(`exercise ${e.id} needs bodyweightFraction`);
  }
  return list;
}
