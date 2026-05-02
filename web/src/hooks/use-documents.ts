import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../app/query-keys';
import { DocumentRecord, DocumentsPageResponse, DocumentScopesResponse } from '../lib/contracts';
import { apiFetch } from '../lib/api';

const GLOBAL_HEADERS = {
  'X-Tenant-Id': '',
  'X-Library-Id': '',
};

export function useDocuments(page = 1, pageSize = 24) {
  return useQuery({
    queryKey: queryKeys.documents.page(page, pageSize),
    queryFn: async () => {
      const queryParams = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await apiFetch<DocumentRecord[] | DocumentsPageResponse>(
        `/documents?${queryParams.toString()}`,
        { headers: GLOBAL_HEADERS },
      );

      if (Array.isArray(response)) {
        return {
          items: response,
          total: response.length,
          page,
          pageSize,
          totalPages: response.length === 0 ? 0 : 1,
        } satisfies DocumentsPageResponse;
      }

      return response;
    },
  });
}

export function useDocument(documentId: string | null) {
  return useQuery({
    queryKey: queryKeys.documents.byId(documentId ?? 'none'),
    queryFn: () => apiFetch<DocumentRecord>(`/documents/${documentId}`, { headers: GLOBAL_HEADERS }),
    enabled: Boolean(documentId),
  });
}

export function useDocumentScopes() {
  return useQuery({
    queryKey: queryKeys.documents.scopes(),
    queryFn: () => apiFetch<DocumentScopesResponse>('/documents/scopes', { headers: GLOBAL_HEADERS }),
  });
}
