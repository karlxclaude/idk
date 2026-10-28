import type { ReactNode } from 'react';

export interface EmptyStateProps { title: string; text?: ReactNode; action?: ReactNode }

export default function EmptyState({ title, text, action }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="empty-title">{title}</div>
      {text && <p className="muted">{text}</p>}
      {action}
    </div>
  );
}
