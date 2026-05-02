import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/query-keys';
import { devLogin, getAuthProviders, getCurrentUser, logout } from '../lib/auth';

export function useCurrentUser() {
  return useQuery({
    queryKey: queryKeys.auth.me(),
    queryFn: getCurrentUser,
    retry: false,
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
    onSuccess: async (response) => {
      queryClient.setQueryData(queryKeys.auth.me(), response.user);
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await logout();
      } catch {
        // The client must still clear local auth state.
      }
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: queryKeys.auth.me() });
      await queryClient.invalidateQueries({ queryKey: queryKeys.auth.me() });
    },
  });
}
