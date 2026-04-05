import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrometheusModule, makeCounterProvider, makeHistogramProvider } from '@willsoto/nestjs-prometheus';
import { ThrottlerModule } from '@nestjs/throttler';
import { JwtService } from '@nestjs/jwt';
import * as cookieParser from 'cookie-parser';

import {
  ANSWER_GENERATOR_PORT,
  CHAT_HISTORY_REPOSITORY,
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

import { DocumentRecord, DocumentChunk } from '../src/modules/documents/domain/models/document.model';
import { ExtractedGraph } from '../src/modules/graph/domain/models/graph.model';

import { HealthController } from '../src/modules/health/health.controller';
import { DocumentsController } from '../src/modules/documents/presentation/documents.controller';
import { QueryController } from '../src/modules/query/presentation/query.controller';
import { IndexController } from '../src/modules/index/presentation/index.controller';
import { AdminController } from '../src/modules/admin/presentation/admin.controller';

import { IngestDocumentUseCase } from '../src/modules/ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from '../src/modules/documents/application/delete-document.usecase';
import { GenerateDocumentUseCase } from '../src/modules/documents/application/generate-document.usecase';
import { ReindexChunksUseCase } from '../src/modules/ingestion/application/reindex-chunks.usecase';
import { GraphRagQueryUseCase } from '../src/modules/query/application/graph-rag-query.usecase';
import { SummarizeUseCase } from '../src/modules/query/application/summarize.usecase';
import { SimpleChunkerService } from '../src/modules/ingestion/application/simple-chunker.service';
import { PromptTemplateService } from '../src/modules/query/application/prompt-template.service';
import { ChatHistoryRepositoryPort, ChatMessage } from '../src/modules/query/domain/ports/chat-history.repository.port';
import { ChecksumService } from '../src/common/utils/checksum.service';
import { StructuredLogger } from '../src/common/logger/structured-logger.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';
import { AuthModule } from '../src/modules/auth/auth.module';

// ── In-memory Document Repository ──────────────────────────────
export class InMemoryDocumentRepository implements DocumentRepositoryPort {
  documents: DocumentRecord[] = [];
  chunks: DocumentChunk[] = [];

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

  async listAllChunks(limit = 10000, tenantId?: string, libraryId?: string): Promise<DocumentChunk[]> {
    const chunks = this.chunks.filter(
      (chunk) =>
        (!tenantId || chunk.tenantId === tenantId) &&
        (!libraryId || chunk.libraryId === libraryId),
    );
    return chunks.slice(0, limit);
  }

  async listChunksNeedingReindex(
    currentModel: string,
    limit = 10000,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentChunk[]> {
    return this.chunks
      .filter(
        (chunk) =>
          chunk.embeddingModel !== currentModel &&
          (!tenantId || chunk.tenantId === tenantId) &&
          (!libraryId || chunk.libraryId === libraryId),
      )
      .slice(0, limit);
  }

  async updateChunkEmbedding(chunkId: string, embedding: number[], embeddingModel: string): Promise<void> {
    const chunk = this.chunks.find((c) => c.chunkId === chunkId);
    if (chunk) {
      chunk.embedding = embedding;
      chunk.embeddingModel = embeddingModel;
    }
  }

  async listDocuments(limit = 50, libraryId?: string): Promise<DocumentRecord[]> {
    return [...this.documents]
      .filter((document) => !libraryId || document.libraryId === libraryId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async listDocumentsByTenant(
    tenantId: string,
    limit = 50,
    libraryId?: string,
  ): Promise<DocumentRecord[]> {
    return this.documents
      .filter((document) => document.tenantId === tenantId && (!libraryId || document.libraryId === libraryId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async listDocumentsByLibrary(
    libraryId: string,
    tenantId?: string,
    limit = 50,
  ): Promise<DocumentRecord[]> {
    return this.documents
      .filter((document) => document.libraryId === libraryId && (!tenantId || document.tenantId === tenantId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async findDocumentById(documentId: string): Promise<DocumentRecord | null> {
    return this.documents.find((d) => d.documentId === documentId) ?? null;
  }

  async findDocumentByChecksum(
    checksum: string,
    tenantId?: string,
    libraryId?: string,
  ): Promise<DocumentRecord | null> {
    return (
      this.documents.find(
        (document) =>
          document.checksum === checksum &&
          (!tenantId || document.tenantId === tenantId) &&
          (!libraryId || document.libraryId === libraryId),
      ) ??
      null
    );
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.chunks = this.chunks.filter((c) => c.documentId !== documentId);
    this.documents = this.documents.filter((d) => d.documentId !== documentId);
  }

  reset(): void {
    this.documents = [];
    this.chunks = [];
  }
}

// ── Mock GraphStore ────────────────────────────────────────────
export class MockGraphStore implements GraphStorePort {
  async ping(): Promise<void> {}
  async upsertGraph(_graph: ExtractedGraph, _tenantId?: string, _libraryId?: string): Promise<void> {}
  async findEntitiesByNames(_names: string[], _tenantId?: string, _libraryIds?: string[]) {
    return [];
  }
  async findRelationshipsForEntityIds(_ids: string[], _tenantId?: string, _libraryIds?: string[]) {
    return [];
  }
  async deleteByDocumentId(_id: string, _tenantId?: string, _libraryId?: string): Promise<void> {}
  async ensureVectorIndex(_dimensions: number): Promise<void> {}
  async saveChunks(_chunks: any[], _tenantId?: string, _libraryId?: string): Promise<void> {}
  async linkChunksToEntities(_graph: ExtractedGraph): Promise<void> {}
  async deleteChunksByDocumentId(_id: string, _tenantId?: string, _libraryId?: string): Promise<void> {}
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

  async hybridSearch(query: {
    queryText: string;
    topK: number;
    tenantId?: string;
    libraryIds?: string[];
  }): Promise<DocumentChunk[]> {
    const filtered = this.repo.chunks.filter(
      (chunk) =>
        (!query.tenantId || chunk.tenantId === query.tenantId) &&
        (!query.libraryIds?.length || query.libraryIds.includes(chunk.libraryId ?? '')),
    );
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

// ── Mock ChatHistoryRepositoryPort ─────────────────────────────
export class MockChatHistoryRepository implements ChatHistoryRepositoryPort {
  messages: ChatMessage[] = [];

  async saveMessage(message: Omit<ChatMessage, 'createdAt'>): Promise<ChatMessage> {
    const saved = { ...message, createdAt: new Date() };
    this.messages.push(saved);
    return saved;
  }

  async getBySessionId(sessionId: string): Promise<ChatMessage[]> {
    return this.messages.filter((message) => message.sessionId === sessionId);
  }

  async clearSession(sessionId: string): Promise<void> {
    this.messages = this.messages.filter((message) => message.sessionId !== sessionId);
  }

  reset(): void {
    this.messages = [];
  }
}

// ── Test Module Factory ────────────────────────────────────────
export async function createTestApp(overrides?: {
  app?: { enableMultiTenant?: boolean; enableApiKeyAuth?: boolean };
  auth?: { allowedAdminEmails?: string[]; enableDevLogin?: boolean };
}): Promise<{
  app: INestApplication;
  repo: InMemoryDocumentRepository;
  graphStore: MockGraphStore;
  chatHistory: MockChatHistoryRepository;
  jwtService: JwtService;
}> {
  const repo = new InMemoryDocumentRepository();
  const graphStore = new MockGraphStore();
  const chunkSearch = new MockChunkSearch(repo);
  const chatHistory = new MockChatHistoryRepository();

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
              enableApiKeyAuth: overrides?.app?.enableApiKeyAuth ?? false,
              enableMultiTenant: overrides?.app?.enableMultiTenant ?? false,
              corsEnabled: false,
              corsOrigins: [],
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
            auth: {
              enableDevLogin: overrides?.auth?.enableDevLogin ?? false,
              jwtSecret: 'test-auth-secret',
              jwtExpiresIn: '8h',
              cookieName: 'pinky_auth',
              cookieSecure: false,
              cookieSameSite: 'lax',
              successUrl: 'http://localhost:5173',
              failureUrl: 'http://localhost:5173/login?error=unauthorized',
              allowedAdminEmails: overrides?.auth?.allowedAdminEmails ?? [],
              googleClientId: 'test-google-client-id',
              googleClientSecret: 'test-google-client-secret',
              googleCallbackUrl: 'http://localhost:8081/auth/google/callback',
              githubClientId: 'test-github-client-id',
              githubClientSecret: 'test-github-client-secret',
              githubCallbackUrl: 'http://localhost:8081/auth/github/callback',
            },
            neo4j: { uri: 'bolt://localhost:7687', user: 'neo4j', password: 'test' },
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
      AuthModule,
    ],
    controllers: [
      HealthController,
      DocumentsController,
      QueryController,
      IndexController,
      AdminController,
    ],
    providers: [
      IngestDocumentUseCase,
      DeleteDocumentUseCase,
      GenerateDocumentUseCase,
      ReindexChunksUseCase,
      GraphRagQueryUseCase,
      SummarizeUseCase,
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
      { provide: CHAT_HISTORY_REPOSITORY, useValue: chatHistory },
      { provide: DOCUMENT_GENERATOR_PORT, useValue: new MockDocumentGenerator() },
      { provide: FILE_TEXT_EXTRACTOR_PORT, useValue: new MockFileTextExtractor() },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();

  return { app, repo, graphStore, chatHistory, jwtService: moduleRef.get(JwtService) };
}
