// Calisthenics skills: planche, lever, flag, handstand, muscle-up and one-arm push-up progressions.
// Difficulty is modelled with bodyweightFraction (share of body mass the hands/bar carry) and refLoad, the reference
// untrained 75 kg man's 1RM of total system load. If 75 x bodyweightFraction exceeds refLoad the reference man cannot
// perform the skill at all (the set fails until he is stronger); where refLoad is larger, the step is attainable.
// Joint-torque ranking: planche lean < tuck FL < adv. tuck FL < tuck planche < straddle FL < full FL < adv. tuck planche < straddle planche.
// All entries are practitioner-based [HEUR]; no controlled trials compare these progressions.
import { ex } from '../define';
import type { Exercise } from '../schema';

export const CALISTHENICS_EXERCISES: Exercise[] = [
  // --- planche progression (straight-arm push: front delts, chest, triceps, straight-arm biceps, abs) ---
  ex({
    id: 'planche_lean', name: 'Planche lean', aliases: ['pseudo planche lean', 'straight-arm lean'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.8, refLoad: 76, repsModifier: 1, equipment: [],
    muscles: { frontDelts: 1, midLowerChest: 0.7, upperChest: 0.4, tricepsLatMed: 0.5, tricepsLong: 0.3, biceps: 0.4, rectusAbdominis: 0.5, forearms: 0.4, obliques: 0.2 },
    lengthBias: { frontDelts: 0.4, midLowerChest: 0.5, biceps: 0.6, tricepsLong: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.3, localDamage: 0.35, skillDemand: 0.7, learningRate: 0.7, baseInjuryRisk: 0.2,
    riskTissues: ['wrist', 'elbow', 'shoulder', 'biceps'], leverageExponents: { femurTorso: -0.15 }, metValue: 4,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.7, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; difficulty scales with how far the shoulders lean past the wrists, which lengthens the shoulder-torque lever.', verified: false,
  }),
  ex({
    id: 'tuck_planche', name: 'Tuck planche', category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 52, repsModifier: 0.85, equipment: [],
    muscles: { frontDelts: 1, midLowerChest: 0.8, upperChest: 0.4, tricepsLatMed: 0.5, tricepsLong: 0.3, biceps: 0.6, rectusAbdominis: 0.6, forearms: 0.5, obliques: 0.25 },
    lengthBias: { frontDelts: 0.4, midLowerChest: 0.5, biceps: 0.6, tricepsLong: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.35, localDamage: 0.4, skillDemand: 0.8, learningRate: 0.6, baseInjuryRisk: 0.28,
    riskTissues: ['wrist', 'elbow', 'shoulder', 'biceps'], leverageExponents: { femurTorso: -0.15 }, metValue: 4.5,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.7, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; knees tucked to the chest shorten the body lever, making this the entry hold for a free-floating planche.', verified: false,
  }),
  ex({
    id: 'advanced_tuck_planche', name: 'Advanced tuck planche', aliases: ['adv tuck planche'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 44, repsModifier: 0.8, equipment: [],
    muscles: { frontDelts: 1, midLowerChest: 0.8, upperChest: 0.4, tricepsLatMed: 0.5, tricepsLong: 0.3, biceps: 0.7, rectusAbdominis: 0.6, forearms: 0.55, obliques: 0.3, spinalErectors: 0.25 },
    lengthBias: { frontDelts: 0.4, midLowerChest: 0.5, biceps: 0.65, tricepsLong: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.4, localDamage: 0.45, skillDemand: 0.85, learningRate: 0.55, baseInjuryRisk: 0.32,
    riskTissues: ['wrist', 'elbow', 'shoulder', 'biceps'], leverageExponents: { femurTorso: -0.15 }, metValue: 5,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.7, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; opening the hips with a flat back lengthens the lever, so straight-arm biceps and shoulder load rise sharply.', verified: false,
  }),
  ex({
    id: 'straddle_planche', name: 'Straddle planche', category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 35, repsModifier: 0.75, equipment: [],
    muscles: { frontDelts: 1, midLowerChest: 0.85, upperChest: 0.4, tricepsLatMed: 0.5, tricepsLong: 0.3, biceps: 0.8, rectusAbdominis: 0.6, forearms: 0.6, obliques: 0.3, spinalErectors: 0.3, gluteMax: 0.3, gluteMed: 0.3 },
    lengthBias: { frontDelts: 0.4, midLowerChest: 0.5, biceps: 0.7, tricepsLong: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.45, localDamage: 0.5, skillDemand: 0.92, learningRate: 0.45, baseInjuryRisk: 0.38,
    riskTissues: ['wrist', 'elbow', 'shoulder', 'biceps'], leverageExponents: { femurTorso: -0.15 }, metValue: 5.5,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.7, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; widening the legs shortens the effective lever but the hold remains far beyond untrained strength, with high biceps-tendon and wrist loading.', verified: false,
  }),

  // --- front lever progression (straight-arm pull: lats, rear delts, abs, biceps) ---
  ex({
    id: 'tuck_front_lever', name: 'Tuck front lever', aliases: ['tuck FL'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 80, repsModifier: 0.9, equipment: ['bar'],
    muscles: { lats: 1, rearDelts: 0.5, rectusAbdominis: 0.6, obliques: 0.2, biceps: 0.5, brachialis: 0.3, forearms: 0.5, midTrapsRhomboids: 0.4, tricepsLong: 0.3 },
    lengthBias: { lats: 0.6, rearDelts: 0.4, biceps: 0.5, tricepsLong: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.3, localDamage: 0.35, skillDemand: 0.72, learningRate: 0.7, baseInjuryRisk: 0.2,
    riskTissues: ['shoulder', 'elbow', 'biceps', 'lats'], leverageExponents: { femurTorso: -0.15 }, metValue: 4.5,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.75, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; the tucked body keeps the lever short enough for a trained-novice lat and core to hold.', verified: false,
  }),
  ex({
    id: 'advanced_tuck_front_lever', name: 'Advanced tuck front lever', aliases: ['adv tuck FL'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 62, repsModifier: 0.85, equipment: ['bar'],
    muscles: { lats: 1, rearDelts: 0.55, rectusAbdominis: 0.65, obliques: 0.25, biceps: 0.55, brachialis: 0.3, forearms: 0.55, midTrapsRhomboids: 0.45, tricepsLong: 0.35, spinalErectors: 0.2 },
    lengthBias: { lats: 0.6, rearDelts: 0.4, biceps: 0.5, tricepsLong: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.35, localDamage: 0.4, skillDemand: 0.8, learningRate: 0.6, baseInjuryRisk: 0.25,
    riskTissues: ['shoulder', 'elbow', 'biceps', 'lats'], leverageExponents: { femurTorso: -0.15 }, metValue: 5,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.75, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; a flat back with knees tucked lengthens the lever beyond the plain tuck.', verified: false,
  }),
  ex({
    id: 'straddle_front_lever', name: 'Straddle front lever', aliases: ['straddle FL'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 52, repsModifier: 0.8, equipment: ['bar'],
    muscles: { lats: 1, rearDelts: 0.6, rectusAbdominis: 0.7, obliques: 0.3, biceps: 0.6, brachialis: 0.3, forearms: 0.6, midTrapsRhomboids: 0.5, tricepsLong: 0.35, spinalErectors: 0.25, gluteMed: 0.25, gluteMax: 0.2 },
    lengthBias: { lats: 0.6, rearDelts: 0.4, biceps: 0.5, tricepsLong: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.4, localDamage: 0.45, skillDemand: 0.87, learningRate: 0.5, baseInjuryRisk: 0.3,
    riskTissues: ['shoulder', 'elbow', 'biceps', 'lats'], leverageExponents: { femurTorso: -0.15 }, metValue: 5.5,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.75, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; legs spread wide shorten the lever relative to the full hold.', verified: false,
  }),
  ex({
    id: 'full_front_lever', name: 'Full front lever', aliases: ['front lever'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 45, repsModifier: 0.75, equipment: ['bar'],
    muscles: { lats: 1, rearDelts: 0.65, rectusAbdominis: 0.75, obliques: 0.35, biceps: 0.65, brachialis: 0.3, forearms: 0.65, midTrapsRhomboids: 0.55, tricepsLong: 0.4, spinalErectors: 0.3, gluteMax: 0.25 },
    lengthBias: { lats: 0.6, rearDelts: 0.4, biceps: 0.5, tricepsLong: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.45, localDamage: 0.5, skillDemand: 0.92, learningRate: 0.45, baseInjuryRisk: 0.35,
    riskTissues: ['shoulder', 'elbow', 'biceps', 'lats'], leverageExponents: { femurTorso: -0.15 }, metValue: 6,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.75, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; the full-length body lever demands lat and shoulder-extensor torque far above bodyweight pull-up strength.', verified: false,
  }),
  ex({
    id: 'back_lever', name: 'Back lever', aliases: ['full back lever'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 55, repsModifier: 0.8, equipment: ['bar'],
    muscles: { lats: 0.8, rearDelts: 0.6, biceps: 0.8, brachialis: 0.3, midLowerChest: 0.4, frontDelts: 0.4, spinalErectors: 0.4, gluteMax: 0.3, rectusAbdominis: 0.4, forearms: 0.6, tricepsLong: 0.3 },
    lengthBias: { biceps: 0.9, midLowerChest: 0.85, frontDelts: 0.85, lats: 0.3, rearDelts: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.35, localDamage: 0.5, skillDemand: 0.82, learningRate: 0.55, baseInjuryRisk: 0.4,
    riskTissues: ['shoulder', 'elbow', 'biceps', 'pec'], leverageExponents: { femurTorso: -0.15 }, metValue: 5,
    adaptationBias: { maxStrength: 0.85, hypertrophy: 0.7, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 8,
    evidenceNotes: 'Evidence is limited and practitioner-based; the shoulders sit in deep extension, stretching the biceps and anterior shoulder, so forcing the position risks shoulder-capsule and biceps-tendon strain.', verified: false,
  }),

  // --- dynamic and flag skills ---
  ex({
    id: 'muscle_up', name: 'Muscle-up', aliases: ['bar muscle-up'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 70, repsModifier: 0.8, equipment: ['bar'],
    muscles: { lats: 1, biceps: 0.6, brachialis: 0.5, midTrapsRhomboids: 0.4, rearDelts: 0.3, forearms: 0.6, midLowerChest: 0.7, frontDelts: 0.5, tricepsLatMed: 0.8, tricepsLong: 0.5, rectusAbdominis: 0.3, upperChest: 0.2 },
    lengthBias: { lats: 0.9, biceps: 0.4, midLowerChest: 0.6, tricepsLong: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.5, localDamage: 0.5, skillDemand: 0.9, learningRate: 0.5, baseInjuryRisk: 0.4,
    riskTissues: ['elbow', 'shoulder', 'wrist'], leverageExponents: { armLength: -0.15 }, metValue: 7,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.8, power: 0.7, muscularEndurance: 0.8 }, secondsPerRep: 4,
    evidenceNotes: 'Evidence is limited and practitioner-based; needs an explosive pull-up above the bar plus a transition and dip, and the false grip and transition stress the wrist, elbow and shoulder.', verified: false,
  }),
  ex({
    id: 'human_flag', name: 'Human flag', category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 40, repsModifier: 0.8, equipment: ['vertical pole'],
    muscles: { obliques: 1, lats: 0.9, sideDelts: 0.7, frontDelts: 0.3, rearDelts: 0.3, upperTraps: 0.4, tricepsLatMed: 0.4, spinalErectors: 0.4, gluteMed: 0.4, forearms: 0.55, rectusAbdominis: 0.3, midTrapsRhomboids: 0.3 },
    lengthBias: { obliques: 0.6, lats: 0.7, sideDelts: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.45, localDamage: 0.45, skillDemand: 0.95, learningRate: 0.4, baseInjuryRisk: 0.45,
    riskTissues: ['shoulder', 'elbow', 'lowBack', 'wrist'], leverageExponents: { femurTorso: -0.15 }, metValue: 5.5,
    adaptationBias: { maxStrength: 0.85, hypertrophy: 0.6, power: 0.1, muscularEndurance: 1 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited and practitioner-based; combines top-arm pull and bottom-arm push with lateral trunk flexion, loading the shoulders, elbows and spine asymmetrically.', verified: false,
  }),
  ex({
    id: 'handstand_hold', name: 'Handstand hold', aliases: ['handstand', 'wall handstand'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.95, refLoad: 84, repsModifier: 1, equipment: [],
    muscles: { frontDelts: 1, upperChest: 0.4, sideDelts: 0.4, upperTraps: 0.7, tricepsLatMed: 0.5, tricepsLong: 0.4, forearms: 0.7, rectusAbdominis: 0.4, spinalErectors: 0.2, obliques: 0.2 },
    lengthBias: { frontDelts: 0.25, tricepsLong: 0.85, upperTraps: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0.2, systemicFatigue: 0.25, localDamage: 0.2, skillDemand: 0.85, learningRate: 0.55, baseInjuryRisk: 0.2,
    riskTissues: ['wrist', 'shoulder', 'elbow'], metValue: 3.8,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.5, power: 0.1, muscularEndurance: 1.2 }, secondsPerRep: 10,
    evidenceNotes: 'Evidence is limited and practitioner-based; balance and wrist tolerance limit most people before shoulder strength does, so strength gains are modest.', verified: false,
  }),

  // --- shoulder-extension and stretch skills ---
  ex({
    id: 'skin_the_cat', name: 'Skin the cat', aliases: ['skin-the-cat'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.9, refLoad: 76, repsModifier: 0.95, equipment: ['bar'],
    muscles: { lats: 1, rearDelts: 0.6, biceps: 0.6, brachialis: 0.4, forearms: 0.7, rectusAbdominis: 0.5, rectusFemoris: 0.3, midLowerChest: 0.3, frontDelts: 0.3, tricepsLong: 0.3 },
    lengthBias: { lats: 0.8, biceps: 0.8, midLowerChest: 0.9, frontDelts: 0.9 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.3, localDamage: 0.45, skillDemand: 0.75, learningRate: 0.65, baseInjuryRisk: 0.4,
    riskTissues: ['shoulder', 'elbow', 'biceps'], metValue: 4.5,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 0.6, power: 0.1, muscularEndurance: 0.9 }, secondsPerRep: 8,
    evidenceNotes: 'Evidence is limited and practitioner-based; the rotation through the bottom puts the shoulder in deep passive extension, so forcing range or dropping through it risks the anterior shoulder and biceps tendon.', verified: false,
  }),
  ex({
    id: 'german_hang', name: 'German hang', category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.85, refLoad: 84, repsModifier: 0.8, equipment: ['rings'],
    muscles: { lats: 0.7, forearms: 0.8, rearDelts: 0.4, biceps: 0.5, frontDelts: 0.4, midLowerChest: 0.35, upperChest: 0.2, rectusAbdominis: 0.2 },
    lengthBias: { frontDelts: 0.95, midLowerChest: 0.95, upperChest: 0.9, biceps: 0.85, lats: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.35, skillDemand: 0.7, learningRate: 0.7, baseInjuryRisk: 0.4,
    riskTissues: ['shoulder', 'elbow', 'biceps'], metValue: 3.8,
    adaptationBias: { maxStrength: 0.4, hypertrophy: 0.3, power: 0, muscularEndurance: 0.8 }, secondsPerRep: 12,
    evidenceNotes: 'Evidence is limited and practitioner-based; a passive deep shoulder-extension stretch with low muscular demand, where forcing the range or dropping into it raises shoulder-capsule risk.', verified: false,
  }),

  // --- one-arm push-up progression ---
  ex({
    id: 'incline_one_arm_push_up', name: 'Incline one-arm push-up', aliases: ['elevated one-arm push-up'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.5, refLoad: 46, repsModifier: 1, equipment: ['bench'],
    muscles: { midLowerChest: 1, upperChest: 0.6, frontDelts: 0.7, tricepsLatMed: 0.8, tricepsLong: 0.5, obliques: 0.4, rectusAbdominis: 0.3, forearms: 0.2, gluteMed: 0.2 },
    lengthBias: { midLowerChest: 0.8, upperChest: 0.7, tricepsLatMed: 0.5, frontDelts: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0.05, systemicFatigue: 0.3, localDamage: 0.45, skillDemand: 0.72, learningRate: 0.65, baseInjuryRisk: 0.25,
    riskTissues: ['shoulder', 'elbow', 'wrist', 'pec'], leverageExponents: { armLength: -0.3 }, metValue: 4.5, unilateral: true,
    adaptationBias: { maxStrength: 0.9, hypertrophy: 0.9, power: 0.3, muscularEndurance: 0.9 }, secondsPerRep: 4,
    evidenceNotes: 'Evidence is limited and practitioner-based; the incline lowers the load carried by the working arm, and one-arm work adds anti-rotation demand and some cross-education.', verified: false,
  }),
  ex({
    id: 'one_arm_push_up', name: 'One-arm push-up', aliases: ['OAPU'], category: 'calisthenics', movementPattern: 'calisthenics',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.7, refLoad: 36, repsModifier: 0.9, equipment: [],
    muscles: { midLowerChest: 1, upperChest: 0.5, frontDelts: 0.8, tricepsLatMed: 0.9, tricepsLong: 0.5, obliques: 0.5, rectusAbdominis: 0.35, gluteMed: 0.25, forearms: 0.25 },
    lengthBias: { midLowerChest: 0.8, upperChest: 0.7, tricepsLatMed: 0.5, frontDelts: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0.05, systemicFatigue: 0.4, localDamage: 0.45, skillDemand: 0.85, learningRate: 0.5, baseInjuryRisk: 0.3,
    riskTissues: ['shoulder', 'elbow', 'wrist', 'pec'], leverageExponents: { armLength: -0.3 }, metValue: 5.5, unilateral: true,
    adaptationBias: { maxStrength: 1, hypertrophy: 1, power: 0.4, muscularEndurance: 0.9 }, secondsPerRep: 5,
    evidenceNotes: 'Evidence is limited and practitioner-based; one arm carries most of the body weight with trunk anti-rotation, so it demands roughly twice the per-arm force of a two-arm push-up.', verified: false,
  }),
];
