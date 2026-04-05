import { useQuery } from '@tanstack/react-query';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getCurrentUser } from '../lib/auth';

export function ProtectedRoute() {
  const location = useLocation();
  const query = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: getCurrentUser,
  });

  if (query.isLoading) {
    return <div className="screen-center">Checking session...</div>;
  }

  if (query.isError) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
