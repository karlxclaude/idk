// Isometric holds and overcoming isometrics. refLoad = expected 1RM (kg) of the reference untrained 75 kg man, expressed as a
// force-equivalent load; each "rep" is one hold of secondsPerRep seconds. Isometric strength gains are largely joint-angle
// specific (Lindh 1979; Noorkoiv 2014; Oranchuk 2019), so adaptationBias.maxStrength is kept below dynamic lifts. [HEUR]
import type { Exercise } from '../schema';
import { ex } from '../define';

export const ISOMETRIC_EXERCISES: Exercise[] = [
  ex({
    id: 'isometric_mid_thigh_pull', name: 'Isometric mid-thigh pull (IMTP)', aliases: ['IMTP'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'powerlifting', refLoad: 150, repsModifier: 0.9, equipment: ['barbell', 'power rack'],
    muscles: { gluteMax: 1, vasti: 0.8, spinalErectors: 0.8, hamstrings: 0.6, forearms: 0.7, upperTraps: 0.7, lats: 0.4, midTrapsRhomboids: 0.4, adductors: 0.4, gastrocnemius: 0.2 },
    lengthBias: { gluteMax: 0.4, vasti: 0.4, hamstrings: 0.5, spinalErectors: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.4, systemicFatigue: 0.6, localDamage: 0.2, skillDemand: 0.35, learningRate: 1.2, baseInjuryRisk: 0.25, riskTissues: ['lowBack', 'hip'],
    metValue: 4, adaptationBias: { maxStrength: 0.85, hypertrophy: 0.5, power: 0.5, muscularEndurance: 0.3 }, secondsPerRep: 5,
    evidenceNotes: 'Standard force-plate test position (Comfort 2019), but strength gains are largely joint-angle specific (Oranchuk 2019) so transfer to the full deadlift or clean is partial.', verified: false,
  }),
  ex({
    id: 'overcoming_isometric_squat', name: 'Overcoming isometric squat (into pins)', aliases: ['pin squat push'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'budget', refLoad: 110, repsModifier: 0.9, equipment: ['barbell', 'power rack'],
    muscles: { vasti: 1, gluteMax: 1, adductors: 0.6, rectusFemoris: 0.4, spinalErectors: 0.6, hamstrings: 0.2, gastrocnemius: 0.2, obliques: 0.2 },
    lengthBias: { vasti: 0.6, gluteMax: 0.6, adductors: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0.7, systemicFatigue: 0.55, localDamage: 0.2, skillDemand: 0.35, learningRate: 1.2, baseInjuryRisk: 0.25, riskTissues: ['lowBack', 'knee', 'hip'],
    leverageExponents: { femurTorso: -0.3 }, metValue: 4, adaptationBias: { maxStrength: 0.8, hypertrophy: 0.45, power: 0.4, muscularEndurance: 0.3 }, secondsPerRep: 5,
    evidenceNotes: 'Maximal push into rack pins; gains concentrate near the trained joint angle, with spillover of roughly 15-20 degrees (Lindh 1979; Noorkoiv 2014).', verified: false,
  }),
  ex({
    id: 'overcoming_isometric_bench', name: 'Overcoming isometric bench press (into pins)', aliases: ['pin bench push'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'budget', refLoad: 75, repsModifier: 0.85, equipment: ['barbell', 'bench', 'power rack'],
    muscles: { midLowerChest: 1, upperChest: 0.5, frontDelts: 0.7, tricepsLatMed: 0.8, tricepsLong: 0.4 },
    lengthBias: { midLowerChest: 0.45, upperChest: 0.4, tricepsLatMed: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.35, localDamage: 0.2, skillDemand: 0.3, learningRate: 1.3, baseInjuryRisk: 0.2, riskTissues: ['shoulder', 'pec', 'elbow'],
    leverageExponents: { armLength: -0.2 }, metValue: 3.5, adaptationBias: { maxStrength: 0.8, hypertrophy: 0.45, power: 0.4, muscularEndurance: 0.3 }, secondsPerRep: 5, legDrive: 0.5,
    evidenceNotes: 'Maximal press into pins set at the sticking point; strength gains are largely joint-angle specific (Oranchuk 2019), so choose the pin height where the lift is weakest.', verified: false,
  }),
  ex({
    id: 'yielding_split_squat_hold', name: 'Yielding split squat hold (bottom position)', aliases: ['isometric split squat'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'home', refLoad: 40, repsModifier: 0.8, equipment: ['dumbbell'], unilateral: true,
    muscles: { vasti: 1, gluteMax: 0.8, adductors: 0.5, rectusFemoris: 0.4, gluteMed: 0.4, hamstrings: 0.3, spinalErectors: 0.3, soleus: 0.2 },
    lengthBias: { vasti: 0.8, gluteMax: 0.85, adductors: 0.7, rectusFemoris: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0.35, systemicFatigue: 0.3, localDamage: 0.3, skillDemand: 0.4, learningRate: 1.3, baseInjuryRisk: 0.15, riskTissues: ['knee', 'hip'],
    metValue: 4, adaptationBias: { maxStrength: 0.65, hypertrophy: 0.65, power: 0.2, muscularEndurance: 0.6 }, secondsPerRep: 20,
    evidenceNotes: 'Holding a load in the deep split squat trains the quads and glutes at long muscle length; isometric gains are joint-angle specific, so effects stay near the bottom position (Oranchuk 2019).', verified: false,
  }),
  ex({
    id: 'wall_sit', name: 'Wall sit', aliases: ['wall squat hold'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.5, refLoad: 60, repsModifier: 0.75, equipment: [],
    muscles: { vasti: 1, rectusFemoris: 0.5, gluteMax: 0.4, adductors: 0.3, hamstrings: 0.2, soleus: 0.2 },
    lengthBias: { vasti: 0.5, rectusFemoris: 0.4, gluteMax: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.15, localDamage: 0.1, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.05, riskTissues: ['knee'],
    metValue: 3.5, adaptationBias: { maxStrength: 0.4, hypertrophy: 0.4, power: 0.1, muscularEndurance: 1.1 }, secondsPerRep: 30,
    evidenceNotes: 'Low-load quad endurance hold at about 90 degrees of knee flexion; strength gains are joint-angle specific (Oranchuk 2019), and the hypertrophy stimulus is modest [HEUR].', verified: false,
  }),
  ex({
    id: 'dead_hang', name: 'Dead hang', aliases: ['bar hang'], category: 'isometric', movementPattern: 'grip',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 110, repsModifier: 0.75, equipment: ['bar'],
    muscles: { forearms: 1, lats: 0.6, brachialis: 0.25, biceps: 0.2, midTrapsRhomboids: 0.2 },
    lengthBias: { lats: 0.95, forearms: 0.5, biceps: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.15, skillDemand: 0.2, learningRate: 1.8, baseInjuryRisk: 0.12, riskTissues: ['shoulder', 'elbow'],
    metValue: 3, adaptationBias: { maxStrength: 0.6, hypertrophy: 0.5, power: 0, muscularEndurance: 1 }, secondsPerRep: 30,
    evidenceNotes: 'Evidence is limited; grip endurance is the main adaptation, and loading the lats at full overhead length is a plausible but untested hypertrophy cue [HEUR].', verified: false,
  }),
  ex({
    id: 'rack_lockout_hold', name: 'Rack deadlift lockout hold (supramaximal)', aliases: ['lockout hold', 'rack pull hold'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'powerlifting', refLoad: 130, repsModifier: 0.8, equipment: ['barbell', 'power rack', 'straps'],
    muscles: { spinalErectors: 1, upperTraps: 1, forearms: 1, gluteMax: 0.9, hamstrings: 0.4, midTrapsRhomboids: 0.4, lats: 0.4, vasti: 0.3, adductors: 0.3 },
    lengthBias: { gluteMax: 0.15, spinalErectors: 0.3, upperTraps: 0.3, forearms: 0.4, hamstrings: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0.9, systemicFatigue: 0.65, localDamage: 0.2, skillDemand: 0.35, learningRate: 1, baseInjuryRisk: 0.35, riskTissues: ['lowBack', 'biceps', 'hip'],
    leverageExponents: { armLength: 0.2 }, metValue: 4.5, adaptationBias: { maxStrength: 0.75, hypertrophy: 0.5, power: 0.2, muscularEndurance: 0.3 }, secondsPerRep: 10,
    evidenceNotes: 'Supramaximal hold near deadlift lockout overloads grip, traps and erectors; gains are joint-angle specific (Oranchuk 2019), and spinal load is high [HEUR].', verified: false,
  }),
  ex({
    id: 'isometric_hip_thrust_hold', name: 'Isometric hip thrust hold', aliases: ['glute bridge hold'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'budget', refLoad: 90, repsModifier: 0.9, equipment: ['barbell', 'bench'],
    muscles: { gluteMax: 1, hamstrings: 0.4, vasti: 0.3, adductors: 0.3, spinalErectors: 0.2 },
    lengthBias: { gluteMax: 0.1, hamstrings: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.2, systemicFatigue: 0.3, localDamage: 0.15, skillDemand: 0.25, learningRate: 1.5, baseInjuryRisk: 0.12, riskTissues: ['hip'],
    metValue: 3.5, adaptationBias: { maxStrength: 0.7, hypertrophy: 0.65, power: 0.2, muscularEndurance: 0.6 }, secondsPerRep: 10,
    evidenceNotes: 'Top-position hold loads the glutes at short length; joint-angle specific strength gains (Oranchuk 2019) mean transfer is strongest near full hip extension [HEUR].', verified: false,
  }),
  ex({
    id: 'isometric_neutral_grip_curl_hold', name: 'Isometric neutral-grip curl hold', aliases: ['hammer curl hold'], category: 'isometric', movementPattern: 'isometric',
    gymTier: 'home', refLoad: 30, repsModifier: 0.9, equipment: ['dumbbell'],
    muscles: { brachialis: 1, biceps: 0.7, forearms: 0.4 },
    lengthBias: { brachialis: 0.5, biceps: 0.45 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.15, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.08, riskTissues: ['elbow'],
    metValue: 3, adaptationBias: { maxStrength: 0.6, hypertrophy: 0.55, power: 0.1, muscularEndurance: 0.8 }, secondsPerRep: 15,
    evidenceNotes: 'Hold at about 90 degrees of elbow flexion; elbow flexor strength gains are joint-angle specific (Oranchuk 2019), and neutral grip biases brachialis and brachioradialis [HEUR].', verified: false,
  }),
];
