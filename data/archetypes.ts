// Starting archetypes: preset characters with distinct hidden genetics and training history.
import type { CharacterProfile } from '../engine/character';

export interface Archetype {
  id: string;
  name: string;
  /** 2-3 sentences, second person. */
  backstory: string;
  /** What is secretly true; shown only after the reveal. */
  hiddenSummary: string;
  profile: CharacterProfile;
}

// Population mean segment fractions of height (data/constants/genetics.ts).
const SEG = { thigh: 0.245, shank: 0.246, upperArm: 0.186, forearm: 0.146, torso: 0.288 };
type SegScale = Partial<Record<keyof typeof SEG, number>>;
/** Scale segment fractions relative to the population mean. */
const seg = (s: SegScale = {}) => ({
  thigh: +(SEG.thigh * (s.thigh ?? 1)).toFixed(4),
  shank: +(SEG.shank * (s.shank ?? 1)).toFixed(4),
  upperArm: +(SEG.upperArm * (s.upperArm ?? 1)).toFixed(4),
  forearm: +(SEG.forearm * (s.forearm ?? 1)).toFixed(4),
  torso: +(SEG.torso * (s.torso ?? 1)).toFixed(4),
});

const BASIC_LIFTS = ['back_squat_high_bar', 'bench_press', 'conventional_deadlift', 'overhead_press', 'barbell_row', 'pull_up', 'barbell_curl'];

export const ARCHETYPES: Archetype[] = [
  {
    id: 'lanky_hardgainer',
    name: 'Lanky Hardgainer',
    backstory: 'You are tall and thin, and people say you must have a fast metabolism. You eat plenty and still look the same, and you never sit still for long.',
    hiddenSummary: 'Very high NEAT responsiveness and a slightly fast metabolism burn off most of your surplus, and your long limbs make many lifts harder. Eat more than feels reasonable and the muscle will come.',
    profile: {
      name: 'Theo', sex: 'male', ageYears: 21, heightCm: 189, ffmi: 17, bodyFat: 0.1,
      anthro: { ...seg({ thigh: 1.04, shank: 1.05, upperArm: 1.05, forearm: 1.05, torso: 0.95 }), wristCm: 16.5 },
      genetics: { neatResponsiveness: 0.7, bmrFactor: 1.06, typeIVL: 52, ffmiCeiling: 23.5, responderHyp: 1.05 },
    },
  },
  {
    id: 'detrained_wrestler',
    name: 'Detrained Wrestler',
    backstory: 'You wrestled and lifted through high school and college, then a career and a desk took over six years ago. You still remember how the big lifts feel.',
    hiddenSummary: 'Years of past training left muscle memory: lost size and strength return far faster than they would for a true beginner. Sprint and plyometric work from your mat days also left a small power reserve.',
    profile: {
      name: 'Marcus', sex: 'male', ageYears: 30, heightCm: 174, ffmi: 19.5, bodyFat: 0.22,
      pastLiftingYears: 5, detrainedYears: 6, sprintYears: 2, plyoYears: 2,
      knownExercises: BASIC_LIFTS,
      anthro: { ...seg({ thigh: 0.98, upperArm: 1.02 }), wristCm: 17.5 },
      genetics: { responderHyp: 1.1, responderStr: 1.1, ffmiCeiling: 24, typeIVL: 45 },
    },
  },
  {
    id: 'desk_worker',
    name: 'Desk Worker',
    backstory: 'You sit for ten hours a day and the weight has crept up over the years. You are healthy enough but tired, and you have decided that now is the time to change.',
    hiddenSummary: 'Your genetics are genuinely average, but a low NEAT response means you barely move when you are not forced to. Daily steps and structure matter more for you than any program choice.',
    profile: {
      name: 'Priya', sex: 'female', ageYears: 38, heightCm: 163, ffmi: 15.2, bodyFat: 0.3,
      genetics: { neatResponsiveness: 0.0, bmrFactor: 0.98, responderHyp: 1, responderStr: 1, responderAer: 1, typeIVL: 50, ffmiCeiling: 19.8 },
    },
  },
  {
    id: 'former_sprinter_35',
    name: 'Former Sprinter at 35',
    backstory: 'You ran the 100 m and 200 m in college and jumped for fun. A decade of jobs and kids later you are 35 and the explosiveness is a memory.',
    hiddenSummary: 'A fast-twitch dominant build (low type I fraction) explains your old speed, and it responds well to power and heavy work. Your power pools have mostly decayed, but they come back faster than you expect.',
    profile: {
      name: 'Andre', sex: 'male', ageYears: 35, heightCm: 180, ffmi: 19, bodyFat: 0.19,
      sprintYears: 6, plyoYears: 5, detrainedYears: 8, pastLiftingYears: 2,
      knownExercises: ['back_squat_high_bar', 'power_clean', 'countermovement_jump', 'box_jump', 'acceleration_20', 'flying_30', 'a_skip'],
      anthro: { ...seg({ shank: 1.03, thigh: 1.02 }), wristCm: 17 },
      genetics: { typeIVL: 30, ffmiCeiling: 24, tendonStiffness: 1.1 },
    },
  },
  {
    id: 'farm_kid_strong',
    name: 'Farm Kid',
    backstory: 'You grew up hauling feed and bales and have never touched a barbell. You are already thick through the frame and surprisingly strong for someone who has never trained.',
    hiddenSummary: 'Years of farm labor raised your untrained muscle mass, and you have a large neural strength reserve and big wrists. Your first months of lifting will deliver explosive strength gains.',
    profile: {
      name: 'Cody', sex: 'male', ageYears: 19, heightCm: 180, ffmi: 21, bodyFat: 0.15,
      anthro: { ...seg({ upperArm: 1.02 }), wristCm: 18.5 },
      genetics: { responderStr: 1.5, typeIVL: 42, neuralFastGain: 0.45, responderHyp: 1.15, ffmiCeiling: 25, tendonStiffness: 1.1 },
    },
  },
  {
    id: 'former_gymnast',
    name: 'Former Gymnast',
    backstory: 'You trained gymnastics for years until an injury and then college ended it. You can still hold a handstand, but you have never used a barbell.',
    hiddenSummary: 'A short frame with short levers suits bodyweight skills, and you learn new movements unusually fast. Strength relative to bodyweight is high, but absolute muscle mass starts modest.',
    profile: {
      name: 'Mia', sex: 'female', ageYears: 24, heightCm: 154, ffmi: 15.8, bodyFat: 0.2,
      pastLiftingYears: 6, detrainedYears: 2,
      knownExercises: ['pull_up', 'chin_up', 'handstand_hold', 'handstand_push_up', 'l_sit', 'tuck_front_lever', 'back_lever', 'muscle_up', 'ring_push_up', 'pike_push_up', 'hanging_leg_raise', 'planche_lean', 'tuck_planche', 'skin_the_cat', 'german_hang'],
      anthro: { ...seg({ thigh: 0.96, shank: 0.96, upperArm: 0.95, forearm: 0.95, torso: 1.04 }), wristCm: 14.5 },
      genetics: { noviceSkill: 0.45, typeIVL: 48, tendonStiffness: 1.15, responderStr: 1.2, ffmiCeiling: 19.5 },
    },
  },
  {
    id: 'hidden_low_responder',
    name: 'Ordinary Beginner (Low)',
    backstory: 'You are an average person of average build who has decided to start lifting. Nothing about you stands out, and you expect to progress like everyone else.',
    hiddenSummary: 'You are a low responder: hypertrophy and strength gains come at roughly half to two thirds the usual rate, and your genetic ceiling is low. Progress is real but slow, so consistency is the only lever.',
    profile: {
      name: 'Sam', sex: 'male', ageYears: 26, heightCm: 175, ffmi: 18.5, bodyFat: 0.2,
      genetics: { responderHyp: 0.5, responderStr: 0.6, ffmiCeiling: 21.5, neuralFastGain: 0.15, typeIVL: 50 },
    },
  },
  {
    id: 'hidden_high_responder',
    name: 'Ordinary Beginner (High)',
    backstory: 'You are an average person of average build who has decided to start lifting. Nothing about you stands out, and you expect to progress like everyone else.',
    hiddenSummary: 'You are a high responder: muscle and strength respond about 1.5 to 1.8 times as fast as typical, and your ceiling is high. Good programming will pay off enormously, and so will poor recovery habits if you overreach.',
    profile: {
      name: 'Jordan', sex: 'male', ageYears: 26, heightCm: 175, ffmi: 18.5, bodyFat: 0.2,
      genetics: { responderHyp: 1.8, responderStr: 1.5, ffmiCeiling: 26, neuralFastGain: 0.4, typeIVL: 50 },
    },
  },
  {
    id: 'beginner_50',
    name: 'Starting at Fifty',
    backstory: 'You are 50, have never trained, and your doctor has suggested you build some muscle and lose some weight. You are nervous but determined.',
    hiddenSummary: 'Age slows recovery and bone adapts more slowly, but untrained muscle responds well to resistance work at any age. Joint and tendon caution matter more than they did in your twenties.',
    profile: {
      name: 'Dale', sex: 'male', ageYears: 50, heightCm: 176, ffmi: 18.2, bodyFat: 0.25,
      genetics: { responderHyp: 0.95, typeIVL: 50, bmrFactor: 0.97, neatResponsiveness: 0.2, ffmiCeiling: 23, injuryProneness: 1.1 },
    },
  },
  {
    id: 'endurance_runner',
    name: 'Distance Runner',
    backstory: 'You have run for eight years and race every season. You are light, lean, and fast over distance, but you have never lifted anything heavy.',
    hiddenSummary: 'A slow-twitch dominant build and a very strong aerobic response made you a good runner, but the same fibers grow less readily. Heavy lifting will help your running economy, with limited size gains.',
    profile: {
      name: 'Elena', sex: 'female', ageYears: 29, heightCm: 168, ffmi: 15, bodyFat: 0.18,
      enduranceYears: 8,
      knownExercises: ['easy_run', 'tempo_run'],
      anthro: { ...seg({ shank: 1.03, thigh: 0.98 }), wristCm: 14.5 },
      genetics: { typeIVL: 72, responderAer: 1.5, responderHyp: 0.9, ffmiCeiling: 19, neatResponsiveness: 0.4 },
    },
  },
  {
    id: 'stocky_powerlifter_build',
    name: 'Stocky Build',
    backstory: 'You are short and wide with thick wrists and a barrel chest. Pushing and pulling heavy things has always felt natural to you.',
    hiddenSummary: 'Short arms and short femurs relative to your torso are ideal leverages for bench and squat, and your large frame gives a high muscle ceiling. You will be strong, but tall-lifter exercises will feel awkward.',
    profile: {
      name: 'Viktor', sex: 'male', ageYears: 24, heightCm: 168, ffmi: 20.5, bodyFat: 0.22,
      anthro: { ...seg({ thigh: 0.95, shank: 0.97, upperArm: 0.95, forearm: 0.95, torso: 1.05 }), wristCm: 19 },
      genetics: { ffmiCeiling: 25, responderStr: 1.2, responderHyp: 1.1, typeIVL: 48, tendonStiffness: 1.05 },
    },
  },
  {
    id: 'tall_jumper',
    name: 'Tall Jumper',
    backstory: 'You are tall and springy, the kind of kid who dunked at sixteen. You played volleyball and jumped constantly, but you have never done structured strength work.',
    hiddenSummary: 'Long legs, stiff tendons and a fast-twitch dominant build give you elite elastic power. The long levers make squats and deadlifts harder to learn than they look.',
    profile: {
      name: 'Kai', sex: 'male', ageYears: 22, heightCm: 193, ffmi: 18.3, bodyFat: 0.14,
      plyoYears: 5,
      knownExercises: ['countermovement_jump', 'box_jump', 'pogo_hops'],
      anthro: { ...seg({ thigh: 1.05, shank: 1.06, upperArm: 1.02, forearm: 1.02, torso: 0.94 }), wristCm: 17 },
      genetics: { typeIVL: 35, tendonStiffness: 1.2, ffmiCeiling: 23.5 },
    },
  },
];
