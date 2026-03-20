import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { ThrottlerModule } from '@nestjs/throttler';

import {
  ANSWER_GENERATOR_PORT,
  CHUNK_SEARCH_PORT,
  DOCUMENT_GENERATOR_PORT,
  DOCUMENT_REPOSITORY,
  EMBEDDING_PORT,
  FILE_TEXT_EXTRACTOR_PORT,
  GRAPH_EXTRACTOR_PORT,
  GRAPH_STORE_PORT,
} from '../src/shared/di.tokens';

import { DocumentRepositoryPort } from '../src/modules/documents/domain/ports/document-repository.port';
import { GraphStorePort } from '../src/modules/graph/domain/ports/graph-store.port';
import { EmbeddingPort } from '../src/modules/ingestion/domain/ports/embedding.port';
import { GraphExtractorPort } from '../src/modules/ingestion/domain/ports/graph-extractor.port';
import { AnswerGeneratorPort } from '../src/modules/query/domain/ports/answer-generator.port';
import { ChunkSearchPort } from '../src/modules/search/domain/ports/chunk-search.port';
import { DocumentGeneratorPort } from '../src/modules/documents/domain/ports/document-generator.port';
import { FileTextExtractorPort } from '../src/modules/ingestion/domain/ports/file-text-extractor.port';

import { DocumentRecord, DocumentChunk, GraphSyncOutboxEvent } from '../src/modules/documents/domain/models/document.model';
import { ExtractedGraph } from '../src/modules/graph/domain/models/graph.model';

import { HealthController } from '../src/modules/health/health.controller';
import { DocumentsController } from '../src/modules/documents/presentation/documents.controller';
import { QueryController } from '../src/modules/query/presentation/query.controller';
import { OutboxController } from '../src/modules/ingestion/presentation/outbox.controller';
import { IndexController } from '../src/modules/index/presentation/index.controller';

import { IngestDocumentUseCase } from '../src/modules/ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../src/modules/documents/application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../src/modules/documents/application/generate-document.usecase';
import { ReindexChunksUseCase } from '../src/modules/ingestion/application/reindex-chunks.usecase';
import { GraphRagQueryUseCase } from '../src/modules/query/application/graph-rag-query.usecase';
import { GraphSyncRetryService } from '../src/modules/ingestion/application/graph-sync-retry.service';
import { SimpleChunkerService } from '../src/modules/ingestion/application/simple-chunker.service';
import { PromptTemplateService } from '../src/modules/query/application/prompt-template.service';
import { ChecksumService } from '../src/common/utils/checksum.service';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { MongoDatabaseService } from '../src/modules/documents/infrastructure/mongo/mongo-database.service';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

// ── In-memory Document Repository ──────────────────────────────
export class InMemoryDocumentRepository implements DocumentRepositoryPort {
  documents: DocumentRecord[] = [];
  chunks: DocumentChunk[] = [];
  outboxEvents: GraphSyncOutboxEvent[] = [];

  async createDocument(input: Omit<DocumentRecord, 'createdAt' | 'updatedAt'>): Promise<DocumentRecord> {
    const now = new Date().toISOString();
    const doc: DocumentRecord = { ...input, createdAt: now, updatedAt: now };
    this.documents.push(doc);
    return doc;
  }

  async updateDocumentStatus(
    documentId: string,
    status: DocumentRecord['status'],
    graphSyncStatus?: DocumentRecord['graphSyncStatus'],
  ): Promise<void> {
    const doc = this.documents.find((d) => d.documentId === documentId);
    if (doc) {
      doc.status = status;
      if (graphSyncStatus) doc.graphSyncStatus = graphSyncStatus;
      doc.updatedAt = new Date().toISOString();
    }
  }

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    this.chunks.push(...chunks);
  }

  async listAllChunks(limit = 10000, tenantId?: string): Promise<DocumentChunk[]> {
    const chunks = tenantId ? this.chunks.filter((c) => c.tenantId === tenantId) : this.chunks;
    return chunks.slice(0, limit);
  }

  async listChunksNeedingReindex(
    currentModel: string,
    limit = 10000,
    tenantId?: string,
  ): Promise<DocumentChunk[]> {
    return this.chunks
      .filter((c) => c.embeddingModel !== currentModel && (!tenantId || c.tenantId === tenantId))
      .slice(0, limit);
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[], embeddingModel: string): Promise<void> {
    const chunk = this.chunks.find((c) => c.chunkId === chunkId);
    if (chunk) {
      chunk.embedding = embedding;
      chunk.embeddingModel = embeddingModel;
    }
  }

  async listDocuments(limit = 50): Promise<DocumentRecord[]> {
    return [...this.documents].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
  }

  async listDocumentsByTenant(tenantId: string, limit = 50): Promise<DocumentRecord[]> {
    return this.documents
      .filter((d) => d.tenantId === tenantId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async findDocumentById(documentId: string): Promise<DocumentRecord | null> {
    return this.documents.find((d) => d.documentId === documentId) ?? null;
  }

  async findDocumentByChecksum(checksum: string, tenantId?: string): Promise<DocumentRecord | null> {
    return (
      this.documents.find((d) => d.checksum === checksum && (tenantId ? d.tenantId === tenantId : true)) ??
      null
    );
  }

  async enqueueGraphSyncEvent(
    documentId: string,
    graph: ExtractedGraph,
    tenantId?: string,
  ): Promise<GraphSyncOutboxEvent> {
    const event: GraphSyncOutboxEvent = {
      eventId: `evt-${Date.now()}`,
      documentId,
      tenantId,
      payload: JSON.stringify(graph),
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.outboxEvents.push(event);
    return event;
  }

  async claimAndGetNextRetryableEvent(tenantId?: string): Promise<GraphSyncOutboxEvent | null> {
    const event = this.outboxEvents.find(
      (e) => (e.status === 'PENDING' || e.status === 'FAILED') && (!tenantId || e.tenantId === tenantId),
    );
    if (event) {
      event.status = 'PROCESSING';
      event.attempts += 1;
    }
    return event ?? null;
  }

  async markGraphSyncEvent(
    eventId: string,
    status: GraphSyncOutboxEvent['status'],
    details?: { attempts?: number; lastError?: string },
  ): Promise<void> {
    const event = this.outboxEvents.find((e) => e.eventId === eventId);
    if (event) {
      event.status = status;
      if (details?.lastError !== undefined) event.lastError = details.lastError;
    }
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
    this.outboxEvents = this.outboxEvents.filter((e) => e.documentId !== documentId);
    this.documents = this.documents.filter((d) => d.documentId !== documentId);
  }

  reset(): void {
    this.documents = [];
    this.chunks = [];
    this.outboxEvents = [];
  }
}

// ── Mock GraphStore ────────────────────────────────────────────
export class MockGraphStore implements GraphStorePort {
  async ping(): Promise<void> {}
  async upsertGraph(_graph: ExtractedGraph, _tenantId?: string): Promise<void> {}
  async findEntitiesByNames(_names: string[], _tenantId?: string) {
    return [];
  }
  async findRelationshipsForEntityIds(_ids: string[], _tenantId?: string) {
    return [];
  }
  async deleteByDocumentId(_id: string, _tenantId?: string): Promise<void> {}
}

// ── Mock EmbeddingPort ─────────────────────────────────────────
export class MockEmbeddingPort implements EmbeddingPort {
  async embed(_text: string): Promise<number[]> {
    return [0.1, 0.2, 0.3, 0.4, 0.5];
  }
  getModelId(): string {
    return 'mock-embed-model';
  }
}

// ── Mock GraphExtractorPort ────────────────────────────────────
export class MockGraphExtractor implements GraphExtractorPort {
  async extract(documentId: string, _chunks: { chunkId: string; text: string }[]): Promise<ExtractedGraph> {
    return { sourceDocumentId: documentId, entities: [], relationships: [] };
  }
  getModelId(): string {
    return 'mock-extraction-model';
  }
}

// ── Mock AnswerGeneratorPort ───────────────────────────────────
export class MockAnswerGenerator implements AnswerGeneratorPort {
  async generate(input: { prompt: string; sources: { id: string }[] }) {
    return {
      answer: 'Mock answer based on context. [CTX-1]',
      sourcesUsed: input.sources.length > 0 ? [input.sources[0].id] : [],
      model: 'mock-llm',
      tokensUsed: 42,
    };
  }
}

// ── Mock ChunkSearchPort ───────────────────────────────────────
export class MockChunkSearch implements ChunkSearchPort {
  constructor(private readonly repo: InMemoryDocumentRepository) {}

  async hybridSearch(query: { queryText: string; topK: number; tenantId?: string }): Promise<DocumentChunk[]> {
    const filtered = query.tenantId
      ? this.repo.chunks.filter((chunk) => chunk.tenantId === query.tenantId)
      : this.repo.chunks;
    return filtered.slice(0, query.topK);
  }
}

// ── Mock DocumentGeneratorPort ─────────────────────────────────
export class MockDocumentGenerator implements DocumentGeneratorPort {
  async generate(useCaseId: string, params?: Record<string, unknown>): Promise<string> {
    return `Generated content for ${useCaseId}. Params: ${JSON.stringify(params ?? {})}`;
  }
}

// ── Mock FileTextExtractorPort ─────────────────────────────────
export class MockFileTextExtractor implements FileTextExtractorPort {
  async extract(file: { buffer?: Buffer }): Promise<string> {
    return file.buffer?.toString('utf-8') ?? '';
  }
}

// ── Mock MongoDatabaseService (for HealthController) ───────────
export class MockMongoDatabaseService {
  async onModuleInit(): Promise<void> {}
  async onModuleDestroy(): Promise<void> {}
  async ping(): Promise<number> {
    return 1;
  }
}

// ── Test Module Factory ────────────────────────────────────────
export async function createTestApp(overrides?: {
  app?: { enableMultiTenant?: boolean };
}): Promise<{
  app: INestApplication;
  repo: InMemoryDocumentRepository;
  graphStore: MockGraphStore;
}> {
  const repo = new InMemoryDocumentRepository();
  const graphStore = new MockGraphStore();
  const chunkSearch = new MockChunkSearch(repo);

  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        load: [
          () => ({
            app: {
              env: 'test',
              port: 8081,
              apiKey: 'test-api-key',
              enableApiKeyAuth: false,
              enableMultiTenant: overrides?.app?.enableMultiTenant ?? false,
              corsEnabled: false,
              corsOrigins: [],
              searchEngine: 'mongo',
              objectStorePath: './data/objects',
              topK: 8,
              chunkSize: 500,
              chunkOverlap: 50,
              rateLimitTtl: 60000,
              rateLimitGlobal: 1000,
              rateLimitQuery: 1000,
              rateLimitUpload: 1000,
              rateLimitIngest: 1000,
              maxFileSizeMB: 10,
              allowedMimeTypes: ['text/plain'],
              enableChecksumValidation: true,
            },
            mongo: { uri: 'mongodb://localhost:27017/test', dbName: 'test' },
            neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'test' },
            redis: { url: 'redis://localhost:6379' },
            ollama: {
              baseUrl: 'http://localhost:11434',
              embeddingModel: 'mock-embed-model',
              extractionModel: 'mock-extraction-model',
              timeoutMs: 5000,
            },
            llm: {
              provider: 'local',
              openai: { apiKey: '', model: 'gpt-4o-mini', temperature: 0.2, maxTokens: 1000, timeoutMs: 5000 },
              anthropic: { apiKey: '', model: 'claude-3-5-sonnet', temperature: 0.2, maxTokens: 1000, timeoutMs: 5000 },
            },
          }),
        ],
      }),
      PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: false } }),
      ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 1000 }]),
    ],
    controllers: [
      HealthController,
      DocumentsController,
      QueryController,
      OutboxController,
      IndexController,
    ],
    providers: [
      IngestDocumentUseCase,
      DeleteDocumentUseCase,
      GenerateDocumentUseCase,
      ReindexChunksUseCase,
      GraphRagQueryUseCase,
      SimpleChunkerService,
      PromptTemplateService,
      ChecksumService,
      StructuredLogger,
      ApiKeyGuard,
      makeCounterProvider({ name: 'brain_documents_ingested_total', help: 'test' }),
      makeCounterProvider({ name: 'brain_queries_total', help: 'test' }),
      makeCounterProvider({ name: 'brain_query_errors_total', help: 'test' }),
      makeHistogramProvider({ name: 'brain_query_latency_ms', help: 'test', buckets: [100, 500, 1000] }),
      { provide: DOCUMENT_REPOSITORY, useValue: repo },
      { provide: GRAPH_STORE_PORT, useValue: graphStore },
      { provide: EMBEDDING_PORT, useValue: new MockEmbeddingPort() },
      { provide: GRAPH_EXTRACTOR_PORT, useValue: new MockGraphExtractor() },
      { provide: ANSWER_GENERATOR_PORT, useValue: new MockAnswerGenerator() },
      { provide: CHUNK_SEARCH_PORT, useValue: chunkSearch },
      { provide: DOCUMENT_GENERATOR_PORT, useValue: new MockDocumentGenerator() },
      { provide: FILE_TEXT_EXTRACTOR_PORT, useValue: new MockFileTextExtractor() },
      { provide: MongoDatabaseService, useValue: new MockMongoDatabaseService() },
      {
        provide: GraphSyncRetryService,
        useFactory: (docRepo: DocumentRepositoryPort, gs: GraphStorePort) => {
          const service = Object.create(GraphSyncRetryService.prototype);
          service.documentRepository = docRepo;
          service.graphStore = gs;
          service.logger = { log: () => {}, error: () => {}, warn: () => {} };
          service.retry = GraphSyncRetryService.prototype.retry.bind(service);
          service.onModuleInit = () => {};
          service.onModuleDestroy = () => {};
          return service;
        },
        inject: [DOCUMENT_REPOSITORY, GRAPH_STORE_PORT],
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, repo, graphStore };
}
