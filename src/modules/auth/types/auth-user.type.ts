export type AuthProvider = 'google' | 'github';

export type AuthUser = {
  email: string;
  name: string;
  avatarUrl?: string;
  provider: AuthProvider;
  providerUserId: string;
  isAdmin: boolean;
};

export type AuthTokenPayload = AuthUser & {
  sub: string;
};
