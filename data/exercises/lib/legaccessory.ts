// Leg accessory library: knee flexion, adductors/abductors, lower leg. See docs/EXERCISE_AUTHORING.md.
// refLoad = expected 1RM (kg) for the reference untrained 75 kg man at starting skill. [HEUR]
import { ex } from '../define';
import type { Exercise } from '../schema';

export const LEG_ACCESSORY_EXERCISES: Exercise[] = [
  // --- knee flexion ---
  ex({
    id: 'glute_ham_raise', name: 'Glute-ham raise', aliases: ['GHR'], category: 'kneeFlexion', movementPattern: 'kneeFlexion', gymTier: 'commercial',
    loadType: 'bodyweight', bodyweightFraction: 0.55, refLoad: 45, equipment: ['GHD'],
    muscles: { hamstrings: 1, gluteMax: 0.5, gastrocnemius: 0.3, spinalErectors: 0.25 }, lengthBias: { hamstrings: 0.6, gluteMax: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.05, systemicFatigue: 0.35, localDamage: 0.65, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.2, riskTissues: ['hamstrings', 'lowBack'], metValue: 4,
    adaptationBias: { maxStrength: 0.8, hypertrophy: 0.95 }, secondsPerRep: 4,
    evidenceNotes: 'Knee flexion plus hip extension on a GHD; hamstrings loaded at moderate-to-long length, no direct hypertrophy trial [HEUR].', verified: false,
  }),
  ex({
    id: 'slider_leg_curl', name: 'Slider leg curl', aliases: ['Bridge leg curl'], category: 'kneeFlexion', movementPattern: 'kneeFlexion', gymTier: 'home',
    loadType: 'bodyweight', bodyweightFraction: 0.35, refLoad: 35, equipment: ['sliders'],
    muscles: { hamstrings: 1, gluteMax: 0.4, gastrocnemius: 0.25, spinalErectors: 0.2 }, lengthBias: { hamstrings: 0.5, gluteMax: 0.2 }, resistanceProfile: 'descending',
    axialLoad: 0, systemicFatigue: 0.25, localDamage: 0.5, skillDemand: 0.3, learningRate: 1.4, baseInjuryRisk: 0.12, riskTissues: ['hamstrings'], metValue: 4,
    adaptationBias: { maxStrength: 0.7, hypertrophy: 0.9, muscularEndurance: 0.9 }, secondsPerRep: 3.5,
    evidenceNotes: 'Hip-extended (bridge) curl, so hamstring length resembles the prone curl (Maeo 2021); the long lever makes it hardest when the legs are extended [HEUR].', verified: false,
  }),
  ex({
    id: 'assisted_nordic_curl', name: 'Band-assisted Nordic curl', category: 'kneeFlexion', movementPattern: 'kneeFlexion', gymTier: 'home',
    loadType: 'bodyweight', bodyweightFraction: 0.45, refLoad: 40, equipment: ['band'],
    muscles: { hamstrings: 1, gastrocnemius: 0.2 }, lengthBias: { hamstrings: 0.7 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.25, localDamage: 0.65, skillDemand: 0.3, learningRate: 1.4, baseInjuryRisk: 0.12, riskTissues: ['hamstrings'], metValue: 4,
    adaptationBias: { maxStrength: 0.75, hypertrophy: 0.9 }, prevention: ['nordic'], secondsPerRep: 4,
    evidenceNotes: 'Band lowers the eccentric load of the Nordic, which halves hamstring injury rate in trials (van Dyk 2019); the assisted version itself is extrapolated.', verified: false,
  }),
  ex({
    id: 'standing_single_leg_curl', name: 'Standing single-leg curl', category: 'kneeFlexion', movementPattern: 'kneeFlexion', gymTier: 'commercial', refLoad: 18, repsModifier: 1.15, equipment: ['machine'],
    muscles: { hamstrings: 1, gastrocnemius: 0.3 }, lengthBias: { hamstrings: 0.45 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.25, localDamage: 0.45, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.12, riskTissues: ['hamstrings'], metValue: 4,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 0.95 }, unilateral: true, secondsPerRep: 3,
    evidenceNotes: 'Hip near neutral, so shorter hamstring length than the seated curl (Maeo 2021); one leg at a time [HEUR].', verified: false,
  }),
  // --- adductors / abductors ---
  ex({
    id: 'adductor_machine', name: 'Hip adductor machine', category: 'adductor', movementPattern: 'adduction', gymTier: 'commercial', refLoad: 60, repsModifier: 1.2, equipment: ['machine'],
    muscles: { adductors: 1 }, lengthBias: { adductors: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.4, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.12, riskTissues: ['adductors'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 0.95 }, secondsPerRep: 3,
    evidenceNotes: 'Seated machine isolates the adductors, loaded from a wide-leg start; direct hypertrophy data are sparse [HEUR].', verified: false,
  }),
  ex({
    id: 'short_lever_copenhagen', name: 'Short-lever Copenhagen plank', category: 'adductor', movementPattern: 'adduction', gymTier: 'home',
    loadType: 'bodyweight', bodyweightFraction: 0.25, refLoad: 25, equipment: ['bench'],
    muscles: { adductors: 1, obliques: 0.3 }, lengthBias: { adductors: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.4, skillDemand: 0.25, learningRate: 1.6, baseInjuryRisk: 0.08, riskTissues: ['adductors'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 0.75, muscularEndurance: 1 }, prevention: ['copenhagen'], unilateral: true, secondsPerRep: 5,
    evidenceNotes: 'Knee-on-bench regression of the Copenhagen plank, which cuts groin problems ~41% (Haroy 2019); the regression itself is extrapolated.', verified: false,
  }),
  ex({
    id: 'cable_hip_abduction', name: 'Cable hip abduction', category: 'adductor', movementPattern: 'abduction', gymTier: 'commercial', refLoad: 10, equipment: ['cable'],
    muscles: { gluteMed: 1, gluteMax: 0.3, obliques: 0.2 }, lengthBias: { gluteMed: 0.35 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.3, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['hip'], metValue: 3,
    adaptationBias: { maxStrength: 0.55, hypertrophy: 0.95 }, unilateral: true, secondsPerRep: 3,
    evidenceNotes: 'Standing single-leg abduction isolates gluteus medius; the stance leg adds stabiliser demand [HEUR].', verified: false,
  }),
  ex({
    id: 'hip_abduction_machine', name: 'Hip abduction machine', category: 'adductor', movementPattern: 'abduction', gymTier: 'commercial', refLoad: 55, repsModifier: 1.2, equipment: ['machine'],
    muscles: { gluteMed: 1, gluteMax: 0.4 }, lengthBias: { gluteMed: 0.35, gluteMax: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.35, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['hip'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 0.95 }, secondsPerRep: 3,
    evidenceNotes: 'Seated (hip flexed) machine adds upper glute max to glute med; low skill, easy to progress [HEUR].', verified: false,
  }),
  ex({
    id: 'banded_lateral_walk', name: 'Banded lateral walk', aliases: ['Monster walk', 'Band side-step'], category: 'adductor', movementPattern: 'abduction', gymTier: 'home',
    loadType: 'none', equipment: ['band'],
    muscles: { gluteMed: 1, gluteMax: 0.35, vasti: 0.2 }, lengthBias: { gluteMed: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.15, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.06, riskTissues: ['knee'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.25, hypertrophy: 0.5, power: 0.1, muscularEndurance: 1.2 }, secondsPerRep: 2.5,
    evidenceNotes: 'Low-load band abduction used for glute med activation and knee control; hypertrophy evidence is weak [HEUR].', verified: false,
  }),
  // --- lower leg ---
  ex({
    id: 'seated_calf_raise', name: 'Seated calf raise', category: 'lowerLeg', movementPattern: 'calf', gymTier: 'commercial', refLoad: 60, repsModifier: 1.25, equipment: ['machine'],
    muscles: { soleus: 1, gastrocnemius: 0.3 }, lengthBias: { soleus: 0.75, gastrocnemius: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.15, localDamage: 0.4, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.08, riskTissues: ['achilles'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.55, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Bent knee slackens the gastrocnemius so the soleus does most of the work (Kinoshita 2023).', verified: true,
  }),
  ex({
    id: 'deficit_single_leg_calf_raise', name: 'Deficit single-leg calf raise', category: 'lowerLeg', movementPattern: 'calf', gymTier: 'home',
    loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 100, repsModifier: 1.25, equipment: ['step', 'dumbbell'],
    muscles: { gastrocnemius: 1, soleus: 0.6 }, lengthBias: { gastrocnemius: 0.95, soleus: 0.7 }, resistanceProfile: 'bell',
    axialLoad: 0.1, systemicFatigue: 0.2, localDamage: 0.5, skillDemand: 0.25, learningRate: 1.6, baseInjuryRisk: 0.12, riskTissues: ['achilles'], metValue: 3.8,
    adaptationBias: { maxStrength: 0.55, hypertrophy: 1 }, unilateral: true, secondsPerRep: 3,
    evidenceNotes: 'Straight knee loads the gastrocnemius at length (Kinoshita 2023); the step deficit extends the stretched range [HEUR].', verified: false,
  }),
  ex({
    id: 'donkey_calf_raise', name: 'Donkey calf raise', category: 'lowerLeg', movementPattern: 'calf', gymTier: 'commercial', refLoad: 100, repsModifier: 1.25, equipment: ['machine'],
    muscles: { gastrocnemius: 1, soleus: 0.55 }, lengthBias: { gastrocnemius: 0.9, soleus: 0.65 }, resistanceProfile: 'flat',
    axialLoad: 0.25, systemicFatigue: 0.25, localDamage: 0.45, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.1, riskTissues: ['achilles'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.55, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Hips flexed with straight knees keeps the gastrocnemius lengthened under load (Kinoshita 2023); the posture adds low-back strain [HEUR].', verified: false,
  }),
  ex({
    id: 'leg_press_calf_raise', name: 'Leg press calf raise', category: 'lowerLeg', movementPattern: 'calf', gymTier: 'commercial', refLoad: 120, repsModifier: 1.25, equipment: ['machine'],
    muscles: { gastrocnemius: 1, soleus: 0.55 }, lengthBias: { gastrocnemius: 0.7, soleus: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.2, localDamage: 0.35, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['achilles'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.55, hypertrophy: 0.95 }, secondsPerRep: 2.5,
    evidenceNotes: 'Straight-knee calf work on the sled: gastrocnemius-biased (Kinoshita 2023), no spinal load, easy to load heavily [HEUR].', verified: false,
  }),
  ex({
    id: 'tibialis_raise', name: 'Tibialis raise', aliases: ['Tib raise', 'Wall tibialis raise'], category: 'lowerLeg', movementPattern: 'tibialis', gymTier: 'home',
    loadType: 'bodyweight', bodyweightFraction: 0.2, refLoad: 25, equipment: ['wall'],
    muscles: { tibialisAnterior: 1 }, lengthBias: { tibialisAnterior: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.2, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.06, riskTissues: ['shin'], metValue: 3,
    adaptationBias: { maxStrength: 0.4, hypertrophy: 0.7, muscularEndurance: 1 }, secondsPerRep: 2,
    evidenceNotes: 'Evidence is limited: no hypertrophy trials; used for shin and ankle resilience, so expect modest effects.', verified: false,
  }),
];
