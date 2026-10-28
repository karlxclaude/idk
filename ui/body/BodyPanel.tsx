// Composed body panel: front/side toggle, optional before/after slider, and a compact stat legend.
import { useMemo, useState } from 'react';
import { MUSCLE_LABELS } from '../../data/muscles';
import type { Params } from '../../data/constants';
import type { CharacterState } from '../../engine/types';
import { BodySvg, type BodyView } from './BodySvg';
import { BeforeAfter } from './BeforeAfter';
import { bodyShape, topGrown } from './model';

export interface BodyPanelProps {
  state: CharacterState;
  P: Params;
  before?: CharacterState;
  units: 'metric' | 'imperial';
}

const KG_PER_LB = 0.45359237;

function fmtMass(kg: number, units: BodyPanelProps['units']): string {
  return units === 'imperial' ? `${(kg / KG_PER_LB).toFixed(1)} lb` : `${kg.toFixed(1)} kg`;
}

function dateLabel(s: CharacterState): string {
  const d = new Date(`${s.startDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return `Day ${s.day}`;
  d.setUTCDate(d.getUTCDate() + Math.floor(s.day));
  return d.toISOString().slice(0, 10);
}

const btn = (on: boolean) => ({
  padding: '4px 10px', border: '1px solid var(--line, #3b2f2a)', borderRadius: 6, cursor: 'pointer', fontSize: 13,
  background: on ? 'var(--muscle, #b5483d)' : 'transparent', color: on ? '#fff' : 'inherit',
});

export function BodyPanel({ state, P, before, units }: BodyPanelProps) {
  const [view, setView] = useState<BodyView>('front');
  const [compare, setCompare] = useState(false);
  const after = useMemo(() => bodyShape(state, P), [state, P]);
  const prior = useMemo(() => (before ? bodyShape(before, P) : null), [before, P]);
  const grown = useMemo(() => topGrown(state, 3), [state]);
  const showCompare = compare && prior !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button type="button" style={btn(view === 'front')} onClick={() => setView('front')}>Front</button>
        <button type="button" style={btn(view === 'side')} onClick={() => setView('side')}>Side</button>
        {before && (
          <button type="button" style={btn(compare)} onClick={() => setCompare((c) => !c)} aria-pressed={compare}>
            Before/after
          </button>
        )}
      </div>
      {showCompare && prior ? (
        <BeforeAfter before={prior} after={after} view={view} beforeLabel={before ? dateLabel(before) : 'Before'} afterLabel={dateLabel(state)} />
      ) : (
        <BodySvg shape={after} view={view} />
      )}
      <dl style={{ display: 'grid', gridTemplateColumns: 'auto auto', gap: '2px 14px', margin: 0, fontSize: 13 }}>
        <dt>Body mass</dt>
        <dd style={{ margin: 0 }}>
          {fmtMass(after.bodyMassKg, units)}
          {prior && showCompare ? ` (was ${fmtMass(prior.bodyMassKg, units)})` : ''}
        </dd>
        <dt>Body fat</dt>
        <dd style={{ margin: 0 }}>{(after.bodyFat * 100).toFixed(1)}%</dd>
        <dt>FFMI</dt>
        <dd style={{ margin: 0 }}>{after.ffmi.toFixed(1)}</dd>
        <dt>Top grown</dt>
        <dd style={{ margin: 0 }}>
          {grown.length === 0
            ? 'none yet'
            : grown.map((g) => `${MUSCLE_LABELS[g.id]} +${fmtMass(g.gainKg, units)}`).join(', ')}
        </dd>
      </dl>
    </div>
  );
}

export default BodyPanel;
