// Trunk / core exercises (anti-extension, anti-rotation, flexion, isometric holds, carries). See docs/EXERCISE_AUTHORING.md.
// refLoad = expected 1RM (kg) for the reference untrained 75 kg man at starting skill; bodyweight lifts use total system load. [HEUR]
import { ex } from '../define';
import type { Exercise } from '../schema';

export const TRUNK_EXERCISES: Exercise[] = [
  ex({
    id: 'hanging_leg_raise', name: 'Hanging leg raise', aliases: ['hanging knee raise'], category: 'core', movementPattern: 'core', gymTier: 'home', equipment: ['bar'],
    loadType: 'bodyweight', bodyweightFraction: 0.35, refLoad: 45,
    muscles: { rectusAbdominis: 1, forearms: 0.4, obliques: 0.4, rectusFemoris: 0.3, lats: 0.2 }, lengthBias: { rectusAbdominis: 0.4 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.3, skillDemand: 0.35, learningRate: 1.2, baseInjuryRisk: 0.15, riskTissues: ['shoulder', 'hip'], metValue: 3.8,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 0.9, muscularEndurance: 1 }, secondsPerRep: 3,
    evidenceNotes: 'Captain\'s-chair leg raise gave among the highest rectus abdominis EMG of the exercises tested (Escamilla 2006); hanging version also taxes grip. Hip flexors share the work.', verified: false,
  }),
  ex({
    id: 'ab_wheel_rollout', name: 'Ab wheel rollout', aliases: ['ab roller'], category: 'core', movementPattern: 'core', gymTier: 'home', equipment: ['ab wheel'],
    loadType: 'bodyweight', bodyweightFraction: 0.5, refLoad: 50,
    muscles: { rectusAbdominis: 1, obliques: 0.5, lats: 0.3, frontDelts: 0.2, spinalErectors: 0.2 }, lengthBias: { rectusAbdominis: 0.9, lats: 0.6 }, resistanceProfile: 'descending',
    axialLoad: 0.05, systemicFatigue: 0.2, localDamage: 0.4, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.25, riskTissues: ['lowBack', 'shoulder'], metValue: 4,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 0.9, muscularEndurance: 0.9 }, secondsPerRep: 4,
    evidenceNotes: 'Ab roller produced very high rectus abdominis EMG and loads the trunk in a lengthened position (Escamilla 2006). Lumbar extension under load raises low-back risk if the brace fails.', verified: true,
  }),
  ex({
    id: 'cable_crunch', name: 'Cable crunch', category: 'core', movementPattern: 'core', gymTier: 'commercial', refLoad: 50, repsModifier: 1.2, equipment: ['cable'],
    muscles: { rectusAbdominis: 1, obliques: 0.4 }, lengthBias: { rectusAbdominis: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.15, localDamage: 0.3, skillDemand: 0.2, learningRate: 1.7, baseInjuryRisk: 0.1, riskTissues: ['lowBack'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 1 }, secondsPerRep: 3,
    evidenceNotes: 'Loadable trunk flexion allows progressive overload of the rectus abdominis; no direct hypertrophy trial, so the effect is inferred from general load-progression logic [HEUR].', verified: false,
  }),
  ex({
    id: 'dragon_flag', name: 'Dragon flag', category: 'core', movementPattern: 'core', gymTier: 'home', equipment: ['bench'],
    loadType: 'bodyweight', bodyweightFraction: 0.7, refLoad: 40,
    muscles: { rectusAbdominis: 1, obliques: 0.6, lats: 0.4, spinalErectors: 0.3, rectusFemoris: 0.3, forearms: 0.3, frontDelts: 0.2 }, lengthBias: { rectusAbdominis: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0.05, systemicFatigue: 0.25, localDamage: 0.5, skillDemand: 0.6, learningRate: 0.6, baseInjuryRisk: 0.3, riskTissues: ['lowBack', 'neck', 'shoulder'], metValue: 4.5,
    adaptationBias: { maxStrength: 0.7, hypertrophy: 0.9, muscularEndurance: 0.7 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited; a long-lever anti-extension and hip-flexion skill that most untrained lifters cannot perform without regressions. Neck and shoulder load the support points.', verified: false,
  }),
  ex({
    id: 'pallof_press', name: 'Pallof press', aliases: ['anti-rotation press'], category: 'core', movementPattern: 'core', gymTier: 'commercial', refLoad: 20, equipment: ['cable'],
    muscles: { obliques: 1, rectusAbdominis: 0.3, gluteMed: 0.2, frontDelts: 0.2 }, lengthBias: { obliques: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.1, localDamage: 0.1, skillDemand: 0.2, learningRate: 1.7, baseInjuryRisk: 0.05, riskTissues: [], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.5, muscularEndurance: 1.1 }, unilateral: true, secondsPerRep: 4,
    evidenceNotes: 'Evidence is limited; anti-rotation drill that loads the obliques isometrically with little spinal compression. Performed one side at a time.', verified: false,
  }),
  ex({
    id: 'side_plank', name: 'Side plank', aliases: ['side bridge'], category: 'core', movementPattern: 'core', gymTier: 'home', loadType: 'none', equipment: [],
    muscles: { obliques: 1, gluteMed: 0.5, rectusAbdominis: 0.3, spinalErectors: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.1, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.05, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.3, hypertrophy: 0.5, muscularEndurance: 1.2 }, unilateral: true, secondsPerRep: 30,
    evidenceNotes: 'Side bridge gives high oblique and gluteus medius activation at low spinal load (Ekstrom 2007).', verified: true,
  }),
  ex({
    id: 'dead_bug', name: 'Dead bug', category: 'core', movementPattern: 'core', gymTier: 'home', loadType: 'none', equipment: [],
    muscles: { rectusAbdominis: 1, obliques: 0.6, rectusFemoris: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.1, skillDemand: 0.25, learningRate: 1.7, baseInjuryRisk: 0.03, riskTissues: [], metValue: 2.8,
    adaptationBias: { maxStrength: 0.2, hypertrophy: 0.4, muscularEndurance: 1.2 }, secondsPerRep: 4,
    evidenceNotes: 'Evidence is limited; low-load anti-extension motor-control drill with small stimulus for trained lifters.', verified: false,
  }),
  ex({
    id: 'l_sit', name: 'L-sit', category: 'core', movementPattern: 'core', gymTier: 'home', equipment: ['parallettes'],
    loadType: 'bodyweight', bodyweightFraction: 0.6, refLoad: 50,
    muscles: { rectusAbdominis: 1, rectusFemoris: 0.5, tricepsLatMed: 0.3, tricepsLong: 0.3, obliques: 0.3, lats: 0.3, frontDelts: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.2, localDamage: 0.2, skillDemand: 0.5, learningRate: 0.9, baseInjuryRisk: 0.1, riskTissues: ['wrist', 'shoulder'], metValue: 4,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.6, muscularEndurance: 1.1 }, secondsPerRep: 10,
    evidenceNotes: 'Evidence is limited; isometric hip-flexion hold with scapular depression and triceps support. Hip flexors and triceps limit hold time as much as the abs.', verified: false,
  }),
  ex({
    id: 'hollow_body_hold', name: 'Hollow body hold', category: 'core', movementPattern: 'core', gymTier: 'home', loadType: 'none', equipment: [],
    muscles: { rectusAbdominis: 1, obliques: 0.5, rectusFemoris: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.1, skillDemand: 0.3, learningRate: 1.7, baseInjuryRisk: 0.05, riskTissues: ['lowBack'], metValue: 3,
    adaptationBias: { maxStrength: 0.3, hypertrophy: 0.5, muscularEndurance: 1.2 }, secondsPerRep: 30,
    evidenceNotes: 'Evidence is limited; isometric anti-extension hold, progressed by lengthening the lever.', verified: false,
  }),
  ex({
    id: 'weighted_decline_sit_up', name: 'Weighted decline sit-up', category: 'core', movementPattern: 'core', gymTier: 'budget', refLoad: 25, equipment: ['decline bench', 'plate'],
    loadType: 'external',
    muscles: { rectusAbdominis: 1, rectusFemoris: 0.4, obliques: 0.3 }, lengthBias: { rectusAbdominis: 0.7 }, resistanceProfile: 'descending',
    axialLoad: 0.1, systemicFatigue: 0.2, localDamage: 0.35, skillDemand: 0.15, learningRate: 1.7, baseInjuryRisk: 0.15, riskTissues: ['lowBack', 'hip'], metValue: 3.8,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 1 }, secondsPerRep: 3,
    evidenceNotes: 'Decline angle raises load at the lengthened bottom position; hip flexors take a large share and lumbar flexion under load can irritate the back [HEUR].', verified: false,
  }),
  ex({
    id: 'landmine_rotation', name: 'Landmine rotation', aliases: ['landmine twist'], category: 'core', movementPattern: 'core', gymTier: 'budget', refLoad: 20, equipment: ['barbell', 'landmine'],
    muscles: { obliques: 1, rectusAbdominis: 0.3, frontDelts: 0.3, spinalErectors: 0.3, gluteMed: 0.2 }, lengthBias: { obliques: 0.5 }, resistanceProfile: 'bell',
    axialLoad: 0.1, systemicFatigue: 0.2, localDamage: 0.2, skillDemand: 0.35, learningRate: 1.3, baseInjuryRisk: 0.15, riskTissues: ['lowBack', 'shoulder'], metValue: 4,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.8, power: 0.7 }, secondsPerRep: 3,
    evidenceNotes: 'Evidence is limited; loaded rotation trains the obliques through range, with some rotational power transfer [HEUR].', verified: false,
  }),
  ex({
    id: 'suitcase_carry', name: 'Suitcase carry', category: 'core', movementPattern: 'carry', gymTier: 'budget', refLoad: 50, equipment: ['dumbbell', 'kettlebell'],
    muscles: { obliques: 1, forearms: 0.8, upperTraps: 0.5, gluteMed: 0.4, spinalErectors: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0.35, systemicFatigue: 0.3, localDamage: 0.15, skillDemand: 0.2, learningRate: 1.5, baseInjuryRisk: 0.15, riskTissues: ['lowBack'], metValue: 5,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.5, muscularEndurance: 1 }, unilateral: true, secondsPerRep: 20,
    evidenceNotes: 'Evidence is limited; one-sided loaded carry resists lateral flexion, loading the obliques and grip. 1RM is the single heaviest implement carried for a short distance.', verified: false,
  }),
];
