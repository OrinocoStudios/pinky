type EmptyStateProps = {
  title: string;
  description?: string;
};

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className="panel state-panel">
      <strong>{title}</strong>
      {description ? <p className="muted-text">{description}</p> : null}
    </div>
  );
}
