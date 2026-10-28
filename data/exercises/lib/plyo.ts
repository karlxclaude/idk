// Plyometric library: hops, depth/drop jumps, horizontal jumps and bounds. See docs/EXERCISE_AUTHORING.md.
// Tendon load scales with drop height and bound intensity (higher baseInjuryRisk / localDamage); adaptation biases follow the core.ts plyo entries.
import type { Exercise } from '../schema';
import { ex } from '../define';

export const PLYO_EXERCISES: Exercise[] = [
  // --- low-amplitude reactive hops ---
  ex({
    id: 'ankle_hops', name: 'Ankle hops', category: 'plyometric', movementPattern: 'jump', gymTier: 'home', loadType: 'none', equipment: [],
    muscles: { gastrocnemius: 0.7, soleus: 0.7, tibialisAnterior: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.1, systemicFatigue: 0.2, localDamage: 0.15, skillDemand: 0.2, learningRate: 2, baseInjuryRisk: 0.15, riskTissues: ['achilles', 'shin'], metValue: 7,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.7, jump: 0.7, speed: 0.4 }, peakPowerLoadPct: 0, secondsPerRep: 0.6,
    evidenceNotes: 'Stiff-knee, ankle-dominant hops for tendon stiffness and reactivity; effect size is inferred from general plyometric training (Markovic 2007), so keep modest.', verified: false,
  }),
  // --- depth / drop jumps (tendon load rises with drop height) ---
  ex({
    id: 'depth_jump_30', name: 'Depth jump (30 cm)', category: 'plyometric', movementPattern: 'jump', gymTier: 'budget', loadType: 'none', equipment: ['box'],
    muscles: { vasti: 0.65, gluteMax: 0.5, gastrocnemius: 0.65, soleus: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.25, systemicFatigue: 0.45, localDamage: 0.33, skillDemand: 0.5, learningRate: 1.2, baseInjuryRisk: 0.33, riskTissues: ['achilles', 'patellarTendon', 'shin'], metValue: 7,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.3, power: 1.05, jump: 1.05, speed: 0.4 }, peakPowerLoadPct: 0, secondsPerRep: 5,
    evidenceNotes: 'Entry-level intensive SSC drop height; plyometric training raises CMJ ~8.7% (Markovic 2007), while the drop-height scaling of tendon load is a heuristic.', verified: true,
  }),
  ex({
    id: 'depth_jump_60', name: 'Depth jump (60 cm)', category: 'plyometric', movementPattern: 'jump', gymTier: 'budget', loadType: 'none', equipment: ['box'],
    muscles: { vasti: 0.8, gluteMax: 0.55, gastrocnemius: 0.7, soleus: 0.45 }, resistanceProfile: 'ascending',
    axialLoad: 0.35, systemicFatigue: 0.55, localDamage: 0.55, skillDemand: 0.6, learningRate: 1, baseInjuryRisk: 0.5, riskTissues: ['achilles', 'patellarTendon', 'shin'], metValue: 7.5,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.3, power: 1.1, jump: 1, speed: 0.35 }, peakPowerLoadPct: 0, secondsPerRep: 5,
    evidenceNotes: 'High drop raises landing forces and contact time without proportionally more jump gain; plyometrics raise CMJ ~8.7% (Markovic 2007), but the optimal drop height is individual and the risk scaling is a heuristic.', verified: true,
  }),
  ex({
    id: 'drop_jump', name: 'Drop jump (reactive rebound)', aliases: ['Reactive drop jump', 'Short-contact drop jump'], category: 'plyometric', movementPattern: 'jump', gymTier: 'budget', loadType: 'none', equipment: ['box'],
    muscles: { gastrocnemius: 0.8, soleus: 0.5, vasti: 0.55, gluteMax: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.25, systemicFatigue: 0.4, localDamage: 0.3, skillDemand: 0.5, learningRate: 1.2, baseInjuryRisk: 0.35, riskTissues: ['achilles', 'patellarTendon', 'shin'], metValue: 7,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.2, power: 0.95, jump: 0.9, speed: 0.55 }, peakPowerLoadPct: 0, secondsPerRep: 4,
    evidenceNotes: 'Rebound focus with minimal ground contact (stiff ankle, shallow knee bend) trains reactive strength more than jump height; plyometrics raise CMJ ~8.7% (Markovic 2007).', verified: true,
  }),
  // --- horizontal jumps and bounds ---
  ex({
    id: 'broad_jump', name: 'Standing broad jump', aliases: ['Standing long jump'], category: 'plyometric', movementPattern: 'jump', gymTier: 'home', loadType: 'none', equipment: [],
    muscles: { gluteMax: 0.8, vasti: 0.6, hamstrings: 0.5, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.35, localDamage: 0.25, skillDemand: 0.35, learningRate: 1.5, baseInjuryRisk: 0.22, riskTissues: ['achilles', 'hamstrings'], metValue: 6.5,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.2, power: 1, jump: 0.8, speed: 0.45 }, peakPowerLoadPct: 0, secondsPerRep: 4,
    evidenceNotes: 'Horizontal-vector, hip-dominant jump; carryover to acceleration is plausible but Evidence is limited.', verified: false,
  }),
  ex({
    id: 'bounding', name: 'Alternating bounds', aliases: ['Bounding', 'Running bounds'], category: 'plyometric', movementPattern: 'jump', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { gluteMax: 0.8, hamstrings: 0.6, vasti: 0.6, gastrocnemius: 0.6, soleus: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.5, localDamage: 0.45, skillDemand: 0.5, learningRate: 1.1, baseInjuryRisk: 0.4, riskTissues: ['achilles', 'hamstrings', 'shin'], metValue: 8,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.2, power: 0.9, jump: 0.7, speed: 0.6 }, peakPowerLoadPct: 0, secondsPerRep: 1.5,
    evidenceNotes: 'Exaggerated sprint stride for distance; high eccentric load on hamstrings and Achilles; transfer to sprinting is plausible but Evidence is limited.', verified: false,
  }),
  ex({
    id: 'single_leg_bounds', name: 'Single-leg bounds', aliases: ['Single-leg hop for distance', 'Repeated single-leg hops'], category: 'plyometric', movementPattern: 'jump', gymTier: 'outdoor', loadType: 'none', equipment: [], unilateral: true,
    muscles: { gluteMax: 0.8, vasti: 0.7, gastrocnemius: 0.7, hamstrings: 0.5, soleus: 0.4, gluteMed: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.15, systemicFatigue: 0.45, localDamage: 0.5, skillDemand: 0.55, learningRate: 1, baseInjuryRisk: 0.48, riskTissues: ['achilles', 'patellarTendon', 'shin'], metValue: 8,
    adaptationBias: { hypertrophy: 0.25, maxStrength: 0.3, power: 0.9, jump: 0.7, speed: 0.6 }, peakPowerLoadPct: 0, secondsPerRep: 2,
    evidenceNotes: 'Single-leg landings roughly double per-limb tendon load compared with two-leg bounds; Evidence is limited, so progress volume cautiously.', verified: false,
  }),
  ex({
    id: 'skater_bounds', name: 'Skater bounds', aliases: ['Lateral bounds', 'Skater jumps'], category: 'plyometric', movementPattern: 'jump', gymTier: 'home', loadType: 'none', equipment: [], unilateral: true,
    muscles: { gluteMed: 0.9, gluteMax: 0.6, adductors: 0.5, vasti: 0.5, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.1, systemicFatigue: 0.35, localDamage: 0.35, skillDemand: 0.4, learningRate: 1.3, baseInjuryRisk: 0.3, riskTissues: ['knee', 'achilles', 'adductors'], metValue: 7,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.2, power: 0.8, jump: 0.7, speed: 0.4 }, peakPowerLoadPct: 0, secondsPerRep: 2.5,
    evidenceNotes: 'Frontal-plane single-leg bound loading the abductors and adductors; Evidence is limited, so effects are modest.', verified: false,
  }),
  // --- hurdle, tuck and combination jumps ---
  ex({
    id: 'hurdle_hops', name: 'Hurdle hops', aliases: ['Hurdle jumps'], category: 'plyometric', movementPattern: 'jump', gymTier: 'budget', loadType: 'none', equipment: ['hurdles'],
    muscles: { gastrocnemius: 0.7, vasti: 0.6, gluteMax: 0.6, soleus: 0.4, hamstrings: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.4, localDamage: 0.3, skillDemand: 0.4, learningRate: 1.3, baseInjuryRisk: 0.3, riskTissues: ['achilles', 'patellarTendon', 'shin'], metValue: 7,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.2, power: 1, jump: 1, speed: 0.4 }, peakPowerLoadPct: 0, secondsPerRep: 1,
    evidenceNotes: 'Continuous rebound jumps over hurdles; indirect support from plyometric training raising CMJ ~8.7% (Markovic 2007), but hurdle height and contact time are heuristics.', verified: false,
  }),
  ex({
    id: 'tuck_jumps', name: 'Tuck jumps', category: 'plyometric', movementPattern: 'jump', gymTier: 'home', loadType: 'none', equipment: [],
    muscles: { vasti: 0.6, gluteMax: 0.6, rectusFemoris: 0.5, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.15, systemicFatigue: 0.4, localDamage: 0.25, skillDemand: 0.35, learningRate: 1.4, baseInjuryRisk: 0.25, riskTissues: ['achilles', 'patellarTendon'], metValue: 7,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.2, power: 0.85, jump: 0.9, speed: 0.3 }, peakPowerLoadPct: 0, secondsPerRep: 3,
    evidenceNotes: 'Maximal vertical jump with knees pulled to chest; a general plyometric stimulus (Markovic 2007) with little evidence for an advantage over countermovement jumps.', verified: false,
  }),
  ex({
    id: 'depth_to_broad_jump', name: 'Depth-to-broad jump', aliases: ['Drop to broad jump'], category: 'plyometric', movementPattern: 'jump', gymTier: 'budget', loadType: 'none', equipment: ['box'],
    muscles: { gluteMax: 0.8, vasti: 0.7, gastrocnemius: 0.6, hamstrings: 0.5, soleus: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.3, systemicFatigue: 0.5, localDamage: 0.5, skillDemand: 0.6, learningRate: 1, baseInjuryRisk: 0.45, riskTissues: ['achilles', 'patellarTendon', 'shin'], metValue: 7.5,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.3, power: 1.05, jump: 0.75, speed: 0.5 }, peakPowerLoadPct: 0, secondsPerRep: 5,
    evidenceNotes: 'Drop landing converted into a horizontal jump (intensive SSC plus horizontal vector); Evidence is limited, risk follows depth-jump logic.', verified: false,
  }),
  ex({
    id: 'approach_jump', name: 'Approach jump', aliases: ['Run-up vertical jump'], category: 'plyometric', movementPattern: 'jump', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { vasti: 0.7, gluteMax: 0.7, gastrocnemius: 0.6, hamstrings: 0.4, soleus: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.4, localDamage: 0.3, skillDemand: 0.55, learningRate: 1, baseInjuryRisk: 0.3, riskTissues: ['achilles', 'patellarTendon', 'knee'], metValue: 7,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.25, power: 1, jump: 1, speed: 0.5 }, peakPowerLoadPct: 0, secondsPerRep: 5,
    evidenceNotes: 'Run-up converts horizontal velocity into vertical jump height (hard plant, braking eccentric load on the knee extensors); general plyometric effect (Markovic 2007), specifics Evidence is limited.', verified: false,
  }),
  ex({
    id: 'lateral_box_jump', name: 'Lateral box jump', aliases: ['Side box jump'], category: 'plyometric', movementPattern: 'jump', gymTier: 'budget', loadType: 'none', equipment: ['box'],
    muscles: { gluteMed: 0.6, vasti: 0.6, gluteMax: 0.5, gastrocnemius: 0.4, adductors: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.15, systemicFatigue: 0.35, localDamage: 0.25, skillDemand: 0.4, learningRate: 1.3, baseInjuryRisk: 0.25, riskTissues: ['knee', 'achilles'], metValue: 6.5,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.2, power: 0.85, jump: 0.7, speed: 0.3 }, peakPowerLoadPct: 0, secondsPerRep: 4,
    evidenceNotes: 'Frontal-plane jump onto or over a box with a controlled landing; Evidence is limited, so treat as general plyometric work.', verified: false,
  }),
  ex({
    id: 'split_squat_jump', name: 'Split squat jump', aliases: ['Split jump', 'Alternating lunge jump'], category: 'plyometric', movementPattern: 'jump', gymTier: 'home', loadType: 'none', equipment: [], unilateral: true,
    muscles: { vasti: 0.8, gluteMax: 0.7, rectusFemoris: 0.4, gastrocnemius: 0.4, hamstrings: 0.3, gluteMed: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.15, systemicFatigue: 0.4, localDamage: 0.3, skillDemand: 0.4, learningRate: 1.3, baseInjuryRisk: 0.3, riskTissues: ['knee', 'patellarTendon', 'achilles'], metValue: 7,
    adaptationBias: { hypertrophy: 0.3, maxStrength: 0.3, power: 0.9, jump: 0.8, speed: 0.3 }, peakPowerLoadPct: 0, secondsPerRep: 3,
    evidenceNotes: 'Lunge-pattern jump with a staggered stance and single-leg emphasis; Evidence is limited, so effects are modest.', verified: false,
  }),
];
