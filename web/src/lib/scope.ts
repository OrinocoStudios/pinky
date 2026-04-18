export type ScopeState = {
  tenantId: string;
  libraryId: string;
};

export const defaultScope: ScopeState = {
  tenantId: '',
  libraryId: '',
};

export function normalizeScopeValue(value?: string | null): string {
  return value?.trim() ?? '';
}

export function normalizeScope(scope?: Partial<ScopeState>): ScopeState {
  return {
    tenantId: normalizeScopeValue(scope?.tenantId),
    libraryId: normalizeScopeValue(scope?.libraryId),
  };
}

export function scopeToSearchParams(scope: ScopeState): URLSearchParams {
  const params = new URLSearchParams();
  if (scope.tenantId) {
    params.set('tenantId', scope.tenantId);
  }
  if (scope.libraryId) {
    params.set('libraryId', scope.libraryId);
  }
  return params;
}

export function scopeFromSearchParams(searchParams: URLSearchParams): ScopeState {
  return normalizeScope({
    tenantId: searchParams.get('tenantId') ?? undefined,
    libraryId: searchParams.get('libraryId') ?? undefined,
  });
}

export function scopeKey(scope: ScopeState): string {
  return `${scope.tenantId || '-'}::${scope.libraryId || '-'}`;
}

export function hasScope(scope: ScopeState): boolean {
  return Boolean(scope.tenantId || scope.libraryId);
}
