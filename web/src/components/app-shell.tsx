import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ScopeProvider, useScope } from '../app/scope-context';
import { useCurrentUser, useLogout } from '../hooks/use-auth';
import { ScopeSelector } from './scope-selector';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/documents', label: 'Documents' },
  { to: '/documentation', label: 'Documentation' },
  { to: '/resources', label: 'Resources' },
  { to: '/query', label: 'Query' },
];

export function AppShell() {
  return (
    <ScopeProvider>
      <AppShellContent />
    </ScopeProvider>
  );
}

function AppShellContent() {
  const navigate = useNavigate();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const { scope } = useScope();

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Pinky</p>
          <h1 className="sidebar-title">Admin Console</h1>
          <p className="muted-text">{scope.tenantId || scope.libraryId ? `tenant:${scope.tenantId || '-'} / library:${scope.libraryId || '-'}` : 'Global scope'}</p>
        </div>

        <nav className="nav-list">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <ScopeSelector />

        <div className="user-card">
          <div>
            <p className="user-name">{user?.name ?? 'Unknown user'}</p>
            <p className="user-email">{user?.email ?? ''}</p>
          </div>
          <button className="secondary-button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
