import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ApiPrincipal, findPrincipalByKey, parseApiKeys } from './api-principal';
import { resolveRequestLibraryIds, resolveRequestScope } from './request-scope';

const scoped: ApiPrincipal = {
  label: 'acme',
  tenantId: 'acme',
  libraries: ['mcp:acme:*'],
  unrestricted: false,
};

const legacy: ApiPrincipal = {
  label: 'legacy-api-key',
  libraries: ['*'],
  unrestricted: true,
};

describe('parseApiKeys', () => {
  it('returns an empty list when unset', () => {
    expect(parseApiKeys(undefined)).toEqual([]);
    expect(parseApiKeys('   ')).toEqual([]);
  });

  it('parses scoped credentials', () => {
    const [entry] = parseApiKeys(
      JSON.stringify([{ label: 'acme', key: 'k'.repeat(32), tenantId: 'acme', libraries: ['mcp:acme:*'] }]),
    );

    expect(entry).toMatchObject({ label: 'acme', tenantId: 'acme', libraries: ['mcp:acme:*'], unrestricted: false });
  });

  it('treats a key with no tenant and no library restriction as unrestricted', () => {
    const [entry] = parseApiKeys(JSON.stringify([{ label: 'root', key: 'k'.repeat(32) }]));
    expect(entry.unrestricted).toBe(true);
  });

  it('rejects malformed input instead of silently dropping credentials', () => {
    expect(() => parseApiKeys('not json')).toThrow(/JSON array/);
    expect(() => parseApiKeys('{}')).toThrow(/JSON array/);
    expect(() => parseApiKeys(JSON.stringify([{ key: 'short' }]))).toThrow(/at least 16 characters/);
    expect(() => parseApiKeys(JSON.stringify([{ key: 'k'.repeat(32), libraries: 'nope' }]))).toThrow(/array of strings/);
  });
});

describe('findPrincipalByKey', () => {
  const entries = parseApiKeys(
    JSON.stringify([
      { label: 'a', key: 'a'.repeat(32), tenantId: 'tenant-a' },
      { label: 'b', key: 'b'.repeat(32), tenantId: 'tenant-b' },
    ]),
  );

  it('resolves the matching credential', () => {
    expect(findPrincipalByKey(entries, 'b'.repeat(32))?.tenantId).toBe('tenant-b');
  });

  it('rejects unknown keys and never leaks the secret back', () => {
    expect(findPrincipalByKey(entries, 'c'.repeat(32))).toBeNull();
    expect(findPrincipalByKey(entries, 'a'.repeat(31))).toBeNull();
    expect(findPrincipalByKey(entries, 'a'.repeat(33))).toBeNull();
    expect(findPrincipalByKey(entries, 'a'.repeat(32))).not.toHaveProperty('key');
  });
});

describe('resolveRequestScope', () => {
  it('pins a bound credential to its own tenant', () => {
    const scope = resolveRequestScope({
      principal: scoped,
      libraryHeader: 'mcp:acme:global',
      enableMultiTenant: true,
    });
    expect(scope.tenantId).toBe('acme');
  });

  it('requires a library when the credential only owns a prefix', () => {
    expect(() => resolveRequestScope({ principal: scoped, enableMultiTenant: true })).toThrow(BadRequestException);
  });

  it('rejects a bound credential asking for someone else tenant', () => {
    expect(() =>
      resolveRequestScope({ principal: scoped, tenantHeader: 'otro', enableMultiTenant: true }),
    ).toThrow(ForbiddenException);
  });

  it('rejects a library outside the credential scope', () => {
    expect(() =>
      resolveRequestScope({ principal: scoped, libraryHeader: 'mcp:otro:global', enableMultiTenant: true }),
    ).toThrow(ForbiddenException);
  });

  it('accepts a library inside the credential prefix', () => {
    const scope = resolveRequestScope({ principal: scoped, libraryHeader: 'mcp:acme:global', enableMultiTenant: true });
    expect(scope).toEqual({ tenantId: 'acme', libraryId: 'mcp:acme:global' });
  });

  it('falls back to the single owned library when no header is sent', () => {
    const single: ApiPrincipal = { ...scoped, libraries: ['mcp:acme:global'] };
    expect(resolveRequestScope({ principal: single, enableMultiTenant: true }).libraryId).toBe('mcp:acme:global');
  });

  it('keeps header-driven behaviour for the legacy unrestricted key', () => {
    const scope = resolveRequestScope({
      principal: legacy,
      tenantHeader: 'cualquiera',
      libraryHeader: 'lo-que-sea',
      enableMultiTenant: true,
    });
    expect(scope).toEqual({ tenantId: 'cualquiera', libraryId: 'lo-que-sea' });
  });

  it('still requires X-Tenant-Id for unrestricted callers in multi-tenant mode', () => {
    expect(() => resolveRequestScope({ principal: legacy, enableMultiTenant: true })).toThrow(BadRequestException);
  });

  it('leaves the tenant undefined in single-tenant mode', () => {
    expect(resolveRequestScope({ principal: legacy, enableMultiTenant: false }).tenantId).toBeUndefined();
  });
});

describe('resolveRequestLibraryIds', () => {
  it('rejects a forbidden library requested through the body', () => {
    expect(() => resolveRequestLibraryIds(scoped, ['mcp:otro:global'])).toThrow(ForbiddenException);
  });

  it('rejects a mix where only one library is forbidden', () => {
    expect(() => resolveRequestLibraryIds(scoped, ['mcp:acme:global', 'mcp:otro:global'])).toThrow(ForbiddenException);
  });

  it('defaults a restricted credential to its own concrete libraries', () => {
    const owner: ApiPrincipal = { ...scoped, libraries: ['mcp:acme:global', 'mcp:acme:dev'] };
    expect(resolveRequestLibraryIds(owner)).toEqual(['mcp:acme:global', 'mcp:acme:dev']);
  });

  it('requires an explicit library when the credential only owns a prefix', () => {
    expect(() => resolveRequestLibraryIds(scoped)).toThrow(BadRequestException);
  });

  it('dedupes body and header for unrestricted callers', () => {
    expect(resolveRequestLibraryIds(legacy, ['a', 'b'], 'a')).toEqual(['a', 'b']);
  });

  it('returns undefined when an unrestricted caller asks for nothing', () => {
    expect(resolveRequestLibraryIds(legacy)).toBeUndefined();
  });
});
