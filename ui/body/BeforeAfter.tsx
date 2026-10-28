// Before/after comparison: two BodyShapes overlaid with a draggable vertical slider (mouse, touch, keyboard).
import { useCallback, useRef, useState, type PointerEvent as RPointerEvent, type KeyboardEvent } from 'react';
import type { MuscleId } from '../../data/muscles';
import { BodySvg, type BodyView } from './BodySvg';
import { VIEW_H, VIEW_W, type BodyShape } from './model';

export interface BeforeAfterProps {
  before: BodyShape;
  after: BodyShape;
  view: BodyView;
  beforeLabel?: string;
  afterLabel?: string;
  height?: number;
  heatmap?: Partial<Record<MuscleId, number>>;
  highlight?: MuscleId | null;
}

export function BeforeAfter({ before, after, view, beforeLabel = 'Before', afterLabel = 'After', height = 360, heatmap, highlight }: BeforeAfterProps) {
  const [pos, setPos] = useState(0.5);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const width = (height * VIEW_W) / VIEW_H;

  const move = useCallback((clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || r.width === 0) return;
    setPos(Math.min(1, Math.max(0, (clientX - r.left) / r.width)));
  }, []);

  const onDown = (e: RPointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') setPos((p) => Math.max(0, p - 0.05));
    if (e.key === 'ArrowRight') setPos((p) => Math.min(1, p + 0.05));
  };

  return (
    <div
      ref={box}
      role="slider"
      tabIndex={0}
      aria-label="Before and after comparison"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos * 100)}
      onPointerDown={onDown}
      onPointerMove={(e) => dragging.current && move(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
      onKeyDown={onKey}
      style={{ position: 'relative', width, maxWidth: '100%', height, touchAction: 'pan-y', cursor: 'ew-resize', userSelect: 'none', margin: '0 auto' }}
    >
      <div style={{ position: 'absolute', inset: 0 }}>
        <BodySvg shape={after} view={view} height={height} heatmap={heatmap} highlight={highlight} idSuffix="-a" />
      </div>
      <div style={{ position: 'absolute', inset: 0, clipPath: `inset(0 ${(1 - pos) * 100}% 0 0)` }}>
        <BodySvg shape={before} view={view} height={height} heatmap={heatmap} highlight={highlight} idSuffix="-b" />
      </div>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${pos * 100}%`, width: 2, background: 'var(--line, #3b2f2a)', transform: 'translateX(-1px)' }}>
        <div style={{ position: 'absolute', top: '50%', left: -13, width: 28, height: 28, marginTop: -14, borderRadius: '50%', background: 'var(--skin, #e9bfa0)', border: '2px solid var(--line, #3b2f2a)', display: 'grid', placeItems: 'center', fontSize: 12, lineHeight: 1 }}>
          {'↔'}
        </div>
      </div>
      <span style={labelStyle('left')}>{beforeLabel}</span>
      <span style={labelStyle('right')}>{afterLabel}</span>
    </div>
  );
}

function labelStyle(side: 'left' | 'right') {
  return { position: 'absolute' as const, top: 0, [side]: 0, fontSize: 11, padding: '2px 6px', borderRadius: 4, background: 'rgba(0,0,0,0.45)', color: '#fff', pointerEvents: 'none' as const, whiteSpace: 'nowrap' as const };
}

export default BeforeAfter;
