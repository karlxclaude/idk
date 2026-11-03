// Grip (forearm) and neck exercises. Evidence for direct forearm and neck hypertrophy work is thin; effects are kept modest. [HEUR]
// refLoad = expected 1RM (kg) for the reference untrained 75 kg man at starting skill.
import { ex } from '../define';
import type { Exercise } from '../schema';

export const GRIP_NECK_EXERCISES: Exercise[] = [
  // --- grip ---
  ex({
    id: 'thick_bar_hold', name: 'Thick-bar (axle) hold', aliases: ['fat grip hold', 'axle hold'], category: 'grip', movementPattern: 'grip',
    gymTier: 'powerlifting', equipment: ['axle', 'rack'], refLoad: 60, secondsPerRep: 10,
    muscles: { forearms: 1, upperTraps: 0.25 }, lengthBias: { forearms: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0.3, systemicFatigue: 0.2, localDamage: 0.2, skillDemand: 0.1, learningRate: 1.8, baseInjuryRisk: 0.2, riskTissues: ['wrist', 'elbow'], metValue: 3.5,
    adaptationBias: { hypertrophy: 0.6, maxStrength: 0.8, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Isometric crush/support grip with a large-diameter implement; strength gains are grip-specific and direct hypertrophy evidence is sparse [HEUR].', verified: false,
  }),
  ex({
    id: 'plate_pinch', name: 'Plate pinch hold', aliases: ['plate pinch'], category: 'grip', movementPattern: 'grip',
    gymTier: 'budget', equipment: ['plates'], refLoad: 25, secondsPerRep: 10,
    muscles: { forearms: 1 }, lengthBias: { forearms: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.15, localDamage: 0.2, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.15, riskTissues: ['wrist', 'elbow'], metValue: 3,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.7, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Thumb-opposed pinch grip with smooth plates; pinch strength is specific and hypertrophy evidence is sparse [HEUR].', verified: false,
  }),
  ex({
    id: 'hand_gripper', name: 'Hand gripper close', aliases: ['gripper', 'captains of crush'], category: 'grip', movementPattern: 'grip',
    gymTier: 'home', equipment: ['gripper'], refLoad: 20, repsModifier: 1.2, secondsPerRep: 2.5,
    muscles: { forearms: 1 }, lengthBias: { forearms: 0.2 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.2, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['wrist', 'elbow'], metValue: 3,
    adaptationBias: { hypertrophy: 0.6, maxStrength: 0.7, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Dynamic crush grip in a shortened range; load is spring-rated and progression is coarse [HEUR].', verified: false,
  }),
  ex({
    id: 'wrist_roller', name: 'Wrist roller', category: 'grip', movementPattern: 'grip',
    gymTier: 'budget', equipment: ['wrist roller', 'plate'], refLoad: 10, secondsPerRep: 15,
    muscles: { forearms: 1, frontDelts: 0.3 }, lengthBias: { forearms: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.25, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.15, riskTissues: ['wrist', 'elbow'], metValue: 3,
    adaptationBias: { hypertrophy: 0.7, maxStrength: 0.5, power: 0, muscularEndurance: 1.1 },
    evidenceNotes: 'Alternating wrist flexion/extension under constant load while the front delts hold the arms out; a rep is one full roll-up [HEUR].', verified: false,
  }),
  ex({
    id: 'wrist_curl', name: 'Barbell wrist curl', aliases: ['forearm curl'], category: 'grip', movementPattern: 'grip',
    gymTier: 'budget', equipment: ['barbell', 'bench'], refLoad: 30, repsModifier: 1.2, secondsPerRep: 2.5,
    muscles: { forearms: 1 }, lengthBias: { forearms: 0.7 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.3, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['wrist', 'elbow'], metValue: 3,
    adaptationBias: { hypertrophy: 0.9, maxStrength: 0.6, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Isolated wrist flexor work; direct trials are few, but forearm flexors respond to loaded stretch and high reps [HEUR].', verified: false,
  }),
  ex({
    id: 'reverse_wrist_curl', name: 'Reverse wrist curl', aliases: ['wrist extension'], category: 'grip', movementPattern: 'grip',
    gymTier: 'budget', equipment: ['barbell', 'bench'], refLoad: 15, repsModifier: 1.2, secondsPerRep: 2.5,
    muscles: { forearms: 1 }, lengthBias: { forearms: 0.6 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.3, skillDemand: 0.15, learningRate: 2, baseInjuryRisk: 0.12, riskTissues: ['wrist', 'elbow'], metValue: 3,
    adaptationBias: { hypertrophy: 0.8, maxStrength: 0.5, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Isolated wrist extensor work; extensors are weaker than flexors so loads are about half [HEUR].', verified: false,
  }),
  ex({
    id: 'rice_bucket', name: 'Rice bucket drill', aliases: ['rice bucket'], category: 'grip', movementPattern: 'grip',
    gymTier: 'home', loadType: 'none', equipment: ['bucket', 'rice'], secondsPerRep: 30,
    muscles: { forearms: 1 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.1, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.05, riskTissues: ['wrist', 'elbow'], metValue: 2.5,
    adaptationBias: { hypertrophy: 0.25, maxStrength: 0.2, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Evidence is limited: low-load, high-volume finger and wrist work used for conditioning and tendon tolerance, not proven for growth.', verified: false,
  }),
  ex({
    id: 'towel_pull_up_hang', name: 'Towel hang', aliases: ['towel dead hang'], category: 'grip', movementPattern: 'grip',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 1.0, refLoad: 75, equipment: ['bar', 'towel'], secondsPerRep: 10,
    muscles: { forearms: 1, lats: 0.4 }, lengthBias: { forearms: 0.5, lats: 0.9 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.25, localDamage: 0.25, skillDemand: 0.2, learningRate: 1.5, baseInjuryRisk: 0.15, riskTissues: ['wrist', 'elbow'], metValue: 3.5,
    adaptationBias: { hypertrophy: 0.5, maxStrength: 0.7, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Bodyweight hang from towels; the thick, unstable implement raises grip demand and the lats are loaded at long length [HEUR].', verified: false,
  }),
  // --- neck ---
  ex({
    id: 'neck_flexion_plate', name: 'Weighted neck flexion', aliases: ['plate neck curl'], category: 'neck', movementPattern: 'neck',
    gymTier: 'budget', equipment: ['plate', 'bench'], refLoad: 10, repsModifier: 1.2, secondsPerRep: 3,
    muscles: { neckFlexors: 1 }, lengthBias: { neckFlexors: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0.1, systemicFatigue: 0.1, localDamage: 0.2, skillDemand: 0.2, learningRate: 1.8, baseInjuryRisk: 0.2, riskTissues: ['neck'], metValue: 3,
    adaptationBias: { hypertrophy: 0.8, maxStrength: 0.7, power: 0.1, muscularEndurance: 0.9 },
    evidenceNotes: 'Evidence is limited: small trials show neck flexor strength and size gains with progressive loading; use light loads and strict control.', verified: false,
  }),
  ex({
    id: 'neck_extension_harness', name: 'Harness neck extension', aliases: ['neck harness extension'], category: 'neck', movementPattern: 'neck',
    gymTier: 'budget', equipment: ['head harness', 'plate'], refLoad: 15, repsModifier: 1.2, secondsPerRep: 3,
    muscles: { neckExtensors: 1, upperTraps: 0.4 }, lengthBias: { neckExtensors: 0.7, upperTraps: 0.4 }, resistanceProfile: 'bell',
    axialLoad: 0.15, systemicFatigue: 0.15, localDamage: 0.25, skillDemand: 0.25, learningRate: 1.6, baseInjuryRisk: 0.2, riskTissues: ['neck'], metValue: 3,
    adaptationBias: { hypertrophy: 0.8, maxStrength: 0.7, power: 0.1, muscularEndurance: 0.9 },
    evidenceNotes: 'Evidence is limited: small trials show neck extensor strength and size gains with progressive loading; extensors tolerate more load than flexors.', verified: false,
  }),
  ex({
    id: 'neck_lateral_flexion', name: 'Weighted lateral neck flexion', aliases: ['side neck raise'], category: 'neck', movementPattern: 'neck',
    gymTier: 'budget', equipment: ['plate', 'bench'], refLoad: 8, repsModifier: 1.2, secondsPerRep: 3, unilateral: true,
    muscles: { neckFlexors: 0.8, neckExtensors: 0.7 }, lengthBias: { neckFlexors: 0.5, neckExtensors: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0.05, systemicFatigue: 0.1, localDamage: 0.2, skillDemand: 0.25, learningRate: 1.6, baseInjuryRisk: 0.2, riskTissues: ['neck'], metValue: 3,
    adaptationBias: { hypertrophy: 0.7, maxStrength: 0.6, power: 0.1, muscularEndurance: 0.9 },
    evidenceNotes: 'Evidence is limited: side-lying lateral flexion loads the sternocleidomastoid, scalenes and splenius together; keep loads light.', verified: false,
  }),
  ex({
    id: 'neck_band_isometrics', name: 'Band neck isometrics', aliases: ['neck isometric holds'], category: 'neck', movementPattern: 'neck',
    gymTier: 'home', loadType: 'none', equipment: ['resistance band'], secondsPerRep: 10,
    muscles: { neckFlexors: 0.8, neckExtensors: 0.8 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.05, localDamage: 0.1, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['neck'], metValue: 2.5,
    adaptationBias: { hypertrophy: 0.4, maxStrength: 0.6, power: 0, muscularEndurance: 1 },
    evidenceNotes: 'Evidence is limited: band-resisted isometric holds in four directions raise neck strength modestly and are a low-risk starting point.', verified: false,
  }),
  ex({
    id: 'neck_bridge', name: 'Wrestler neck bridge', aliases: ['neck bridge'], category: 'neck', movementPattern: 'neck',
    gymTier: 'home', loadType: 'bodyweight', bodyweightFraction: 0.35, refLoad: 35, equipment: [], secondsPerRep: 5,
    muscles: { neckExtensors: 1, neckFlexors: 0.6, upperTraps: 0.3 }, lengthBias: { neckExtensors: 0.7 }, resistanceProfile: 'flat',
    axialLoad: 0.3, systemicFatigue: 0.2, localDamage: 0.3, skillDemand: 0.5, learningRate: 0.8, baseInjuryRisk: 0.7, riskTissues: ['neck'], metValue: 3.5,
    adaptationBias: { hypertrophy: 0.7, maxStrength: 0.6, power: 0, muscularEndurance: 0.9 },
    evidenceNotes: 'Evidence is limited and risk is HIGH: body weight compresses the cervical spine in extreme extension, so build up with a mat and slow rocking only.', verified: false,
  }),
];
