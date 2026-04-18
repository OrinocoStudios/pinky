import { describe, expect, it } from 'vitest';
import { buildApiHeaders, getScopeHeaders, parseApiErrorMessage, setApiScope } from './api';

describe('api helpers', () => {
  it('builds default content-type header', () => {
    setApiScope({});
    expect(buildApiHeaders()).toEqual({
      'Content-Type': 'application/json',
    });
  });

  it('merges custom headers over defaults', () => {
    setApiScope({});
    expect(buildApiHeaders({ Authorization: 'Bearer test' })).toEqual({
      'Content-Type': 'application/json',
      authorization: 'Bearer test',
    });
  });

  it('builds scope headers only when values exist', () => {
    expect(getScopeHeaders({ tenantId: 'tenant-a', libraryId: 'library-a' })).toEqual({
      'X-Tenant-Id': 'tenant-a',
      'X-Library-Id': 'library-a',
    });
    expect(getScopeHeaders({ tenantId: '', libraryId: '' })).toEqual({});
  });

  it('parses json error arrays into a single message', async () => {
    const response = new Response(JSON.stringify({ message: ['first error', 'second error'] }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });

    await expect(parseApiErrorMessage(response)).resolves.toBe('first error, second error');
  });

  it('returns plain text error payloads', async () => {
    const response = new Response('backend down', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });

    await expect(parseApiErrorMessage(response)).resolves.toBe('backend down');
  });
});
