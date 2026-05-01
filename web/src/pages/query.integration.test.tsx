import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryPage } from './query';
import { server } from '../test/server';
import { renderWithAppProviders } from '../test/render';
import { QueryPayload, QueryResponse, ChatMessage } from '../lib/contracts';

const now = new Date().toISOString();

function chatHistoryPayload(sessionId: string, messages: ChatMessage[]) {
  return {
    sessionId,
    messages,
  };
}

function queryResponse(): QueryResponse {
  return {
    answer: 'This is the generated answer based on the retrieved context.',
    sourcesUsed: [
      { id: 's1', title: 'Source 1' },
      { id: 's2', title: 'Source 2', documentId: 'doc-1' },
    ],
    model: 'gpt-4',
    tokensUsed: 1250,
    fastContext: [
      { entity: 'Document', relationships: { type: 'contains', target: 'Section 1' } },
      { entity: 'Section 1', relationships: { type: 'describes', target: 'Introduction' } },
    ],
    truthFacts: ['Fact 1 about the document', 'Fact 2 about the entity'],
  };
}

describe('QueryPage', () => {
  let mockSessionId: string;
  const submitSpy = vi.fn();
  const historySpy = vi.fn();

  beforeEach(() => {
    mockSessionId = `session-${Date.now()}`;
    submitSpy.mockReset();
    historySpy.mockReset();

    server.use(
      http.post('/query', async ({ request }) => {
        const payload = (await request.json()) as QueryPayload;
        submitSpy();
        return HttpResponse.json(queryResponse());
      }),
      http.get('/query/history/:sessionId', ({ params }) => {
        historySpy();
        const sessionIdParam = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
        const sessionId = sessionIdParam ?? 'unknown-session';
        return HttpResponse.json(chatHistoryPayload(sessionId, [
          { role: 'user' as const, content: 'Initial query', timestamp: now },
          { role: 'assistant' as const, content: 'Here is the answer from history', timestamp: now },
        ]));
      }),
    );
  });

  it('submits query with all advanced parameters', async () => {
    renderWithAppProviders(<QueryPage />);

    await screen.findByText('Query Workbench');

    fireEvent.change(screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system'), {
      target: { value: 'What are the main entities in the document?' },
    });

    const sessionIdInput = screen.getAllByPlaceholderText(/Session ID/i)[0];
    fireEvent.change(sessionIdInput, { target: { value: mockSessionId } });

    const topKInput = screen.getAllByPlaceholderText(/Top K/i)[0];
    fireEvent.change(topKInput, { target: { value: '10' } });

    const hintsInput = screen.getAllByPlaceholderText(/Entity Hints/i)[0];
    fireEvent.change(hintsInput, { target: { value: 'Document, Section' } });

    const libraryInput = screen.getAllByPlaceholderText(/Library IDs/i)[0];
    fireEvent.change(libraryInput, { target: { value: 'lib-1, lib-2' } });

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));

    await screen.findByText(/This is the generated answer/i);


    await screen.findByText('Fast Context');
    await screen.findByText('Truth Facts');

    const answerText = await screen.findByText(/This is the generated answer/i);
    expect(answerText).toBeInTheDocument();
    const modelCard = screen.getByText('Model').closest('.status-card');
    const tokensCard = screen.getByText('Tokens').closest('.status-card');
    const sourcesCardLabel = screen
      .getAllByText('Sources')
      .find((node) => Boolean(node.closest('.status-card')));
    const sourcesCard = sourcesCardLabel?.closest('.status-card') ?? null;
    expect(modelCard).not.toBeNull();
    expect(tokensCard).not.toBeNull();
    expect(sourcesCard).not.toBeNull();
    const modelCardEl = modelCard as HTMLElement;
    const tokensCardEl = tokensCard as HTMLElement;
    const sourcesCardEl = sourcesCard as HTMLElement;
    expect(within(modelCardEl).getByText('gpt-4')).toBeInTheDocument();
    expect(within(tokensCardEl).getByText('1250')).toBeInTheDocument();
    expect(within(sourcesCardEl).getByText('2')).toBeInTheDocument();

    await waitFor(() => expect(historySpy).toHaveBeenCalled());
  });

  it('saves query and sessionId to localStorage', async () => {
    renderWithAppProviders(<QueryPage />);

    const queryInput = screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system');
    const sessionIdInput = screen.getAllByPlaceholderText(/Session ID/i)[0];

    fireEvent.change(queryInput, { target: { value: 'Test query' } });
    fireEvent.change(sessionIdInput, { target: { value: 'test-session-123' } });

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));

    await screen.findByText(/This is the generated answer/i);


    const lastQuery = localStorage.getItem('pinky_last_query');
    const lastSession = localStorage.getItem('pinky_last_session');

    expect(lastQuery).toBe('Test query');
    expect(lastSession).toBe('test-session-123');
  });

  it('displays fastContext and truthFacts in the response', async () => {
    renderWithAppProviders(<QueryPage />);

    const queryInput = screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system');
    fireEvent.change(queryInput, { target: { value: 'What entities exist?' } });

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await screen.findByText('Answer');

    await waitFor(() => {
      const fastContextSection = screen.getByText('Fast Context');
      expect(fastContextSection).toBeInTheDocument();

      const truthSection = screen.getByText('Truth Facts');
      expect(truthSection).toBeInTheDocument();
    });

    await screen.findByText('Fact 1 about the document');
    await screen.findByText('Fact 2 about the entity');
  });

  it('displays chat history panel when sessionId is provided', async () => {
    renderWithAppProviders(<QueryPage />);

    const sessionIdInput = screen.getAllByRole('textbox', { name: /Session ID/i })[0];
    fireEvent.change(sessionIdInput, { target: { value: mockSessionId } });

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await screen.findByText('Chat History');

    await waitFor(() => expect(historySpy).toHaveBeenCalled());

    expect(screen.getByText('user')).toBeInTheDocument();
    expect(screen.getByText('assistant')).toBeInTheDocument();
    expect(screen.getByText('Initial query')).toBeInTheDocument();
    expect(screen.getByText('Here is the answer from history')).toBeInTheDocument();
  });

  it('shows loading state while query is running', async () => {
    server.use(
      http.post('/query', async () => {
        submitSpy();
        await new Promise((resolve) => setTimeout(resolve, 100));
        return HttpResponse.json(queryResponse());
      }),
    );
    renderWithAppProviders(<QueryPage />);

    const queryInput = screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system');
    fireEvent.change(queryInput, { target: { value: 'Running query test' } });
    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);
    await screen.findByRole('button', { name: 'Running query...' });
    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));

    await screen.findByText(/This is the generated answer/i);
  });

  it('shows error state when query fails', async () => {
    server.use(
      http.post('/query', () => {
        return HttpResponse.json({ message: 'Query failed' }, { status: 500 });
      }),
    );

    renderWithAppProviders(<QueryPage />);

    const queryInput = screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system');
    fireEvent.change(queryInput, { target: { value: 'Failing query' } });

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await screen.findByText('Unable to run query.');
  });

  it('uses existing sessionId from localStorage', async () => {
    localStorage.setItem('pinky_last_query', 'Previous query');
    localStorage.setItem('pinky_last_session', 'saved-session-456');

    renderWithAppProviders(<QueryPage />);

    await screen.findByText('Query Workbench');

    const queryInput = screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system');
    expect(queryInput).toHaveValue('Previous query');

    const sessionIdInput = screen.getAllByRole('textbox', { name: /Session ID/i })[0];
    expect(sessionIdInput).toHaveValue('saved-session-456');

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
  });

  it('does not submit empty query', async () => {
    renderWithAppProviders(<QueryPage />);

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitSpy).not.toHaveBeenCalled());
  });

  it('trims input values before submission', async () => {
    renderWithAppProviders(<QueryPage />);

    const queryInput = screen.getByPlaceholderText('Ask Pinky about the data currently ingested in the system');
    fireEvent.change(queryInput, { target: { value: '  Query with spaces  ' } });

    const sessionIdInput = screen.getAllByRole('textbox', { name: /Session ID/i })[0];
    fireEvent.change(sessionIdInput, { target: { value: '  session-id-123  ' } });

    const submitButton = screen.getByRole('button', { name: 'Run query' });
    fireEvent.click(submitButton);

    await waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));

    const lastQuery = localStorage.getItem('pinky_last_query');
    const lastSession = localStorage.getItem('pinky_last_session');

    expect(lastQuery).toBe('Query with spaces');
    expect(lastSession).toBe('session-id-123');
  });
});
