import { useState, type ReactNode } from 'react';

/** Small "?" that toggles an explanation (click/tap works on touch; hover title as a fallback). */
export default function InfoTip({ children, label = 'More info' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="infotip">
      <button type="button" className="infotip-btn" aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>?</button>
      {open && <span className="infotip-pop" role="note">{children}</span>}
    </span>
  );
}
