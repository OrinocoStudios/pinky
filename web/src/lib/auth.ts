import { apiFetch, getApiBaseUrl } from './api';
import { AuthMeResponse, AuthProvidersResponse, AuthUser } from './contracts';

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiFetch<AuthMeResponse>('/auth/me');
  return response.user;
}

export async function getAuthProviders(): Promise<AuthProvidersResponse> {
  return apiFetch<AuthProvidersResponse>('/auth/providers');
}

export async function devLogin(input: { email: string; name?: string }): Promise<AuthMeResponse> {
  return apiFetch<AuthMeResponse>('/auth/dev/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function logout(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

export function getProviderLoginUrl(provider: 'google' | 'github') {
  return `${getApiBaseUrl()}/auth/${provider}`;
}
