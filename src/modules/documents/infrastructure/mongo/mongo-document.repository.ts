import { Injectable } from '@nestjs/common';
import { DocumentRepositoryPort } from '../../domain/ports/document-repository.port';
import { DocumentChunk, DocumentRecord } from '../../domain/models/document.model';
import { MongoDatabaseService } from './mongo-database.service';

@Injectable()
export class MongoDocumentRepository implements DocumentRepositoryPort {
  constructor(private readonly db: MongoDatabaseService) {}

  async createDocument(input: Omit<DocumentRecord, 'createdAt' | 'updatedAt'>): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    const doc: DocumentRecord = {
      ...input,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.documentsCollection.insertOne(doc);
    return doc;
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentRecord['status'],
    graphSyncStatus?: DocumentRecord['graphSyncStatus'],
  ): Promise<void> {
    const now = new Date().toISOString();
    await this.db.documentsCollection.updateOne(
      { documentId },
      {
        $set: {
          status,
          updatedAt: now,
          ...(graphSyncStatus ? { graphSyncStatus } : {}),
        },
      },
    );
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }
    await this.db.chunksCollection.insertMany(chunks);
  }

  async listAllChunks(limit = 10000, tenantId?: string, libraryId?: string): Promise<DocumentChunk[]> {
    const filter = this.buildScopeFilter(tenantId, libraryId);
    return (await this.db.chunksCollection
      .find(filter)
      .limit(limit)
      .toArray()) as unknown as DocumentChunk[];
  }

  async listChunksNeedingReindex(
    currentEmbeddingModel: string,
    limit = 10000,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentChunk[]> {
    const scopeFilter = this.buildScopeFilter(tenantId, libraryId);
    return (await this.db.chunksCollection
      .find({
        ...scopeFilter,
        $or: [
          { embeddingModel: { $exists: false } },
          { embeddingModel: null },
          { embeddingModel: { $ne: currentEmbeddingModel } },
        ],
      })
      .limit(limit)
      .toArray()) as unknown as DocumentChunk[];
  }

  async updateChunkEmbedding(
    chunkId: string,
    embedding: number[],
    embeddingModel: string,
  ): Promise<void> {
    await this.db.chunksCollection.updateOne(
      { chunkId },
      { $set: { embedding, embeddingModel } },
    );
  }

  async listDocuments(limit = 50, libraryId?: string): Promise<DocumentRecord[]> {
    const filter = libraryId ? { libraryId } : {};
    return (await this.db.documentsCollection
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as unknown as DocumentRecord[];
  }

  async listDocumentsByTenant(
    tenantId: string,
    limit = 50,
    libraryId?: string,
  ): Promise<DocumentRecord[]> {
    return (await this.db.documentsCollection
      .find(this.buildScopeFilter(tenantId, libraryId))
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as unknown as DocumentRecord[];
  }

  async listDocumentsByLibrary(
    libraryId: string,
    tenantId?: string,
    limit = 50,
  ): Promise<DocumentRecord[]> {
    return (await this.db.documentsCollection
      .find(this.buildScopeFilter(tenantId, libraryId))
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as unknown as DocumentRecord[];
  }

  async findDocumentById(documentId: string): Promise<DocumentRecord | null> {
    return (await this.db.documentsCollection.findOne({ documentId })) as DocumentRecord | null;
  }

  async findDocumentByChecksum(
    checksum: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord | null> {
    const filter = {
      checksum,
      ...this.buildScopeFilter(tenantId, libraryId),
    };
    return (await this.db.documentsCollection.findOne(filter)) as DocumentRecord | null;
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.db.chunksCollection.deleteMany({ documentId });
    await this.db.documentsCollection.deleteOne({ documentId });
  }

  private buildScopeFilter(tenantId?: string, libraryId?: string): Record<string, string> {
    return {
      ...(tenantId ? { tenantId } : {}),
      ...(libraryId ? { libraryId } : {}),
    };
  }
}
