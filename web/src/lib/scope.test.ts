import { describe, expect, it } from 'vitest';
import { scopeFromSearchParams, scopeKey, scopeToSearchParams } from './scope';

describe('scope helpers', () => {
  it('reads scope from search params', () => {
    const params = new URLSearchParams('tenantId=tenant-a&libraryId=library-b');
    expect(scopeFromSearchParams(params)).toEqual({
      tenantId: 'tenant-a',
      libraryId: 'library-b',
    });
  });

  it('writes scope to search params', () => {
    const params = scopeToSearchParams({ tenantId: 'tenant-a', libraryId: 'library-b' });
    expect(params.toString()).toBe('tenantId=tenant-a&libraryId=library-b');
  });

  it('creates stable scope keys', () => {
    expect(scopeKey({ tenantId: '', libraryId: '' })).toBe('-::-');
    expect(scopeKey({ tenantId: 'tenant-a', libraryId: 'library-b' })).toBe('tenant-a::library-b');
  });
});
