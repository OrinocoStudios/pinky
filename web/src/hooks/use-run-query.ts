import { useMutation } from '@tanstack/react-query';
import { useScope } from '../app/scope-context';
import { QueryPayload, QueryResponse } from '../lib/contracts';
import { apiFetch, getScopeHeaders } from '../lib/api';

export function useRunQuery() {
  const { scope } = useScope();

  return useMutation({
    mutationFn: (payload: QueryPayload) =>
      apiFetch<QueryResponse>('/query', {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: getScopeHeaders(scope),
      }),
  });
}
