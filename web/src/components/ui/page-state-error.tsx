type PageStateErrorProps = {
  title?: string;
  description?: string;
};

export function PageStateError({
  title = 'Unable to load data.',
  description = 'Try again or verify the remote service is reachable.',
}: PageStateErrorProps) {
  return (
    <div className="panel state-panel state-error">
      <strong>{title}</strong>
      <p className="muted-text">{description}</p>
    </div>
  );
}
