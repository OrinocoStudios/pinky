import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="screen-center page-stack">
      <h1>Pagina no encontrada</h1>
      <Link className="primary-button" to="/">
        Volver al inicio
      </Link>
    </div>
  );
}
