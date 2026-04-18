import { FormEvent, useState } from 'react';
import { IngestTextDocumentPayload } from '../lib/contracts';
import { parseJsonObjectInput } from '../lib/document-forms';

type DocumentTextFormProps = {
  isPending: boolean;
  onSubmit: (payload: IngestTextDocumentPayload) => Promise<void>;
};

export function DocumentTextForm({ isPending, onSubmit }: DocumentTextFormProps) {
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [metadataText, setMetadataText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!rawText.trim()) {
      setError('Raw text is required');
      return;
    }

    try {
      await onSubmit({
        title: title.trim() || undefined,
        rawText: rawText.trim(),
        metadata: parseJsonObjectInput(metadataText, 'Metadata'),
      });
      setTitle('');
      setRawText('');
      setMetadataText('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to ingest document');
    }
  }

  return (
    <form className="panel page-stack compact-gap" onSubmit={handleSubmit}>
      <div>
        <h3>Ingest text</h3>
        <p className="muted-text">Create a document directly from text content.</p>
      </div>
      <input className="search-input form-input" placeholder="Optional title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea
        className="query-textarea"
        rows={6}
        placeholder="Document content"
        value={rawText}
        onChange={(event) => setRawText(event.target.value)}
      />
      <textarea
        className="query-textarea"
        rows={3}
        placeholder='Optional metadata JSON, e.g. {"source":"manual"}'
        value={metadataText}
        onChange={(event) => setMetadataText(event.target.value)}
      />
      {error ? <p className="error-text">{error}</p> : null}
      <div>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? 'Saving...' : 'Create text document'}
        </button>
      </div>
    </form>
  );
}
