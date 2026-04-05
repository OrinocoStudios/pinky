import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="screen-center page-stack">
      <h1>Page not found</h1>
      <Link className="primary-button" to="/">
        Go back to dashboard
      </Link>
    </div>
  );
}
