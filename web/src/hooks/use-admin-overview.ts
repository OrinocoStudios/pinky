import { useQuery } from '@tanstack/react-query';
import { useScope } from '../app/scope-context';
import { queryKeys } from '../app/query-keys';
import { OverviewResponse } from '../lib/contracts';
import { apiFetch, getScopeHeaders } from '../lib/api';
import { scopeKey } from '../lib/scope';

export function useAdminOverview() {
  const { scope } = useScope();

  return useQuery({
    queryKey: [...queryKeys.admin.overview(), scopeKey(scope)],
    queryFn: () => apiFetch<OverviewResponse>('/admin/overview', { headers: getScopeHeaders(scope) }),
  });
}
