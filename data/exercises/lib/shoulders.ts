// Shoulder, rear-delt, rotator-cuff proxy and trap exercises. See docs/EXERCISE_AUTHORING.md.
// Note: there is no dedicated lower-trap or rotator-cuff region; lower traps are proxied by midTrapsRhomboids,
// and external rotators (infraspinatus/teres minor) by rearDelts. refLoad for dumbbell lifts = sum of both bells
// (per-hand load for unilateral lifts). [HEUR]
import { ex } from '../define';
import type { Exercise } from '../schema';

export const SHOULDERS_EXERCISES: Exercise[] = [
  // --- side/front delt isolation ---
  ex({
    id: 'cable_lateral_raise', name: 'Cable lateral raise', aliases: ['single-arm cable lateral raise'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'commercial', equipment: ['cable'], refLoad: 8, repsModifier: 1.05, unilateral: true,
    muscles: { sideDelts: 1, upperTraps: 0.25, frontDelts: 0.2 }, lengthBias: { sideDelts: 0.6 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.12, localDamage: 0.3, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 1, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Cable keeps tension at the bottom (shortened-to-mid range) where a dumbbell has almost none; direct hypertrophy comparisons are limited [HEUR].', verified: false,
  }),
  ex({
    id: 'lean_away_lateral_raise', name: 'Lean-away lateral raise', aliases: ['leaning cable lateral raise'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'commercial', equipment: ['cable'], refLoad: 8, repsModifier: 1.05, unilateral: true,
    muscles: { sideDelts: 1, upperTraps: 0.2, frontDelts: 0.2 }, lengthBias: { sideDelts: 0.7 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.12, localDamage: 0.35, skillDemand: 0.25, learningRate: 1.8, baseInjuryRisk: 0.1, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 1, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Leaning away from the anchor moves peak torque toward the stretched start position; evidence is limited, so the length bias is a mechanical inference [HEUR].', verified: false,
  }),
  ex({
    id: 'y_raise', name: 'Y raise', aliases: ['incline Y raise', 'prone Y raise'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'budget', equipment: ['dumbbell', 'bench'], refLoad: 8, repsModifier: 1.05,
    muscles: { sideDelts: 1, midTrapsRhomboids: 0.6, rearDelts: 0.3, upperTraps: 0.2 }, lengthBias: { sideDelts: 0.3, midTrapsRhomboids: 0.5 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.12, localDamage: 0.25, skillDemand: 0.3, learningRate: 1.8, baseInjuryRisk: 0.1, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.95, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Lower traps are proxied by midTrapsRhomboids (no dedicated lower-trap region); EMG shows high lower-trap activity but evidence for hypertrophy is limited.', verified: false,
  }),
  ex({
    id: 'lu_raise', name: 'Lu raise', aliases: ['Lu Xiaojun raise'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'home', equipment: ['dumbbell'], refLoad: 6, repsModifier: 1.05,
    muscles: { sideDelts: 1, frontDelts: 0.6, upperTraps: 0.3 }, lengthBias: { sideDelts: 0.3, frontDelts: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.3, skillDemand: 0.35, learningRate: 1.6, baseInjuryRisk: 0.12, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.95, muscularEndurance: 0.9 }, secondsPerRep: 3,
    evidenceNotes: 'Combined lateral raise to overhead arc loads side and front delts; evidence is limited, little direct research on this variation [HEUR].', verified: false,
  }),
  ex({
    id: 'front_raise', name: 'Dumbbell front raise', aliases: ['front raise'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'home', equipment: ['dumbbell'], refLoad: 12, repsModifier: 1.05,
    muscles: { frontDelts: 1, upperChest: 0.3, sideDelts: 0.2, upperTraps: 0.2 }, lengthBias: { frontDelts: 0.3, upperChest: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0, systemicFatigue: 0.12, localDamage: 0.25, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 0.9, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Front delts already receive heavy indirect volume from pressing, so marginal value is low; direct evidence is limited [HEUR].', verified: false,
  }),
  // --- rear delt / upper-back isolation ---
  ex({
    id: 'rear_delt_fly', name: 'Bent-over rear delt fly', aliases: ['rear delt raise', 'reverse fly'], category: 'shoulders', movementPattern: 'upperBackIsolation',
    gymTier: 'home', equipment: ['dumbbell'], refLoad: 10, repsModifier: 1.05,
    muscles: { rearDelts: 1, midTrapsRhomboids: 0.5, upperTraps: 0.2 }, lengthBias: { rearDelts: 0.5, midTrapsRhomboids: 0.5 }, resistanceProfile: 'ascending',
    axialLoad: 0.1, systemicFatigue: 0.12, localDamage: 0.3, skillDemand: 0.25, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.5, hypertrophy: 1, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Horizontal abduction isolates the posterior deltoid; torque peaks at the top with free weights. Direct hypertrophy data is limited [HEUR].', verified: false,
  }),
  ex({
    id: 'reverse_pec_deck', name: 'Reverse pec deck', aliases: ['rear delt machine fly', 'machine reverse fly'], category: 'shoulders', movementPattern: 'upperBackIsolation',
    gymTier: 'commercial', equipment: ['machine'], refLoad: 30, repsModifier: 1.15,
    muscles: { rearDelts: 1, midTrapsRhomboids: 0.5, upperTraps: 0.2 }, lengthBias: { rearDelts: 0.55, midTrapsRhomboids: 0.5 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.3, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.08, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.6, hypertrophy: 1, muscularEndurance: 0.9 }, secondsPerRep: 2.5,
    evidenceNotes: 'Chest-supported machine gives constant tension on the rear delts with minimal skill demand [HEUR].', verified: false,
  }),
  ex({
    id: 'cuban_press', name: 'Cuban press', aliases: ['Cuban rotation'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'home', equipment: ['dumbbell'], refLoad: 12, repsModifier: 1.05,
    muscles: { rearDelts: 0.8, sideDelts: 0.6, midTrapsRhomboids: 0.4, upperTraps: 0.3 }, lengthBias: { rearDelts: 0.4, sideDelts: 0.3 }, resistanceProfile: 'bell',
    axialLoad: 0, systemicFatigue: 0.15, localDamage: 0.2, skillDemand: 0.4, learningRate: 1.5, baseInjuryRisk: 0.12, riskTissues: ['shoulder'], metValue: 3,
    adaptationBias: { maxStrength: 0.4, hypertrophy: 0.7, muscularEndurance: 1 }, secondsPerRep: 4,
    evidenceNotes: 'Rotator cuff has no dedicated region, so rear and side delts plus mid traps stand in as a proxy; evidence is limited and loads are light.', verified: false,
  }),
  ex({
    id: 'external_rotation_cable', name: 'Cable external rotation', aliases: ['cable shoulder external rotation', 'band external rotation'], category: 'shoulders', movementPattern: 'shoulderIsolation',
    gymTier: 'commercial', equipment: ['cable'], refLoad: 6, repsModifier: 1.1, unilateral: true,
    muscles: { rearDelts: 0.6 }, lengthBias: { rearDelts: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.1, localDamage: 0.1, skillDemand: 0.25, learningRate: 1.8, baseInjuryRisk: 0.05, riskTissues: ['shoulder'], metValue: 2.5,
    adaptationBias: { maxStrength: 0.4, hypertrophy: 0.3, muscularEndurance: 1.2 }, secondsPerRep: 3,
    evidenceNotes: 'Prehab for infraspinatus/teres minor; no rotator cuff region exists so rearDelts 0.6 is a proxy. Evidence is limited and effects are modest.', verified: false,
  }),
  // --- trap / upright pulling ---
  ex({
    id: 'upright_row', name: 'Upright row', aliases: ['barbell upright row'], category: 'shoulders', movementPattern: 'upperBackIsolation',
    gymTier: 'budget', equipment: ['barbell'], refLoad: 35, repsModifier: 1.0,
    muscles: { sideDelts: 1, upperTraps: 1, frontDelts: 0.3, biceps: 0.2, forearms: 0.3 }, lengthBias: { sideDelts: 0.3, upperTraps: 0.3 }, resistanceProfile: 'bell',
    axialLoad: 0.2, systemicFatigue: 0.25, localDamage: 0.35, skillDemand: 0.3, learningRate: 1.6, baseInjuryRisk: 0.25, riskTissues: ['shoulder', 'wrist'], metValue: 4,
    adaptationBias: { maxStrength: 0.7, hypertrophy: 1 }, secondsPerRep: 2.5,
    evidenceNotes: 'Internal rotation under load at or above chest height is a recognised impingement concern; a wider grip and stopping at sternum level reduce it. Direct evidence is limited [HEUR].', verified: false,
  }),
  ex({
    id: 'barbell_shrug', name: 'Barbell shrug', aliases: ['shrug'], category: 'shoulders', movementPattern: 'upperBackIsolation',
    gymTier: 'budget', equipment: ['barbell'], refLoad: 100, repsModifier: 0.95,
    muscles: { upperTraps: 1, forearms: 0.5, midTrapsRhomboids: 0.2 }, lengthBias: { upperTraps: 0.3 }, resistanceProfile: 'bell',
    axialLoad: 0.45, systemicFatigue: 0.25, localDamage: 0.25, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.8, hypertrophy: 1, muscularEndurance: 0.8 }, secondsPerRep: 2.5,
    evidenceNotes: 'Upper trap elevation with heavy grip demand; grip often limits load before the traps do. Direct hypertrophy data is limited [HEUR].', verified: false,
  }),
  ex({
    id: 'db_shrug', name: 'Dumbbell shrug', category: 'shoulders', movementPattern: 'upperBackIsolation',
    gymTier: 'home', equipment: ['dumbbell'], refLoad: 70, repsModifier: 1.0,
    muscles: { upperTraps: 1, forearms: 0.5, midTrapsRhomboids: 0.2 }, lengthBias: { upperTraps: 0.35 }, resistanceProfile: 'bell',
    axialLoad: 0.4, systemicFatigue: 0.25, localDamage: 0.25, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.08, riskTissues: ['wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.8, hypertrophy: 1, muscularEndurance: 0.8 }, secondsPerRep: 2.5,
    evidenceNotes: 'Neutral-grip dumbbells allow a freer path at the sides; load is the sum of both bells and grip is the usual limiter [HEUR].', verified: false,
  }),
  ex({
    id: 'trap_bar_shrug', name: 'Trap bar shrug', aliases: ['hex bar shrug'], category: 'shoulders', movementPattern: 'upperBackIsolation',
    gymTier: 'powerlifting', equipment: ['trap bar'], refLoad: 110, repsModifier: 0.95,
    muscles: { upperTraps: 1, forearms: 0.5, midTrapsRhomboids: 0.2 }, lengthBias: { upperTraps: 0.3 }, resistanceProfile: 'bell',
    axialLoad: 0.5, systemicFatigue: 0.3, localDamage: 0.25, skillDemand: 0.1, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['wrist'], metValue: 3.5,
    adaptationBias: { maxStrength: 0.8, hypertrophy: 1, muscularEndurance: 0.8 }, secondsPerRep: 2.5,
    evidenceNotes: 'Load sits at the sides so the bar does not clip the thighs and heavier weights are possible; direct hypertrophy data is limited [HEUR].', verified: false,
  }),
];
