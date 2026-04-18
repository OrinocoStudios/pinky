import { PageStateError } from '../components/ui/page-state-error';
import { PageStateLoading } from '../components/ui/page-state-loading';
import { useHealth } from '../hooks/use-health';

export function ResourcesPage() {
  const { data, isLoading, error } = useHealth();

  if (isLoading) {
    return <PageStateLoading message="Loading resources..." />;
  }

  if (error || !data) {
    return <PageStateError title="Unable to load resources." />;
  }

  return (
    <div className="page-stack">
      <div>
        <p className="eyebrow">Operations</p>
        <h2 className="page-title">Resources</h2>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">Service</span>
          <strong>{data.service}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Status</span>
          <strong>{data.status}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Timestamp</span>
          <strong>{new Date(data.timestamp).toLocaleTimeString()}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Latency</span>
          <strong>{data.latency_ms} ms</strong>
        </article>
      </section>

      <article className="panel">
        <h3>Service details</h3>
        <div className="status-grid">
          {Object.entries(data.services).map(([name, service]) => (
            <div key={name} className="status-card">
              <span>{name}</span>
              <strong>{service.status}</strong>
              <small>{service.provider ? `provider: ${service.provider}` : `${service.latency_ms ?? 'n/a'} ms`}</small>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
