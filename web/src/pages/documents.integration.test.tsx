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
    previewText: `Vista previa de ${title}`,
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
          usage: {
            documents: {
              ingestedByDay: [{ date: '2026-05-01', count: documents.length }],
              byLibrary: [],
              bySource: [{ source: 'generated', count: documents.length }],
            },
            queries: {
              total: 0,
              byDay: [{ date: '2026-05-01', count: 0 }],
              byLibrary: [],
            },
          },
        }),
      ),
      http.get('/documents/scopes', () =>
        HttpResponse.json({
          tenants: ['tenant-a', 'tenant-b'],
          libraries: ['lib-a', 'lib-b'],
        }),
      ),
    );
  });

  it('creates a manual document with existing tenant/library suggestions', async () => {
    let usedTenantHeader: string | null = null;
    let usedLibraryHeader: string | null = null;
    server.use(
      http.post('/documents/text', async ({ request }) => {
        const body = (await request.json()) as { title?: string; rawText: string };
        usedTenantHeader = request.headers.get('x-tenant-id');
        usedLibraryHeader = request.headers.get('x-library-id');
        documents = [...documents, documentPayload('doc-2', body.title ?? 'Untitled')];
        return HttpResponse.json(documents[documents.length - 1]);
      }),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo manual' }));
    await screen.findByRole('dialog', { name: 'Nuevo manual' });
    fireEvent.change(screen.getByPlaceholderText('Titulo (opcional)'), { target: { value: 'Created from UI' } });
    fireEvent.change(screen.getByPlaceholderText('Contenido del documento'), { target: { value: 'Some raw text' } });
    fireEvent.change(screen.getByPlaceholderText('tenant-ejemplo'), { target: { value: 'tenant-a' } });
    fireEvent.change(screen.getByPlaceholderText('library-ejemplo'), { target: { value: 'lib-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar documento' }));

    await screen.findByText('Created from UI');
    await waitFor(() => expect(listSpy).toHaveBeenCalledTimes(2));
    expect(usedTenantHeader).toBe('tenant-a');
    expect(usedLibraryHeader).toBe('lib-a');
  });

  it('creates a manual document with new tenant/library values', async () => {
    let usedTenantHeader: string | null = null;
    let usedLibraryHeader: string | null = null;
    server.use(
      http.post('/documents/text', async ({ request }) => {
        const body = (await request.json()) as { title?: string; rawText: string };
        usedTenantHeader = request.headers.get('x-tenant-id');
        usedLibraryHeader = request.headers.get('x-library-id');
        documents = [...documents, documentPayload('doc-3', body.title ?? 'Untitled')];
        return HttpResponse.json(documents[documents.length - 1]);
      }),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo manual' }));
    await screen.findByRole('dialog', { name: 'Nuevo manual' });
    fireEvent.change(screen.getByPlaceholderText('Titulo (opcional)'), { target: { value: 'Brand new scope' } });
    fireEvent.change(screen.getByPlaceholderText('Contenido del documento'), { target: { value: 'Raw content for new scope' } });
    fireEvent.change(screen.getByPlaceholderText('tenant-ejemplo'), { target: { value: 'tenant-new' } });
    fireEvent.change(screen.getByPlaceholderText('library-ejemplo'), { target: { value: 'lib-new' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar documento' }));

    await screen.findByText('Brand new scope');
    expect(usedTenantHeader).toBe('tenant-new');
    expect(usedLibraryHeader).toBe('lib-new');
  });

  it('renders backend suggestions in add manual modal', async () => {
    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByRole('button', { name: 'Nuevo manual' }));
    const dialog = await screen.findByRole('dialog', { name: 'Nuevo manual' });
    expect(within(dialog).getByText('Puedes seleccionar una sugerencia o escribir un tenant/library nuevo.')).toBeInTheDocument();
    expect(document.querySelector('datalist#manual-tenant-suggestions option[value="tenant-a"]')).not.toBeNull();
    expect(document.querySelector('datalist#manual-library-suggestions option[value="lib-a"]')).not.toBeNull();
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
    fireEvent.click(screen.getByText('Opciones avanzadas'));
    const titleInputs = screen.getAllByPlaceholderText('Titulo opcional');
    fireEvent.change(titleInputs[1], { target: { value: 'Upload title' } });
    const file = new File(['hello'], 'hello.txt', { type: 'text/plain' });
    fireEvent.change(screen.getByLabelText('Archivo'), { target: { files: [file] } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir documento' }));

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
    fireEvent.click(screen.getByText('Opciones avanzadas'));
    fireEvent.change(screen.getByPlaceholderText('useCaseId'), { target: { value: 'sample' } });
    fireEvent.change(screen.getAllByPlaceholderText('Titulo opcional').at(-1)!, { target: { value: 'Generated UI' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generar documento' }));

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
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    const dialog = screen.getByRole('dialog', { name: 'Eliminar documento' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Eliminar documento' }));

    await screen.findByText('No encontramos documentos');
  });

  describe('Reindexing functionality', () => {
    it('shows the maintenance section', async () => {
      renderWithAppProviders(<DocumentsPage />);
      await screen.findByText('Doc 1');
      expect(screen.getByText('Opciones avanzadas')).toBeInTheDocument();
    });

    it('triggers incremental reindexing', async () => {
      const incrementalSpy = vi.fn();
      server.use(
        http.post('/index/incremental', () => {
          incrementalSpy();
          return HttpResponse.json({ success: true });
        }),
      );

      renderWithAppProviders(<DocumentsPage />);
      await screen.findByText('Doc 1');
      fireEvent.click(screen.getByText('Opciones avanzadas'));

      fireEvent.click(screen.getByRole('button', { name: 'Reindexado incremental' }));
      const dialog = await screen.findByRole('dialog', { name: /reindexado incremental/i });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar' }));
      await waitFor(() => expect(incrementalSpy).toHaveBeenCalledTimes(1));
    });

    it('triggers rebuild reindexing after confirmation', async () => {
      const rebuildSpy = vi.fn();
      server.use(
        http.post('/index/rebuild', () => {
          rebuildSpy();
          return HttpResponse.json({ success: true });
        }),
      );

      renderWithAppProviders(<DocumentsPage />);
      await screen.findByText('Doc 1');
      fireEvent.click(screen.getByText('Opciones avanzadas'));

      fireEvent.click(screen.getByRole('button', { name: 'Reconstruir indice' }));
      const dialog = await screen.findByRole('dialog', { name: /reconstruir indice/i });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Iniciar' }));
      await waitFor(() => expect(rebuildSpy).toHaveBeenCalledTimes(1));
    });
  });

  it('opens a document and loads full content on demand', async () => {
    server.use(
      http.get('/documents/:id', ({ params }) =>
        HttpResponse.json({
          ...documentPayload(String(params.id), 'Doc 1'),
          source: { kind: 'generated', useCaseId: 'manual-api-text' },
          rawText: 'Contenido completo del documento.',
        }),
      ),
    );

    renderWithAppProviders(<DocumentsPage />);

    await screen.findByText('Doc 1');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    await screen.findByRole('dialog', { name: 'Documento' });
    await screen.findByText('Contenido completo del documento.');
  });
});
