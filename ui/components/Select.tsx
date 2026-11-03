import { useId } from 'react';

export interface SelectOption<T extends string = string> { value: T; label: string; disabled?: boolean }

export interface SelectProps<T extends string = string> {
  label?: string;
  value: T;
  options: readonly SelectOption<T>[];
  onChange: (v: T) => void;
  disabled?: boolean;
}

export default function Select<T extends string = string>({ label, value, options, onChange, disabled }: SelectProps<T>) {
  const id = useId();
  return (
    <div className="field">
      {label && <label htmlFor={id}>{label}</label>}
      <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}
      </select>
    </div>
  );
}
