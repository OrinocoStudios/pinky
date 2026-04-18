import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useCurrentUser, useDevLogin } from './use-auth';
import { server } from '../test/server';
import { createAppWrapper } from '../test/render';

describe('use-auth hooks', () => {
  it('loads current user', async () => {
    server.use(
      http.get('/auth/me', () =>
        HttpResponse.json({
          user: {
            email: 'admin@example.com',
            name: 'Admin',
            provider: 'google',
            providerUserId: 'google-1',
            isAdmin: true,
          },
        }),
      ),
    );

    const { Wrapper } = createAppWrapper();
    const { result } = renderHook(() => useCurrentUser(), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.email).toBe('admin@example.com');
  });

  it('executes dev login mutation successfully', async () => {
    server.use(
      http.post('/auth/dev/login', async ({ request }) => {
        const body = (await request.json()) as { email: string };
        return HttpResponse.json({
          user: {
            email: body.email,
            name: 'Dev Admin',
            provider: 'google',
            providerUserId: 'dev-1',
            isAdmin: true,
          },
        });
      }),
    );

    const { Wrapper } = createAppWrapper();
    const { result } = renderHook(() => useDevLogin(), {
      wrapper: Wrapper,
    });

    await result.current.mutateAsync({ email: 'dev@example.com' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.user.email).toBe('dev@example.com');
  });
});
