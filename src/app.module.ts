import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
} from '@willsoto/nestjs-prometheus';
import configuration, { BrainConfig } from './config/configuration';
import { HealthController } from './modules/health/health.controller';
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
  QUERY_DOCUMENT_ANALYTICS_REPOSITORY,
} from './shared/di.tokens';
import { Neo4jConnectionService } from './modules/graph/infrastructure/neo4j/neo4j-connection.service';
import { Neo4jGraphStoreAdapter } from './modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter';
import { VectorIndexInitializerService } from './modules/graph/application/vector-index-initializer.service';
import { Neo4jChunkSearchAdapter } from './modules/search/infrastructure/neo4j/neo4j-chunk-search.adapter';
import { Neo4jDocumentRepository } from './modules/documents/infrastructure/neo4j/neo4j-document.repository';
import { IngestDocumentUseCase } from './modules/ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from './modules/documents/application/delete-document.usecase';
import { GenerateDocumentUseCase } from './modules/documents/application/generate-document.usecase';
import { TemplateDocumentGeneratorAdapter } from './modules/documents/infrastructure/generators/template-document-generator.adapter';
import { ReindexChunksUseCase } from './modules/ingestion/application/reindex-chunks.usecase';
import { GraphRagQueryUseCase } from './modules/query/application/graph-rag-query.usecase';
import { SummarizeUseCase } from './modules/query/application/summarize.usecase';
import { DocumentsController } from './modules/documents/presentation/documents.controller';
import { SimpleChunkerService } from './modules/ingestion/application/simple-chunker.service';
import { DefaultFileTextExtractorAdapter } from './modules/ingestion/infrastructure/extractors/default-file-text-extractor.adapter';
import { OllamaEmbeddingAdapter } from './modules/ingestion/infrastructure/ollama/ollama-embedding.adapter';
import { OllamaGraphExtractorAdapter } from './modules/ingestion/infrastructure/ollama/ollama-graph-extractor.adapter';
import { OpenAiEmbeddingAdapter } from './modules/ingestion/infrastructure/openai/openai-embedding.adapter';
import { OpenAiGraphExtractorAdapter } from './modules/ingestion/infrastructure/openai/openai-graph-extractor.adapter';
import { OllamaAnswerGeneratorAdapter } from './modules/query/infrastructure/ollama/ollama-answer-generator.adapter';
import { LocalAnswerGeneratorAdapter } from './modules/query/infrastructure/local/local-answer-generator.adapter';
import { LocalEmbeddingAdapter } from './modules/ingestion/infrastructure/local/local-embedding.adapter';
import { LocalGraphExtractorAdapter } from './modules/ingestion/infrastructure/local/local-graph-extractor.adapter';
import { OpenAiAnswerGeneratorAdapter } from './modules/query/infrastructure/openai/openai-answer-generator.adapter';
import { AnthropicAnswerGeneratorAdapter } from './modules/query/infrastructure/anthropic/anthropic-answer-generator.adapter';
import { ChunkScoreFilterService } from './modules/query/application/chunk-score-filter.service';
import { PromptBudgetService } from './modules/query/application/prompt-budget.service';
import { PromptTemplateService } from './modules/query/application/prompt-template.service';
import { QueryController } from './modules/query/presentation/query.controller';
import { IndexController } from './modules/index/presentation/index.controller';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { RequireApiKey } from './common/decorators/require-api-key.decorator';
import { FileUploadInterceptor } from './common/interceptors/file-upload.interceptor';
import { ChecksumService } from './common/utils/checksum.service';
import { StructuredLogger } from './common/logger/structured-logger.service';
import { Neo4jChatHistoryRepository } from './modules/query/infrastructure/neo4j/neo4j-chat-history.repository';
import { Neo4jQueryDocumentAnalyticsRepository } from './modules/query/infrastructure/neo4j/neo4j-query-document-analytics.repository';
import { AuthModule } from './modules/auth/auth.module';
import { AdminController } from './modules/admin/presentation/admin.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: { enabled: true },
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<BrainConfig>) => {
        const ttl = configService.get<number>('app.rateLimitTtl', { infer: true }) ?? 60000;
        const globalLimit = configService.get<number>('app.rateLimitGlobal', { infer: true }) ?? 60;
        const queryLimit = configService.get<number>('app.rateLimitQuery', { infer: true }) ?? 5;
        const uploadLimit = configService.get<number>('app.rateLimitUpload', { infer: true }) ?? 3;
        const ingestLimit = configService.get<number>('app.rateLimitIngest', { infer: true }) ?? 5;

        return [
          {
            name: 'default',
            ttl,
            limit: globalLimit,
          },
          {
            name: 'query',
            ttl,
            limit: queryLimit,
          },
          {
            name: 'upload',
            ttl,
            limit: uploadLimit,
          },
          {
            name: 'ingest',
            ttl,
            limit: ingestLimit,
          },
        ];
      },
    }),
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
    Neo4jConnectionService,
    ApiKeyGuard,
    FileUploadInterceptor,
    ChecksumService,
    StructuredLogger,
    makeCounterProvider({
      name: 'brain_documents_ingested_total',
      help: 'Total number of successfully ingested documents.',
    }),
    makeCounterProvider({
      name: 'brain_queries_total',
      help: 'Total number of GraphRAG queries handled.',
    }),
    makeCounterProvider({
      name: 'brain_query_errors_total',
      help: 'Total number of GraphRAG query failures.',
    }),
    makeHistogramProvider({
      name: 'brain_query_latency_ms',
      help: 'GraphRAG query execution latency in milliseconds.',
      buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
    }),
    IngestDocumentUseCase,
    DeleteDocumentUseCase,
    GenerateDocumentUseCase,
    ReindexChunksUseCase,
    GraphRagQueryUseCase,
    SummarizeUseCase,
    SimpleChunkerService,
    ChunkScoreFilterService,
    PromptBudgetService,
    PromptTemplateService,
    VectorIndexInitializerService,
    Neo4jDocumentRepository,
    Neo4jChunkSearchAdapter,
    Neo4jChatHistoryRepository,
    Neo4jQueryDocumentAnalyticsRepository,
    DefaultFileTextExtractorAdapter,
    TemplateDocumentGeneratorAdapter,
    LocalAnswerGeneratorAdapter,
    OpenAiAnswerGeneratorAdapter,
    AnthropicAnswerGeneratorAdapter,
    LocalEmbeddingAdapter,
    LocalGraphExtractorAdapter,
    OpenAiEmbeddingAdapter,
    OpenAiGraphExtractorAdapter,
    OllamaEmbeddingAdapter,
    OllamaGraphExtractorAdapter,
    OllamaAnswerGeneratorAdapter,
    {
      provide: CHAT_HISTORY_REPOSITORY,
      useExisting: Neo4jChatHistoryRepository,
    },
    {
      provide: QUERY_DOCUMENT_ANALYTICS_REPOSITORY,
      useExisting: Neo4jQueryDocumentAnalyticsRepository,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: DOCUMENT_REPOSITORY,
      useExisting: Neo4jDocumentRepository,
    },
    {
      provide: CHUNK_SEARCH_PORT,
      useExisting: Neo4jChunkSearchAdapter,
    },
    {
      provide: GRAPH_STORE_PORT,
      useClass: Neo4jGraphStoreAdapter,
    },
    {
      provide: FILE_TEXT_EXTRACTOR_PORT,
      useExisting: DefaultFileTextExtractorAdapter,
    },
    {
      provide: ANSWER_GENERATOR_PORT,
      inject: [
        ConfigService,
        LocalAnswerGeneratorAdapter,
        OpenAiAnswerGeneratorAdapter,
        AnthropicAnswerGeneratorAdapter,
        OllamaAnswerGeneratorAdapter,
      ],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        localAdapter: LocalAnswerGeneratorAdapter,
        openaiAdapter: OpenAiAnswerGeneratorAdapter,
        anthropicAdapter: AnthropicAnswerGeneratorAdapter,
        ollamaAdapter: OllamaAnswerGeneratorAdapter,
      ) => {
        const llmProvider = configService.get<'local' | 'openai' | 'anthropic' | 'ollama'>('llm.provider', {
          infer: true,
        });

        console.log(`[AppModule] Selected LLM Provider: ${llmProvider}`);

        switch (llmProvider) {
          case 'openai':
            return openaiAdapter;
          case 'anthropic':
            return anthropicAdapter;
          case 'ollama':
            return ollamaAdapter;
          case 'local':
          default:
            return localAdapter;
        }
      },
    },
    {
      provide: EMBEDDING_PORT,
      inject: [
        ConfigService,
        OllamaEmbeddingAdapter,
        LocalEmbeddingAdapter,
        OpenAiEmbeddingAdapter,
      ],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        ollamaAdapter: OllamaEmbeddingAdapter,
        localAdapter: LocalEmbeddingAdapter,
        openaiAdapter: OpenAiEmbeddingAdapter,
      ) => {
        const llmProvider = configService.get<
          'local' | 'openai' | 'anthropic' | 'ollama'
        >('llm.provider', {
          infer: true,
        });
        switch (llmProvider) {
          case 'local':
            return localAdapter;
          case 'openai':
            return openaiAdapter;
          case 'anthropic':
          case 'ollama':
          default:
            return ollamaAdapter;
        }
      },
    },
    {
      provide: GRAPH_EXTRACTOR_PORT,
      inject: [
        ConfigService,
        OllamaGraphExtractorAdapter,
        LocalGraphExtractorAdapter,
        OpenAiGraphExtractorAdapter,
      ],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        ollamaAdapter: OllamaGraphExtractorAdapter,
        localAdapter: LocalGraphExtractorAdapter,
        openaiAdapter: OpenAiGraphExtractorAdapter,
      ) => {
        const llmProvider = configService.get<
          'local' | 'openai' | 'anthropic' | 'ollama'
        >('llm.provider', {
          infer: true,
        });
        switch (llmProvider) {
          case 'local':
            return localAdapter;
          case 'openai':
            return openaiAdapter;
          case 'anthropic':
          case 'ollama':
          default:
            return ollamaAdapter;
        }
      },
    },
    {
      provide: DOCUMENT_GENERATOR_PORT,
      useExisting: TemplateDocumentGeneratorAdapter,
    },
  ],
})
export class AppModule implements OnModuleInit {
  private readonly logger = new Logger(AppModule.name);

  constructor(private readonly vectorIndexInitializer: VectorIndexInitializerService) {}

  onModuleInit(): void {
    this.logger.log('Initializing Neo4j vector index for chunk embeddings...');
    // Fire-and-forget: a hanging or unreachable gateway must not delay nor
    // kill the boot; the initializer retries in background and the service
    // starts degraded until the index is ready.
    void this.vectorIndexInitializer.initialize();
  }
}
