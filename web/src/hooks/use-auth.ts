import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/query-keys';
import { devLogin, getAuthProviders, getCurrentUser, logout } from '../lib/auth';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: getCurrentUser,
  });
}

export function useAuthProviders() {
  return useQuery({
    queryKey: queryKeys.auth.providers(),
    queryFn: getAuthProviders,
    retry: false,
  });
}

export function useDevLogin() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: devLogin,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}
