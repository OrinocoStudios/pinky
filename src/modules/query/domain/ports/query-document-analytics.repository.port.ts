export type RetrievedDocumentHit = {
  documentId: string;
  title?: string;
  libraryId?: string;
};

export type SaveRetrievedDocumentsInput = {
  queryExecutionId: string;
  createdAt: string;
  tenantId?: string;
  libraryId?: string;
  documents: RetrievedDocumentHit[];
};

export interface QueryDocumentAnalyticsRepositoryPort {
  saveRetrievedDocuments(input: SaveRetrievedDocumentsInput): Promise<void>;
  getTopDocumentsByQueryCount(
    days: number,
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ documentId: string; title?: string; count: number }>>;
}
