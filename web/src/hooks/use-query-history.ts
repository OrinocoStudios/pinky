import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../app/query-keys';
import { ChatHistoryResponse } from '../lib/contracts';
import { apiFetch } from '../lib/api';
import { useScope } from '../app/scope-context';

export function useQueryHistory(sessionId: string) {
  const { scope } = useScope();

  return useQuery({
    queryKey: queryKeys.query.history(sessionId),
    queryFn: () => apiFetch<ChatHistoryResponse>('/query/history/' + encodeURIComponent(sessionId), {
      headers: {
        'X-Tenant-Id': scope.tenantId,
        'X-Library-Id': scope.libraryId,
      },
    }),
    enabled: Boolean(sessionId),
  });
}
