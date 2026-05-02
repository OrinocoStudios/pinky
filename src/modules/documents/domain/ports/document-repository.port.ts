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
  listDocuments(limit?: number, libraryId?: string): Promise<DocumentRecord[]>;
  listDocumentsByTenant(tenantId: string, limit?: number, libraryId?: string): Promise<DocumentRecord[]>;
  listDocumentsByLibrary(
    libraryId: string,
    tenantId?: string,
    limit?: number,
  ): Promise<DocumentRecord[]>;
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
