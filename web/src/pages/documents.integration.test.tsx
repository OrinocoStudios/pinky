import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsPage } from './documents';
import { server } from '../test/server';
import { renderWithAppProviders } from '../test/render';

const now = new Date().toISOString();

function documentPayload(id: string, title: string) {
  return {
    documentId: id,
    title,
    status: 'READY',
    graphSyncStatus: 'SYNCED',
    createdAt: now,
    updatedAt: now,
  };
}

describe('DocumentsPage', () => {
  let documents: Array<ReturnType<typeof documentPayload>>;
  const listSpy = vi.fn();

  beforeEach(() => {
    documents = [documentPayload('doc-1', 'Doc 1')];
    listSpy.mockReset();

    server.use(
      http.get('/documents', () => {
        listSpy();
        return HttpResponse.json(documents);
      }),
      http.get('/admin/overview', () =>
        HttpResponse.json({
          health: {
            status: 'ok',
            uptime: 1,
            services: {
              neo4j: { status: 'up', latency_ms: 2 },
              llm: { status: 'configured', provider: 'local' },
            },
            latency_ms: 3,
          },
          documents: {
            total: documents.length,
            byStatus: { READY: documents.length },
            recent: documents,
          },
        }),
      ),
    );
  });

  it('creates a text document and refreshes the table', async () => {
    server.use(
      http.post('/documents/text', async ({ request }) => {
        const body = (await request.json()) as { title?: string; rawText: string };
        documents = [...documents, documentPayload('doc-2', body.title ?? 'Untitled')];
        return HttpResponse.json(documents[documents.length - 1]);
      }),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.change(screen.getAllByPlaceholderText('Optional title')[0], { target: { value: 'Created from UI' } });
    fireEvent.change(screen.getByPlaceholderText('Document content'), { target: { value: 'Some raw text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create text document' }));

    await screen.findByText('Created from UI');
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
  });

  it('uploads a document file', async () => {
    server.use(
      http.post('/documents/upload', () => {
        documents = [...documents, documentPayload('doc-3', 'Upload title')];
        return HttpResponse.json(documents[documents.length - 1]);
      }),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    const titleInputs = screen.getAllByPlaceholderText('Optional title');
    fireEvent.change(titleInputs[1], { target: { value: 'Upload title' } });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('File'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    await screen.findByText('Upload title');
  });

  it('generates a document', async () => {
    server.use(
      http.post('/documents/generate', async ({ request }) => {
        const body = (await request.json()) as { title?: string };
        documents = [...documents, documentPayload('doc-4', body.title ?? 'Generated')];
        return HttpResponse.json(documents[documents.length - 1]);
      }),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.change(screen.getByPlaceholderText('useCaseId'), { target: { value: 'sample' } });
    fireEvent.change(screen.getAllByPlaceholderText('Optional title')[2], { target: { value: 'Generated UI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate document' }));

    await screen.findByText('Generated UI');
  });

  it('deletes a document after confirmation', async () => {
    server.use(
      http.delete('/documents/:id', ({ params }) => {
        documents = documents.filter((document) => document.documentId !== params.id);
        return HttpResponse.json({ deleted: params.id });
      }),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete document' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete document' }));

    await screen.findByText('No documents found');
  });

  describe('Reindexing functionality', () => {
    it('shows the maintenance section', async () => {
      renderWithAppProviders(<DocumentsPage />);
      await screen.findByText('Doc 1');
      // We expect a section for corpus management to be visible
      expect(screen.getByText(/Corpus Management/i)).toBeInTheDocument();
    });

    it('triggers incremental reindexing', async () => {
      server.use(
        http.post('/index/incremental', () => {
          return HttpResponse.json({ success: true });
        }),
      );

      renderWithAppProviders(<DocumentsPage />);
      await screen.findByText('Doc 1');

      fireEvent.click(screen.getByRole('button', { name: 'Incremental Reindex' }));

      // Check for success toast (assuming toast implementation)
      await screen.findByText(/reindexing completed/i);
    });

    it('triggers rebuild reindexing after confirmation', async () => {
      server.use(
        http.post('/index/rebuild', () => {
          return HttpResponse.json({ success: true });
        }),
      );

      renderWithAppProviders(<DocumentsPage />);
      await screen.findByText('Doc 1');

      fireEvent.click(screen.getByRole('button', { name: 'Rebuild Index' }));
      
      // Check for confirmation dialog
      const dialog = await screen.findByRole('dialog', { name: /confirm rebuild/i });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Confirm' }));

      await screen.findByText(/rebuild completed/i);
    });
  });
});
