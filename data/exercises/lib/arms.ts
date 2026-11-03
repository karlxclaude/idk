// Arm isolation library: elbow flexors (biceps, brachialis) and elbow extensors (triceps heads).
// refLoad = expected 1RM (kg) for the reference untrained 75 kg man at starting skill; dumbbell values are the sum of both bells. [HEUR]
// Lengthened-position bias follows Maeo 2023 (overhead triceps) and the long-muscle-length literature (Pedrosa 2022; Wolf 2023).
import { ex } from '../define';
import type { Exercise } from '../schema';

export const ARMS_EXERCISES: Exercise[] = [
  // --- elbow flexion ---
  ex({
    id: 'bayesian_cable_curl', name: 'Bayesian cable curl', aliases: ['behind-the-body cable curl'], category: 'arms', movementPattern: 'elbowFlexion',
    gymTier: 'commercial', refLoad: 20, equipment: ['cable'],
    muscles: { biceps: 1, brachialis: 0.5, forearms: 0.3 }, lengthBias: { biceps: 0.9 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.5, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 1 }, unilateral: true, secondsPerRep: 3,
    evidenceNotes: 'Facing away from the stack with the shoulder extended puts the biceps long head at long length under constant cable tension; long-length loading favours growth (Pedrosa 2022; Wolf 2023), but no trial tests this curl directly [HEUR].',
    verified: false,
  }),
  ex({
    id: 'preacher_curl', name: 'Preacher curl', category: 'arms', movementPattern: 'elbowFlexion', gymTier: 'commercial', refLoad: 26, equipment: ['barbell', 'bench'],
    muscles: { biceps: 1, brachialis: 0.6, forearms: 0.3 }, lengthBias: { biceps: 0.6 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.5, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Arm pinned forward on the pad removes swing and loads the stretched elbow-extended range; moderate stretch because the shoulder is flexed, which slackens the long head (Pedrosa 2022; Wolf 2023 on long-length training) [HEUR].',
    verified: false,
  }),
  ex({
    id: 'spider_curl', name: 'Spider curl', category: 'arms', movementPattern: 'elbowFlexion', gymTier: 'budget', refLoad: 22, equipment: ['dumbbell', 'bench'],
    muscles: { biceps: 1, brachialis: 0.5, forearms: 0.3 }, lengthBias: { biceps: 0.2 },
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.3, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 0.95 }, secondsPerRep: 2.5,
    evidenceNotes: 'Chest-supported with arms hanging vertical keeps tension in the shortened range; less stretch stimulus than lengthened curls (Pedrosa 2022; Wolf 2023 favour long-length loading), so a complement rather than a replacement [HEUR].',
    verified: false,
  }),
  ex({
    id: 'hammer_curl', name: 'Hammer curl', category: 'arms', movementPattern: 'elbowFlexion', gymTier: 'home', refLoad: 26, equipment: ['dumbbell'],
    muscles: { brachialis: 1, biceps: 0.5, forearms: 0.6 }, lengthBias: { biceps: 0.4, brachialis: 0.5 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.4, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.7, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Neutral grip shifts load from the biceps (a supinator) to brachialis and brachioradialis; region split is anatomical reasoning, as EMG is a weak proxy for growth [HEUR].',
    verified: false,
  }),
  ex({
    id: 'reverse_curl', name: 'Reverse curl', category: 'arms', movementPattern: 'elbowFlexion', gymTier: 'budget', refLoad: 22, equipment: ['barbell'],
    muscles: { brachialis: 1, forearms: 0.9, biceps: 0.4 }, lengthBias: { biceps: 0.4, brachialis: 0.5 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.4, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 0.95, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Pronated grip puts the biceps at a mechanical disadvantage, so brachialis, brachioradialis and wrist extensors limit the lift; grip-limited, with a higher wrist load [HEUR].',
    verified: false,
  }),
  ex({
    id: 'ez_bar_curl', name: 'EZ-bar curl', aliases: ['EZ curl'], category: 'arms', movementPattern: 'elbowFlexion', gymTier: 'budget', refLoad: 29, equipment: ['ez_bar'],
    muscles: { biceps: 1, brachialis: 0.65, forearms: 0.3 }, lengthBias: { biceps: 0.4 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.4, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.7, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Semi-supinated grip trades a little biceps supination for less wrist and forearm strain than the straight bar; elbow-flexor training adaptations are similar (Hubal 2005) [HEUR].',
    verified: false,
  }),
  ex({
    id: 'cable_curl', name: 'Cable curl', category: 'arms', movementPattern: 'elbowFlexion', gymTier: 'commercial', refLoad: 28, equipment: ['cable'],
    muscles: { biceps: 1, brachialis: 0.6, forearms: 0.3 }, lengthBias: { biceps: 0.45 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.4, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow', 'wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Constant cable tension through the whole range, including the stretched and shortened ends where free weights unload; shoulder neutral, so no extra long-head stretch [HEUR].',
    verified: false,
  }),
  // --- elbow extension ---
  ex({
    id: 'skull_crusher', name: 'Skull crusher', aliases: ['lying triceps extension'], category: 'arms', movementPattern: 'elbowExtension', gymTier: 'budget', refLoad: 30,
    equipment: ['ez_bar', 'bench'],
    muscles: { tricepsLong: 1, tricepsLatMed: 0.85 }, lengthBias: { tricepsLong: 0.7, tricepsLatMed: 0.45 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.5, skillDemand: 0.25, learningRate: 2, baseInjuryRisk: 0.12, riskTissues: ['elbow'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 1 }, secondsPerRep: 3,
    evidenceNotes: 'Shoulder flexed with the bar lowered behind the head lengthens the long head, so it sits between pushdown and overhead work (Maeo 2023 for overhead vs neutral); elbow tendon load is notable [HEUR].',
    verified: false,
  }),
  ex({
    id: 'tate_press', name: 'Tate press', category: 'arms', movementPattern: 'elbowExtension', gymTier: 'budget', refLoad: 22, equipment: ['dumbbell', 'bench'],
    muscles: { tricepsLatMed: 1, tricepsLong: 0.6 }, lengthBias: { tricepsLong: 0.5, tricepsLatMed: 0.4 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.4, skillDemand: 0.25, learningRate: 2, baseInjuryRisk: 0.12, riskTissues: ['elbow'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 0.95 }, secondsPerRep: 3,
    evidenceNotes: 'Elbows flared, dumbbells lowered to the chest; the arm stays near vertical so the long head is only moderately stretched (shoulder-flexion logic of Maeo 2023). Evidence is limited for any head-specific advantage [HEUR].',
    verified: false,
  }),
  ex({
    id: 'close_grip_push_up', name: 'Close-grip push-up', aliases: ['diamond push-up'], category: 'arms', movementPattern: 'elbowExtension', gymTier: 'home',
    loadType: 'bodyweight', bodyweightFraction: 0.64, refLoad: 60, equipment: [],
    muscles: { tricepsLatMed: 1, tricepsLong: 0.6, midLowerChest: 0.6, frontDelts: 0.5 }, lengthBias: { tricepsLatMed: 0.5, tricepsLong: 0.35 },
    axialLoad: 0.05, systemicFatigue: 0.25, localDamage: 0.3, skillDemand: 0.2, learningRate: 1.5, baseInjuryRisk: 0.15, riskTissues: ['elbow', 'wrist', 'shoulder'], metValue: 4,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 0.9, muscularEndurance: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Narrow hands shift the push-up toward the triceps; a triceps-biased bodyweight press that is easy to load by adding weight, not a stretched-position stimulus [HEUR].',
    verified: false,
  }),
  ex({
    id: 'db_overhead_triceps_extension', name: 'Dumbbell overhead triceps extension', aliases: ['French press'], category: 'arms', movementPattern: 'elbowExtension',
    gymTier: 'home', refLoad: 22, equipment: ['dumbbell'],
    muscles: { tricepsLong: 1, tricepsLatMed: 0.75 }, lengthBias: { tricepsLong: 0.9, tricepsLatMed: 0.5 },
    axialLoad: 0, systemicFatigue: 0.2, localDamage: 0.5, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['elbow'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.65, hypertrophy: 1 }, secondsPerRep: 3,
    evidenceNotes: 'Overhead arm position loads the long head at long length: whole triceps +19.9% vs +13.9% for the neutral arm position (Maeo 2023); long-length loading is favoured (Wolf 2023).',
    verified: true,
  }),
  ex({
    id: 'dip_machine_triceps', name: 'Seated dip machine (triceps)', category: 'arms', movementPattern: 'elbowExtension', gymTier: 'commercial', refLoad: 60, repsModifier: 1.1,
    equipment: ['machine'],
    muscles: { tricepsLatMed: 1, tricepsLong: 0.7, midLowerChest: 0.3, frontDelts: 0.3 }, lengthBias: { tricepsLatMed: 0.5, tricepsLong: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.25, localDamage: 0.35, skillDemand: 0.1, learningRate: 1.5, baseInjuryRisk: 0.12, riskTissues: ['elbow', 'shoulder'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.75, hypertrophy: 0.95 }, secondsPerRep: 2.5,
    evidenceNotes: 'Machine dip with the shoulder at or behind neutral keeps the long head short, so this is a heavy, easily loaded lateral/medial-head press, not a lengthened-position exercise (contrast Maeo 2023 overhead work) [HEUR].',
    verified: false,
  }),
];
