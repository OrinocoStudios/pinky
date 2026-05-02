import { normalizeScope, ScopeState } from './scope';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';
let currentApiScope: ScopeState = normalizeScope();

type ApiErrorPayload = {
  message?: string | string[];
  error?: string;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const cache = init?.cache ?? (method === 'GET' || method === 'HEAD' ? 'no-store' : undefined);

  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: buildApiHeaders(init?.headers),
    cache,
    ...init,
  });

  if (!response.ok) {
    throw new ApiError(await parseApiErrorMessage(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export function getApiBaseUrl() {
  return apiBaseUrl;
}

export function buildApiHeaders(headers?: HeadersInit): HeadersInit {
  const normalizedHeaders = headers ? Object.fromEntries(new Headers(headers).entries()) : {};

  return {
    'Content-Type': 'application/json',
    ...getScopeHeaders(currentApiScope),
    ...normalizedHeaders,
  };
}

export function setApiScope(scope: Partial<ScopeState>) {
  currentApiScope = normalizeScope(scope);
}

export function getApiScope(): ScopeState {
  return currentApiScope;
}

export function getScopeHeaders(scope: Partial<ScopeState>): HeadersInit {
  const normalizedScope = normalizeScope(scope);
  const headers: Record<string, string> = {};
  if (normalizedScope.tenantId) {
    headers['X-Tenant-Id'] = normalizedScope.tenantId;
  }
  if (normalizedScope.libraryId) {
    headers['X-Library-Id'] = normalizedScope.libraryId;
  }
  return headers;
}

export async function parseApiErrorMessage(response: Response): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    return (await response.text()) || 'Request failed';
  }

  const payload = (await response.json()) as ApiErrorPayload;
  if (Array.isArray(payload.message)) {
    return payload.message.join(', ');
  }

  return payload.message || payload.error || 'Request failed';
}
