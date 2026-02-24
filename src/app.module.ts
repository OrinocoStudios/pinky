import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import configuration, { BrainConfig } from './config/configuration';
import { AppController } from './app.controller';
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
import { DocumentsController } from './modules/documents/presentation/documents.controller';
import { MongoDatabaseService } from './modules/documents/infrastructure/mongo/mongo-database.service';
import { SimpleChunkerService } from './modules/ingestion/application/simple-chunker.service';
import { DefaultFileTextExtractorAdapter } from './modules/ingestion/infrastructure/extractors/default-file-text-extractor.adapter';
import { OllamaEmbeddingAdapter } from './modules/ingestion/infrastructure/ollama/ollama-embedding.adapter';
import { OllamaGraphExtractorAdapter } from './modules/ingestion/infrastructure/ollama/ollama-graph-extractor.adapter';
import { LocalAnswerGeneratorAdapter } from './modules/query/infrastructure/local/local-answer-generator.adapter';
import { OpenAiAnswerGeneratorAdapter } from './modules/query/infrastructure/openai/openai-answer-generator.adapter';
import { AnthropicAnswerGeneratorAdapter } from './modules/query/infrastructure/anthropic/anthropic-answer-generator.adapter';
import { PromptTemplateService } from './modules/query/application/prompt-template.service';
import { QueryController } from './modules/query/presentation/query.controller';
import { GraphSyncRetryService } from './modules/ingestion/application/graph-sync-retry.service';
import { OutboxController } from './modules/ingestion/presentation/outbox.controller';
import { IndexController } from './modules/index/presentation/index.controller';
import { ApiKeyGuard } from './common/guards/api-key.guard';
import { RequireApiKey } from './common/decorators/require-api-key.decorator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 3,
      },
    ]),
  ],
  controllers: [AppController, DocumentsController, QueryController, OutboxController, IndexController],
  providers: [
    ApiKeyGuard,
    IngestDocumentUseCase,
    DeleteDocumentUseCase,
    GenerateDocumentUseCase,
    ReindexChunksUseCase,
    GraphRagQueryUseCase,
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
    OllamaEmbeddingAdapter,
    OllamaGraphExtractorAdapter,
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
      ],
      useFactory: (
        configService: ConfigService<BrainConfig>,
        localAdapter: LocalAnswerGeneratorAdapter,
        openaiAdapter: OpenAiAnswerGeneratorAdapter,
        anthropicAdapter: AnthropicAnswerGeneratorAdapter,
      ) => {
        const llmProvider = configService.get<'local' | 'openai' | 'anthropic'>('llm.provider', {
          infer: true,
        });

        switch (llmProvider) {
          case 'openai':
            return openaiAdapter;
          case 'anthropic':
            return anthropicAdapter;
          case 'local':
          default:
            return localAdapter;
        }
      },
    },
    {
      provide: EMBEDDING_PORT,
      useExisting: OllamaEmbeddingAdapter,
    },
    {
      provide: GRAPH_EXTRACTOR_PORT,
      useExisting: OllamaGraphExtractorAdapter,
    },
    {
      provide: DOCUMENT_GENERATOR_PORT,
      useExisting: TemplateDocumentGeneratorAdapter,
    },
  ],
})
export class AppModule {}
