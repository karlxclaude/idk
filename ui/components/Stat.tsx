import type { ReactNode } from 'react';

export interface StatProps {
  label: string;
  value: ReactNode;
  /** Change text, e.g. "+0.4 kg". Colored by `deltaGood`. */
  delta?: ReactNode;
  /** true = good (green), false = bad (red), undefined = neutral. */
  deltaGood?: boolean;
  hint?: ReactNode;
}

export default function Stat({ label, value, delta, deltaGood, hint }: StatProps) {
  const tone = deltaGood === undefined ? '' : deltaGood ? 'good' : 'bad';
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {delta !== undefined && <div className={`stat-delta ${tone}`}>{delta}</div>}
      {hint && <div className="stat-hint">{hint}</div>}
    </div>
  );
}
