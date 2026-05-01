import { FormEvent, useEffect, useState } from 'react';
import { PageStateError } from '../components/ui/page-state-error';
import { StatusBadge } from '../components/ui/status-badge';
import { useRunQuery } from '../hooks/use-run-query';
import { useQueryHistory } from '../hooks/use-query-history';
import { QueryPayload } from '../lib/contracts';
import { useScope } from '../app/scope-context';
 
export function QueryPage() {
  const { scope } = useScope();
  const [query, setQuery] = useState(localStorage.getItem('pinky_last_query') || '');
  const [sessionId, setSessionId] = useState(localStorage.getItem('pinky_last_session') || '');
  const [topK, setTopK] = useState('8');
  const [hintsText, setHintsText] = useState('');
  const [libraryIdsText, setLibraryIdsText] = useState('');
 
  const mutation = useRunQuery();
  const historyQuery = useQueryHistory(sessionId);
 
  useEffect(() => {
    localStorage.setItem('pinky_last_query', query);
    localStorage.setItem('pinky_last_session', sessionId);
  }, [query, sessionId]);
 
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedQuery = query.trim();
    const normalizedSessionId = sessionId.trim();
    if (!normalizedQuery) {
      return;
    }
    if (normalizedQuery !== query) {
      setQuery(normalizedQuery);
    }
    if (normalizedSessionId !== sessionId) {
      setSessionId(normalizedSessionId);
    }
 
    const payload: QueryPayload = {
      query: normalizedQuery,
      sessionId: normalizedSessionId || undefined,
      topK: parseInt(topK, 10) || 8,
      entityHints: hintsText.split(',').map(h => h.trim()).filter(Boolean),
      libraryIds: libraryIdsText.split(',').map(l => l.trim()).filter(Boolean),
    };
 
    mutation.mutate(payload);
  }
 
  return (
    <div className="page-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }}>
      <div className="page-stack">
        <div>
          <p className="eyebrow">GraphRAG</p>
          <h2 className="page-title">Query Workbench</h2>
        </div>
 
        <form className="panel page-stack" onSubmit={handleSubmit}>
          <textarea
            className="query-textarea"
            rows={6}
            placeholder="Ask Pinky about the data currently ingested in the system"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
 
          <div className="status-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
            <div className="status-card">
              <span>Session ID</span>
              <input
                className="search-input"
                style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem' }}
                aria-label="Session ID"
                placeholder="Session ID"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              />
            </div>
            <div className="status-card">
              <span>Top K</span>
              <input
                className="search-input"
                style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem' }}
                type="number"
                aria-label="Top K"
                placeholder="Top K"
                value={topK}
                onChange={(event) => setTopK(event.target.value)}
              />
            </div>
            <div className="status-card">
              <span>Entity Hints (csv)</span>
              <input
                className="search-input"
                style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem' }}
                aria-label="Entity Hints"
                placeholder="Entity Hints"
                value={hintsText}
                onChange={(event) => setHintsText(event.target.value)}
              />
            </div>
            <div className="status-card">
              <span>Library IDs (csv)</span>
              <input
                className="search-input"
                style={{ width: '100%', padding: '4px 8px', fontSize: '0.8rem' }}
                aria-label="Library IDs"
                placeholder="Library IDs"
                value={libraryIdsText}
                onChange={(event) => setLibraryIdsText(event.target.value)}
              />
            </div>
          </div>
 
          <div>
            <button className="primary-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Running query...' : 'Run query'}
            </button>
          </div>
        </form>
 
        {mutation.isError ? <PageStateError title="Unable to run query." description="Check auth, scope or backend availability." /> : null}
 
        {mutation.data ? (
          <div className="panel page-stack">
            <div>
              <h3>Answer</h3>
              <p className="answer-block">{mutation.data.answer}</p>
            </div>
 
            {Boolean(mutation.data.fastContext) && (
              <div>
                <h3>Fast Context</h3>
                <div className="panel muted-text" style={{ padding: '12px', fontSize: '0.9rem' }}>
                  {JSON.stringify(mutation.data.fastContext, null, 2)}
                </div>
              </div>
            )}
 
            {Boolean(mutation.data.truthFacts) && (
              <div>
                <h3>Truth Facts</h3>
                <div className="panel" style={{ padding: '12px' }}>
                  <ul className="source-list">
                    {Array.isArray(mutation.data.truthFacts) ? 
                      mutation.data.truthFacts.map((fact, i) => <li key={i}>{String(fact)}</li>) : 
                      <li>{String(mutation.data.truthFacts)}</li>
                    }
                  </ul>
                </div>
              </div>
            )}
 
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
              <div className="status-card">
                <span>Result</span>
                <StatusBadge status="READY" />
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
 
      <aside className="panel" style={{ padding: '20px' }}>
        <h3>Chat History</h3>
        {historyQuery.isLoading ? (
          <p className="muted-text">Loading history...</p>
        ) : historyQuery.data ? (
          <div className="details-list">
            {historyQuery.data.messages.map((msg, i) => (
              <div key={i} style={{ display: 'grid', gap: '4px', padding: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <span className="eyebrow" style={{ fontSize: '0.7rem' }}>{msg.role}</span>
                <p style={{ margin: 0, fontSize: '0.85rem' }}>{msg.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-text">No history found for this session.</p>
        )}
      </aside>
    </div>
  );
}
