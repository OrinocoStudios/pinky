import { useAdminOverview } from '../hooks/use-admin-overview';
import { PageStateError } from '../components/ui/page-state-error';
import { PageStateLoading } from '../components/ui/page-state-loading';
import { StatusBadge } from '../components/ui/status-badge';

export function DashboardPage() {
  const { data, isLoading, error } = useAdminOverview();

  if (isLoading) {
    return <PageStateLoading message="Loading dashboard..." />;
  }

  if (error || !data) {
    return <PageStateError title="Unable to load dashboard." />;
  }

  return (
    <div className="page-stack">
      <div>
        <p className="eyebrow">Overview</p>
        <h2 className="page-title">System status</h2>
      </div>

      <section className="stats-grid">
        <article className="stat-card">
          <span className="stat-label">System</span>
          <strong>{data.health.status}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Neo4j</span>
          <strong>{data.health.services.neo4j.status}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">LLM</span>
          <strong>{data.health.services.llm.provider}</strong>
        </article>
        <article className="stat-card">
          <span className="stat-label">Documents</span>
          <strong>{data.documents.total}</strong>
        </article>
      </section>

      <section className="panel-grid">
        <article className="panel">
          <h3>Status breakdown</h3>
          <div className="status-grid">
            {Object.entries(data.documents.byStatus).map(([status, count]) => (
              <div key={status} className="status-card">
                <span>{status}</span>
                <strong>{count}</strong>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <h3>Resource snapshot</h3>
          <dl className="details-list">
            <div>
              <dt>Uptime</dt>
              <dd>{data.health.uptime}s</dd>
            </div>
            <div>
              <dt>Health latency</dt>
              <dd>{data.health.latency_ms} ms</dd>
            </div>
            <div>
              <dt>Neo4j latency</dt>
              <dd>{data.health.services.neo4j.latency_ms ?? 'n/a'} ms</dd>
            </div>
            <div>
              <dt>LLM status</dt>
              <dd>{data.health.services.llm.status}</dd>
            </div>
          </dl>
        </article>
      </section>

      <article className="panel">
        <h3>Recent documents</h3>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Graph</th>
                <th>Library</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {data.documents.recent.map((document) => (
                <tr key={document.documentId}>
                  <td>{document.title || document.documentId}</td>
                   <td><StatusBadge status={document.status} /></td>
                  <td>{document.graphSyncStatus}</td>
                  <td>{document.libraryId || '-'}</td>
                  <td>{new Date(document.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </div>
  );
}
