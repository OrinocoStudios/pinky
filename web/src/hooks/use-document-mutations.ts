import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../app/query-keys';
import { useScope } from '../app/scope-context';
import {
  DeleteDocumentResponse,
  DocumentRecord,
  GenerateDocumentPayload,
  IngestTextDocumentPayload,
  ReindexResponse,
  UploadDocumentPayload,
} from '../lib/contracts';
import { apiFetch, getScopeHeaders, parseApiErrorMessage } from '../lib/api';

function useInvalidateDocumentQueries() {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all() }),
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.overview() }),
    ]);
  };
}

export function useIngestTextDocument() {
  const { scope } = useScope();
  const invalidate = useInvalidateDocumentQueries();

  return useMutation({
    mutationFn: ({ tenantId, libraryId, ...payload }: IngestTextDocumentPayload) =>
      apiFetch<DocumentRecord>('/documents/text', {
        method: 'POST',
        headers: getScopeHeaders({
          tenantId: tenantId ?? scope.tenantId,
          libraryId: libraryId ?? scope.libraryId,
        }),
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidate,
  });
}

export function useGenerateDocument() {
  const { scope } = useScope();
  const invalidate = useInvalidateDocumentQueries();

  return useMutation({
    mutationFn: (payload: GenerateDocumentPayload) =>
      apiFetch<DocumentRecord>('/documents/generate', {
        method: 'POST',
        headers: getScopeHeaders(scope),
        body: JSON.stringify(payload),
      }),
    onSuccess: invalidate,
  });
}

export function useUploadDocument() {
  const { scope } = useScope();
  const invalidate = useInvalidateDocumentQueries();

  return useMutation({
    mutationFn: async (payload: UploadDocumentPayload) => {
      const formData = new FormData();
      formData.set('file', payload.file);
      if (payload.title?.trim()) {
        formData.set('title', payload.title.trim());
      }
      if (payload.metadata) {
        formData.set('metadata', JSON.stringify(payload.metadata));
      }

      const response = await fetch('/documents/upload', {
        method: 'POST',
        credentials: 'include',
        headers: getScopeHeaders(scope),
        body: formData,
      });

      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }

      return (await response.json()) as DocumentRecord;
    },
    onSuccess: invalidate,
  });
}

/**
 * Hook for triggering index reindexing operations.
 * 
 * @returns A TanStack Query mutation object.
 * @param mode - The reindexing mode:
 *   - 'rebuild': Performs a complete rebuild of the index.
 *   - 'incremental': Performs an incremental update of the index.
 * 
 * @example
 * const { mutate, isPending } = useReindex();
 * mutate('rebuild');
 */
export function useReindex() {
  const { scope } = useScope();
  const invalidate = useInvalidateDocumentQueries();

  return useMutation({
    mutationFn: (mode: 'rebuild' | 'incremental') =>
      apiFetch<ReindexResponse>(`/index/${mode}`, {
        method: 'POST',
        headers: getScopeHeaders(scope),
      }),
    onSuccess: invalidate,
  });
}

/**
 * Hook for deleting a document from the corpus.
 * 
 * @returns A TanStack Query mutation object.
 * @param documentId - The unique identifier of the document to delete.
 * 
 * @example
 * const { mutate, isPending } = useDeleteDocument();
 * mutate('doc-123');
 */
export function useDeleteDocument() {
  const { scope } = useScope();
  const invalidate = useInvalidateDocumentQueries();

  return useMutation({
    mutationFn: (documentId: string) =>
      apiFetch<DeleteDocumentResponse>(`/documents/${documentId}`, {
        method: 'DELETE',
        headers: getScopeHeaders(scope),
      }),
    onSuccess: invalidate,
  });
}
