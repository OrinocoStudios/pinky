import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { queryClient } from '../app/query-client';
import { getCurrentUser, logout } from '../lib/auth';

const navigation = [
  { to: '/', label: 'Dashboard' },
  { to: '/documents', label: 'Documents' },
  { to: '/resources', label: 'Resources' },
  { to: '/query', label: 'Query' },
];

export function AppShell() {
  const navigate = useNavigate();
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  });

  async function handleLogout() {
    await logout();
    await queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    navigate('/login');
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Pinky</p>
          <h1 className="sidebar-title">Admin Console</h1>
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
