import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiPrincipal, defaultLibraryFor, isLibraryAllowed } from './api-principal';

export type RequestScope = {
  tenantId?: string;
  libraryId?: string;
};

export type ScopeInput = {
  principal?: ApiPrincipal;
  tenantHeader?: string;
  libraryHeader?: string;
  enableMultiTenant: boolean;
};

/**
 * Resolves the tenant/library a request may act on.
 *
 * The headers are a *request*, not an authorization: a credential bound to a
 * tenant can never be talked out of it, and a credential bound to a set of
 * libraries cannot reach outside them. Unrestricted credentials (the legacy
 * single API_KEY and admin JWT sessions) keep the previous header-driven
 * behaviour so existing deployments are unaffected.
 */
export function resolveRequestScope(input: ScopeInput): RequestScope {
  const { principal, enableMultiTenant } = input;
  const tenantHeader = normalize(input.tenantHeader);
  const libraryHeader = normalize(input.libraryHeader);

  const tenantId = resolveTenant(principal, tenantHeader, enableMultiTenant);
  const libraryId = resolveLibrary(principal, libraryHeader);

  return { tenantId, libraryId };
}

/**
 * Tenant-only resolution, for routes that scope libraries separately (they take
 * a list, not a single id, so the library half of resolveRequestScope does not
 * apply to them).
 */
export function resolveRequestTenant(
  principal: ApiPrincipal | undefined,
  tenantHeader: string | undefined,
  enableMultiTenant: boolean,
): string | undefined {
  return resolveTenant(principal, normalize(tenantHeader), enableMultiTenant);
}

function resolveTenant(
  principal: ApiPrincipal | undefined,
  tenantHeader: string | undefined,
  enableMultiTenant: boolean,
): string | undefined {
  const boundTenant = principal?.tenantId;

  if (boundTenant) {
    if (tenantHeader && tenantHeader !== boundTenant) {
      throw new ForbiddenException('This credential cannot act on the requested tenant');
    }
    return boundTenant;
  }

  if (enableMultiTenant && !tenantHeader) {
    throw new BadRequestException('X-Tenant-Id header is required when ENABLE_MULTI_TENANT=true');
  }

  return tenantHeader;
}

function resolveLibrary(principal: ApiPrincipal | undefined, libraryHeader: string | undefined): string | undefined {
  if (!principal || principal.unrestricted) {
    return libraryHeader;
  }

  if (!libraryHeader) {
    // A credential that owns exactly one library does not need to name it; one
    // that owns a prefix does, or the write would land outside any library.
    const fallback = defaultLibraryFor(principal);
    if (fallback) {
      return fallback;
    }
    throw new BadRequestException('X-Library-Id header is required for this credential');
  }

  if (!isLibraryAllowed(principal, libraryHeader)) {
    throw new ForbiddenException('This credential cannot act on the requested library');
  }

  return libraryHeader;
}

/**
 * Multi-library variant for /query and /retrieve, where the caller may ask for
 * several libraries at once through the body. Every requested library is checked
 * against the credential; a restricted credential that asks for nothing gets its
 * own libraries rather than the whole corpus.
 */
export function resolveRequestLibraryIds(
  principal: ApiPrincipal | undefined,
  bodyLibraryIds?: string[],
  libraryHeader?: string,
): string[] | undefined {
  const requested = [...(bodyLibraryIds ?? []), ...(libraryHeader ? [libraryHeader] : [])]
    .map((libraryId) => libraryId.trim())
    .filter(Boolean);
  const unique = [...new Set(requested)];

  if (!principal || principal.unrestricted) {
    return unique.length > 0 ? unique : undefined;
  }

  if (unique.length === 0) {
    const owned = principal.libraries.filter((pattern) => !pattern.includes('*'));
    if (owned.length === 0) {
      throw new BadRequestException('X-Library-Id header or libraryIds is required for this credential');
    }
    return owned;
  }

  const forbidden = unique.filter((libraryId) => !isLibraryAllowed(principal, libraryId));
  if (forbidden.length > 0) {
    throw new ForbiddenException('This credential cannot act on the requested library');
  }

  return unique;
}

function normalize(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}
