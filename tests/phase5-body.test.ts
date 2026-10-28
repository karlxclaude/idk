import { describe, expect, it } from 'vitest';
import { MUSCLE_REGIONS } from '../data/muscles';
import { bodyShape, topGrown } from '../ui/body/model';
import { referenceCharacter } from '../engine/character';
import { ctx, averageMan } from './helpers';

const P = ctx.P;
const ref = () => referenceCharacter(ctx);

describe('phase 5: body visual model', () => {
  it('reference man has girth multipliers of about 1', () => {
    const s = bodyShape(ref(), P);
    for (const m of MUSCLE_REGIONS) expect(s.girth[m]).toBeCloseTo(1, 1);
    for (const g of Object.values(s.group)) expect(g).toBeCloseTo(1, 1);
  });

  it('doubling quad mass raises quad girth by about sqrt(2)', () => {
    const base = bodyShape(ref(), P);
    const c = ref();
    c.muscles.vasti.mass *= 2;
    c.muscles.rectusFemoris.mass *= 2;
    const s = bodyShape(c, P);
    expect(s.girth.vasti / base.girth.vasti).toBeCloseTo(Math.SQRT2, 1);
    expect(s.group.quads / base.group.quads).toBeCloseTo(Math.SQRT2, 1);
    expect(s.group.hams).toBeCloseTo(base.group.hams, 5);
  });

  it('higher body fat gives a thicker fat layer and lower definition', () => {
    const lean = averageMan({ bodyFat: 0.1 });
    const fat = averageMan({ bodyFat: 0.3 });
    const a = bodyShape(lean, P);
    const b = bodyShape(fat, P);
    for (const k of Object.keys(a.fat) as Array<keyof typeof a.fat>) expect(b.fat[k]).toBeGreaterThan(a.fat[k]);
    expect(b.definition).toBeLessThan(a.definition);
  });

  it('higher androidFat puts more fat on the waist than on the limbs', () => {
    const lo = averageMan({ bodyFat: 0.25 });
    const hi = averageMan({ bodyFat: 0.25 });
    lo.genetics.androidFat = 0.2;
    hi.genetics.androidFat = 0.8;
    const a = bodyShape(lo, P);
    const b = bodyShape(hi, P);
    expect(b.fat.waist).toBeGreaterThan(a.fat.waist);
    expect(b.fat.thigh).toBeLessThan(a.fat.thigh);
    expect(b.fat.waist).toBeGreaterThan(b.fat.thigh);
    expect(b.fat.waist).toBeGreaterThan(b.fat.upperArm);
    expect(b.fat.waist / b.fat.thigh).toBeGreaterThan(a.fat.waist / a.fat.thigh);
  });

  it('a longer thigh fraction gives a longer thigh segment', () => {
    const a = averageMan();
    const b = averageMan();
    b.anthro.thigh = a.anthro.thigh * 1.1;
    expect(bodyShape(b, P).seg.thigh).toBeGreaterThan(bodyShape(a, P).seg.thigh);
  });

  it('wrist circumference widens the frame; belly length does not change girth', () => {
    const a = averageMan();
    const b = averageMan();
    b.anthro.wristCm = a.anthro.wristCm + 2;
    expect(bodyShape(b, P).frame.shoulderHalf).toBeGreaterThan(bodyShape(a, P).frame.shoulderHalf);
    const c = averageMan();
    c.muscles.biceps.momentArm = 0.7;
    const sa = bodyShape(a, P);
    const sc = bodyShape(c, P);
    expect(sc.girth.biceps).toBeCloseTo(sa.girth.biceps, 8);
    expect(sc.fullness.biceps).toBeGreaterThan(sa.fullness.biceps);
  });

  it('is deterministic and ranks grown muscles', () => {
    const c = averageMan();
    expect(bodyShape(c, P)).toEqual(bodyShape(c, P));
    c.muscles.lats.mass = c.muscles.lats.baseline + 2;
    expect(topGrown(c, 1)[0]?.id).toBe('lats');
  });
});
