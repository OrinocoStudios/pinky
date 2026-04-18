import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { DocumentsPage } from './documents';
import { renderWithAppProviders } from '../test/render';
import { setupServer } from 'msw/node';
import { http, HttpResponse } from 'msw';

// Mock data
const MOCK_DOCUMENTS = [
  {
    documentId: 'doc_1',
    title: 'Test Document 1',
    status: 'ingested',
    graphSyncStatus: 'synced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId: 'tenant_1',
    libraryId: 'lib_1',
  },
  {
    documentId: 'doc_2',
    title: 'Test Document 2',
    status: 'ingested',
    graphSyncStatus: 'synced',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    tenantId: 'tenant_1',
    libraryId: 'lib_1',
  },
];

// MSW Server setup
const server = setupServer(
  http.get('*/documents', () => {
    return HttpResponse.json(MOCK_DOCUMENTS);
  }),
  http.delete('*/documents/doc_1', () => {
    return HttpResponse.json({ deleted: 'doc_1' });
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('DocumentsPage Deletion Flow', () => {
  it('shows confirmation dialog when delete button is clicked', async () => {
    renderWithAppProviders(<DocumentsPage />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 5000 });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    // In the current implementation, the dialog should be visible
    // The dialog title is "Delete document"
    expect(screen.getByText(/delete document/i)).toBeInTheDocument();
  });

  it('cancels deletion when cancel is clicked', async () => {
    renderWithAppProviders(<DocumentsPage />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 5000 });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    // Dialog should be gone
    await waitFor(() => {
      expect(screen.queryByText(/delete document/i)).not.toBeInTheDocument();
    });
  });

  it('calls delete API and removes row when confirmed', async () => {
    renderWithAppProviders(<DocumentsPage />);

    // Wait for loading to finish
    await waitFor(() => expect(screen.queryByText(/loading/i)).not.toBeInTheDocument(), { timeout: 5000 });

    const deleteButton = screen.getByRole('button', { name: /delete/i });
    fireEvent.click(deleteButton);

    const confirmButton = screen.getByRole('button', { name: /delete document/i });
    fireEvent.click(confirmButton);

    // Wait for the document to be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('Test Document 1')).not.toBeInTheDocument();
    }, { timeout: 3000 });
  });
});
