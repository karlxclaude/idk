import { useId, type ReactNode } from 'react';

export interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  /** Value text; defaults to the number. */
  format?: (v: number) => string;
  hint?: ReactNode;
  disabled?: boolean;
}

export default function Slider({ label, value, min, max, step = 1, onChange, format, hint, disabled }: SliderProps) {
  const id = useId();
  return (
    <div className="field">
      <div className="field-row">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id} className="field-value">{format ? format(value) : value}</output>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <div className="field-hint">{hint}</div>}
    </div>
  );
}
