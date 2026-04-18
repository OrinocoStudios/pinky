import { FormEvent, useState } from 'react';
import { GenerateDocumentPayload } from '../lib/contracts';
import { parseJsonObjectInput } from '../lib/document-forms';

type DocumentGenerateFormProps = {
  isPending: boolean;
  onSubmit: (payload: GenerateDocumentPayload) => Promise<void>;
};

export function DocumentGenerateForm({ isPending, onSubmit }: DocumentGenerateFormProps) {
  const [useCaseId, setUseCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [paramsText, setParamsText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!useCaseId.trim()) {
      setError('useCaseId is required');
      return;
    }

    try {
      await onSubmit({
        useCaseId: useCaseId.trim(),
        title: title.trim() || undefined,
        params: parseJsonObjectInput(paramsText, 'Params'),
      });
      setUseCaseId('');
      setTitle('');
      setParamsText('');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to generate document');
    }
  }

  return (
    <form className="panel page-stack compact-gap" onSubmit={handleSubmit}>
      <div>
        <h3>Generate document</h3>
        <p className="muted-text">Use backend templates to produce a new document.</p>
      </div>
      <input className="search-input form-input" placeholder="useCaseId" value={useCaseId} onChange={(event) => setUseCaseId(event.target.value)} />
      <input className="search-input form-input" placeholder="Optional title" value={title} onChange={(event) => setTitle(event.target.value)} />
      <textarea
        className="query-textarea"
        rows={3}
        placeholder='Optional params JSON, e.g. {"region":"latam"}'
        value={paramsText}
        onChange={(event) => setParamsText(event.target.value)}
      />
      {error ? <p className="error-text">{error}</p> : null}
      <div>
        <button className="primary-button" type="submit" disabled={isPending}>
          {isPending ? 'Generating...' : 'Generate document'}
        </button>
      </div>
    </form>
  );
}
