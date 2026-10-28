// Headless simulation CLI.
// Usage: npm run sim -- --seed 7 --years 2 [--sex female] [--age 30] [--program fullbody|arms|cardio|runner|plyo] [--balance 250]
import { makeContext } from '../engine/context';
import { createCharacter } from '../engine/character';
import { runDays, snapshot, bodyFatTargetDiet } from '../engine/runner';
import type { WeeklyPlan } from '../engine/plan';
import { ARM_ONLY_WEEK, CARDIO_WEEK, FULL_BODY_WEEK, PLYO_WEEK, RUNNER_WEEK } from '../data/programs';
import { bodyFatFraction, normalizedFfmi } from '../engine/body';
import { runTime, row2kTime, formatTime } from '../engine/performance';

const args = process.argv.slice(2);
const arg = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 && args[i + 1] ? (args[i + 1] as string) : d;
};
const ctx = makeContext({ accelerated: args.includes('--accelerated') });
const programs: Record<string, WeeklyPlan['week']> = { fullbody: FULL_BODY_WEEK, arms: ARM_ONLY_WEEK, cardio: CARDIO_WEEK, runner: RUNNER_WEEK, plyo: PLYO_WEEK };
const s = createCharacter(ctx, { sex: arg('sex', 'male') as 'male' | 'female', ageYears: Number(arg('age', '24')) }, arg('seed', '1'));
const plan: WeeklyPlan = {
  week: programs[arg('program', 'fullbody')] ?? FULL_BODY_WEEK,
  sleepH: Number(arg('sleep', '8')), bedHour: 23,
  intake: { balanceKcal: Number(arg('balance', '250')), proteinGkg: Number(arg('protein', '1.8')) },
  supplements: { vitDIU: 1000, creatine: args.includes('--creatine') },
};
const years = Number(arg('years', '1'));
const diet = args.includes('--lean-bulk') ? bodyFatTargetDiet(ctx, 0.15) : undefined;
const row = (label: string) => {
  const snap = snapshot(ctx, s);
  console.log(
    `${label.padEnd(8)} BW ${snap.weight.toFixed(1)} kg | BF ${(bodyFatFraction(s, ctx.P) * 100).toFixed(1)}% | lean ${snap.leanMass.toFixed(1)} | nFFMI ${normalizedFfmi(s, ctx.P).toFixed(1)} | ` +
      Object.entries(snap.lifts).map(([k, v]) => `${k.split('_')[0]} ${v.toFixed(0)}`).join(' ') +
      ` | CMJ ${(snap.cmj * 100).toFixed(1)} cm | 40yd ${snap.sprint40yd.toFixed(2)} s | VO2 ${snap.vo2max.toFixed(1)} | 5K ${formatTime(runTime(ctx, s, 5000))} | 2K row ${formatTime(row2kTime(ctx, s))}`,
  );
};
console.log(`seed ${s.seed}: ${s.sex}, ${s.ageYears.toFixed(0)} y, ${s.anthro.heightCm.toFixed(0)} cm; hidden: hyp x${s.genetics.responderHyp.toFixed(2)} str x${s.genetics.responderStr.toFixed(2)} aer x${s.genetics.responderAer.toFixed(2)} typeI ${s.genetics.typeIVL.toFixed(0)}% ceiling FFMI ${s.genetics.ffmiCeiling.toFixed(1)}`);
row('start');
const t0 = Date.now();
for (let q = 1; q <= years * 4; q++) {
  runDays(ctx, s, plan, 91, diet ? { adjust: diet } : {});
  row(`q${q}`);
}
console.log(`injuries: ${s.injuryHistory.length + s.injuries.length}; simulated ${years} y in ${Date.now() - t0} ms`);
