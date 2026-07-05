import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { ScopeProvider } from '../app/scope-context';
import { useCurrentUser, useLogout } from '../hooks/use-auth';

const libraryNavigation = [
  { to: '/documents', label: 'Documentos' },
  { to: '/', label: 'Dashboard' },
];

const toolsNavigation = [
  { to: '/query', label: 'Consultas' },
  { to: '/documentation', label: 'Guias' },
  { to: '/resources', label: 'Ajustes' },
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const initials = useMemo(() => {
    const source = user?.name || user?.email || 'U';
    const tokens = source.split(' ').filter(Boolean);
    if (tokens.length >= 2) {
      return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
    }
    return source.slice(0, 2).toUpperCase();
  }, [user?.email, user?.name]);

  async function handleLogout() {
    await logoutMutation.mutateAsync();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <p className="eyebrow">Biblioteca</p>
            <h1 className="sidebar-title">Pinky</h1>
          </div>
          <div className="user-menu">
            <button
              className="user-menu-trigger"
              type="button"
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((value) => !value)}
            >
              {initials}
            </button>
            {isMenuOpen ? (
              <div className="user-menu-dropdown" role="menu">
                <p className="user-name">{user?.name ?? 'Usuario desconocido'}</p>
                <p className="user-email">{user?.email ?? ''}</p>
                <button className="secondary-button user-menu-action" onClick={() => void handleLogout()}>
                  Salir
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="nav-block">
          <p className="nav-group-title">Principal</p>
          <nav className="nav-list">
            {libraryNavigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
            <button className="nav-link-static" type="button">
              Favoritos <span className="nav-pill">proximamente</span>
            </button>
            <button className="nav-link-static" type="button">
              Papelera <span className="nav-pill">proximamente</span>
            </button>
          </nav>
        </div>

        <div className="nav-block">
          <p className="nav-group-title">Herramientas</p>
          <nav className="nav-list">
            {toolsNavigation.map((item) => (
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
        </div>

      </aside>

      <main className="content">
        <div className="content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
