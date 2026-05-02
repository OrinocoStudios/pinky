import { FormEvent, useMemo, useState } from 'react';
import { IngestTextDocumentPayload } from '../lib/contracts';
import { parseJsonObjectInput } from '../lib/document-forms';

type DocumentManualModalProps = {
  open: boolean;
  isPending: boolean;
  tenantSuggestions: string[];
  librarySuggestions: string[];
  isLoadingSuggestions: boolean;
  onClose: () => void;
  onSubmit: (payload: IngestTextDocumentPayload) => Promise<void>;
};

export function DocumentManualModal({
  open,
  isPending,
  tenantSuggestions,
  librarySuggestions,
  isLoadingSuggestions,
  onClose,
  onSubmit,
}: DocumentManualModalProps) {
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [libraryId, setLibraryId] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const tenantListId = useMemo(() => `manual-tenant-suggestions`, []);
  const libraryListId = useMemo(() => `manual-library-suggestions`, []);

  if (!open) {
    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!rawText.trim()) {
      setError('El contenido del documento es obligatorio');
      return;
    }

    try {
      await onSubmit({
        title: title.trim() || undefined,
        rawText: rawText.trim(),
        tenantId: tenantId.trim() || undefined,
        libraryId: libraryId.trim() || undefined,
        metadata: parseJsonObjectInput(metadataText, 'Metadata'),
      });
      setTitle('');
      setRawText('');
      setTenantId('');
      setLibraryId('');
      setMetadataText('');
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo guardar el documento manual');
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <section
        className="dialog-card manual-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Add manual"
        onClick={(event) => event.stopPropagation()}
      >
        <form className="page-stack compact-gap" onSubmit={handleSubmit}>
          <div className="reader-header">
            <div>
              <h3 className="dialog-title">Add manual</h3>
              <p className="muted-text">Crea un documento manual y define tenant/library existente o nueva.</p>
            </div>
            <button className="secondary-button" type="button" onClick={onClose}>
              Cerrar
            </button>
          </div>

          <input
            className="search-input form-input"
            placeholder="Titulo (opcional)"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />

          <textarea
            className="query-textarea"
            rows={7}
            placeholder="Contenido del documento"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
          />

          <div className="manual-scope-grid">
            <label className="scope-field">
              <span>Tenant</span>
              <input
                className="search-input form-input"
                list={tenantListId}
                placeholder="tenant-ejemplo"
                value={tenantId}
                onChange={(event) => setTenantId(event.target.value)}
              />
              <datalist id={tenantListId}>
                {tenantSuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>

            <label className="scope-field">
              <span>Library</span>
              <input
                className="search-input form-input"
                list={libraryListId}
                placeholder="library-ejemplo"
                value={libraryId}
                onChange={(event) => setLibraryId(event.target.value)}
              />
              <datalist id={libraryListId}>
                {librarySuggestions.map((suggestion) => (
                  <option key={suggestion} value={suggestion} />
                ))}
              </datalist>
            </label>
          </div>

          <p className="muted-inline">
            {isLoadingSuggestions
              ? 'Cargando sugerencias...'
              : 'Puedes seleccionar una sugerencia o escribir un tenant/library nuevo.'}
          </p>

          <textarea
            className="query-textarea"
            rows={3}
            placeholder='Metadata JSON opcional, ej: {"source":"manual"}'
            value={metadataText}
            onChange={(event) => setMetadataText(event.target.value)}
          />

          {error ? <p className="error-text">{error}</p> : null}

          <div className="document-card-actions">
            <button className="primary-button" type="submit" disabled={isPending}>
              {isPending ? 'Guardando...' : 'Guardar documento'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
