import { fireEvent, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { DocumentsPage } from './documents';
import { renderWithAppProviders } from '../test/render';
import { server } from '../test/server';

function createMockDocuments() {
  const now = new Date().toISOString();
  return [
    {
      documentId: 'doc_1',
      title: 'Test Document 1',
      status: 'ingested',
      graphSyncStatus: 'synced',
      previewText: 'Texto de ejemplo 1',
      createdAt: now,
      updatedAt: now,
      tenantId: 'tenant_1',
      libraryId: 'lib_1',
    },
    {
      documentId: 'doc_2',
      title: 'Test Document 2',
      status: 'ingested',
      graphSyncStatus: 'synced',
      previewText: 'Texto de ejemplo 2',
      createdAt: now,
      updatedAt: now,
      tenantId: 'tenant_1',
      libraryId: 'lib_1',
    },
  ];
}

describe('DocumentsPage Deletion Flow', () => {
  let documents = createMockDocuments();

  beforeEach(() => {
    documents = createMockDocuments();
    server.use(
      http.get('/documents', () => {
        return HttpResponse.json(documents);
      }),
      http.get('/documents/scopes', () =>
        HttpResponse.json({
          tenants: [],
          libraries: [],
        }),
      ),
      http.delete('/documents/:id', ({ params }) => {
        const id = String(params.id);
        documents = documents.filter((document) => document.documentId !== id);
        return HttpResponse.json({ deleted: id });
      }),
    );
  });

  it('shows confirmation dialog when delete button is clicked', async () => {
    renderWithAppProviders(<DocumentsPage />);

    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(), { timeout: 5000 });

    const deleteButton = screen.getAllByRole('button', { name: /^eliminar$/i })[0];
    fireEvent.click(deleteButton);
    expect(screen.getByRole('dialog', { name: /eliminar documento/i })).toBeInTheDocument();
  });

  it('cancels deletion when cancel is clicked', async () => {
    renderWithAppProviders(<DocumentsPage />);

    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(), { timeout: 5000 });

    const deleteButton = screen.getAllByRole('button', { name: /^eliminar$/i })[0];
    fireEvent.click(deleteButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    await waitFor(() => {
      expect(screen.queryByText(/eliminar documento/i)).not.toBeInTheDocument();
    });
  });

  it('calls delete API and removes row when confirmed', async () => {
    renderWithAppProviders(<DocumentsPage />);

    await waitFor(() => expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument(), { timeout: 5000 });

    const deleteButton = screen.getAllByRole('button', { name: /^eliminar$/i })[0];
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', { name: /eliminar documento/i });
    fireEvent.click(confirmButton);

    await waitFor(
      () => {
        expect(screen.queryByText('Test Document 1')).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });
});
