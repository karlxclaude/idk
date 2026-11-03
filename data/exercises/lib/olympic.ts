// Olympic lifts, weightlifting derivatives and ballistic power work (category olympic; intent defaults to 'max').
// refLoad = expected 1RM (kg) for the reference untrained 75 kg man at starting skill. [HEUR]
// Olympic lifts need a platform and bumper plates, hence gymTier 'powerlifting'. Ids must not clash with core.ts (power_clean, jump_squat).
import { ex } from '../define';
import type { Exercise } from '../schema';

export const OLYMPIC_EXERCISES: Exercise[] = [
  // --- clean family ---
  ex({
    id: 'hang_clean', name: 'Hang power clean', aliases: ['hang clean'], category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 47, repsModifier: 0.85,
    equipment: ['barbell', 'bumper plates', 'platform'],
    muscles: { gluteMax: 0.8, hamstrings: 0.5, vasti: 0.7, spinalErectors: 0.7, upperTraps: 0.8, forearms: 0.5, gastrocnemius: 0.4, frontDelts: 0.2 }, resistanceProfile: 'ascending',
    axialLoad: 0.55, systemicFatigue: 0.65, localDamage: 0.3, skillDemand: 0.85, learningRate: 0.65, baseInjuryRisk: 0.33, riskTissues: ['lowBack', 'wrist', 'knee'],
    leverageExponents: { femurTorso: -0.1, armLength: 0.2 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.4, maxStrength: 0.6, power: 1.2, jump: 0.7, speed: 0.4 }, peakPowerLoadPct: 75, secondsPerRep: 3,
    evidenceNotes: 'Starting from the hang removes the first pull and eases technique; peak power at 70-80% 1RM (Cormie 2011).', verified: true,
  }),
  ex({
    id: 'clean_pull', name: 'Clean pull', category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 70, repsModifier: 0.9,
    equipment: ['barbell', 'bumper plates', 'platform'],
    muscles: { gluteMax: 0.9, hamstrings: 0.7, vasti: 0.7, spinalErectors: 0.9, upperTraps: 1, forearms: 0.7, midTrapsRhomboids: 0.4, lats: 0.4, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.8, systemicFatigue: 0.75, localDamage: 0.45, skillDemand: 0.5, learningRate: 0.9, baseInjuryRisk: 0.3, riskTissues: ['lowBack', 'knee', 'hamstrings'],
    leverageExponents: { armLength: 0.3, femurTorso: -0.1 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.9, power: 1.1, jump: 0.5, speed: 0.3 }, peakPowerLoadPct: 80, secondsPerRep: 3.5,
    evidenceNotes: 'Pulls without a catch tolerate supramaximal-to-clean loads; peak power at the top of the 70-80% range (Cormie 2011) [HEUR].', verified: false,
  }),
  // --- snatch family ---
  ex({
    id: 'power_snatch', name: 'Power snatch', category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 38, repsModifier: 0.85,
    equipment: ['barbell', 'bumper plates', 'platform'],
    muscles: { gluteMax: 0.8, hamstrings: 0.6, vasti: 0.7, spinalErectors: 0.8, upperTraps: 0.9, midTrapsRhomboids: 0.6, sideDelts: 0.5, rearDelts: 0.4, frontDelts: 0.4, tricepsLatMed: 0.3, forearms: 0.5, gastrocnemius: 0.4 },
    resistanceProfile: 'ascending',
    axialLoad: 0.55, systemicFatigue: 0.7, localDamage: 0.3, skillDemand: 0.95, learningRate: 0.5, baseInjuryRisk: 0.35, riskTissues: ['lowBack', 'shoulder', 'wrist', 'knee'],
    leverageExponents: { femurTorso: -0.15 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.4, maxStrength: 0.55, power: 1.2, jump: 0.7, speed: 0.4 }, peakPowerLoadPct: 70, secondsPerRep: 3,
    evidenceNotes: 'Wide-grip overhead catch adds shoulder and upper-back demand and a high skill barrier; peak power at about 70% 1RM (Cormie 2011).', verified: true,
  }),
  ex({
    id: 'hang_snatch', name: 'Hang power snatch', aliases: ['hang snatch'], category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 36, repsModifier: 0.85,
    equipment: ['barbell', 'bumper plates', 'platform'],
    muscles: { gluteMax: 0.8, hamstrings: 0.5, vasti: 0.7, spinalErectors: 0.7, upperTraps: 0.9, midTrapsRhomboids: 0.6, sideDelts: 0.5, rearDelts: 0.4, frontDelts: 0.4, tricepsLatMed: 0.3, forearms: 0.5, gastrocnemius: 0.4 },
    resistanceProfile: 'ascending',
    axialLoad: 0.5, systemicFatigue: 0.65, localDamage: 0.3, skillDemand: 0.9, learningRate: 0.55, baseInjuryRisk: 0.33, riskTissues: ['lowBack', 'shoulder', 'wrist', 'knee'],
    leverageExponents: { femurTorso: -0.15 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.4, maxStrength: 0.55, power: 1.2, jump: 0.7, speed: 0.4 }, peakPowerLoadPct: 70, secondsPerRep: 3,
    evidenceNotes: 'Hang start shortens the pull and reduces technique load relative to the floor snatch; peak power at about 70% 1RM (Cormie 2011).', verified: true,
  }),
  ex({
    id: 'snatch_pull', name: 'Snatch pull', category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 55, repsModifier: 0.9,
    equipment: ['barbell', 'bumper plates', 'platform'],
    muscles: { gluteMax: 0.9, hamstrings: 0.7, vasti: 0.7, spinalErectors: 0.9, upperTraps: 1, midTrapsRhomboids: 0.6, lats: 0.5, rearDelts: 0.4, forearms: 0.7, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.8, systemicFatigue: 0.75, localDamage: 0.45, skillDemand: 0.55, learningRate: 0.9, baseInjuryRisk: 0.3, riskTissues: ['lowBack', 'knee', 'hamstrings'],
    leverageExponents: { armLength: 0.2, femurTorso: -0.1 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.9, power: 1.1, jump: 0.5, speed: 0.3 }, peakPowerLoadPct: 80, secondsPerRep: 3.5,
    evidenceNotes: 'Wide-grip pull with a longer range than the clean pull and more upper-back work; heavy pulls keep power high (Cormie 2011) [HEUR].', verified: false,
  }),
  // --- jerks and combined lifts ---
  ex({
    id: 'push_jerk', name: 'Push jerk', category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 48, repsModifier: 0.85,
    equipment: ['barbell', 'bumper plates', 'platform', 'rack'],
    muscles: { vasti: 0.8, gluteMax: 0.6, gastrocnemius: 0.5, rectusFemoris: 0.3, frontDelts: 0.9, tricepsLatMed: 0.8, tricepsLong: 0.5, sideDelts: 0.4, upperTraps: 0.5, upperChest: 0.3, spinalErectors: 0.4, obliques: 0.3 },
    resistanceProfile: 'ascending',
    axialLoad: 0.55, systemicFatigue: 0.55, localDamage: 0.3, skillDemand: 0.8, learningRate: 0.7, baseInjuryRisk: 0.3, riskTissues: ['shoulder', 'wrist', 'lowBack', 'knee'],
    leverageExponents: { armLength: -0.1 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.7, power: 1.1, jump: 0.4, speed: 0.2 }, peakPowerLoadPct: 60, secondsPerRep: 3,
    evidenceNotes: 'Leg-drive overhead lift with a shallow-dip catch; peak power at lighter loads than cleans, around 60% 1RM [HEUR].', verified: false,
  }),
  ex({
    id: 'split_jerk', name: 'Split jerk', category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 52, repsModifier: 0.85,
    equipment: ['barbell', 'bumper plates', 'platform', 'rack'],
    muscles: { vasti: 0.8, gluteMax: 0.7, hamstrings: 0.3, adductors: 0.3, gastrocnemius: 0.5, rectusFemoris: 0.3, frontDelts: 0.9, tricepsLatMed: 0.8, tricepsLong: 0.5, sideDelts: 0.4, upperTraps: 0.5, upperChest: 0.3, spinalErectors: 0.4, obliques: 0.3 },
    resistanceProfile: 'ascending',
    axialLoad: 0.55, systemicFatigue: 0.6, localDamage: 0.3, skillDemand: 0.85, learningRate: 0.6, baseInjuryRisk: 0.32, riskTissues: ['shoulder', 'wrist', 'lowBack', 'knee'],
    leverageExponents: { armLength: -0.1 }, metValue: 7,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.75, power: 1.1, jump: 0.4, speed: 0.2 }, peakPowerLoadPct: 60, secondsPerRep: 3.5,
    evidenceNotes: 'Split catch gives a wider base and heavier loads than the push jerk but needs more coordination [HEUR].', verified: false,
  }),
  ex({
    id: 'clean_and_jerk', name: 'Clean and jerk', category: 'olympic', movementPattern: 'olympic', gymTier: 'powerlifting', refLoad: 45, repsModifier: 0.85,
    equipment: ['barbell', 'bumper plates', 'platform'],
    muscles: { gluteMax: 0.8, vasti: 0.9, hamstrings: 0.6, spinalErectors: 0.8, upperTraps: 0.8, frontDelts: 0.7, tricepsLatMed: 0.6, forearms: 0.5, gastrocnemius: 0.5, sideDelts: 0.3, tricepsLong: 0.3, obliques: 0.3 },
    lengthBias: { vasti: 0.6, gluteMax: 0.6 }, resistanceProfile: 'ascending',
    axialLoad: 0.75, systemicFatigue: 0.85, localDamage: 0.35, skillDemand: 0.95, learningRate: 0.5, baseInjuryRisk: 0.4, riskTissues: ['lowBack', 'wrist', 'knee', 'shoulder'],
    leverageExponents: { femurTorso: -0.15, armLength: 0.1 }, metValue: 8,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.7, power: 1.15, jump: 0.6, speed: 0.3 }, peakPowerLoadPct: 70, secondsPerRep: 6,
    evidenceNotes: 'Full squat clean plus jerk is the highest-skill, highest-fatigue lift; peak power in the 70-80% window of its parts (Cormie 2011) [HEUR].', verified: false,
  }),
  // --- kettlebell ---
  ex({
    id: 'kettlebell_snatch', name: 'Kettlebell snatch (single arm)', category: 'olympic', movementPattern: 'olympic', gymTier: 'home', refLoad: 24, repsModifier: 1.3, equipment: ['kettlebell'],
    muscles: { gluteMax: 0.8, hamstrings: 0.6, spinalErectors: 0.6, upperTraps: 0.6, frontDelts: 0.5, forearms: 0.8, vasti: 0.4, lats: 0.3, sideDelts: 0.3, obliques: 0.3, gastrocnemius: 0.3 },
    resistanceProfile: 'ascending',
    axialLoad: 0.3, systemicFatigue: 0.5, localDamage: 0.25, skillDemand: 0.7, learningRate: 0.8, baseInjuryRisk: 0.25, riskTissues: ['shoulder', 'wrist', 'lowBack'], metValue: 9.8,
    adaptationBias: { hypertrophy: 0.3, maxStrength: 0.3, power: 0.6, muscularEndurance: 1.5, aerobic: 0.3 }, unilateral: true, secondsPerRep: 3,
    evidenceNotes: 'Hip-driven single-arm ballistic lift run in high-rep sets, which loads grip and posterior chain endurance more than maximal power [HEUR].', verified: false,
  }),
  // --- loaded and unloaded ballistics ---
  ex({
    id: 'trap_bar_jump', name: 'Trap bar jump', aliases: ['hex bar jump'], category: 'olympic', movementPattern: 'ballistic', gymTier: 'powerlifting', refLoad: 100, repsModifier: 1,
    equipment: ['trap bar', 'bumper plates'],
    muscles: { vasti: 0.8, gluteMax: 0.8, gastrocnemius: 0.5, hamstrings: 0.4, soleus: 0.3, spinalErectors: 0.3, forearms: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.4, systemicFatigue: 0.5, localDamage: 0.3, skillDemand: 0.45, learningRate: 1.2, baseInjuryRisk: 0.3, riskTissues: ['lowBack', 'knee', 'achilles'], metValue: 7,
    adaptationBias: { hypertrophy: 0.3, maxStrength: 0.5, power: 1.1, jump: 0.9, speed: 0.4 }, peakPowerLoadPct: 20, secondsPerRep: 3,
    evidenceNotes: 'Load is scaled to the trap-bar deadlift 1RM; hex-bar jumps give high peak power at light loads with less spinal load than back-loaded jumps (Swinton 2012).', verified: false,
  }),
  ex({
    id: 'bench_throw', name: 'Smith machine bench throw', category: 'olympic', movementPattern: 'ballistic', gymTier: 'commercial', refLoad: 55, repsModifier: 1, equipment: ['smith machine', 'bench'],
    muscles: { midLowerChest: 0.9, upperChest: 0.4, frontDelts: 0.7, tricepsLatMed: 0.8, tricepsLong: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.05, systemicFatigue: 0.35, localDamage: 0.25, skillDemand: 0.5, learningRate: 1, baseInjuryRisk: 0.25, riskTissues: ['shoulder', 'pec', 'elbow'], metValue: 5,
    adaptationBias: { hypertrophy: 0.3, maxStrength: 0.5, power: 1.2 }, peakPowerLoadPct: 35, secondsPerRep: 3, legDrive: 0.5,
    evidenceNotes: 'Releasing the bar removes the braking phase, so velocity and late-range activation exceed a bench press (Newton 1996); peak power near 30-45% 1RM.', verified: false,
  }),
  ex({
    id: 'med_ball_chest_pass', name: 'Medicine ball chest pass', aliases: ['med ball chest throw'], category: 'olympic', movementPattern: 'ballistic', gymTier: 'home', loadType: 'none', equipment: ['medicine ball', 'wall'],
    muscles: { midLowerChest: 0.8, upperChest: 0.4, frontDelts: 0.6, tricepsLatMed: 0.7, tricepsLong: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.1, skillDemand: 0.2, learningRate: 1.5, baseInjuryRisk: 0.1, riskTissues: ['shoulder', 'wrist'], metValue: 4,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.15, power: 1 }, secondsPerRep: 4,
    evidenceNotes: 'Unloaded-release pressing power with no braking phase; a low-fatigue upper-body power drill [HEUR].', verified: false,
  }),
  ex({
    id: 'med_ball_scoop_toss', name: 'Medicine ball scoop toss', aliases: ['underhand med ball throw'], category: 'olympic', movementPattern: 'ballistic', gymTier: 'home', loadType: 'none', equipment: ['medicine ball'],
    muscles: { gluteMax: 0.7, hamstrings: 0.5, vasti: 0.6, spinalErectors: 0.6, obliques: 0.5, frontDelts: 0.3, gastrocnemius: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.1, systemicFatigue: 0.25, localDamage: 0.1, skillDemand: 0.25, learningRate: 1.5, baseInjuryRisk: 0.1, riskTissues: ['lowBack'], metValue: 5,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.15, power: 1, jump: 0.3 }, secondsPerRep: 5,
    evidenceNotes: 'Underhand overhead-backward throw trains explosive triple extension without impact or barbell loading [HEUR].', verified: false,
  }),
  ex({
    id: 'med_ball_overhead_throw', name: 'Medicine ball overhead throw', aliases: ['med ball slam throw'], category: 'olympic', movementPattern: 'ballistic', gymTier: 'home', loadType: 'none', equipment: ['medicine ball', 'wall'],
    muscles: { frontDelts: 0.5, lats: 0.6, tricepsLong: 0.6, rectusAbdominis: 0.5, upperChest: 0.3, obliques: 0.3, vasti: 0.3, gluteMax: 0.3 },
    lengthBias: { lats: 0.7, tricepsLong: 0.8 }, resistanceProfile: 'ascending',
    axialLoad: 0.1, systemicFatigue: 0.25, localDamage: 0.15, skillDemand: 0.25, learningRate: 1.5, baseInjuryRisk: 0.1, riskTissues: ['shoulder', 'lowBack'], metValue: 5,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.15, power: 1, jump: 0.2 }, secondsPerRep: 5,
    evidenceNotes: 'Overhead throw loads the arms at long length and the trunk through a whole-body chain; transfer evidence is modest [HEUR].', verified: false,
  }),
];
