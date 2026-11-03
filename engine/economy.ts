// Economy: gym access, fixed monthly costs, the cash ledger and financial stress.
// Prices and thresholds live in data/constants/economy.ts; only structure lives here.
import type { Params } from '../data/constants';
import { EXERCISES, getExercise } from '../data/exercises';
import type { Exercise, GymTier } from '../data/exercises/schema';
import { SUPPLEMENTS } from '../data/supplements';
import type { SimContext } from './context';
import { clamp } from './math';

type EconomyKey = keyof Params['economy'];

/**
 * What the character can train in. Membership tiers cost a monthly fee; home items are owned equipment
 * (one-off purchase, no monthly fee). 'home' is the free baseline (floor, a pull-up bar, bodyweight).
 */
export type AccessItem = 'budget' | 'commercial' | 'powerlifting' | 'strongman' | 'track' | 'home' | 'homeBasic' | 'homeFull';
export type GymAccess = AccessItem[];
export type MembershipTier = 'budget' | 'commercial' | 'powerlifting' | 'strongman' | 'track';
export type HomeGymTier = 'homeBasic' | 'homeFull';

export const MEMBERSHIP_TIERS: readonly MembershipTier[] = ['budget', 'commercial', 'powerlifting', 'strongman', 'track'];

/**
 * Exercise tiers that are available to everyone, whatever they own: bodyweight/floor work ('home'), outdoor work
 * (running, hills, sprints on grass) and swimming. Pool: no pool price exists in the economy constants and public
 * pools are cheap relative to everything else modelled, so it is treated as always available (design simplification).
 */
export const ALWAYS_AVAILABLE_TIERS: readonly GymTier[] = ['home', 'outdoor', 'pool'];

/**
 * Explicit tier-inclusion table (data): the exercise tiers each access item unlocks, in addition to
 * ALWAYS_AVAILABLE_TIERS. A better gym includes the equipment of the gyms below it:
 *   budget < commercial < powerlifting < strongman.
 * 'track' is a separate facility (sprint/jump/track work) and does not include any gym tier.
 * Home equipment: homeBasic = rack, bar, plates and bench (budget-gym equipment); homeFull additionally has machines,
 * cables and a lifting platform (commercial + powerlifting equipment) but no strongman implements or track.
 */
export const TIER_INCLUDES: Readonly<Record<AccessItem, readonly GymTier[]>> = {
  home: ['home'],
  homeBasic: ['home', 'budget'],
  homeFull: ['home', 'budget', 'commercial', 'powerlifting'],
  budget: ['budget'],
  commercial: ['budget', 'commercial'],
  powerlifting: ['budget', 'commercial', 'powerlifting'],
  strongman: ['budget', 'commercial', 'powerlifting', 'strongman'],
  track: ['track'],
};

/** Economy constant holding the monthly fee of each membership tier. */
export const MEMBERSHIP_COST_KEY: Readonly<Record<MembershipTier, EconomyKey>> = {
  budget: 'gymBudgetMonthly',
  commercial: 'gymCommercialMonthly',
  powerlifting: 'gymPowerliftingMonthly',
  strongman: 'gymStrongmanMonthly',
  track: 'trackAccessMonthly',
};

export const HOME_GYM_COST_KEY: Readonly<Record<HomeGymTier, EconomyKey>> = { homeBasic: 'homeGymBasicCost', homeFull: 'homeGymFullCost' };

export function isMembership(item: AccessItem): item is MembershipTier {
  return (MEMBERSHIP_TIERS as readonly string[]).includes(item);
}

/** The set of exercise tiers a given access list unlocks. */
export function accessibleTiers(access: GymAccess): Set<GymTier> {
  const tiers = new Set<GymTier>(ALWAYS_AVAILABLE_TIERS);
  for (const a of access) for (const t of TIER_INCLUDES[a]) tiers.add(t);
  return tiers;
}

export function exerciseAllowed(access: GymAccess, id: string): boolean {
  return accessibleTiers(access).has(getExercise(id).gymTier);
}

export function availableExercises(access: GymAccess, exercises: readonly Exercise[] = EXERCISES): Exercise[] {
  const tiers = accessibleTiers(access);
  return exercises.filter((e) => tiers.has(e.gymTier));
}

// ---- Costs -----------------------------------------------------------------------------------------------------

export interface CostBreakdown {
  rent: number;
  utilities: number;
  gym: number;
  supplements: number;
  coaching: number;
  total: number;
}

export function supplementMonthlyCost(ctx: SimContext, supplementId: string): number {
  const def = SUPPLEMENTS.find((s) => s.id === supplementId);
  if (!def) throw new Error(`unknown supplement ${supplementId}`);
  return ctx.P.economy[def.costConstantId as EconomyKey];
}

/** Monthly USD by category. Duplicate supplement ids are charged once. */
export function monthlyCostBreakdown(ctx: SimContext, access: GymAccess, supplementsTaken: readonly string[], coaching: boolean): CostBreakdown {
  const E = ctx.P.economy;
  let gym = 0;
  for (const a of new Set(access)) if (isMembership(a)) gym += E[MEMBERSHIP_COST_KEY[a]];
  let supplements = 0;
  for (const id of new Set(supplementsTaken)) supplements += supplementMonthlyCost(ctx, id);
  const c = coaching ? E.coachingMonthly : 0;
  return { rent: E.rentMonthly, utilities: E.utilitiesMonthly, gym, supplements, coaching: c, total: E.rentMonthly + E.utilitiesMonthly + gym + supplements + c };
}

/** Rent + utilities + gym memberships + supplements (+ coaching), USD per month. Charged daily as monthly / daysPerMonth. */
export function monthlyFixedCosts(ctx: SimContext, access: GymAccess, supplementsTaken: readonly string[], coaching: boolean): number {
  return monthlyCostBreakdown(ctx, access, supplementsTaken, coaching).total;
}

// ---- Ledger ----------------------------------------------------------------------------------------------------

export type LedgerCategory = 'income' | 'rent' | 'utilities' | 'gym' | 'supplements' | 'coaching' | 'groceries' | 'lab' | 'equipment' | 'certification' | 'other';
export interface LedgerEntry { day: number; amount: number; category: LedgerCategory; note: string }
/** Plain data (JSON safe). Positive amounts are income, negative are spending. Cash may go negative (debt). */
export interface Ledger { cash: number; entries: LedgerEntry[] }

export function newLedger(cash: number): Ledger {
  return { cash, entries: [] };
}

export function post(ledger: Ledger, day: number, amount: number, category: LedgerCategory, note: string): void {
  ledger.cash += amount;
  ledger.entries.push({ day, amount, category, note });
}

/** Drop the oldest entries beyond the retention constant (cash itself is kept). */
export function trimLedger(ctx: SimContext, ledger: Ledger): void {
  const extra = ledger.entries.length - ctx.P.economy.ledgerEntriesKept;
  if (extra > 0) ledger.entries.splice(0, extra);
}

/** Daily share of a monthly amount. */
export function perDay(ctx: SimContext, monthly: number): number {
  return monthly / ctx.P.economy.daysPerMonth;
}

/**
 * Financial stress 0..1 from the cash runway (days of fixed costs covered by cash). 0 when the runway is at least
 * `financialRunwayDays`, rising linearly to 1 at zero (or negative) cash.
 */
export function financialStress(ctx: SimContext, cash: number, monthlyCosts: number): number {
  const daily = perDay(ctx, monthlyCosts);
  if (daily <= 0) return cash >= 0 ? 0 : 1;
  return clamp(1 - cash / daily / ctx.P.economy.financialRunwayDays, 0, 1);
}

export class InsufficientFundsError extends Error {}
