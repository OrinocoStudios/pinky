import { Injectable } from '@nestjs/common';
import { DocumentRepositoryPort } from '../../domain/ports/document-repository.port';
import { DocumentChunk, DocumentRecord, GraphSyncOutboxEvent } from '../../domain/models/document.model';
import { MongoDatabaseService } from './mongo-database.service';
import { ExtractedGraph } from '../../../graph/domain/models/graph.model';
import { randomUUID } from 'node:crypto';

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

  async listAllChunks(limit = 10000): Promise<DocumentChunk[]> {
    return (await this.db.chunksCollection
      .find({})
      .limit(limit)
      .toArray()) as unknown as DocumentChunk[];
  }

  async listChunksNeedingReindex(
    currentEmbeddingModel: string,
    limit = 10000,
  ): Promise<DocumentChunk[]> {
    return (await this.db.chunksCollection
      .find({
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

  async listDocuments(limit = 50): Promise<DocumentRecord[]> {
    return (await this.db.documentsCollection
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()) as unknown as DocumentRecord[];
  }

  async findDocumentById(documentId: string): Promise<DocumentRecord | null> {
    return (await this.db.documentsCollection.findOne({ documentId })) as DocumentRecord | null;
  }

  async findDocumentByChecksum(checksum: string): Promise<DocumentRecord | null> {
    return (await this.db.documentsCollection.findOne({ checksum })) as DocumentRecord | null;
  }

  async enqueueGraphSyncEvent(documentId: string, graph: ExtractedGraph): Promise<GraphSyncOutboxEvent> {
    const now = new Date().toISOString();
    const event: GraphSyncOutboxEvent = {
      eventId: randomUUID(),
      documentId,
      payload: JSON.stringify(graph),
      status: 'PENDING',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.graphSyncOutboxCollection.insertOne(event);
    return event;
  }

  async claimAndGetNextRetryableEvent(): Promise<GraphSyncOutboxEvent | null> {
    const now = new Date();
    const nowIso = now.toISOString();
    const lockExpiresAt = new Date(now.getTime() + 2 * 60 * 1000).toISOString();
    const result = await this.db.graphSyncOutboxCollection.findOneAndUpdate(
      {
        status: { $in: ['PENDING', 'FAILED'] },
        attempts: { $lt: 10 },
        $or: [
          { lockExpiresAt: { $exists: false } },
          { lockExpiresAt: null },
          { lockExpiresAt: { $lt: nowIso } },
        ],
      },
      {
        $set: {
          status: 'PROCESSING',
          updatedAt: nowIso,
          lockExpiresAt,
        },
        $inc: { attempts: 1 },
      },
      { sort: { updatedAt: 1 }, returnDocument: 'after' },
    );
    return result as unknown as GraphSyncOutboxEvent | null;
  }

  async markGraphSyncEvent(
    eventId: string,
    status: GraphSyncOutboxEvent['status'],
    details?: { attempts?: number; lastError?: string },
  ): Promise<void> {
    const now = new Date().toISOString();
    const update: Record<string, unknown> = {
      $set: {
        status,
        updatedAt: now,
        ...(details?.attempts !== undefined ? { attempts: details.attempts } : {}),
        ...(details?.lastError !== undefined ? { lastError: details.lastError } : {}),
      },
    };
    // Clear lock when done (SYNCED, FAILED, DEAD_LETTER) so retries can reclaim
    if (status !== 'PENDING') {
      (update as { $unset?: Record<string, number> }).$unset = { lockExpiresAt: 1 };
    }
    await this.db.graphSyncOutboxCollection.updateOne({ eventId }, update);
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.db.chunksCollection.deleteMany({ documentId });
    await this.db.graphSyncOutboxCollection.deleteMany({ documentId });
    await this.db.documentsCollection.deleteOne({ documentId });
  }
}
