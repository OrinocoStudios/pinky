import { useQuery } from '@tanstack/react-query';
import { useScope } from '../app/scope-context';
import { queryKeys } from '../app/query-keys';
import { DocumentRecord } from '../lib/contracts';
import { apiFetch, getScopeHeaders } from '../lib/api';
import { scopeKey } from '../lib/scope';

export function useDocuments() {
  const { scope } = useScope();

  return useQuery({
    queryKey: [...queryKeys.documents.all(), scopeKey(scope)],
    queryFn: () => apiFetch<DocumentRecord[]>('/documents', { headers: getScopeHeaders(scope) }),
  });
}
