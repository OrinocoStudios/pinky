# Pinky — Port Interfaces Reference

## Document Repository (`DOCUMENT_REPOSITORY`)

```typescript
interface DocumentRepositoryPort {
  createDocument(input: Omit<DocumentRecord, 'createdAt' | 'updatedAt'>): Promise<DocumentRecord>;
  updateDocumentStatus(documentId: string, status: DocumentStatus, graphSyncStatus?: GraphSyncStatus): Promise<void>;
  addChunks(chunks: DocumentChunk[]): Promise<void>;
  listAllChunks(limit?: number, tenantId?: string, libraryId?: string): Promise<DocumentChunk[]>;
  listChunksNeedingReindex(currentModel: string, limit?: number, tenantId?: string, libraryId?: string): Promise<DocumentChunk[]>;
  updateChunkEmbedding(chunkId: string, embedding: number[], embeddingModel: string): Promise<void>;
  listDocuments(limit?: number, libraryId?: string): Promise<DocumentRecord[]>;
  listDocumentsByTenant(tenantId: string, limit?: number, libraryId?: string): Promise<DocumentRecord[]>;
  listDocumentsByLibrary(libraryId: string, tenantId?: string, limit?: number): Promise<DocumentRecord[]>;
  findDocumentById(documentId: string): Promise<DocumentRecord | null>;
  findDocumentByChecksum(checksum: string, tenantId?: string, libraryId?: string): Promise<DocumentRecord | null>;
  enqueueGraphSyncEvent(documentId: string, graph: ExtractedGraph, tenantId?: string, libraryId?: string): Promise<GraphSyncOutboxEvent>;
  claimAndGetNextRetryableEvent(tenantId?: string, libraryId?: string): Promise<GraphSyncOutboxEvent | null>;
  markGraphSyncEvent(eventId: string, status: OutboxEventStatus, details?: { attempts?: number; lastError?: string }): Promise<void>;
  deleteDocument(documentId: string): Promise<void>;
}
```

## Graph Store (`GRAPH_STORE_PORT`)

```typescript
interface GraphStorePort {
  ping(): Promise<void>;
  upsertGraph(graph: ExtractedGraph, tenantId?: string, libraryId?: string): Promise<void>;
  findEntitiesByNames(names: string[], tenantId?: string, libraryIds?: string[]): Promise<GraphEntity[]>;
  findRelationshipsForEntityIds(entityIds: string[], tenantId?: string, libraryIds?: string[]): Promise<GraphRelationship[]>;
  deleteByDocumentId(documentId: string, tenantId?: string, libraryId?: string): Promise<void>;
}
```

## Chunk Search (`CHUNK_SEARCH_PORT`)

```typescript
interface ChunkSearchQuery {
  queryText: string;
  topK: number;
  tenantId?: string;
  libraryIds?: string[];
}

interface ChunkSearchPort {
  hybridSearch(query: ChunkSearchQuery): Promise<DocumentChunk[]>;
}
```

## Embedding (`EMBEDDING_PORT`)

```typescript
interface EmbeddingPort {
  embed(text: string): Promise<number[]>;
  getModelId(): string;
}
```

## Graph Extractor (`GRAPH_EXTRACTOR_PORT`)

```typescript
interface GraphExtractorPort {
  extract(documentId: string, chunks: ChunkInput[]): Promise<ExtractedGraph>;
  getModelId(): string;
}
```

## Answer Generator (`ANSWER_GENERATOR_PORT`)

```typescript
interface AnswerGeneratorPort {
  generate(input: GenerateAnswerInput): Promise<GenerateAnswerOutput>;
}

type GenerateAnswerInput = {
  prompt: string;
  sources: AnswerSource[];
  maxTokens?: number;
};

type GenerateAnswerOutput = {
  answer: string;
  sourcesUsed: string[];
  model?: string;
  tokensUsed?: number;
};
```

## File Text Extractor (`FILE_TEXT_EXTRACTOR_PORT`)

```typescript
interface FileTextExtractorPort {
  extract(file: { buffer?: Buffer; mimetype?: string; originalname?: string }): Promise<string>;
}
```

## Document Generator (`DOCUMENT_GENERATOR_PORT`)

```typescript
interface DocumentGeneratorPort {
  generate(useCaseId: string, params?: Record<string, unknown>): Promise<string>;
}
```
