import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

type DocumentRecord = {
  documentId: string;
  title?: string;
  status: string;
  graphSyncStatus: string;
  createdAt: string;
  updatedAt: string;
  tenantId?: string;
  libraryId?: string;
  metadata?: Record<string, unknown>;
};

export function DocumentsPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useQuery({
    queryKey: ['documents'],
    queryFn: () => apiFetch<DocumentRecord[]>('/documents'),
  });

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return data ?? [];
    }

    return (data ?? []).filter((document) => {
      return [document.title, document.documentId, document.libraryId, document.tenantId]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [data, search]);

  if (isLoading) {
    return <div>Loading documents...</div>;
  }

  if (error) {
    return <div>Unable to load documents.</div>;
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Corpus</p>
          <h2 className="page-title">Documents</h2>
        </div>
        <input
          className="search-input"
          placeholder="Search by title, id, tenant or library"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <article className="panel">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Graph</th>
                <th>Tenant</th>
                <th>Library</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((document) => (
                <tr key={document.documentId}>
                  <td>
                    <div className="cell-stack">
                      <strong>{document.title || 'Untitled document'}</strong>
                      <span className="muted-inline">{document.documentId}</span>
                    </div>
                  </td>
                  <td><span className={`status-badge status-${document.status.toLowerCase()}`}>{document.status}</span></td>
                  <td>{document.graphSyncStatus}</td>
                  <td>{document.tenantId || '-'}</td>
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
