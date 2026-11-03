import { describe, expect, it } from 'vitest';
import sources from '../data/sources.json';
import { COACH_NOTES, notesFor, type NoteContext } from '../data/coachNotes';
import { FULL_BODY_WEEK } from '../data/programs';
import { inputsForDay } from '../engine/plan';
import { simulateDay } from '../engine/sim';
import type { DayReport } from '../engine/types';
import { averageMan, ctx, goodPlan } from './helpers';

const sourceIds = new Set((sources as Array<{ id: string }>).map((s) => s.id));

function realContext(days = 3): NoteContext {
  const s = averageMan();
  const plan = goodPlan(FULL_BODY_WEEK);
  const recent: DayReport[] = [];
  for (let i = 0; i < days; i++) recent.push(simulateDay(ctx, s, inputsForDay(plan, s.day)).report);
  return { state: s, report: recent[recent.length - 1] as DayReport, recent };
}

describe('Phase 5 coach notes', () => {
  it('has at least 40 notes with unique ids', () => {
    expect(COACH_NOTES.length).toBeGreaterThanOrEqual(40);
    const ids = COACH_NOTES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every sourceIds entry exists in sources.json and each note cites at least one', () => {
    for (const n of COACH_NOTES) {
      expect(n.sourceIds.length, n.id).toBeGreaterThan(0);
      for (const id of n.sourceIds) expect(sourceIds.has(id), `${n.id}:${id}`).toBe(true);
    }
  });

  it('text is at most 2 sentences and 320 characters', () => {
    for (const n of COACH_NOTES) {
      expect(n.text.length, n.id).toBeLessThanOrEqual(320);
      const sentences = n.text.split(/[.!?]+(?:\s+|$)/).filter((x) => x.trim().length > 0);
      expect(sentences.length, n.id).toBeGreaterThanOrEqual(1);
      expect(sentences.length, n.id).toBeLessThanOrEqual(2);
    }
  });

  it('triggers run on a real report without throwing and notesFor is deterministic and bounded', () => {
    const c = realContext(5);
    for (const n of COACH_NOTES) expect(typeof n.trigger(c), n.id).toBe('boolean');
    const a = notesFor(c, 3).map((n) => n.id);
    const b = notesFor(c, 3).map((n) => n.id);
    expect(a).toEqual(b);
    expect(a.length).toBeLessThanOrEqual(3);
    expect(notesFor(c, 1).length).toBeLessThanOrEqual(1);
    expect(notesFor(c, 0)).toEqual([]);
  });

  it('returns notes in descending priority', () => {
    const c = realContext(2);
    const c2: NoteContext = { ...c, report: { ...c.report, balance: -900, energyAvailability: 20 } };
    const got = notesFor(c2, 10);
    for (let i = 1; i < got.length; i++) expect((got[i - 1] as { priority: number }).priority).toBeGreaterThanOrEqual((got[i] as { priority: number }).priority);
  });

  it('a large calorie deficit triggers the deficit note', () => {
    const c = realContext(2);
    const c2: NoteContext = { ...c, report: { ...c.report, balance: -800 } };
    expect(notesFor(c2, 10).map((n) => n.id)).toContain('deficit-blunts');
    expect(notesFor({ ...c, report: { ...c.report, balance: 0 } }, 10).map((n) => n.id)).not.toContain('deficit-blunts');
  });
});
