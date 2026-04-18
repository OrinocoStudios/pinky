import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setApiScope } from '../lib/api';
import { defaultScope, normalizeScope, ScopeState, scopeFromSearchParams, scopeToSearchParams } from '../lib/scope';

type ScopeContextValue = {
  scope: ScopeState;
  setScope: (nextScope: Partial<ScopeState>) => void;
  resetScope: () => void;
};

const ScopeContext = createContext<ScopeContextValue | null>(null);

export function ScopeProvider({ children }: PropsWithChildren) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [scope, setScopeState] = useState<ScopeState>(() => scopeFromSearchParams(searchParams));

  useEffect(() => {
    const nextScope = scopeFromSearchParams(searchParams);
    setScopeState((current) =>
      current.tenantId === nextScope.tenantId && current.libraryId === nextScope.libraryId ? current : nextScope,
    );
  }, [searchParams]);

  useEffect(() => {
    setApiScope(scope);
  }, [scope]);

  const value = useMemo<ScopeContextValue>(
    () => ({
      scope,
      setScope: (nextScope) => {
        const mergedScope = normalizeScope({ ...scope, ...nextScope });
        setScopeState(mergedScope);
        setSearchParams(scopeToSearchParams(mergedScope), { replace: true });
      },
      resetScope: () => {
        setScopeState(defaultScope);
        setSearchParams(new URLSearchParams(), { replace: true });
      },
    }),
    [scope, setSearchParams],
  );

  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>;
}

export function useScope() {
  const context = useContext(ScopeContext);
  if (!context) {
    throw new Error('useScope must be used within ScopeProvider');
  }
  return context;
}
