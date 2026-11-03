// Coach notes: one- or two-sentence plain-language explanations of the science, each naming its sources.
// Triggers read only fields that exist on CharacterState / DayReport. Source ids must exist in sources.json.
import type { CharacterState, DayReport } from '../engine/types';

export interface NoteContext {
  state: CharacterState;
  report: DayReport;
  /** Last up to 28 day reports, oldest first (may include the current report). */
  recent: DayReport[];
}

export interface CoachNote {
  id: string;
  topic: string;
  /** 1-2 sentences, plain language. */
  text: string;
  /** Ids into data/sources.json. */
  sourceIds: string[];
  trigger: (ctx: NoteContext) => boolean;
  /** Higher shows first. */
  priority: number;
}

// ---------- helpers ----------

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const trained = (r: DayReport): boolean => r.sets.length > 0;
const maxWeeklySets = (r: DayReport): number => Math.max(0, ...Object.values(r.muscleStim).map((m) => (m ? m.weeklySets : 0)));
const meanRir = (r: DayReport): number => (r.sets.length ? sum(r.sets.map((x) => x.rir)) / r.sets.length : NaN);
const meanPct = (r: DayReport): number => (r.sets.length ? sum(r.sets.map((x) => x.pct1rm)) / r.sets.length : NaN);
const meanVelLoss = (r: DayReport): number => (r.sets.length ? sum(r.sets.map((x) => x.velocityLoss)) / r.sets.length : NaN);
const failedFrac = (r: DayReport): number => (r.sets.length ? r.sets.filter((x) => x.failed).length / r.sets.length : 0);
const lastN = (c: NoteContext, n: number): DayReport[] => c.recent.slice(-n);
const meanBalance = (c: NoteContext, n: number): number => {
  const w = lastN(c, n);
  return w.length ? sum(w.map((r) => r.balance)) / w.length : 0;
};
const acwr = (s: CharacterState): number => {
  const h = s.fatigue.acuteLoadHist;
  const at = (back: number): number => h[(((s.day - 1 - back) % h.length) + h.length) % h.length] ?? 0;
  let acute = 0;
  let total = 0;
  for (let i = 0; i < h.length; i++) {
    const v = at(i);
    total += v;
    if (i < 7) acute += v;
  }
  const chronic = total / (h.length / 7);
  return chronic > 0 ? acute / chronic : 0;
};
const sumHist = (h: readonly number[]): number => sum(h);
const month = (r: DayReport): number => Number(r.date.slice(5, 7));
const isFemale = (c: NoteContext): boolean => c.state.sex === 'female';
const anyMuscle = (s: CharacterState, f: (m: CharacterState['muscles'][keyof CharacterState['muscles']]) => boolean): boolean => Object.values(s.muscles).some(f);

// ---------- notes ----------

export const COACH_NOTES: CoachNote[] = [
  // ----- volume, intensity, proximity to failure -----
  {
    id: 'volume-low', topic: 'Volume dose-response', priority: 40, sourceIds: ['schoenfeld2017volume', 'pelland2024'],
    text: 'Muscle growth rises with weekly hard sets per muscle, and the lowest-volume weeks leave a lot of growth on the table. Meta-regressions show most of the gain comes from the first sets, with returns shrinking as volume climbs.',
    trigger: (c) => trained(c.report) && maxWeeklySets(c.report) > 0 && maxWeeklySets(c.report) < 6,
  },
  {
    id: 'volume-diminishing', topic: 'Volume dose-response', priority: 36, sourceIds: ['pelland2024', 'schoenfeld2017volume'],
    text: 'Past roughly 10 to 20 weekly sets per muscle, each extra set adds less growth than the one before. More is not always better once you cannot recover from it.',
    trigger: (c) => maxWeeklySets(c.report) >= 22,
  },
  {
    id: 'volume-strength', topic: 'Volume dose-response', priority: 22, sourceIds: ['ralston2017'],
    text: 'Strength also rises with weekly set volume, but the curve flattens quickly, and high-volume weeks add little over moderate ones. Heavier loads and practice of the lift matter more for strength than piling on sets.',
    trigger: (c) => trained(c.report) && maxWeeklySets(c.report) >= 10 && maxWeeklySets(c.report) < 22,
  },
  {
    id: 'frequency-equated', topic: 'Training frequency', priority: 20, sourceIds: ['schoenfeld2019freq', 'grgic2018freq'],
    text: 'When weekly volume is equal, training a muscle more or fewer times per week makes little difference to growth. Spreading sets over more sessions mainly makes high volumes easier to do well.',
    trigger: (c) => maxWeeklySets(c.report) >= 12 && lastN(c, 7).filter(trained).length <= 2,
  },
  {
    id: 'proximity-far', topic: 'Proximity to failure', priority: 38, sourceIds: ['refalo2023', 'robinson2024'],
    text: 'Sets that stop with four or more reps in reserve stimulate noticeably less growth than sets taken close to failure. Aim for roughly 0 to 3 reps in reserve on most working sets.',
    trigger: (c) => c.report.sets.length >= 3 && meanRir(c.report) >= 4,
  },
  {
    id: 'proximity-failure', topic: 'Proximity to failure', priority: 34, sourceIds: ['refalo2023', 'moranNavarro2017'],
    text: 'Training to failure on most sets adds fatigue and slows recovery without clearly adding growth over stopping a rep or two short. Save true failure for safe, isolation-style lifts.',
    trigger: (c) => c.report.sets.length >= 3 && (failedFrac(c.report) > 0.3 || meanRir(c.report) < 0.5),
  },
  {
    id: 'velocity-loss', topic: 'Velocity loss', priority: 24, sourceIds: ['parejaBlanco2017'],
    text: 'Stopping a set once bar speed has dropped by about 20 percent gave similar strength gains to going to a 40 percent drop in a trial, with less fatigue. Large speed losses mean extra fatigue for little extra benefit.',
    trigger: (c) => trained(c.report) && meanVelLoss(c.report) > 0.35,
  },
  {
    id: 'light-loads', topic: 'Load and hypertrophy', priority: 26, sourceIds: ['schoenfeld2017load', 'lasevicius2018', 'lopez2021'],
    text: 'Light loads can build muscle about as well as heavy ones when sets are taken close to failure, but heavier loads still win for maximal strength. Mixing both is a sound approach.',
    trigger: (c) => c.report.sets.length >= 3 && meanPct(c.report) < 50,
  },

  // ----- protein, energy, body composition -----
  {
    id: 'protein-low', topic: 'Protein dose', priority: 48, sourceIds: ['morton2018', 'fao2013'],
    text: 'Protein intake below roughly 1.6 g per kg of body weight leaves muscle gains short of their potential, with benefits flattening out above that. Protein quality counts too, since digestibility and amino acid mix vary by food.',
    trigger: (c) => (c.report.hypMods.protein ?? 1) < 0.97 && trained(c.report),
  },
  {
    id: 'protein-distribution', topic: 'Protein distribution', priority: 30, sourceIds: ['schoenfeldAragon2018', 'trommelen2023'],
    text: 'Spreading protein over three or four feedings of about 0.4 g per kg works well, though the old idea of a hard 30 g per meal cap is not supported. Total daily protein matters far more than precise timing.',
    trigger: (c) => (c.report.hypMods.protein ?? 1) < 1 && (c.report.hypMods.protein ?? 1) >= 0.97,
  },
  {
    id: 'protein-timing', topic: 'Protein timing', priority: 14, sourceIds: ['schoenfeld2013timing'],
    text: 'The post-workout anabolic window is much wider than the gym myth says. Once total daily protein and training are matched, timing adds little.',
    trigger: (c) => trained(c.report) && (c.report.hypMods.protein ?? 1) >= 1,
  },
  {
    id: 'plant-protein', topic: 'Plant protein', priority: 16, sourceIds: ['heviaLarrain2021', 'mathai2017'],
    text: 'A protein-matched, high-protein plant diet can support similar strength and muscle gains to an omnivorous one. Lower digestibility of some plant proteins means eating a little more of it or mixing sources.',
    trigger: (c) => (c.report.hypMods.protein ?? 1) < 0.97,
  },
  {
    id: 'deficit-blunts', topic: 'Calorie deficit and hypertrophy', priority: 60, sourceIds: ['slater2019', 'murphyKoehler2022', 'helms2014'],
    text: 'Eating well below maintenance blunts muscle growth, and the bigger the deficit the more lean tissue you risk losing. Keep protein high, keep lifting heavy, and cut slowly to hold on to muscle.',
    trigger: (c) => c.report.balance < -500,
  },
  {
    id: 'deficit-rate', topic: 'Rate of weight loss', priority: 32, sourceIds: ['garthe2011', 'helms2014'],
    text: 'Athletes who lost about 0.7 percent of body weight per week kept more lean mass and gained more strength than those losing about 1.4 percent. A slower cut costs time but protects muscle.',
    trigger: (c) => c.report.balance < -250 && c.report.balance >= -500 && trained(c.report),
  },
  {
    id: 'recomposition', topic: 'Body recomposition', priority: 28, sourceIds: ['barakat2020'],
    text: 'Gaining muscle while losing fat at the same time is realistic for novices and returning lifters with high protein and hard training. It gets much slower the more trained you become.',
    trigger: (c) => c.state.trainingHours < 200 && Math.abs(c.report.balance) < 200 && trained(c.report),
  },
  {
    id: 'surplus-size', topic: 'Energy surplus', priority: 30, sourceIds: ['helms2023', 'slater2019'],
    text: 'A large surplus does not buy proportionally more muscle, and the extra calories mostly end up as fat. A modest surplus, or even maintenance for newer lifters, builds muscle with less fat gain.',
    trigger: (c) => c.report.balance > 500,
  },
  {
    id: 'carbs-training', topic: 'Carbohydrate', priority: 18, sourceIds: ['henselmans2022', 'burke2011'],
    text: 'Carbohydrate matters most for long or repeated hard sessions, where it supports performance. For typical lifting, total calories and protein explain more of your results than carb amount.',
    trigger: (c) => c.state.aerobic.glycogen < 300 && c.report.trainingMinutes > 30,
  },
  {
    id: 'low-fat', topic: 'Dietary fat', priority: 12, sourceIds: ['helms2014'],
    text: 'Fat intake below about 20 percent of calories is not needed and can undermine hormonal health in dieting athletes. Keep a moderate fat floor even when cutting.',
    trigger: (c) => (c.report.hypMods.fatIntake ?? 1) < 1,
  },
  {
    id: 'alcohol', topic: 'Alcohol and recovery', priority: 26, sourceIds: ['parr2014'],
    text: 'Alcohol after training lowers muscle protein synthesis, even when protein is eaten with it. Heavy drinking quietly taxes your gains.',
    trigger: (c) => (c.report.hypMods.alcohol ?? 1) < 1,
  },
  {
    id: 'hunger-satiety', topic: 'Hunger and satiety', priority: 18, sourceIds: ['holt1995', 'westerterp2004'],
    text: 'Foods differ a lot in how filling they are per calorie, and protein is the most satiating nutrient. Choosing high-satiety foods makes a deficit much easier to stick to.',
    trigger: (c) => c.state.nutrition.hunger > 0.7 && c.report.balance < 0,
  },

  // ----- energy balance and weight loss -----
  {
    id: 'rule-3500', topic: 'The 3500 kcal rule', priority: 42, sourceIds: ['hall2008', 'hall2011'],
    text: 'The 3500 kcal per pound rule overstates long-term loss because your body burns less as it shrinks and adapts to eating less. Real weight loss follows a curve that slows down, not a straight line.',
    trigger: (c) => c.recent.length >= 14 && meanBalance(c, 14) < -300,
  },
  {
    id: 'metabolic-adaptation', topic: 'Why weight loss slows', priority: 44, sourceIds: ['rosenbaumLeibel2010', 'martins2020', 'pontzer2016'],
    text: 'Part of the slowdown in dieting is a real drop in energy expenditure beyond what the smaller body explains, though how large it is remains debated. Planned diet breaks and patience are better answers than cutting calories further.',
    trigger: (c) => c.state.body.adaptiveThermo > 0.2,
  },
  {
    id: 'neat-surplus', topic: 'NEAT and weight gain', priority: 16, sourceIds: ['levine1999'],
    text: 'When people overeat, some spontaneously fidget and move more, and that non-exercise activity explained much of the difference in who gained fat. Daily movement quietly shifts your energy balance.',
    trigger: (c) => c.report.balance > 250,
  },
  {
    id: 'epoc-small', topic: 'Afterburn', priority: 10, sourceIds: ['laforgia2006'],
    text: 'The afterburn from a workout is real but small, usually a few dozen calories rather than hundreds. Do not count on it to cover a meal.',
    trigger: (c) => c.report.trainingMinutes > 30 && c.report.tdee.epoc > 0,
  },
  {
    id: 'water-weight', topic: 'Water weight', priority: 20, sourceIds: ['fernandezElias2015'],
    text: 'Each gram of stored glycogen holds about three grams of water, so scale weight jumps when you change carbs or start training. Day-to-day swings are mostly water, not fat.',
    trigger: (c) => c.state.body.earlyWater > 0.5,
  },

  // ----- sleep and stress -----
  {
    id: 'sleep-lean-loss', topic: 'Sleep restriction and lean mass', priority: 52, sourceIds: ['nedeltcheva2010'],
    text: 'In a dieting trial, sleeping 5.5 hours instead of 8.5 cut fat loss by more than half and increased the share of weight lost as lean mass. Short sleep during a deficit costs muscle.',
    trigger: (c) => c.state.fatigue.sleepDebtH > 4 && c.report.balance < -200,
  },
  {
    id: 'sleep-protein-synthesis', topic: 'Sleep and muscle', priority: 34, sourceIds: ['lamon2021', 'craven2022'],
    text: 'A night of lost sleep lowers muscle protein synthesis, and sleep loss in general hurts performance, especially in longer efforts. Protecting sleep is a training variable.',
    trigger: (c) => (c.report.hypMods.sleep ?? 1) < 1,
  },
  {
    id: 'sleep-injury', topic: 'Sleep and injury', priority: 36, sourceIds: ['milewski2014'],
    text: 'Young athletes who sleep under eight hours had higher injury rates than those who sleep more. Chronic short sleep makes you more breakable.',
    trigger: (c) => c.state.fatigue.sleepDebtH > 6,
  },
  {
    id: 'sleep-extension', topic: 'Sleep extension', priority: 12, sourceIds: ['mah2011'],
    text: 'Basketball players who extended sleep to about ten hours sprinted faster and shot more accurately. Extra sleep is one of the cheapest performance boosts.',
    trigger: (c) => c.state.fatigue.sleepDebtH < 1 && c.report.readiness > 0.85 && trained(c.report),
  },
  {
    id: 'chronic-stress', topic: 'Stress and recovery', priority: 30, sourceIds: ['stultsKolehmainen2014', 'bartholomew2008'],
    text: 'Chronic psychological stress slows recovery of muscle function and blunts strength gains. High life stress is training load too.',
    trigger: (c) => c.state.fatigue.stress > 0.6 || (c.report.hypMods.stress ?? 1) < 0.95,
  },

  // ----- interference, detraining, memory -----
  {
    id: 'interference', topic: 'Interference effect', priority: 40, sourceIds: ['wilson2012', 'schumann2022'],
    text: 'Combining endurance and strength training can reduce strength and power gains, especially with lots of running and short gaps between sessions. Hypertrophy is affected little, so separate sessions and keep cardio volume modest.',
    trigger: (c) => c.report.interference.strength < 0.97 || c.report.interference.power < 0.97,
  },
  {
    id: 'interference-hyp', topic: 'Interference effect', priority: 24, sourceIds: ['schumann2022'],
    text: 'Muscle growth is largely compatible with endurance training, so concurrent training suits physique goals better than power goals. Cycling tends to interfere less than running.',
    trigger: (c) => c.report.interference.hypertrophy < 0.98 && c.report.interference.hypertrophy < c.report.interference.strength + 0.02,
  },
  {
    id: 'lifting-for-runners', topic: 'Strength for endurance', priority: 22, sourceIds: ['balsalobre2016'],
    text: 'Strength training improves running economy in trained runners, so it helps rather than hurts when added sensibly. Heavy lifting twice a week is a solid starting dose.',
    trigger: (c) => c.report.cardioMinutes > 0 && c.state.aerobic.runHours > 20,
  },
  {
    id: 'detraining', topic: 'Detraining', priority: 38, sourceIds: ['bosquet2013', 'mujika2000'],
    text: 'Strength holds up for a few weeks off and then declines slowly, while muscle size is lost gradually. A short break costs little, and trained lifters lose less than they fear.',
    trigger: (c) => c.recent.length >= 14 && lastN(c, 14).every((r) => !trained(r) && r.trainingMinutes === 0),
  },
  {
    id: 'muscle-memory', topic: 'Muscle memory', priority: 34, sourceIds: ['bruusgaard2010', 'seaborne2018', 'psilander2019'],
    text: 'Muscle you have built before returns faster than muscle you build from scratch, likely thanks to retained nuclei and epigenetic marks. Lost size is quick to regain once you train again.',
    trigger: (c) => sum(Object.values(c.state.muscles).map((m) => Math.max(0, m.highWater - m.mass))) > 0.3 && trained(c.report),
  },
  {
    id: 'maintenance-dose', topic: 'Maintenance dose', priority: 18, sourceIds: ['spiering2021', 'bickel2011'],
    text: 'Maintaining strength and size takes far less training than building them, roughly a third of the volume in older trials. When life gets busy, a few hard sets per muscle keeps most of your gains.',
    trigger: (c) => trained(c.report) && maxWeeklySets(c.report) >= 2 && maxWeeklySets(c.report) < 6,
  },
  {
    id: 'aerobic-detraining', topic: 'Aerobic detraining', priority: 20, sourceIds: ['coyle1984', 'hickson1981'],
    text: 'Aerobic fitness falls within weeks of stopping, but reduced frequency alone can maintain much of it if intensity stays up. Intensity is the key to keeping endurance.',
    trigger: (c) => c.recent.length >= 14 && lastN(c, 14).every((r) => r.cardioMinutes === 0) && c.state.aerobic.vo2Fast + c.state.aerobic.vo2Slow > 2,
  },

  // ----- fatigue, overreaching, injury -----
  {
    id: 'deload', topic: 'Deloads', priority: 46, sourceIds: ['meeusen2013', 'banister1975'],
    text: 'Performance is the net of fitness and fatigue, so a lighter week lets fatigue fall while fitness barely moves. Low readiness is your cue to back off before it becomes overreaching.',
    trigger: (c) => c.state.fatigue.state === 'normal' && c.report.readiness < 0.6,
  },
  {
    id: 'functional-overreach', topic: 'Functional overreaching', priority: 50, sourceIds: ['meeusen2013'],
    text: 'Functional overreaching is a short-term dip in performance that rebounds after days to weeks of rest. It can be deliberate, as long as you actually take the rest.',
    trigger: (c) => c.state.fatigue.state === 'FOR',
  },
  {
    id: 'nonfunctional-overreach', topic: 'Non-functional overreaching', priority: 70, sourceIds: ['meeusen2013'],
    text: 'Non-functional overreaching means performance stays down for weeks to months despite rest. It signals that load, sleep or food have been out of balance for too long.',
    trigger: (c) => c.state.fatigue.state === 'NFOR',
  },
  {
    id: 'overtraining', topic: 'Overtraining syndrome', priority: 80, sourceIds: ['meeusen2013'],
    text: 'Overtraining syndrome is a long-lasting maladaptation, often months of lost performance, with mood and hormonal disruption. Prevention beats cure, and diagnosis requires ruling out illness and low energy intake.',
    trigger: (c) => c.state.fatigue.state === 'OTS',
  },
  {
    id: 'acwr-spike', topic: 'Load spikes and injury', priority: 58, sourceIds: ['gabbett2016', 'impellizzeri2020'],
    text: 'Jumping your weekly load far above what you have been used to is linked with more injuries, while a well-built base protects you. The ratio is a rough guide with known statistical limits, not a precise alarm.',
    trigger: (c) => acwr(c.state) > 1.5,
  },
  {
    id: 'training-paradox', topic: 'Training load paradox', priority: 16, sourceIds: ['gabbett2016'],
    text: 'Athletes with a high chronic training load tend to be better protected against injury than those who train too little. Building load gradually is safer than staying underprepared.',
    trigger: (c) => trained(c.report) && acwr(c.state) > 0 && acwr(c.state) < 0.8 && c.recent.length >= 21,
  },
  {
    id: 'nordic', topic: 'Hamstring injury prevention', priority: 42, sourceIds: ['vanDyk2019'],
    text: 'Programs that include the Nordic hamstring exercise cut hamstring injuries by roughly half in meta-analysis. A few sets per week of eccentric hamstring work is cheap insurance.',
    trigger: (c) => sumHist(c.state.fatigue.preventionHist.nordic ?? []) === 0 && ((c.report.muscleStim.hamstrings?.weeklySets ?? 0) > 3 || c.state.injuryHistory.some((i) => i.tissue === 'hamstrings')),
  },
  {
    id: 'copenhagen', topic: 'Groin injury prevention', priority: 28, sourceIds: ['haroy2019'],
    text: 'A structured adductor strengthening program, including the Copenhagen exercise, lowered groin problems in male footballers. Sports with sprints and cutting benefit most.',
    trigger: (c) => sumHist(c.state.fatigue.preventionHist.copenhagen ?? []) === 0 && (sumHist(c.state.power.sprintHist) > 0 || c.state.injuryHistory.some((i) => i.tissue === 'adductors' || i.tissue === 'groin')),
  },
  {
    id: 'tendon-lag', topic: 'Tendon adaptation', priority: 38, sourceIds: ['bohm2015', 'heinemeier2013'],
    text: 'Tendons adapt far more slowly than muscle and have little tissue renewal in adults. If your lifts jump faster than your tendons can follow, tendinopathy risk rises.',
    trigger: (c) => anyMuscle(c.state, (m) => m.tendon < 0.85),
  },
  {
    id: 'injury-rate', topic: 'Injury', priority: 54, sourceIds: ['keoghWinwood2017'],
    text: 'Weightlifting injuries are mostly strains and joint problems, and rates are lower than in many team sports. Most are caused by too much load too soon, or by poor recovery.',
    trigger: (c) => c.report.injuries.length > 0 || c.state.injuries.length > 0,
  },
  {
    id: 'cross-education', topic: 'Training around injury', priority: 26, sourceIds: ['carroll2006', 'manca2017'],
    text: 'Training one limb raises strength in the untrained limb through neural adaptation. Working the healthy side while an injury heals helps limit strength loss.',
    trigger: (c) => c.state.injuries.length > 0,
  },
  {
    id: 'running-novice', topic: 'Running injuries', priority: 30, sourceIds: ['videbaek2015'],
    text: 'Novice runners have roughly double the injury rate per hour of experienced runners. Add running volume gradually and keep early runs easy.',
    trigger: (c) => c.report.cardioMinutes > 0 && c.state.aerobic.runHours < 50,
  },

  // ----- energy availability, bone, sex -----
  {
    id: 'low-ea', topic: 'Low energy availability', priority: 66, sourceIds: ['loucks2003', 'mountjoy2023'],
    text: 'When energy left after exercise falls below about 30 kcal per kg of fat-free mass, hormones start to shut down. Low energy availability can harm health and performance even in athletes who look fine.',
    trigger: (c) => c.report.energyAvailability < 30,
  },
  {
    id: 'reds', topic: 'REDs', priority: 74, sourceIds: ['mountjoy2023'],
    text: 'Relative Energy Deficiency in Sport covers the lasting effects of low energy availability, including bone loss, poor recovery, illness and reproductive dysfunction. Weeks of undereating while training is how it starts.',
    trigger: (c) => c.state.nutrition.lowEaDays > 14,
  },
  {
    id: 'bone-loading', topic: 'Bone health', priority: 24, sourceIds: ['turnerRobling2003', 'watson2018'],
    text: 'Bone responds to high, varied and unusual loading, and heavy lifting plus impact training improved bone density in a trial of postmenopausal women. Low-load or low-impact exercise does little for bone.',
    trigger: (c) => c.state.body.bmd < 0.95,
  },
  {
    id: 'women-training', topic: 'Women and resistance training', priority: 14, sourceIds: ['roberts2020', 'hunter2014'],
    text: 'Women gain similar relative muscle size to men from resistance training and tend to fatigue less in many tasks. Training recommendations are largely the same.',
    trigger: (c) => isFemale(c) && trained(c.report),
  },
  {
    id: 'menstrual-cycle', topic: 'Menstrual cycle', priority: 12, sourceIds: ['mcnulty2020'],
    text: 'Performance may dip slightly in the early follicular phase, but effects are small and highly individual. Train by how you feel rather than rigid cycle rules.',
    trigger: (c) => isFemale(c) && c.state.ageYears < 50 && c.report.readiness < 0.8,
  },

  // ----- micronutrients -----
  {
    id: 'iron-runners', topic: 'Iron and runners', priority: 46, sourceIds: ['peeling2008', 'burden2015'],
    text: 'Hard training raises hepcidin for hours, which cuts iron absorption, and running adds losses through impact and sweat. Even iron deficiency without anaemia can hurt performance.',
    trigger: (c) => c.state.nutrition.ironStoreMg < 300 && c.state.aerobic.runHours > 10,
  },
  {
    id: 'iron-hepcidin', topic: 'Iron absorption', priority: 20, sourceIds: ['peeling2008', 'hurrellEgli2010'],
    text: 'Heme iron from meat is absorbed far better than non-heme iron from plants, and absorption drops for hours after hard exercise. Space iron-rich meals away from training.',
    trigger: (c) => c.state.nutrition.ironStoreMg < 500 && c.report.trainingMinutes > 20,
  },
  {
    id: 'hemoglobin-vo2', topic: 'Hemoglobin and VO2max', priority: 28, sourceIds: ['schmidtPrommer2010'],
    text: 'Total hemoglobin mass is a main driver of VO2max, so losing it through iron deficiency lowers your aerobic ceiling. Restoring iron restores it.',
    trigger: (c) => c.state.aerobic.hbMassFraction < 0.95,
  },
  {
    id: 'vitd-winter', topic: 'Winter vitamin D', priority: 40, sourceIds: ['webb1988', 'ross2011'],
    text: 'At northern latitudes the winter sun is too weak to make vitamin D in skin, so levels fall from autumn to spring. Below about 20 ng/mL counts as deficient.',
    trigger: (c) => (month(c.report) >= 11 || month(c.report) <= 2) && c.state.nutrition.vitDngml < 30,
  },
  {
    id: 'vitd-dose', topic: 'Vitamin D dosing', priority: 22, sourceIds: ['heaney2003', 'iom2011'],
    text: 'Blood vitamin D rises with dose but slowly, taking weeks to plateau. Supplementing steadily beats a single large dose.',
    trigger: (c) => c.state.nutrition.vitDngml < 20,
  },
  {
    id: 'vitd-muscle', topic: 'Vitamin D and muscle', priority: 26, sourceIds: ['iom2011', 'ross2011'],
    text: 'Deficiency, not merely low-normal levels, is where vitamin D matters for health, and it also hampers muscle function. Fixing a real deficit helps, but extra beyond sufficiency does not.',
    trigger: (c) => (c.report.hypMods.vitaminD ?? 1) < 1,
  },
  {
    id: 'calcium-low', topic: 'Calcium', priority: 14, sourceIds: ['iom2011'],
    text: 'Adults need about 1000 mg of calcium a day, rising for women over 50 and everyone over 70, to support bone. Dairy, fortified foods and greens all count.',
    trigger: (c) => c.state.nutrition.calciumStatus < 0.6,
  },
  {
    id: 'magnesium-low', topic: 'Magnesium', priority: 12, sourceIds: ['maughan2018'],
    text: 'Magnesium supplements help only when dietary intake is low and do nothing for performance in people who are replete. Fix the diet first.',
    trigger: (c) => c.state.nutrition.magnesiumStatus < 0.6,
  },

  // ----- supplements -----
  {
    id: 'caffeine-sleep', topic: 'Caffeine and sleep', priority: 44, sourceIds: ['drake2013', 'guest2021'],
    text: 'Caffeine taken even six hours before bed measurably cut sleep time in a trial. Keep it to the morning and early afternoon if sleep is a limiter.',
    trigger: (c) => c.state.fatigue.caffeineMgAtBed > 25,
  },
  {
    id: 'caffeine-benefit', topic: 'Caffeine performance', priority: 16, sourceIds: ['grgic2018caffeine'],
    text: 'Caffeine gives a small but real boost to strength and power, and it works best for the first hour or two. It is a modest edge, not a replacement for sleep.',
    trigger: (c) => c.state.nutrition.caffeineHabit > 0.8 && trained(c.report),
  },
  {
    id: 'creatine-loading', topic: 'Creatine saturation', priority: 32, sourceIds: ['hultman1996', 'kreider2017'],
    text: 'Muscle creatine saturates in about a week with a loading phase of 20 g a day, or in roughly a month on 3 to 5 g a day. Both end up in the same place, so loading is optional.',
    trigger: (c) => c.state.flags.creatine && c.state.body.creatineSaturation < 0.9,
  },
  {
    id: 'creatine-water', topic: 'Creatine water weight', priority: 30, sourceIds: ['kreider2017', 'syrotuikBell2004'],
    text: 'Creatine typically adds around one to two kilograms of body water early on, mostly inside muscle cells. That is not fat gain, and it is not harmful.',
    trigger: (c) => c.state.body.creatineWater > 0.5,
  },
  {
    id: 'creatine-nonresponder', topic: 'Creatine non-responders', priority: 34, sourceIds: ['syrotuikBell2004', 'kreider2017'],
    text: 'Some people barely raise muscle creatine from supplements, usually those who already eat a lot of meat and fish. If you gain no water weight and see no benefit, you may be a non-responder.',
    trigger: (c) => c.state.flags.creatine && c.state.body.creatineSaturation > 0.9 && c.state.genetics.revealed.responders && !c.state.genetics.creatineResponder,
  },
  {
    id: 'beta-alanine', topic: 'Beta-alanine tingling', priority: 24, sourceIds: ['hobson2012', 'saunders2017'],
    text: 'Beta-alanine causes harmless tingling in the skin, which is why it is taken in smaller split doses. It helps efforts lasting about one to four minutes, not maximal lifts.',
    trigger: (c) => c.state.nutrition.betaAlanineLoad > 0.05,
  },
  {
    id: 'bcaa', topic: 'BCAAs', priority: 20, sourceIds: ['maughan2018'],
    text: 'If you eat enough protein, BCAA supplements add nothing, because whole protein already supplies them. Spend the money on food.',
    trigger: (c) => (c.report.hypMods.protein ?? 1) >= 0.97 && trained(c.report),
  },
  {
    id: 'test-boosters', topic: 'Testosterone boosters', priority: 18, sourceIds: ['maughan2018'],
    text: 'Over-the-counter testosterone boosters do not raise testosterone or build muscle in healthy men. Sleep, food and training move hormones; supplements do not.',
    trigger: (c) => c.state.sex === 'male' && c.state.ageYears >= 28 && trained(c.report),
  },
  {
    id: 'fat-burners', topic: 'Fat burners', priority: 18, sourceIds: ['maughan2018'],
    text: 'Fat burners are mostly caffeine plus filler, and their effect is trivial next to a calorie deficit. A deficit does the burning.',
    trigger: (c) => c.report.balance < -200,
  },
  {
    id: 'bicarb-nitrate', topic: 'Evidence-based supplements', priority: 10, sourceIds: ['maughan2018', 'grgic2021bicarb', 'jones2014'],
    text: 'Few supplements have good evidence: caffeine, creatine, beta-alanine, bicarbonate and nitrate lead the list. Each helps a specific kind of effort, and bicarbonate often upsets the stomach.',
    trigger: (c) => c.report.cardioMinutes > 20,
  },

  // ----- hydration -----
  {
    id: 'dehydration', topic: 'Dehydration thresholds', priority: 42, sourceIds: ['cheuvrontKenefick2014', 'judelson2007'],
    text: 'Losing about 2 percent of body weight in fluid starts to impair endurance performance, and larger deficits also cost strength and power. Drink to thirst and replace big sweat losses.',
    trigger: (c) => c.state.nutrition.hydration >= 0.02,
  },
  {
    id: 'sweat-variability', topic: 'Sweat loss', priority: 14, sourceIds: ['baker2017'],
    text: 'Sweat rate and sweat sodium differ widely between athletes, so generic fluid advice often misses the mark. Weigh yourself before and after a session to see your own loss.',
    trigger: (c) => c.state.nutrition.hydration >= 0.01,
  },

  // ----- specificity, neural, genetics, aging -----
  {
    id: 'novice-neural', topic: 'Novice neural gains', priority: 36, sourceIds: ['moritaniDeVries1979', 'seynnes2007'],
    text: 'Early strength gains come largely from the nervous system, with muscle growth adding up more slowly. That is why beginners get stronger fast without looking much bigger.',
    trigger: (c) => c.state.trainingHours < 30 && trained(c.report),
  },
  {
    id: 'skill-specificity', topic: 'Strength is skill-specific', priority: 28, sourceIds: ['moritaniDeVries1979', 'carroll2006'],
    text: 'Strength gains are largely specific to the lift and movement you practice, partly because technique is learned. A new exercise feels weak at first even if your muscles are strong.',
    trigger: (c) => c.report.sets.some((x) => (c.state.skills[x.exerciseId]?.skill ?? 1) < 0.5),
  },
  {
    id: 'repeated-bout', topic: 'Soreness and the repeated bout effect', priority: 22, sourceIds: ['mchugh2003', 'hyldahlHubal2014'],
    text: 'Soreness after a new exercise fades with repeat exposure because the body adapts to protect itself. Heavy soreness is not required for growth.',
    trigger: (c) => c.state.trainingHours < 60 && c.report.readinessFactors.soreness !== undefined && c.report.readinessFactors.soreness < 0.9,
  },
  {
    id: 'response-variability', topic: 'Genetic response variability', priority: 32, sourceIds: ['hubal2005', 'bouchard1999'],
    text: 'In large trials, identical training produced anywhere from almost no growth to doubled muscle size in different people. Your results are partly set by genetics, so compare yourself to your own history.',
    trigger: (c) => c.state.trainingHours > 100 && !c.state.genetics.revealed.responders,
  },
  {
    id: 'fiber-type', topic: 'Fibre type', priority: 12, sourceIds: ['simoneauBouchard1989', 'costill1976'],
    text: 'Muscle fibre type proportions vary widely between people and are mostly inherited. They shape whether you are naturally better at sprinting or endurance work.',
    trigger: (c) => c.state.genetics.revealed.fiberType,
  },
  {
    id: 'actn3', topic: 'ACTN3 and power', priority: 12, sourceIds: ['yang2003'],
    text: 'The ACTN3 gene variant is linked to elite sprint and power performance, but it explains only a small part of the variation between athletes. It is no destiny.',
    trigger: (c) => c.state.genetics.revealed.responders && c.state.genetics.actn3xx,
  },
  {
    id: 'ceiling-slowing', topic: 'Diminishing gains', priority: 30, sourceIds: ['mcdonaldAragon', 'schutz2002'],
    text: 'Realistic rates of muscle gain fall steadily with each year of training as you approach your genetic limit. Slower progress means you are getting closer, not that something is wrong.',
    trigger: (c) => anyMuscle(c.state, (m) => m.mass > 0.85 * m.mmax) && trained(c.report),
  },
  {
    id: 'anabolic-resistance', topic: 'Aging and anabolic resistance', priority: 38, sourceIds: ['breenPhillips2011', 'mitchell2012', 'peterson2011'],
    text: 'Older muscle responds less to a given dose of protein and exercise, so older lifters need somewhat more protein per meal and consistent resistance training. Lifting still adds lean mass at any age.',
    trigger: (c) => c.state.ageYears >= 50,
  },
  {
    id: 'vo2-aging', topic: 'Aging and aerobic capacity', priority: 20, sourceIds: ['fleg2005'],
    text: 'Aerobic capacity declines with age, and the decline accelerates in later decades, especially in the sedentary. Staying active slows it considerably.',
    trigger: (c) => c.state.ageYears >= 40 && c.report.cardioMinutes === 0,
  },

  // ----- power, speed, endurance -----
  {
    id: 'plyometrics', topic: 'Plyometrics', priority: 20, sourceIds: ['markovic2007'],
    text: 'Plyometric training reliably improves jump height in a range of populations. A couple of low-volume sessions per week is enough.',
    trigger: (c) => sumHist(c.state.power.plyoHist) > 0,
  },
  {
    id: 'strength-sprint', topic: 'Strength and sprinting', priority: 18, sourceIds: ['seitz2014', 'suchomel2016'],
    text: 'Greater lower-body strength transfers positively to sprint speed, especially over shorter distances. Stronger legs are a good base for speed work.',
    trigger: (c) => sumHist(c.state.power.sprintHist) > 0 && c.report.sets.length > 0,
  },
  {
    id: 'sprint-force', topic: 'Sprint speed', priority: 16, sourceIds: ['weyand2000', 'morin2011'],
    text: 'Top running speed comes from applying greater force to the ground rather than from moving the legs faster, and good force direction counts. Practise sprinting itself, not just lifting.',
    trigger: (c) => sumHist(c.state.power.sprintHist) > 0,
  },
  {
    id: 'polarized', topic: 'Endurance intensity distribution', priority: 18, sourceIds: ['seiler2010', 'stogglSperlich2014'],
    text: 'Elite endurance athletes do most of their training easy and a smaller share very hard. Polarized training beat threshold-heavy training in trained athletes in one trial.',
    trigger: (c) => c.report.cardioMinutes >= 60,
  },
  {
    id: 'vo2-genetics', topic: 'Aerobic trainability', priority: 14, sourceIds: ['bouchard1999'],
    text: 'VO2max gains from the same program vary enormously between people, and part of that variation runs in families. Judge your progress against your own baseline.',
    trigger: (c) => c.report.cardioMinutes > 0 && !c.state.genetics.revealed.responders,
  },
];

// ---------- selection ----------

/** Highest-priority triggered notes (ties broken by id), at most `max`. Deterministic and side-effect free. */
export function notesFor(ctx: NoteContext, max = 3): CoachNote[] {
  if (max <= 0) return [];
  const hits = COACH_NOTES.filter((n) => {
    try {
      return n.trigger(ctx);
    } catch {
      return false;
    }
  });
  hits.sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return hits.slice(0, max);
}
