import { FormEvent, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

type QueryResponse = {
  answer: string;
  sourcesUsed: Array<{ id?: string; title?: string; documentId?: string }>;
  model: string;
  tokensUsed: number;
  prompt?: string;
};

export function QueryPage() {
  const [query, setQuery] = useState('');

  const mutation = useMutation({
    mutationFn: (payload: { query: string }) => apiFetch<QueryResponse>('/query', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  });

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) {
      return;
    }
    mutation.mutate({ query: query.trim() });
  }

  return (
    <div className="page-stack">
      <div>
        <p className="eyebrow">GraphRAG</p>
        <h2 className="page-title">Query</h2>
      </div>

      <form className="panel page-stack" onSubmit={handleSubmit}>
        <textarea
          className="query-textarea"
          rows={6}
          placeholder="Ask Pinky about the data currently ingested in the system"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div>
          <button className="primary-button" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Running query...' : 'Run query'}
          </button>
        </div>
      </form>

      {mutation.isError ? <div className="panel">Unable to run query.</div> : null}

      {mutation.data ? (
        <div className="panel page-stack">
          <div>
            <h3>Answer</h3>
            <p className="answer-block">{mutation.data.answer}</p>
          </div>

          <div className="status-grid">
            <div className="status-card">
              <span>Model</span>
              <strong>{mutation.data.model}</strong>
            </div>
            <div className="status-card">
              <span>Tokens</span>
              <strong>{mutation.data.tokensUsed}</strong>
            </div>
            <div className="status-card">
              <span>Sources</span>
              <strong>{mutation.data.sourcesUsed.length}</strong>
            </div>
          </div>

          <div>
            <h3>Sources</h3>
            <ul className="source-list">
              {mutation.data.sourcesUsed.map((source, index) => (
                <li key={`${source.documentId || source.id || 'source'}-${index}`}>
                  {source.title || source.documentId || source.id || `Source ${index + 1}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
