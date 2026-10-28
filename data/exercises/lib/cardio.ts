// Cardio library (Phase 2). Style follows the cardio block in ../core.ts. MET values: 2024 Adult Compendium where an entry exists, else analogues [HEUR].
import { ex } from '../define';
import type { Exercise } from '../schema';

export const CARDIO_EXERCISES: Exercise[] = [
  // --- running ---
  ex({
    id: 'long_run', name: 'Long run', category: 'cardio', movementPattern: 'cardio', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { gastrocnemius: 0.3, soleus: 0.5, vasti: 0.25, hamstrings: 0.2, gluteMax: 0.25 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.45, localDamage: 0.3, skillDemand: 0.2, learningRate: 1.5, baseInjuryRisk: 0.55, riskTissues: ['shin', 'achilles', 'knee', 'tibia'], metValue: 9,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'running', defaultZone: 1, impact: 1 }, secondsPerRep: 60,
    evidenceNotes: 'Long Zone 1 run; abrupt weekly mileage jumps (>30%) raise injury risk in novices (Nielsen 2014).', verified: true,
  }),
  ex({
    id: 'track_400s', name: 'Track 400 m repeats', category: 'cardio', movementPattern: 'cardio', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { gastrocnemius: 0.3, soleus: 0.4, vasti: 0.4, hamstrings: 0.35, gluteMax: 0.3 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.65, localDamage: 0.4, skillDemand: 0.25, learningRate: 1.5, baseInjuryRisk: 0.65, riskTissues: ['shin', 'achilles', 'knee', 'tibia', 'hamstrings'], metValue: 12,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.1, muscularEndurance: 0, aerobic: 1.05 }, cardio: { modality: 'running', defaultZone: 3, impact: 1 }, secondsPerRep: 60,
    evidenceNotes: 'Intervals near vVO2max accumulate more time at high VO2 than continuous running (Billat 2001).', verified: true,
  }),
  ex({
    id: 'hill_repeats_run', name: 'Hill repeats (running)', category: 'cardio', movementPattern: 'cardio', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { gastrocnemius: 0.4, soleus: 0.4, vasti: 0.4, hamstrings: 0.3, gluteMax: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.65, localDamage: 0.35, skillDemand: 0.25, learningRate: 1.5, baseInjuryRisk: 0.6, riskTissues: ['shin', 'achilles', 'knee', 'tibia', 'calf'], metValue: 11,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.1, muscularEndurance: 0, aerobic: 1.05 }, cardio: { modality: 'running', defaultZone: 3, impact: 1 }, secondsPerRep: 60,
    evidenceNotes: 'Uphill running lowers vertical impact peaks (Gottschall 2005) but loads glutes and calves more; training-study evidence is limited.', verified: false,
  }),
  // --- cycling ---
  ex({
    id: 'road_cycling', name: 'Road cycling', category: 'cardio', movementPattern: 'cardio', gymTier: 'outdoor', loadType: 'none', equipment: ['bike'],
    muscles: { vasti: 0.4, gluteMax: 0.25, hamstrings: 0.15, gastrocnemius: 0.15 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.35, localDamage: 0.1, skillDemand: 0.25, learningRate: 1.5, baseInjuryRisk: 0.2, riskTissues: ['knee', 'lowBack'], metValue: 8,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'cycling', defaultZone: 1, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Non-impact outdoor endurance work; cycling interferes less with strength gains than running (Wilson 2012). Crash risk included in base risk.', verified: true,
  }),
  ex({
    id: 'cycling_intervals', name: 'Cycling intervals', category: 'cardio', movementPattern: 'cardio', gymTier: 'budget', loadType: 'none', equipment: ['bike'],
    muscles: { vasti: 0.5, gluteMax: 0.3, hamstrings: 0.2, gastrocnemius: 0.15 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.55, localDamage: 0.15, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.15, riskTissues: ['knee'], metValue: 10,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.05, muscularEndurance: 0, aerobic: 1.1 }, cardio: { modality: 'cycling', defaultZone: 3, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'High-intensity intervals raise VO2max efficiently (Laursen 2002), with no impact cost.', verified: true,
  }),
  ex({
    id: 'air_bike_intervals', name: 'Air bike intervals', category: 'cardio', movementPattern: 'cardio', gymTier: 'commercial', loadType: 'none', equipment: ['airBike'],
    muscles: { vasti: 0.5, gluteMax: 0.3, hamstrings: 0.2, gastrocnemius: 0.15, lats: 0.3, tricepsLatMed: 0.25, biceps: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.65, localDamage: 0.2, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.15, riskTissues: ['knee'], metValue: 10,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0, power: 0.1, muscularEndurance: 0, aerobic: 1.1 }, cardio: { modality: 'airBike', defaultZone: 3, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Whole-body sprint intervals; low-volume high-intensity work improves aerobic fitness (Gibala 2012).', verified: true,
  }),
  // --- rowing ---
  ex({
    id: 'rowing_2k_piece', name: 'Rowing 2000 m piece', category: 'cardio', movementPattern: 'cardio', gymTier: 'budget', loadType: 'none', equipment: ['rower'],
    muscles: { vasti: 0.5, gluteMax: 0.4, lats: 0.4, spinalErectors: 0.4, hamstrings: 0.25, biceps: 0.25, midTrapsRhomboids: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.2, systemicFatigue: 0.8, localDamage: 0.25, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.2, riskTissues: ['lowBack'], metValue: 12,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0, power: 0.1, muscularEndurance: 0, aerobic: 1.1 }, cardio: { modality: 'rowing', defaultZone: 3, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Maximal 6-8 min effort taxing VO2max and anaerobic capacity; direct training-study evidence is limited.', verified: false,
  }),
  ex({
    id: 'rowing_500m_intervals', name: 'Rowing 500 m intervals', category: 'cardio', movementPattern: 'cardio', gymTier: 'budget', loadType: 'none', equipment: ['rower'],
    muscles: { vasti: 0.5, gluteMax: 0.35, lats: 0.35, spinalErectors: 0.35, hamstrings: 0.2, biceps: 0.25, midTrapsRhomboids: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.2, systemicFatigue: 0.65, localDamage: 0.25, skillDemand: 0.35, learningRate: 1.3, baseInjuryRisk: 0.18, riskTissues: ['lowBack'], metValue: 11,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0, power: 0.1, muscularEndurance: 0, aerobic: 1.1 }, cardio: { modality: 'rowing', defaultZone: 3, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Repeated short efforts allow VO2max-range work with controlled recovery (Laursen 2002).', verified: true,
  }),
  ex({
    id: 'ski_erg', name: 'Ski erg', category: 'cardio', movementPattern: 'cardio', gymTier: 'commercial', loadType: 'none', equipment: ['skiErg'],
    muscles: { lats: 0.5, tricepsLong: 0.3, tricepsLatMed: 0.3, rectusAbdominis: 0.35, vasti: 0.2, gluteMax: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.45, localDamage: 0.2, skillDemand: 0.4, learningRate: 1.3, baseInjuryRisk: 0.15, riskTissues: ['shoulder', 'lowBack'], metValue: 8,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'skiErg', defaultZone: 2, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Upper-body-dominant non-impact ergometer. Evidence is limited; MET extrapolated from rowing.', verified: false,
  }),
  // --- swimming ---
  ex({
    id: 'swim_steady', name: 'Swimming (steady)', category: 'cardio', movementPattern: 'cardio', gymTier: 'pool', loadType: 'none', equipment: [],
    muscles: { lats: 0.45, frontDelts: 0.3, sideDelts: 0.2, rearDelts: 0.2, tricepsLatMed: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.3, localDamage: 0.1, skillDemand: 0.6, learningRate: 0.8, baseInjuryRisk: 0.12, riskTissues: ['shoulder'], metValue: 6,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'swimming', defaultZone: 1, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Non-impact; economy is strongly technique dependent. Shoulder overuse is the main swimming injury; evidence for muscle gain is limited.', verified: false,
  }),
  ex({
    id: 'swim_intervals', name: 'Swim intervals', category: 'cardio', movementPattern: 'cardio', gymTier: 'pool', loadType: 'none', equipment: [],
    muscles: { lats: 0.5, frontDelts: 0.35, sideDelts: 0.2, rearDelts: 0.2, tricepsLatMed: 0.25 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.6, localDamage: 0.15, skillDemand: 0.6, learningRate: 0.8, baseInjuryRisk: 0.15, riskTissues: ['shoulder'], metValue: 9.8,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.05, muscularEndurance: 0, aerobic: 1.1 }, cardio: { modality: 'swimming', defaultZone: 3, impact: 0 }, secondsPerRep: 60,
    evidenceNotes: 'Hard-pace swim repeats; technique degrades with fatigue and training-study evidence in non-swimmers is limited.', verified: false,
  }),
  // --- walking / loaded / stepping ---
  ex({
    id: 'rucking', name: 'Rucking', category: 'cardio', movementPattern: 'cardio', gymTier: 'outdoor', loadType: 'none', equipment: ['rucksack'],
    muscles: { gluteMax: 0.3, vasti: 0.3, soleus: 0.3, hamstrings: 0.2, gastrocnemius: 0.2, spinalErectors: 0.25, upperTraps: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.3, systemicFatigue: 0.35, localDamage: 0.25, skillDemand: 0.1, learningRate: 1.8, baseInjuryRisk: 0.2, riskTissues: ['lowBack', 'foot'], metValue: 7,
    adaptationBias: { hypertrophy: 0, maxStrength: 0.05, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'rucking', defaultZone: 1, impact: 0.4 }, secondsPerRep: 60,
    evidenceNotes: 'Metabolic cost rises with pack mass (Pandolf 1977); foot, low-back and stress injuries dominate load carriage (Knapik 2004).', verified: true,
  }),
  ex({
    id: 'stair_climber', name: 'Stair climber', category: 'cardio', movementPattern: 'cardio', gymTier: 'commercial', loadType: 'none', equipment: ['machine'],
    muscles: { gluteMax: 0.4, vasti: 0.4, soleus: 0.3, gastrocnemius: 0.3, hamstrings: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.45, localDamage: 0.2, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.15, riskTissues: ['knee', 'achilles'], metValue: 9,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'stairs', defaultZone: 2, impact: 0.3 }, secondsPerRep: 60,
    evidenceNotes: 'Stepping ergometer with high glute and quad demand and low impact; evidence on muscle gain is limited, treated as aerobic work.', verified: false,
  }),
  ex({
    id: 'incline_treadmill_walk', name: 'Incline treadmill walk', category: 'cardio', movementPattern: 'cardio', gymTier: 'commercial', loadType: 'none', equipment: ['treadmill'],
    muscles: { gluteMax: 0.35, soleus: 0.3, gastrocnemius: 0.25, vasti: 0.25, hamstrings: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.25, localDamage: 0.1, skillDemand: 0.05, learningRate: 2, baseInjuryRisk: 0.12, riskTissues: ['achilles', 'calf'], metValue: 6,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'walking', defaultZone: 1, impact: 0.2 }, secondsPerRep: 60,
    evidenceNotes: 'Energy cost of walking rises steeply with grade (Minetti 2002), giving a Zone 1 stimulus at low impact.', verified: true,
  }),
  ex({
    id: 'jump_rope', name: 'Jump rope', category: 'cardio', movementPattern: 'cardio', gymTier: 'home', loadType: 'none', equipment: ['jump rope'],
    muscles: { gastrocnemius: 0.5, soleus: 0.4, vasti: 0.2, tibialisAnterior: 0.15, forearms: 0.15 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.4, localDamage: 0.2, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.4, riskTissues: ['achilles', 'calf', 'shin', 'foot'], metValue: 11,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.05, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'jumpRope', defaultZone: 2, impact: 0.7 }, secondsPerRep: 60,
    evidenceNotes: 'Rope skipping at 100-120/min is about 11-12 MET (2024 Compendium); repeated ankle loading makes calf and Achilles the weak points.', verified: false,
  }),
  ex({
    id: 'elliptical', name: 'Elliptical trainer', category: 'cardio', movementPattern: 'cardio', gymTier: 'commercial', loadType: 'none', equipment: ['machine'],
    muscles: { vasti: 0.35, gluteMax: 0.25, hamstrings: 0.2, gastrocnemius: 0.15 }, resistanceProfile: 'flat',
    axialLoad: 0, systemicFatigue: 0.3, localDamage: 0.1, skillDemand: 0.05, learningRate: 2, baseInjuryRisk: 0.1, riskTissues: ['knee'], metValue: 5,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'elliptical', defaultZone: 1, impact: 0.1 }, secondsPerRep: 60,
    evidenceNotes: 'Low-impact running-like pattern; useful when impact must be limited. Evidence beyond aerobic work is limited.', verified: false,
  }),
  ex({
    id: 'hiking', name: 'Hiking', category: 'cardio', movementPattern: 'cardio', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { gluteMax: 0.35, vasti: 0.35, soleus: 0.3, gastrocnemius: 0.25, hamstrings: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.3, localDamage: 0.2, skillDemand: 0.15, learningRate: 1.8, baseInjuryRisk: 0.2, riskTissues: ['knee', 'foot'], metValue: 6,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'walking', defaultZone: 1, impact: 0.3 }, secondsPerRep: 60,
    evidenceNotes: 'Uphill walking cost rises with grade (Minetti 2002); descents add eccentric knee load.', verified: true,
  }),
  // --- other ---
  ex({
    id: 'battle_ropes', name: 'Battle ropes', category: 'cardio', movementPattern: 'cardio', gymTier: 'commercial', loadType: 'none', equipment: ['battle ropes'],
    muscles: { frontDelts: 0.4, sideDelts: 0.3, lats: 0.3, forearms: 0.3, rectusAbdominis: 0.25, obliques: 0.2, tricepsLong: 0.2, biceps: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.55, localDamage: 0.2, skillDemand: 0.3, learningRate: 1.5, baseInjuryRisk: 0.15, riskTissues: ['shoulder', 'elbow'], metValue: 10,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.05, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'other', defaultZone: 3, impact: 0.1 }, secondsPerRep: 60,
    evidenceNotes: 'Upper-body conditioning intervals. Evidence is limited; MET is approximate.', verified: false,
  }),
  ex({
    id: 'sled_push_conditioning', name: 'Sled push conditioning', category: 'cardio', movementPattern: 'cardio', gymTier: 'track', loadType: 'none', equipment: ['sled'],
    muscles: { vasti: 0.5, gluteMax: 0.45, gastrocnemius: 0.35, soleus: 0.3, hamstrings: 0.25, adductors: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.15, systemicFatigue: 0.6, localDamage: 0.3, skillDemand: 0.2, learningRate: 1.5, baseInjuryRisk: 0.2, riskTissues: ['lowBack', 'knee'], metValue: 10,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0, power: 0.1, muscularEndurance: 0, aerobic: 1 }, cardio: { modality: 'other', defaultZone: 3, impact: 0.3 }, secondsPerRep: 60,
    evidenceNotes: 'Leg-dominant loaded pushing repeats with low eccentric load. Evidence is limited; MET is approximate.', verified: false,
  }),
];
