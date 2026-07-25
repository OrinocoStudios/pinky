import { timingSafeEqual } from 'node:crypto';

/**
 * Who is behind a request, once the credential has been validated.
 *
 * `tenantId === undefined` means unrestricted: the caller may act on any tenant
 * and is trusted to pass X-Tenant-Id itself. That is the legacy single-API_KEY
 * behaviour and the shape given to authenticated admins.
 */
export type ApiPrincipal = {
  /** Human-readable name, used in logs. Never a secret. */
  label: string;
  /** Forced tenant for this credential. Undefined = unrestricted. */
  tenantId?: string;
  /**
   * Library patterns the credential may touch. `['*']` allows every library.
   * A pattern may end in `*` to allow a prefix (e.g. `mcp:acme:*`).
   */
  libraries: string[];
  /** True for the legacy API_KEY and for admin JWT sessions. */
  unrestricted: boolean;
};

export type ApiKeyEntry = ApiPrincipal & { key: string };

const WILDCARD = '*';

export const ADMIN_PRINCIPAL: ApiPrincipal = {
  label: 'admin-jwt',
  libraries: [WILDCARD],
  unrestricted: true,
};

/**
 * Parses API_KEYS, a JSON array of scoped credentials:
 *
 *   [{"label":"acme","key":"<secreto>","tenantId":"acme","libraries":["mcp:acme:*"]}]
 *
 * Throws on malformed input rather than silently dropping credentials — a
 * dropped entry would look like a valid key being rejected at runtime.
 */
export function parseApiKeys(raw: string | undefined): ApiKeyEntry[] {
  const trimmed = raw?.trim();
  if (!trimmed) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`API_KEYS must be a JSON array: ${(error as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('API_KEYS must be a JSON array');
  }

  return parsed.map((entry, index) => toApiKeyEntry(entry, index));
}

function toApiKeyEntry(entry: unknown, index: number): ApiKeyEntry {
  if (typeof entry !== 'object' || entry === null) {
    throw new Error(`API_KEYS[${index}] must be an object`);
  }

  const { label, key, tenantId, libraries } = entry as Record<string, unknown>;

  if (typeof key !== 'string' || key.length < 16) {
    throw new Error(`API_KEYS[${index}].key must be a string of at least 16 characters`);
  }

  if (tenantId != null && (typeof tenantId !== 'string' || tenantId.trim().length === 0)) {
    throw new Error(`API_KEYS[${index}].tenantId must be a non-empty string when present`);
  }

  if (libraries != null && !isStringArray(libraries)) {
    throw new Error(`API_KEYS[${index}].libraries must be an array of strings`);
  }

  const resolvedLibraries = libraries && libraries.length > 0 ? libraries : [WILDCARD];

  return {
    label: typeof label === 'string' && label.trim().length > 0 ? label.trim() : `key-${index}`,
    key,
    tenantId: typeof tenantId === 'string' ? tenantId.trim() : undefined,
    libraries: resolvedLibraries,
    // A key with no tenant and no library restriction is effectively the legacy key.
    unrestricted: tenantId == null && resolvedLibraries.includes(WILDCARD),
  };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Constant-time credential lookup. Every candidate is compared so the number of
 * comparisons does not depend on which key matched.
 */
export function findPrincipalByKey(candidates: ApiKeyEntry[], presented: string): ApiPrincipal | null {
  let match: ApiKeyEntry | null = null;
  for (const candidate of candidates) {
    if (secureEquals(candidate.key, presented)) {
      match = candidate;
    }
  }

  if (!match) {
    return null;
  }

  const { key: _key, ...principal } = match;
  return principal;
}

export function secureEquals(expected: string, presented: string): boolean {
  const expectedBuffer = Buffer.from(expected, 'utf8');
  const presentedBuffer = Buffer.from(presented, 'utf8');

  // timingSafeEqual throws on length mismatch, so compare against a padded copy
  // and fold the length check into the boolean result.
  const padded = Buffer.alloc(expectedBuffer.length);
  presentedBuffer.copy(padded);

  return timingSafeEqual(expectedBuffer, padded) && expectedBuffer.length === presentedBuffer.length;
}

export function isLibraryAllowed(principal: ApiPrincipal, libraryId: string): boolean {
  return principal.libraries.some((pattern) => matchesLibraryPattern(pattern, libraryId));
}

function matchesLibraryPattern(pattern: string, libraryId: string): boolean {
  if (pattern === WILDCARD) {
    return true;
  }
  if (pattern.endsWith(WILDCARD)) {
    return libraryId.startsWith(pattern.slice(0, -1));
  }
  return pattern === libraryId;
}

/**
 * The single concrete library a restricted principal owns, when it owns exactly
 * one. Used as the implicit scope when the caller sends no X-Library-Id.
 */
export function defaultLibraryFor(principal: ApiPrincipal): string | undefined {
  const concrete = principal.libraries.filter((pattern) => !pattern.includes(WILDCARD));
  return concrete.length === 1 ? concrete[0] : undefined;
}
