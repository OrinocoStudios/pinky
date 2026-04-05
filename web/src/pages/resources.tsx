import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

type HealthResponse = {
  status: string;
  timestamp: string;
  uptime: number;
  services: Record<string, { status: string; latency_ms?: number; provider?: string }>;
  service: string;
  latency_ms: number;
};

export function ResourcesPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<HealthResponse>('/health'),
  });

  if (isLoading) {
    return <div>Loading resources...</div>;
  }

  if (error || !data) {
    return <div>Unable to load resources.</div>;
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
