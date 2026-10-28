export interface TabDef<T extends string = string> { id: T; label: string }

export interface TabsProps<T extends string = string> {
  tabs: readonly TabDef<T>[];
  value: T;
  onChange: (id: T) => void;
}

export default function Tabs<T extends string = string>({ tabs, value, onChange }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={`tab${t.id === value ? ' active' : ''}`} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}
