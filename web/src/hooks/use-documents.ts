import { useQuery } from '@tanstack/react-query';
import { useScope } from '../app/scope-context';
import { queryKeys } from '../app/query-keys';
import { DocumentRecord, DocumentScopesResponse } from '../lib/contracts';
import { apiFetch, getScopeHeaders } from '../lib/api';
import { scopeKey } from '../lib/scope';

export function useDocuments() {
  const { scope } = useScope();

  return useQuery({
    queryKey: [...queryKeys.documents.all(), scopeKey(scope)],
    queryFn: () => apiFetch<DocumentRecord[]>('/documents', { headers: getScopeHeaders(scope) }),
  });
}

export function useDocument(documentId: string | null) {
  const { scope } = useScope();

  return useQuery({
    queryKey: [...queryKeys.documents.byId(documentId ?? 'none'), scopeKey(scope)],
    queryFn: () => apiFetch<DocumentRecord>(`/documents/${documentId}`, { headers: getScopeHeaders(scope) }),
    enabled: Boolean(documentId),
  });
}

export function useDocumentScopes() {
  return useQuery({
    queryKey: queryKeys.documents.scopes(),
    queryFn: () => apiFetch<DocumentScopesResponse>('/documents/scopes'),
  });
}
