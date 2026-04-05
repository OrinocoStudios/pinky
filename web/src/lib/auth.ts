import { apiFetch, getApiBaseUrl } from './api';

export type AuthUser = {
  email: string;
  name: string;
  avatarUrl?: string;
  provider: 'google' | 'github';
  providerUserId: string;
  isAdmin: boolean;
};

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch<{ user: AuthUser }>('/auth/me');
  return response.user;
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export function getProviderLoginUrl(provider: 'google' | 'github') {
  return `${getApiBaseUrl()}/auth/${provider}`;
}
