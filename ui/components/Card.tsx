import type { ReactNode } from 'react';

export interface CardProps {
  title?: ReactNode;
  /** Right-aligned header content (buttons, badges). */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export default function Card({ title, actions, className = '', children }: CardProps) {
  return (
    <section className={`card ${className}`.trim()}>
      {(title || actions) && (
        <header className="card-head">
          {title && <h3 className="card-title">{title}</h3>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}
