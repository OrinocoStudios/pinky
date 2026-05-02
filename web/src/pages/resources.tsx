import { PageStateError } from '../components/ui/page-state-error';
import { PageStateLoading } from '../components/ui/page-state-loading';
import { useHealth } from '../hooks/use-health';

export function ResourcesPage() {
  const { data, isLoading, error } = useHealth();

  if (isLoading) {
    return <PageStateLoading message="Cargando recursos..." />;
  }

  if (error || !data) {
    return <PageStateError title="No se pudo cargar recursos." />;
  }

  return (
    <div className="page-stack">
      <div>
        <p className="eyebrow">Ajustes</p>
        <h2 className="page-title">Recursos de servicio</h2>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Servicio</span>
          <strong>{data.service}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Estado</span>
          <strong>{data.status}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Hora</span>
          <strong>{new Date(data.timestamp).toLocaleTimeString()}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Latencia</span>
          <strong>{data.latency_ms} ms</strong>
        </article>
      </section>

      <article className="panel">
        <h3>Detalle por servicio</h3>
        <div className="status-grid">
          {Object.entries(data.services).map(([name, service]) => (
            <div key={name} className="status-card">
              <span>{name}</span>
              <strong>{service.status}</strong>
              <small>{service.provider ? `proveedor: ${service.provider}` : `${service.latency_ms ?? 'n/a'} ms`}</small>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
