import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmDialog } from '../components/ui/confirm-dialog';
import { DocumentManualModal } from '../components/document-manual-modal';
import { DocumentGenerateForm } from '../components/document-generate-form';
import { DocumentUploadForm } from '../components/document-upload-form';
import { EmptyState } from '../components/ui/empty-state';
import { PageStateError } from '../components/ui/page-state-error';
import { PageStateLoading } from '../components/ui/page-state-loading';
import { ScopeBadge } from '../components/ui/scope-badge';
import { StatusBadge } from '../components/ui/status-badge';
import { useDocument, useDocumentScopes, useDocuments } from '../hooks/use-documents';
import {
  useDeleteDocument,
  useGenerateDocument,
  useIngestTextDocument,
  useReindex,
  useUploadDocument,
} from '../hooks/use-document-mutations';
import {
  formatDocumentStatus,
  formatGraphSyncLabel,
  formatSourceLabel,
  getPreviewText,
} from '../lib/document-view';
import { queryKeys } from '../app/query-keys';

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
  const queryClient = useQueryClient();
  const pageSize = 24;
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [documentIdToDelete, setDocumentIdToDelete] = useState<string | null>(null);
  const [reindexConfirmMode, setReindexConfirmMode] = useState<'rebuild' | 'incremental' | null>(null);
  const { data, isLoading, error, refetch, isFetching } = useDocuments(page, pageSize);
  const documentScopesQuery = useDocumentScopes();
  const activeDocument = useDocument(activeDocumentId);
  const ingestTextMutation = useIngestTextDocument();
  const uploadDocumentMutation = useUploadDocument();
  const generateDocumentMutation = useGenerateDocument();
  const deleteDocumentMutation = useDeleteDocument();
  const reindexMutation = useReindex();
  const items = data?.items ?? [];
  const selectedDocument = activeDocumentId
    ? items.find((document) => document.documentId === activeDocumentId)
    : null;

  const filtered = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) {
      return items;
    }

    return items.filter((document) => {
      return [document.title, document.documentId, document.libraryId, document.tenantId, document.previewText]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalized));
    });
  }, [items, search]);

  const hasActiveSearch = search.trim().length > 0;

  const metrics = useMemo(() => {
    const list = items;
    const readyCount = list.filter((document) => String(document.status).toUpperCase() === 'READY').length;
    const latestUpdate = list.length
      ? list.reduce((latest, current) =>
          new Date(current.updatedAt).getTime() > new Date(latest.updatedAt).getTime() ? current : latest,
        )
      : null;

    return {
      total: data?.total ?? list.length,
      ready: readyCount,
      updatedAt: latestUpdate ? new Date(latestUpdate.updatedAt).toLocaleString() : '-',
    };
  }, [data?.total, items]);

  if (isLoading) {
    return <PageStateLoading message="Cargando documentos..." />;
  }

  if (error) {
    return <PageStateError title="No se pudo cargar documentos." />;
  }

  async function handleDeleteConfirm() {
    if (!documentIdToDelete) {
      return;
    }

    await deleteDocumentMutation.mutateAsync(documentIdToDelete);
    setDocumentIdToDelete(null);
    if (activeDocumentId === documentIdToDelete) {
      setActiveDocumentId(null);
    }
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

  async function handleRefresh() {
    setPage(1);
    await queryClient.cancelQueries({ queryKey: queryKeys.documents.all() });
    queryClient.removeQueries({ queryKey: queryKeys.documents.all() });
    await refetch();
    setLastRefreshAt(new Date());
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <p className="eyebrow">Biblioteca</p>
          <h2 className="page-title">Tus documentos</h2>
          <p className="muted-text">Busca, abre y revisa el contenido guardado de forma simple.</p>
        </div>
        <div className="page-header-actions">
          <button className="primary-button" type="button" onClick={() => setIsManualModalOpen(true)}>
            Nuevo manual
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void handleRefresh()}
            disabled={isFetching}
          >
            {isFetching ? 'Recargando...' : 'Recargar'}
          </button>
          <input
            className="search-input"
            placeholder="Buscar por titulo, contenido o alcance"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <section className="metrics-grid">
        <article className="metric-card">
          <span className="muted-text">Documentos</span>
          <strong>{metrics.total}</strong>
          <span className="muted-inline">Guardados</span>
        </article>
        <article className="metric-card">
          <span className="muted-text">Listos</span>
          <strong>{metrics.ready}</strong>
          <span className="muted-inline">Para consultar</span>
        </article>
        <article className="metric-card">
          <span className="muted-text">Ultima actualizacion</span>
          <strong>{metrics.updatedAt}</strong>
          <span className="muted-inline">Indice y metadata</span>
        </article>
      </section>
      {lastRefreshAt ? (
        <p className="muted-inline">Actualizado: {lastRefreshAt.toLocaleTimeString()}</p>
      ) : null}

      <article className="panel">
        {filtered.length === 0 ? (
          <EmptyState
            title="No encontramos documentos"
            description="Prueba otro termino o agrega un documento desde Opciones avanzadas."
          />
        ) : (
          <div className="documents-grid">
            {filtered.map((document) => (
              <article key={document.documentId} className="document-card">
                <div className="document-card-header">
                  <StatusBadge status={document.status} />
                  <span className="muted-inline">{new Date(document.updatedAt).toLocaleString()}</span>
                </div>

                <h3 className="document-card-title">{document.title || 'Documento sin titulo'}</h3>
                <p className="muted-inline">Resumen</p>
                <p className="document-card-preview">{getPreviewText(document)}</p>

                <div className="cell-stack">
                  <ScopeBadge tenantId={document.tenantId} libraryId={document.libraryId} />
                  <p className="muted-text">{formatGraphSyncLabel(document.graphSyncStatus)}</p>
                </div>

                <div className="document-card-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => setActiveDocumentId(document.documentId)}
                  >
                    Abrir
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setDocumentIdToDelete(document.documentId)}
                  >
                    Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </article>

      {hasActiveSearch ? (
        <p className="muted-inline">Busqueda activa sobre pagina {page}. Limpia busqueda para paginar todo.</p>
      ) : data ? (
        <div className="documents-pagination">
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
            disabled={isFetching || page <= 1}
          >
            Anterior
          </button>
          <p className="muted-inline">
            Pagina {data.totalPages === 0 ? 0 : page} de {data.totalPages} · Total {data.total}
          </p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setPage((currentPage) => currentPage + 1)}
            disabled={isFetching || page >= data.totalPages}
          >
            Siguiente
          </button>
        </div>
      ) : null}

      <details className="panel advanced-panel">
        <summary className="advanced-summary">
          Opciones avanzadas
          <span className="muted-inline">Agregar documentos y mantenimiento</span>
        </summary>

        <div className="page-stack compact-gap">
          <section className="panel-grid form-grid">
            <DocumentUploadForm isPending={uploadDocumentMutation.isPending} onSubmit={handleUploadSubmit} />
          </section>

          <section className="panel-grid form-grid-single">
            <DocumentGenerateForm isPending={generateDocumentMutation.isPending} onSubmit={handleGenerateSubmit} />
          </section>

          <section className="panel maintenance-panel">
            <h3 className="maintenance-title">Mantenimiento del indice</h3>
            <p className="muted-text">
              Usa estas opciones cuando quieras refrescar el conocimiento disponible para consultas.
            </p>
            <div className="maintenance-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setReindexConfirmMode('rebuild')}
                disabled={reindexMutation.isPending}
              >
                Reconstruir indice
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setReindexConfirmMode('incremental')}
                disabled={reindexMutation.isPending}
              >
                Reindexado incremental
              </button>
            </div>
          </section>
        </div>
      </details>

      <DocumentManualModal
        open={isManualModalOpen}
        isPending={ingestTextMutation.isPending}
        tenantSuggestions={documentScopesQuery.data?.tenants ?? []}
        librarySuggestions={documentScopesQuery.data?.libraries ?? []}
        isLoadingSuggestions={documentScopesQuery.isLoading}
        onClose={() => setIsManualModalOpen(false)}
        onSubmit={handleTextSubmit}
      />

      {activeDocumentId ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setActiveDocumentId(null)}>
          <section
            className="dialog-card reader-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Documento"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="page-stack compact-gap">
              <div className="reader-header">
                <div className="cell-stack">
                  <h3 className="dialog-title">
                    {activeDocument.data?.title || selectedDocument?.title || 'Documento'}
                  </h3>
                  <p className="muted-text">
                    {formatDocumentStatus(
                      activeDocument.data?.status || selectedDocument?.status || 'READY',
                    )}
                  </p>
                </div>
                <button className="secondary-button" type="button" onClick={() => setActiveDocumentId(null)}>
                  Cerrar
                </button>
              </div>

              <p className="muted-text">
                {formatSourceLabel(activeDocument.data?.source)} ·{' '}
                {formatGraphSyncLabel(
                  activeDocument.data?.graphSyncStatus || selectedDocument?.graphSyncStatus || 'PENDING',
                )}
              </p>

              {activeDocument.isError ? (
                <div className="reader-warning">
                  <p className="muted-text">
                    No se pudo cargar el detalle completo en este intento.
                  </p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void activeDocument.refetch()}
                  >
                    Reintentar carga completa
                  </button>
                </div>
              ) : null}

              <article className="reader-content">
                {activeDocument.isLoading ? (
                  <p className="muted-text">Cargando contenido...</p>
                ) : (
                  <p className="reader-text">
                    {(activeDocument.data?.rawText?.trim() || selectedDocument?.rawText?.trim()) ??
                      'No hay texto disponible para este documento.'}
                  </p>
                )}
              </article>

              <details>
                <summary className="muted-inline">Detalles tecnicos</summary>
                <dl className="details-list reader-details">
                  <div>
                    <dt>ID</dt>
                    <dd>{activeDocument.data?.documentId ?? activeDocumentId}</dd>
                  </div>
                  <div>
                    <dt>Tenant</dt>
                    <dd>{activeDocument.data?.tenantId ?? selectedDocument?.tenantId ?? '-'}</dd>
                  </div>
                  <div>
                    <dt>Library</dt>
                    <dd>{activeDocument.data?.libraryId ?? selectedDocument?.libraryId ?? '-'}</dd>
                  </div>
                </dl>
              </details>
            </div>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        open={Boolean(documentIdToDelete)}
        title="Eliminar documento"
        description="Se eliminara el documento y su contenido asociado en el alcance actual."
        confirmLabel="Eliminar documento"
        isPending={deleteDocumentMutation.isPending}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => setDocumentIdToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(reindexConfirmMode)}
        title={reindexConfirmMode === 'rebuild' ? 'Reconstruir indice' : 'Reindexado incremental'}
        description={
          reindexConfirmMode === 'rebuild'
            ? 'Esta accion reconstruira el indice completo y puede tardar varios minutos.'
            : 'Esta accion actualiza solo los documentos nuevos o modificados.'
        }
        confirmLabel="Iniciar"
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
