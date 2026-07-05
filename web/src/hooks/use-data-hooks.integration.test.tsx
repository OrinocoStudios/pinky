import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useAdminOverview } from './use-admin-overview';
import { useDocuments } from './use-documents';
import { useRunQuery } from './use-run-query';
import { server } from '../test/server';
import { createAppWrapper } from '../test/render';

describe('data hooks', () => {
  it('loads admin overview', async () => {
    server.use(
      http.get('/admin/overview', () =>
        HttpResponse.json({
          health: {
            status: 'ok',
            uptime: 10,
            services: {
              neo4j: { status: 'up', latency_ms: 5 },
              llm: { status: 'configured', provider: 'local' },
            },
            latency_ms: 6,
          },
          documents: {
            total: 2,
            byStatus: { READY: 2 },
            recent: [],
          },
          usage: {
            documents: {
              ingestedByDay: [{ date: '2026-05-01', count: 2 }],
              byLibrary: [{ libraryId: 'lib-a', count: 2 }],
              bySource: [{ source: 'generated', count: 2 }],
              byQueryCount: [{ documentId: 'doc-1', title: 'Doc 1', count: 3 }],
            },
            queries: {
              total: 3,
              byDay: [{ date: '2026-05-01', count: 3 }],
              byLibrary: [{ libraryId: 'lib-a', count: 3 }],
            },
          },
        }),
      ),
    );

    const { Wrapper } = createAppWrapper();
    const { result } = renderHook(() => useAdminOverview(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.documents.total).toBe(2);
  });

  it('loads documents list', async () => {
    server.use(
      http.get('/documents', ({ request }) => {
        expect(request.headers.get('x-tenant-id')).toBe('');
        expect(request.headers.get('x-library-id')).toBe('');

        return HttpResponse.json([
          {
            documentId: 'doc-1',
            title: 'Doc 1',
            status: 'READY',
            graphSyncStatus: 'SYNCED',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ]);
      }),
    );

    const { Wrapper } = createAppWrapper({ initialEntries: ['/?tenantId=tenant-a&libraryId=library-a'] });
    const { result } = renderHook(() => useDocuments(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.total).toBe(1);
  });

  it('runs query mutation', async () => {
    server.use(
      http.post('/query', async ({ request }) => {
        expect(request.headers.get('x-tenant-id')).toBe('tenant-q');
        expect(request.headers.get('x-library-id')).toBe('library-q');
        const body = (await request.json()) as { query: string };
        return HttpResponse.json({
          answer: `Echo: ${body.query}`,
          sourcesUsed: [],
          model: 'mock-model',
          tokensUsed: 12,
        });
      }),
    );

    const { Wrapper } = createAppWrapper({ initialEntries: ['/?tenantId=tenant-q&libraryId=library-q'] });
    const { result } = renderHook(() => useRunQuery(), { wrapper: Wrapper });

    await result.current.mutateAsync({ query: 'hello' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.answer).toBe('Echo: hello');
  });
});
