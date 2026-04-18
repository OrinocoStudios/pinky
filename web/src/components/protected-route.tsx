import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { PageStateLoading } from './ui/page-state-loading';
import { useCurrentUser } from '../hooks/use-auth';

export function ProtectedRoute() {
  const location = useLocation();
  const query = useCurrentUser();

  if (query.isLoading) {
    return <div className="screen-center"><PageStateLoading message="Checking session..." /></div>;
  }

  if (query.isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
