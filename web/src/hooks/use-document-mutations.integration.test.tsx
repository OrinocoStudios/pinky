import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useReindex } from './use-document-mutations';
import { server } from '../test/server';
import { createAppWrapper } from '../test/render';

describe('use-document-mutations hooks', () => {
  it('useReindex - Rebuild Success', async () => {
    server.use(
      http.post('/index/rebuild', () => {
        return HttpResponse.json({ success: true });
      }),
    );

    const { Wrapper } = createAppWrapper();
    const { result } = renderHook(() => useReindex(), {
      wrapper: Wrapper,
    });

    // This should fail because useReindex currently does nothing
    await result.current.mutateAsync('rebuild');

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
