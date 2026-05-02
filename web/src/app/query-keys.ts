export const queryKeys = {
  auth: {
    me: () => ['auth', 'me'] as const,
    providers: () => ['auth', 'providers'] as const,
  },
  admin: {
    overview: () => ['admin', 'overview'] as const,
  },
  documents: {
    all: () => ['documents'] as const,
    page: (page: number, pageSize: number) => ['documents', 'page', page, pageSize] as const,
    byId: (documentId: string) => ['documents', documentId] as const,
    scopes: () => ['documents', 'scopes'] as const,
  },
  health: {
    current: () => ['health'] as const,
  },
  query: {
    history: (sessionId: string) => ['query', 'history', sessionId] as const,
  },
};
