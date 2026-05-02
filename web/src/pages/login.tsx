import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { getProviderLoginUrl } from '../lib/auth';
import { useAuthProviders, useCurrentUser, useDevLogin } from '../hooks/use-auth';

export function LoginPage() {
  const navigate = useNavigate();
  const [devEmail, setDevEmail] = useState('');
  const [devError, setDevError] = useState<string | null>(null);
  const query = useCurrentUser();
  const providersQuery = useAuthProviders();
  const devLoginMutation = useDevLogin();
  const providers = providersQuery.data?.providers ?? [];
  const googleEnabled = providers.includes('google');
  const githubEnabled = providers.includes('github');

  if (query.data) {
    return <Navigate to="/" replace />;
  }

  async function handleDevLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDevError(null);

    try {
      await devLoginMutation.mutateAsync({ email: devEmail });
      navigate('/', { replace: true });
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
          Sign in with an allowlisted admin account.
        </p>
        {googleEnabled || githubEnabled ? (
          <div className="login-actions">
            {googleEnabled ? (
              <a className="primary-button" href={getProviderLoginUrl('google')}>
                Continue with Google
              </a>
            ) : null}
            {githubEnabled ? (
              <a className={googleEnabled ? 'secondary-button' : 'primary-button'} href={getProviderLoginUrl('github')}>
                Continue with GitHub
              </a>
            ) : null}
          </div>
        ) : providersQuery.isSuccess ? (
          <p className="muted-text">OAuth disabled in this environment.</p>
        ) : null}

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
            <button className="secondary-button" type="submit" disabled={!devEmail.trim() || devLoginMutation.isPending}>
              {devLoginMutation.isPending ? 'Signing in...' : 'Sign in without OAuth'}
            </button>
            {devError ? <p className="error-text">{devError}</p> : null}
          </form>
        ) : null}
      </div>
    </div>
  );
}
