import { PropsWithChildren, ReactElement } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { createQueryClient } from '../app/query-client';
import { ScopeProvider } from '../app/scope-context';

type CreateAppWrapperOptions = {
  initialEntries?: string[];
};

export function createAppWrapper(options: CreateAppWrapperOptions = {}) {
  const queryClient = createQueryClient();
  const initialEntries = options.initialEntries ?? ['/'];

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <QueryClientProvider client={queryClient}>
          <ScopeProvider>{children}</ScopeProvider>
        </QueryClientProvider>
      </MemoryRouter>
    );
  }

  return { Wrapper, queryClient };
}

export function renderWithAppProviders(ui: ReactElement, options: CreateAppWrapperOptions = {}) {
  const { Wrapper, queryClient } = createAppWrapper(options);

  return {
    queryClient,
    ...render(ui, { wrapper: Wrapper }),
  };
}
