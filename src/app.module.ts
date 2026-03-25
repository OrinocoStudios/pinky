import { Module } from '@nestjs/common';
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
  CHUNK_SEARCH_PORT,
  DOCUMENT_GENERATOR_PORT,
  DOCUMENT_REPOSITORY,
  EMBEDDING_PORT,
  FILE_TEXT_EXTRACTOR_PORT,
  GRAPH_EXTRACTOR_PORT,
  GRAPH_STORE_PORT,
} from './shared/di.tokens';
import { MongoDocumentRepository } from './modules/documents/infrastructure/mongo/mongo-document.repository';
import { MongoChunkSearchAdapter } from './modules/search/infrastructure/mongo/mongo-chunk-search.adapter';
import { ElasticsearchChunkSearchAdapter } from './modules/search/infrastructure/elasticsearch/elasticsearch-chunk-search.adapter';
import { Neo4jGraphStoreAdapter } from './modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter';
import { IngestDocumentUseCase } from './modules/ingestion/application/ingest-document.usecase';
import { DeleteDocumentUseCase } from './modules/documents/application/delete-document.usecase';
import { GenerateDocumentUseCase } from './modules/documents/application/generate-document.usecase';
import { TemplateDocumentGeneratorAdapter } from './modules/documents/infrastructure/generators/template-document-generator.adapter';
import { ReindexChunksUseCase } from './modules/ingestion/application/reindex-chunks.usecase';
import { GraphRagQueryUseCase } from './modules/query/application/graph-rag-query.usecase';
import { SummarizeUseCase } from './modules/query/application/summarize.usecase';
import { DocumentsController } from './modules/documents/presentation/documents.controller';
import { MongoDatabaseService } from './modules/documents/infrastructure/mongo/mongo-database.service';
import { SimpleChunkerService } from './modules/ingestion/application/simple-chunker.service';
import { DefaultFileTextExtractorAdapter } from './modules/ingestion/infrastructure/extractors/default-file-text-extractor.adapter';
import { OllamaEmbeddingAdapter } from './modules/ingestion/infrastructure/ollama/ollama-embedding.adapter';
import { OllamaGraphExtractorAdapter } from './modules/ingestion/infrastructure/ollama/ollama-graph-extractor.adapter';
import { OllamaAnswerGeneratorAdapter } from './modules/query/infrastructure/ollama/ollama-answer-generator.adapter';
import { LocalAnswerGeneratorAdapter } from './modules/query/infrastructure/local/local-answer-generator.adapter';
import { LocalEmbeddingAdapter } from './modules/ingestion/infrastructure/local/local-embedding.adapter';
import { LocalGraphExtractorAdapter } from './modules/ingestion/infrastructure/local/local-graph-extractor.adapter';
import { OpenAiAnswerGeneratorAdapter } from './modules/query/infrastructure/openai/openai-answer-generator.adapter';
import { AnthropicAnswerGeneratorAdapter } from './modules/query/infrastructure/anthropic/anthropic-answer-generator.adapter';
import { PromptTemplateService } from './modules/query/application/prompt-template.service';
import { QueryController } from './modules/query/presentation/query.controller';
import { GraphSyncRetryService } from './modules/ingestion/application/graph-sync-retry.service';
import { OutboxController } from './modules/ingestion/presentation/outbox.controller';
import { IndexController } from './modules/index/presentation/index.controller';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { RequireApiKey } from './common/decorators/require-api-key.decorator';
import { FileUploadInterceptor } from './common/interceptors/file-upload.interceptor';
import { ChecksumService } from './common/utils/checksum.service';
import { StructuredLogger } from './common/logger/structured-logger.service';

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
        const globalLimit = configService.get<number>('app.rateLimitGlobal', { infer: true }) ?? 10;
        const queryLimit = configService.get<number>('app.rateLimitQuery', { infer: true }) ?? 5;
        const uploadLimit = configService.get<number>('app.rateLimitUpload', { infer: true }) ?? 3;

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
        ];
      },
    }),
  ],
  controllers: [
    HealthController,
    DocumentsController,
    QueryController,
    OutboxController,
    IndexController,
  ],
  providers: [
    MongoDatabaseService,
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
    GraphSyncRetryService,
    SimpleChunkerService,
    PromptTemplateService,
    MongoChunkSearchAdapter,
    ElasticsearchChunkSearchAdapter,
    DefaultFileTextExtractorAdapter,
    TemplateDocumentGeneratorAdapter,
    LocalAnswerGeneratorAdapter,
    OpenAiAnswerGeneratorAdapter,
    AnthropicAnswerGeneratorAdapter,
    LocalEmbeddingAdapter,
    LocalGraphExtractorAdapter,
    OllamaEmbeddingAdapter,
    OllamaGraphExtractorAdapter,
    OllamaAnswerGeneratorAdapter,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: DOCUMENT_REPOSITORY,
      useClass: MongoDocumentRepository,
    },
    {
      provide: CHUNK_SEARCH_PORT,
      inject: [ConfigService, MongoChunkSearchAdapter, ElasticsearchChunkSearchAdapter],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        mongoAdapter: MongoChunkSearchAdapter,
        elasticAdapter: ElasticsearchChunkSearchAdapter,
      ) => {
        const searchEngine = configService.get<'mongo' | 'elasticsearch'>('app.searchEngine', {
          infer: true,
        });
        return searchEngine === 'elasticsearch' ? elasticAdapter : mongoAdapter;
      },
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
      inject: [ConfigService, OllamaEmbeddingAdapter, LocalEmbeddingAdapter],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        ollamaAdapter: OllamaEmbeddingAdapter,
        localAdapter: LocalEmbeddingAdapter,
      ) => {
        const llmProvider = configService.get<'local' | 'openai' | 'anthropic'>('llm.provider', {
          infer: true,
        });
        return llmProvider === 'local' ? localAdapter : ollamaAdapter;
      },
    },
    {
      provide: GRAPH_EXTRACTOR_PORT,
      inject: [ConfigService, OllamaGraphExtractorAdapter, LocalGraphExtractorAdapter],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        ollamaAdapter: OllamaGraphExtractorAdapter,
        localAdapter: LocalGraphExtractorAdapter,
      ) => {
        const llmProvider = configService.get<'local' | 'openai' | 'anthropic'>('llm.provider', {
          infer: true,
        });
        return llmProvider === 'local' ? localAdapter : ollamaAdapter;
      },
    },
    {
      provide: DOCUMENT_GENERATOR_PORT,
      useExisting: TemplateDocumentGeneratorAdapter,
    },
  ],
})
export class AppModule {}
