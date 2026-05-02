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
    <div className="query-layout">
      <div className="page-stack">
        <div>
          <p className="eyebrow">GraphRAG</p>
          <h2 className="page-title">Centro de consultas</h2>
        </div>
 
        <form className="panel page-stack" onSubmit={handleSubmit}>
          <textarea
            className="query-textarea"
            rows={6}
            placeholder="Pregunta sobre los datos actualmente ingeridos en el sistema"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
 
          <div className="status-grid query-form-grid">
            <div className="status-card">
              <span>Sesion ID</span>
              <input
                className="search-input query-mini-input"
                aria-label="Sesion ID"
                placeholder="Sesion ID"
                value={sessionId}
                onChange={(event) => setSessionId(event.target.value)}
              />
            </div>
            <div className="status-card">
              <span>Top K</span>
              <input
                className="search-input query-mini-input"
                type="number"
                aria-label="Top K"
                placeholder="Top K"
                value={topK}
                onChange={(event) => setTopK(event.target.value)}
              />
            </div>
            <div className="status-card">
              <span>Pistas de entidad (csv)</span>
              <input
                className="search-input query-mini-input"
                aria-label="Pistas de entidad"
                placeholder="Pistas de entidad"
                value={hintsText}
                onChange={(event) => setHintsText(event.target.value)}
              />
            </div>
            <div className="status-card">
              <span>Library IDs (csv)</span>
              <input
                className="search-input query-mini-input"
                aria-label="Library IDs"
                placeholder="Library IDs"
                value={libraryIdsText}
                onChange={(event) => setLibraryIdsText(event.target.value)}
              />
            </div>
          </div>
 
          <div>
            <button className="primary-button" type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Ejecutando consulta...' : 'Consultar'}
            </button>
          </div>
        </form>
 
        {mutation.isError ? <PageStateError title="No se pudo ejecutar la consulta." description="Revisa auth, scope o disponibilidad del backend." /> : null}
 
        {mutation.data ? (
          <div className="panel page-stack">
            <div>
              <h3>Respuesta</h3>
              <p className="answer-block">{mutation.data.answer}</p>
            </div>
 
            {Boolean(mutation.data.fastContext) && (
              <div>
                <h3>Contexto rapido</h3>
                <div className="panel muted-text">
                  {JSON.stringify(mutation.data.fastContext, null, 2)}
                </div>
              </div>
            )}
 
            {Boolean(mutation.data.truthFacts) && (
              <div>
                <h3>Hechos base</h3>
                <div className="panel compact-gap">
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
              <div className="status-card" data-testid="query-metric-model">
                <span>Modelo</span>
                <strong>{mutation.data.model}</strong>
              </div>
              <div className="status-card" data-testid="query-metric-tokens">
                <span>Tokens</span>
                <strong>{mutation.data.tokensUsed}</strong>
              </div>
              <div className="status-card" data-testid="query-metric-sources">
                <span>Fuentes</span>
                <strong>{mutation.data.sourcesUsed.length}</strong>
              </div>
              <div className="status-card">
                <span>Resultado</span>
                <StatusBadge status="READY" />
              </div>
            </div>
 
            <div>
              <h3>Fuentes</h3>
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
 
      <aside className="panel">
        <h3>Historial</h3>
        {historyQuery.isLoading ? (
          <p className="muted-text">Cargando historial...</p>
        ) : historyQuery.data ? (
          <div className="details-list">
            {historyQuery.data.messages.map((msg, i) => (
              <div key={i} className="query-history-entry">
                <span className="eyebrow">{msg.role}</span>
                <p>{msg.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted-text">No hay historial para esta sesion.</p>
        )}
      </aside>
    </div>
  );
}
