import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../app/query-keys';
import { HealthResponse } from '../lib/contracts';
import { apiFetch } from '../lib/api';

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health.current(),
    queryFn: () => apiFetch<HealthResponse>('/health'),
  });
}
