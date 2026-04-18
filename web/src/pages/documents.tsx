import { useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { DocumentGenerateForm } from '../components/document-generate-form';
import { DocumentTextForm } from '../components/document-text-form';
import { DocumentUploadForm } from '../components/document-upload-form';
import { EmptyState } from '../components/ui/empty-state';
import { PageStateError } from '../components/ui/page-state-error';
import { PageStateLoading } from '../components/ui/page-state-loading';
import { ScopeBadge } from '../components/ui/scope-badge';
import { StatusBadge } from '../components/ui/status-badge';
import { useDocuments } from '../hooks/use-documents';
import {
  useDeleteDocument,
  useGenerateDocument,
  useIngestTextDocument,
  useReindex,
  useUploadDocument,
} from '../hooks/use-document-mutations';

/**
 * DocumentsPage component provides a centralized interface for managing the document corpus.
 * 
 * Features:
 * - Search and filter documents by title, ID, tenant, or library.
 * - Ingest documents via text or file upload.
 * - Generate documents using LLM.
 * - Corpus Management: Trigger full or incremental index rebuilds.
 * - Document Management: Delete documents with a confirmation workflow.
 * 
 * @component
 */
export function DocumentsPage() {
  const [search, setSearch] = useState('');
  const [documentIdToDelete, setDocumentIdToDelete] = useState<string | null>(null);
  const [reindexConfirmMode, setReindexConfirmMode] = useState<'rebuild' | 'incremental' | null>(null);
  const { data, isLoading, error } = useDocuments();
  const ingestTextMutation = useIngestTextDocument();
  const uploadDocumentMutation = useUploadDocument();
  const generateDocumentMutation = useGenerateDocument();
  const deleteDocumentMutation = useDeleteDocument();
  const reindexMutation = useReindex();

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
    return <PageStateLoading message="Loading documents..." />;
  }

  if (error) {
    return <PageStateError title="Unable to load documents." />;
  }

  async function handleDeleteConfirm() {
    if (!documentIdToDelete) {
      return;
    }

    await deleteDocumentMutation.mutateAsync(documentIdToDelete);
    setDocumentIdToDelete(null);
  }

  async function handleTextSubmit(payload: Parameters<typeof ingestTextMutation.mutateAsync>[0]) {
    await ingestTextMutation.mutateAsync(payload);
  }

  async function handleUploadSubmit(payload: Parameters<typeof uploadDocumentMutation.mutateAsync>[0]) {
    await uploadDocumentMutation.mutateAsync(payload);
  }

  async function handleGenerateSubmit(payload: Parameters<typeof generateDocumentMutation.mutateAsync>[0]) {
    await generateDocumentMutation.mutateAsync(payload);
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

      <section className="panel-grid form-grid" style={{ gridTemplateColumns: '1fr auto' }}>
        <div className="panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', opacity: 0.8 }}>Corpus Management</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setReindexConfirmMode('rebuild')}
              disabled={reindexMutation.isPending}
            >
              Rebuild Index
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setReindexConfirmMode('incremental')}
              disabled={reindexMutation.isPending}
            >
              Incremental Reindex
            </button>
          </div>
        </div>
      </section>

      <section className="panel-grid form-grid">
        <DocumentTextForm isPending={ingestTextMutation.isPending} onSubmit={handleTextSubmit} />
        <DocumentUploadForm isPending={uploadDocumentMutation.isPending} onSubmit={handleUploadSubmit} />
      </section>

      <section className="panel-grid form-grid-single">
        <DocumentGenerateForm isPending={generateDocumentMutation.isPending} onSubmit={handleGenerateSubmit} />
      </section>

      <article className="panel">
        {filtered.length === 0 ? (
          <EmptyState
            title="No documents found"
            description="Change filters or ingest documents to populate this table."
          />
        ) : (
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((document) => (
                  <tr key={document.documentId}>
                    <td>
                      <div className="cell-stack">
                        <strong>{document.title || 'Untitled document'}</strong>
                        <span className="muted-inline">{document.documentId}</span>
                        <ScopeBadge tenantId={document.tenantId} libraryId={document.libraryId} />
                      </div>
                    </td>
                    <td><StatusBadge status={document.status} /></td>
                    <td>{document.graphSyncStatus}</td>
                    <td>{document.tenantId || '-'}</td>
                    <td>{document.libraryId || '-'}</td>
                    <td>{new Date(document.updatedAt).toLocaleString()}</td>
                    <td>
                      <button
                        className="secondary-button table-action-button"
                        type="button"
                        onClick={() => setDocumentIdToDelete(document.documentId)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      <ConfirmDialog
        open={Boolean(documentIdToDelete)}
        title="Delete document"
        description="This removes the document and its associated chunks/graph data from the current scope."
        confirmLabel="Delete document"
        isPending={deleteDocumentMutation.isPending}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDocumentIdToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(reindexConfirmMode)}
        title={reindexConfirmMode === 'rebuild' ? "Rebuild Index" : "Incremental Reindex"}
        description={
          reindexConfirmMode === 'rebuild'
            ? "This will completely rebuild the index. This may take a while."
            : "This will incrementally update the index with new or changed documents."
        }
        confirmLabel="Start"
        isPending={reindexMutation.isPending}
        onConfirm={() => {
          if (reindexConfirmMode) {
            reindexMutation.mutate(reindexConfirmMode);
            setReindexConfirmMode(null);
          }
        }}
        onCancel={() => setReindexConfirmMode(null)}
      />
    </div>
  );
}
