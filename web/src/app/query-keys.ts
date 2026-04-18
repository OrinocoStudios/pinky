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
  },
  health: {
    current: () => ['health'] as const,
  },
  query: {
    history: (sessionId: string) => ['query', 'history', sessionId] as const,
  },
};
