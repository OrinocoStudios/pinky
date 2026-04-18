type ScopeBadgeProps = {
  tenantId?: string;
  libraryId?: string;
};

export function ScopeBadge({ tenantId, libraryId }: ScopeBadgeProps) {
  if (!tenantId && !libraryId) {
    return <span className="scope-badge">Global</span>;
  }

  return (
    <span className="scope-badge">
      {tenantId ? `tenant:${tenantId}` : 'tenant:-'}
      {' / '}
      {libraryId ? `library:${libraryId}` : 'library:-'}
    </span>
  );
}
