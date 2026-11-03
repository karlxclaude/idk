// Display formatting. The engine is metric internally (kg, cm, kcal, USD); convert only at the UI edge.
export type Units = 'kg' | 'lb';

export const LB_PER_KG = 2.2046226218;
const MS_PER_DAY = 86_400_000;
const MIN_PER_H = 60;

export const kgToLb = (kg: number): number => kg * LB_PER_KG;
export const lbToKg = (lb: number): number => lb / LB_PER_KG;

function trimmed(v: number, digits: number): string {
  return v.toFixed(digits).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
}

/** Body mass: "82.4 kg" / "181.7 lb". */
export function fmtMass(kg: number, units: Units = 'kg', digits = 1): string {
  return `${trimmed(units === 'lb' ? kgToLb(kg) : kg, digits)} ${units}`;
}

/** Bar load rounded to a loadable increment (0.5 kg / 1 lb): "102.5 kg" / "226 lb". */
export function fmtLoad(kg: number, units: Units = 'kg'): string {
  if (units === 'lb') return `${Math.round(kgToLb(kg))} lb`;
  return `${trimmed(Math.round(kg * 2) / 2, 1)} kg`;
}

/** Add whole days to an ISO date (YYYY-MM-DD), UTC-safe. */
export function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** ISO date -> "Mon 5 Jan 2026" (short: "5 Jan"). */
export function fmtDate(iso: string, short = false): string {
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', short
    ? { day: 'numeric', month: 'short', timeZone: 'UTC' }
    : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** USD with thousands separators: "$1,234", "-$12". */
export function fmtMoney(usd: number, digits = 0): string {
  const abs = Number(Math.abs(usd).toFixed(digits));
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return `${usd < 0 && abs > 0 ? '-' : ''}$${s}`;
}

/** Ratio (0.185) -> "18.5%" (digits default 0). */
export function fmtPct(ratio: number, digits = 0): string {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Hour of day (7.5) -> "07:30". Also accepts hours >= 24 (wraps). */
export function fmtTime(hour: number): string {
  const total = Math.round(((hour % 24) + 24) % 24 * MIN_PER_H);
  const h = Math.floor(total / MIN_PER_H) % 24;
  return `${String(h).padStart(2, '0')}:${String(total % MIN_PER_H).padStart(2, '0')}`;
}

/** Minutes -> "1 h 30 min" / "45 min". */
export function fmtDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < MIN_PER_H) return `${m} min`;
  const r = m % MIN_PER_H;
  return r ? `${Math.floor(m / MIN_PER_H)} h ${r} min` : `${m / MIN_PER_H} h`;
}
