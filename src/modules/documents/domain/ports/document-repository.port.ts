import { DocumentChunk, DocumentRecord } from '../models/document.model';

export interface DocumentRepositoryPort {
  createDocument(input: Omit<DocumentRecord, 'createdAt' | 'updatedAt'>): Promise<DocumentRecord>;
  updateDocumentStatus(
    documentId: string,
    status: DocumentRecord['status'],
    graphSyncStatus?: DocumentRecord['graphSyncStatus'],
  ): Promise<void>;
  addChunks(chunks: DocumentChunk[]): Promise<void>;
  listAllChunks(limit?: number, tenantId?: string, libraryId?: string): Promise<DocumentChunk[]>;
  listChunksNeedingReindex(
    currentEmbeddingModel: string,
    limit?: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentChunk[]>;
  updateChunkEmbedding(chunkId: string, embedding: number[], embeddingModel: string): Promise<void>;
  listDocuments(limit?: number, libraryId?: string, offset?: number): Promise<DocumentRecord[]>;
  listDocumentsByTenant(
    tenantId: string,
    limit?: number,
    libraryId?: string,
    offset?: number,
  ): Promise<DocumentRecord[]>;
  listDocumentsByLibrary(
    libraryId: string,
    tenantId?: string,
    limit?: number,
    offset?: number,
  ): Promise<DocumentRecord[]>;
  countDocuments(tenantId?: string, libraryId?: string): Promise<number>;
  getDocumentIngestionByDay(
    days: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ date: string; count: number }>>;
  getTopLibrariesByDocumentCount(
    limit: number,
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ libraryId: string; count: number }>>;
  getDocumentCountBySource(
    tenantId?: string,
    libraryId?: string,
  ): Promise<Array<{ source: string; count: number }>>;
  listDocumentScopes(): Promise<{ tenants: string[]; libraries: string[] }>;
  findDocumentById(documentId: string): Promise<DocumentRecord | null>;
  findDocumentByChecksum(
    checksum: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord | null>;
  findDocumentByIngestKey(
    ingestKey: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord | null>;
  deleteDocument(documentId: string): Promise<void>;
}
