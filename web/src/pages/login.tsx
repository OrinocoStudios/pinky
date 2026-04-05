import { FormEvent, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate } from 'react-router-dom';
import { queryClient } from '../app/query-client';
import { apiFetch } from '../lib/api';
import { getCurrentUser, getProviderLoginUrl } from '../lib/auth';

export function LoginPage() {
  const [devEmail, setDevEmail] = useState('');
  const [devError, setDevError] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
    retry: false,
  });

  const providersQuery = useQuery({
    queryKey: ['auth', 'providers'],
    queryFn: () => apiFetch<{ providers: string[]; devLogin: boolean }>('/auth/providers'),
    retry: false,
  });

  if (query.data) {
    return <Navigate to="/" replace />;
  }

  async function handleDevLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevError(null);

    try {
      await apiFetch('/auth/dev/login', {
        method: 'POST',
        body: JSON.stringify({ email: devEmail }),
      });
      await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    } catch (error) {
      setDevError(error instanceof Error ? error.message : 'Dev login failed');
    }
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <p className="eyebrow">Pinky</p>
        <h1>Admin access only</h1>
        <p className="muted-text">
          Sign in with a Google or GitHub account that is explicitly allowlisted as an administrator.
        </p>

        <div className="login-actions">
          <a className="primary-button" href={getProviderLoginUrl('google')}>
            Continue with Google
          </a>
          <a className="secondary-button" href={getProviderLoginUrl('github')}>
            Continue with GitHub
          </a>
        </div>

        {providersQuery.data?.devLogin ? (
          <form className="dev-login" onSubmit={handleDevLogin}>
            <label className="dev-login-label" htmlFor="dev-email">
              Local dev access
            </label>
            <input
              id="dev-email"
              className="search-input dev-input"
              placeholder="admin@example.com"
              value={devEmail}
              onChange={(event) => setDevEmail(event.target.value)}
            />
            <button className="secondary-button" type="submit" disabled={!devEmail.trim()}>
              Sign in without OAuth
            </button>
            {devError ? <p className="error-text">{devError}</p> : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
