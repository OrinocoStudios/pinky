import { DocumentRepositoryPort } from '../../domain/ports/document-repository.port';
import { DocumentChunk, DocumentRecord, GraphSyncOutboxEvent } from '../../domain/models/document.model';
import { MongoDatabaseService } from './mongo-database.service';
import { ExtractedGraph } from '../../../graph/domain/models/graph.model';
export declare class MongoDocumentRepository implements DocumentRepositoryPort {
    private readonly db;
    constructor(db: MongoDatabaseService);
    createDocument(input: Omit<DocumentRecord, 'createdAt' | 'updatedAt'>): Promise<DocumentRecord>;
    updateDocumentStatus(documentId: string, status: DocumentRecord['status'], graphSyncStatus?: DocumentRecord['graphSyncStatus']): Promise<void>;
    addChunks(chunks: DocumentChunk[]): Promise<void>;
    listAllChunks(limit?: number): Promise<DocumentChunk[]>;
    listChunksNeedingReindex(currentEmbeddingModel: string, limit?: number): Promise<DocumentChunk[]>;
    updateChunkEmbedding(chunkId: string, embedding: number[], embeddingModel: string): Promise<void>;
    listDocuments(limit?: number): Promise<DocumentRecord[]>;
    findDocumentById(documentId: string): Promise<DocumentRecord | null>;
    enqueueGraphSyncEvent(documentId: string, graph: ExtractedGraph): Promise<GraphSyncOutboxEvent>;
    getRetryableGraphSyncEvents(limit: number): Promise<GraphSyncOutboxEvent[]>;
    markGraphSyncEvent(eventId: string, status: GraphSyncOutboxEvent['status'], details?: {
        attempts?: number;
        lastError?: string;
    }): Promise<void>;
    deleteDocument(documentId: string): Promise<void>;
}
