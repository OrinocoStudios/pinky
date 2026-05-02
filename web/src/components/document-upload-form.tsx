import { ChangeEvent, FormEvent, useState } from 'react';
import { UploadDocumentPayload } from '../lib/contracts';
import { parseJsonObjectInput } from '../lib/document-forms';

type DocumentUploadFormProps = {
  isPending: boolean;
  onSubmit: (payload: UploadDocumentPayload) => Promise<void>;
};

export function DocumentUploadForm({ isPending, onSubmit }: DocumentUploadFormProps) {
  const [title, setTitle] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0] ?? null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError('El archivo es obligatorio');
      return;
    }

    try {
      await onSubmit({
        file,
        title: title.trim() || undefined,
        metadata: parseJsonObjectInput(metadataText, 'Metadata'),
      });
      setTitle('');
      setMetadataText('');
      setFile(null);
      const input = document.getElementById('document-upload-input') as HTMLInputElement | null;
      if (input) {
        input.value = '';
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'No se pudo subir el documento');
    }
  }

  return (
    <form className="panel page-stack compact-gap" onSubmit={handleSubmit}>
      <div>
        <h3>Subir archivo</h3>
        <p className="muted-text">Sube un archivo y deja que backend extraiga el texto antes de ingestar.</p>
      </div>
      <input className="search-input form-input" placeholder="Titulo opcional" value={title} onChange={(event) => setTitle(event.target.value)} />
      <label className="scope-field" htmlFor="document-upload-input">
        <span>Archivo</span>
        <input id="document-upload-input" className="file-input" type="file" onChange={handleFileChange} />
      </label>
      <textarea
        className="query-textarea"
        rows={3}
        placeholder='Metadata JSON opcional, ej: {"source":"upload"}'
        value={metadataText}
        onChange={(event) => setMetadataText(event.target.value)}
      />
      {file ? <p className="muted-text">Seleccionado: {file.name}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      <div>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? 'Subiendo...' : 'Subir documento'}
        </button>
      </div>
    </form>
  );
}
