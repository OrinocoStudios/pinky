import { createBrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/app-shell';
import { ProtectedRoute } from '../components/protected-route';
import { DashboardPage } from '../pages/dashboard';
import { DocumentationPage } from '../pages/documentation';
import { DocumentsPage } from '../pages/documents';
import { LoginPage } from '../pages/login';
import { NotFoundPage } from '../pages/not-found';
import { QueryPage } from '../pages/query';
import { ResourcesPage } from '../pages/resources';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppShell />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/documents', element: <DocumentsPage /> },
          { path: '/documentation', element: <DocumentationPage /> },
          { path: '/resources', element: <ResourcesPage /> },
          { path: '/query', element: <QueryPage /> },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
]);
