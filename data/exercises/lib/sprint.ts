// Sprint drills and sprint variants. See docs/EXERCISE_AUTHORING.md.
// sprint = { f0h, vmax, technique }: acceleration/sled/hill work leans on f0h, flying/overspeed work on vmax, drills on technique.
import { ex } from '../define';
import type { Exercise } from '../schema';

export const SPRINT_EXERCISES: Exercise[] = [
  // --- drills ---
  ex({
    id: 'b_skip', name: 'B-skip', aliases: ['B skip'], category: 'sprint', movementPattern: 'sprintDrill', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { rectusFemoris: 0.5, hamstrings: 0.5, gluteMax: 0.4, gastrocnemius: 0.4 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.15, localDamage: 0.1, skillDemand: 0.5, learningRate: 1.2, baseInjuryRisk: 0.1, riskTissues: [], metValue: 6,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.2, jump: 0.2, speed: 0.6 }, sprint: { f0h: 0.1, vmax: 0.15, technique: 1 }, secondsPerRep: 1,
    evidenceNotes: 'Evidence is limited for direct speed transfer; rehearses the knee-up, leg-extend, paw-back cycle of the swing leg.', verified: false,
  }),
  ex({
    id: 'wall_drill', name: 'Wall drill (lean and knee-drive)', aliases: ['Wall march', 'Wall switch'], category: 'sprint', movementPattern: 'sprintDrill', gymTier: 'outdoor', loadType: 'none', equipment: ['wall'],
    muscles: { rectusFemoris: 0.5, gluteMax: 0.4, hamstrings: 0.3, rectusAbdominis: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.05, systemicFatigue: 0.1, localDamage: 0.05, skillDemand: 0.3, learningRate: 1.5, baseInjuryRisk: 0.1, riskTissues: [], metValue: 6,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.15, jump: 0.1, speed: 0.5 }, sprint: { f0h: 0.2, vmax: 0.1, technique: 1 }, secondsPerRep: 1,
    evidenceNotes: 'Evidence is limited for direct speed transfer; rehearses the forward-lean posture and knee drive of acceleration.', verified: false,
  }),
  ex({
    id: 'wicket_runs', name: 'Wicket runs (mini-hurdle rhythm runs)', aliases: ['Wicket drill', 'Mini-hurdle runs'], category: 'sprint', movementPattern: 'sprintDrill', gymTier: 'track', loadType: 'none', equipment: ['mini hurdles'],
    muscles: { hamstrings: 0.6, gluteMax: 0.5, rectusFemoris: 0.5, gastrocnemius: 0.4, adductors: 0.2 }, resistanceProfile: 'flat',
    axialLoad: 0.1, systemicFatigue: 0.3, localDamage: 0.2, skillDemand: 0.6, learningRate: 1.2, baseInjuryRisk: 0.15, riskTissues: ['hamstrings'], metValue: 7,
    adaptationBias: { hypertrophy: 0, maxStrength: 0, power: 0.3, jump: 0.2, speed: 0.7 }, sprint: { f0h: 0.1, vmax: 0.5, technique: 0.9 }, secondsPerRep: 4,
    evidenceNotes: 'Evidence is limited for direct speed transfer; fixed wicket spacing constrains stride length and rhythm at high speed.', verified: false,
  }),
  ex({
    id: 'straight_leg_bounds', name: 'Straight-leg bounds', aliases: ['Straight-leg run', 'Pawing bound'], category: 'sprint', movementPattern: 'sprintDrill', gymTier: 'outdoor', loadType: 'none', equipment: [],
    muscles: { hamstrings: 0.7, gluteMax: 0.6, gastrocnemius: 0.5, soleus: 0.3, tibialisAnterior: 0.25 }, resistanceProfile: 'ascending',
    axialLoad: 0.15, systemicFatigue: 0.25, localDamage: 0.3, skillDemand: 0.5, learningRate: 1.2, baseInjuryRisk: 0.15, riskTissues: ['hamstrings'], metValue: 6,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0, power: 0.4, jump: 0.35, speed: 0.6 }, sprint: { f0h: 0.15, vmax: 0.25, technique: 0.9 }, secondsPerRep: 1,
    evidenceNotes: 'Evidence is limited for direct speed transfer; emphasises active hip extension and a paw-down foot strike.', verified: false,
  }),
  // --- flying and max-velocity sprints ---
  ex({
    id: 'flying_10', name: 'Flying 10 m sprint', aliases: ['Fly 10'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { hamstrings: 0.8, gluteMax: 0.7, rectusFemoris: 0.4, gastrocnemius: 0.5, adductors: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.45, localDamage: 0.4, skillDemand: 0.55, learningRate: 1, baseInjuryRisk: 0.5, riskTissues: ['hamstrings', 'adductors'], metValue: 14,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.7, jump: 0.3, speed: 1.1 }, sprint: { f0h: 0.1, vmax: 0.85, technique: 0.5 }, secondsPerRep: 4,
    evidenceNotes: 'Max-velocity sprinting is the most specific vmax stimulus; a 10 m zone after a build-up limits time at top speed.', verified: false,
  }),
  ex({
    id: 'flying_20', name: 'Flying 20 m sprint', aliases: ['Fly 20'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { hamstrings: 0.8, gluteMax: 0.7, rectusFemoris: 0.4, gastrocnemius: 0.5, adductors: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.55, localDamage: 0.5, skillDemand: 0.6, learningRate: 1, baseInjuryRisk: 0.55, riskTissues: ['hamstrings', 'adductors'], metValue: 14,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.8, jump: 0.3, speed: 1.2 }, sprint: { f0h: 0.15, vmax: 0.95, technique: 0.5 }, secondsPerRep: 4.5,
    evidenceNotes: 'Max-velocity sprinting is the most specific vmax stimulus; a 20 m zone gives more steps at top speed than a 10 m zone.', verified: false,
  }),
  ex({
    id: 'assisted_overspeed_sprint', name: 'Assisted overspeed sprint (towed)', aliases: ['Towed sprint', 'Bungee overspeed'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: ['elastic tow cord'],
    muscles: { hamstrings: 0.9, gluteMax: 0.6, rectusFemoris: 0.5, adductors: 0.4, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.5, localDamage: 0.55, skillDemand: 0.7, learningRate: 0.9, baseInjuryRisk: 0.6, riskTissues: ['hamstrings', 'adductors'], metValue: 14,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0.05, power: 0.6, jump: 0.2, speed: 1.1 }, sprint: { f0h: 0.1, vmax: 0.95, technique: 0.35 }, secondsPerRep: 4,
    evidenceNotes: 'Towing raises sprint speed above the unassisted maximum (Clark 2009) but loads the late-swing hamstrings harder, so volume stays low.', verified: false,
  }),
  ex({
    id: 'downhill_overspeed_sprint', name: 'Downhill overspeed sprint (2-3 degree slope)', aliases: ['Downhill sprint'], category: 'sprint', movementPattern: 'sprint', gymTier: 'outdoor', loadType: 'none', equipment: ['gentle slope'],
    muscles: { hamstrings: 0.85, gluteMax: 0.6, vasti: 0.5, rectusFemoris: 0.4, adductors: 0.4, gastrocnemius: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.3, systemicFatigue: 0.55, localDamage: 0.6, skillDemand: 0.6, learningRate: 0.9, baseInjuryRisk: 0.55, riskTissues: ['hamstrings', 'adductors', 'knee'], metValue: 14,
    adaptationBias: { hypertrophy: 0.05, maxStrength: 0.05, power: 0.6, jump: 0.25, speed: 1 }, sprint: { f0h: 0.1, vmax: 0.85, technique: 0.4 }, secondsPerRep: 4,
    evidenceNotes: 'Mild downhill sprinting exceeds flat top speed, and combined uphill-downhill training improved sprint speed (Paradisis & Cooke 2006).', verified: false,
  }),
  ex({
    id: 'sprint_100m', name: '100 m sprint (full effort)', aliases: ['100 m dash', '100 m time trial'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { hamstrings: 0.8, gluteMax: 0.8, vasti: 0.5, rectusFemoris: 0.4, gastrocnemius: 0.5, adductors: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.8, localDamage: 0.6, skillDemand: 0.7, learningRate: 1, baseInjuryRisk: 0.6, riskTissues: ['hamstrings', 'adductors'], metValue: 16,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.7, jump: 0.3, speed: 1 }, sprint: { f0h: 0.5, vmax: 0.9, technique: 0.6 }, secondsPerRep: 14,
    evidenceNotes: '100 m performance depends on acceleration force output and on holding force orientation as speed rises (Morin 2012).', verified: true,
  }),
  ex({
    id: 'curved_sprint', name: 'Curved sprint (bend running)', aliases: ['Bend sprint', 'Curve running'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { hamstrings: 0.8, gluteMax: 0.7, gluteMed: 0.5, adductors: 0.5, gastrocnemius: 0.5, vasti: 0.4, obliques: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.55, localDamage: 0.5, skillDemand: 0.7, learningRate: 0.9, baseInjuryRisk: 0.5, riskTissues: ['hamstrings', 'adductors'], metValue: 14,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.7, jump: 0.3, speed: 1 }, sprint: { f0h: 0.2, vmax: 0.8, technique: 0.7 }, secondsPerRep: 5,
    evidenceNotes: 'Curve running lowers top speed because the legs must also supply centripetal force (Chang & Kram 2007).', verified: false,
  }),
  // --- acceleration, resisted and uphill sprints ---
  ex({
    id: 'two_point_start_30', name: '30 m acceleration (2-point start)', aliases: ['Standing start sprint'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { gluteMax: 0.8, hamstrings: 0.6, vasti: 0.6, gastrocnemius: 0.5, adductors: 0.4 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.5, localDamage: 0.4, skillDemand: 0.45, learningRate: 1.1, baseInjuryRisk: 0.4, riskTissues: ['hamstrings', 'adductors'], metValue: 14,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.9, jump: 0.4, speed: 1.1 }, sprint: { f0h: 0.8, vmax: 0.45, technique: 0.6 }, secondsPerRep: 4.5,
    evidenceNotes: 'A 30 m acceleration run trains horizontal force output and early upright speed (Morin 2011).', verified: false,
  }),
  ex({
    id: 'falling_start_20', name: '20 m falling-start sprint', aliases: ['Falling start'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: [],
    muscles: { gluteMax: 0.8, hamstrings: 0.6, vasti: 0.6, gastrocnemius: 0.5, adductors: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.4, localDamage: 0.35, skillDemand: 0.5, learningRate: 1.2, baseInjuryRisk: 0.35, riskTissues: ['hamstrings', 'adductors'], metValue: 14,
    adaptationBias: { hypertrophy: 0.1, maxStrength: 0.1, power: 0.8, jump: 0.3, speed: 1 }, sprint: { f0h: 0.85, vmax: 0.25, technique: 0.8 }, secondsPerRep: 3.5,
    evidenceNotes: 'Evidence is limited; used to coach forward lean and horizontal force application (Morin 2011).', verified: false,
  }),
  ex({
    id: 'light_sled_sprint', name: 'Light sled sprint (10-20% BM)', aliases: ['Light sled tow'], category: 'sprint', movementPattern: 'sprint', gymTier: 'track', loadType: 'none', equipment: ['sled'],
    muscles: { gluteMax: 0.8, hamstrings: 0.6, vasti: 0.6, gastrocnemius: 0.5, adductors: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.2, systemicFatigue: 0.5, localDamage: 0.4, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.3, riskTissues: ['hamstrings', 'lowBack'], metValue: 14,
    adaptationBias: { hypertrophy: 0.15, maxStrength: 0.2, power: 0.85, jump: 0.3, speed: 1 }, sprint: { f0h: 0.6, vmax: 0.4, technique: 0.5 }, secondsPerRep: 5,
    evidenceNotes: 'Light sleds keep velocity near maximal while adding horizontal force demand, far below the power-optimal loads in Cross 2017.', verified: true,
  }),
  ex({
    id: 'hill_sprint', name: 'Hill sprint (6-10% grade)', aliases: ['Hill repeats'], category: 'sprint', movementPattern: 'sprint', gymTier: 'outdoor', loadType: 'none', equipment: ['hill'],
    muscles: { gluteMax: 0.9, vasti: 0.7, hamstrings: 0.6, gastrocnemius: 0.6, soleus: 0.4, rectusFemoris: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.25, systemicFatigue: 0.6, localDamage: 0.5, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.3, riskTissues: ['hamstrings', 'calf'], metValue: 15,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.2, power: 0.9, jump: 0.3, speed: 0.9 }, sprint: { f0h: 0.85, vmax: 0.3, technique: 0.5 }, secondsPerRep: 6,
    evidenceNotes: 'Uphill sprinting shifts force application toward horizontal push-off; trial evidence is mostly from mild slopes (Paradisis & Cooke 2006).', verified: false,
  }),
  ex({
    id: 'stair_sprint', name: 'Stair sprint', aliases: ['Stair run'], category: 'sprint', movementPattern: 'sprint', gymTier: 'outdoor', loadType: 'none', equipment: ['stairs'],
    muscles: { gluteMax: 0.9, vasti: 0.9, gastrocnemius: 0.6, soleus: 0.4, hamstrings: 0.4, rectusFemoris: 0.3 }, resistanceProfile: 'ascending',
    axialLoad: 0.25, systemicFatigue: 0.6, localDamage: 0.5, skillDemand: 0.4, learningRate: 1.2, baseInjuryRisk: 0.3, riskTissues: ['knee', 'achilles', 'calf'], metValue: 15,
    adaptationBias: { hypertrophy: 0.2, maxStrength: 0.2, power: 0.9, jump: 0.4, speed: 0.8 }, sprint: { f0h: 0.8, vmax: 0.15, technique: 0.3 }, secondsPerRep: 6,
    evidenceNotes: 'Evidence is limited; a high-force uphill acceleration surrogate with short ground contacts [HEUR].', verified: false,
  }),
];
