"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const config_1 = require("@nestjs/config");
const throttler_1 = require("@nestjs/throttler");
const nestjs_prometheus_1 = require("@willsoto/nestjs-prometheus");
const configuration_1 = require("./config/configuration");
const health_controller_1 = require("./modules/health/health.controller");
const di_tokens_1 = require("./shared/di.tokens");
const mongo_document_repository_1 = require("./modules/documents/infrastructure/mongo/mongo-document.repository");
const mongo_chunk_search_adapter_1 = require("./modules/search/infrastructure/mongo/mongo-chunk-search.adapter");
const elasticsearch_chunk_search_adapter_1 = require("./modules/search/infrastructure/elasticsearch/elasticsearch-chunk-search.adapter");
const neo4j_graph_store_adapter_1 = require("./modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter");
const ingest_document_usecase_1 = require("./modules/ingestion/application/ingest-document.usecase");
const delete_document_usecase_1 = require("./modules/documents/application/delete-document.usecase");
const generate_document_usecase_1 = require("./modules/documents/application/generate-document.usecase");
const template_document_generator_adapter_1 = require("./modules/documents/infrastructure/generators/template-document-generator.adapter");
const reindex_chunks_usecase_1 = require("./modules/ingestion/application/reindex-chunks.usecase");
const graph_rag_query_usecase_1 = require("./modules/query/application/graph-rag-query.usecase");
const documents_controller_1 = require("./modules/documents/presentation/documents.controller");
const mongo_database_service_1 = require("./modules/documents/infrastructure/mongo/mongo-database.service");
const simple_chunker_service_1 = require("./modules/ingestion/application/simple-chunker.service");
const default_file_text_extractor_adapter_1 = require("./modules/ingestion/infrastructure/extractors/default-file-text-extractor.adapter");
const ollama_embedding_adapter_1 = require("./modules/ingestion/infrastructure/ollama/ollama-embedding.adapter");
const ollama_graph_extractor_adapter_1 = require("./modules/ingestion/infrastructure/ollama/ollama-graph-extractor.adapter");
const local_answer_generator_adapter_1 = require("./modules/query/infrastructure/local/local-answer-generator.adapter");
const openai_answer_generator_adapter_1 = require("./modules/query/infrastructure/openai/openai-answer-generator.adapter");
const anthropic_answer_generator_adapter_1 = require("./modules/query/infrastructure/anthropic/anthropic-answer-generator.adapter");
const prompt_template_service_1 = require("./modules/query/application/prompt-template.service");
const query_controller_1 = require("./modules/query/presentation/query.controller");
const graph_sync_retry_service_1 = require("./modules/ingestion/application/graph-sync-retry.service");
const outbox_controller_1 = require("./modules/ingestion/presentation/outbox.controller");
const index_controller_1 = require("./modules/index/presentation/index.controller");
const api_key_guard_1 = require("./common/guards/api-key.guard");
const file_upload_interceptor_1 = require("./common/interceptors/file-upload.interceptor");
const checksum_service_1 = require("./common/utils/checksum.service");
const structured_logger_service_1 = require("./common/logger/structured-logger.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                load: [configuration_1.default],
            }),
            nestjs_prometheus_1.PrometheusModule.register({
                path: '/metrics',
                defaultMetrics: { enabled: true },
            }),
            throttler_1.ThrottlerModule.forRootAsync({
                inject: [config_1.ConfigService],
                useFactory: (configService) => {
                    const ttl = configService.get('app.rateLimitTtl', { infer: true }) ?? 60000;
                    const globalLimit = configService.get('app.rateLimitGlobal', { infer: true }) ?? 10;
                    const queryLimit = configService.get('app.rateLimitQuery', { infer: true }) ?? 5;
                    const uploadLimit = configService.get('app.rateLimitUpload', { infer: true }) ?? 3;
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
            health_controller_1.HealthController,
            documents_controller_1.DocumentsController,
            query_controller_1.QueryController,
            outbox_controller_1.OutboxController,
            index_controller_1.IndexController,
        ],
        providers: [
            mongo_database_service_1.MongoDatabaseService,
            api_key_guard_1.ApiKeyGuard,
            file_upload_interceptor_1.FileUploadInterceptor,
            checksum_service_1.ChecksumService,
            structured_logger_service_1.StructuredLogger,
            (0, nestjs_prometheus_1.makeCounterProvider)({
                name: 'brain_documents_ingested_total',
                help: 'Total number of successfully ingested documents.',
            }),
            (0, nestjs_prometheus_1.makeCounterProvider)({
                name: 'brain_queries_total',
                help: 'Total number of GraphRAG queries handled.',
            }),
            (0, nestjs_prometheus_1.makeCounterProvider)({
                name: 'brain_query_errors_total',
                help: 'Total number of GraphRAG query failures.',
            }),
            (0, nestjs_prometheus_1.makeHistogramProvider)({
                name: 'brain_query_latency_ms',
                help: 'GraphRAG query execution latency in milliseconds.',
                buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
            }),
            ingest_document_usecase_1.IngestDocumentUseCase,
            delete_document_usecase_1.DeleteDocumentUseCase,
            generate_document_usecase_1.GenerateDocumentUseCase,
            reindex_chunks_usecase_1.ReindexChunksUseCase,
            graph_rag_query_usecase_1.GraphRagQueryUseCase,
            graph_sync_retry_service_1.GraphSyncRetryService,
            simple_chunker_service_1.SimpleChunkerService,
            prompt_template_service_1.PromptTemplateService,
            mongo_chunk_search_adapter_1.MongoChunkSearchAdapter,
            elasticsearch_chunk_search_adapter_1.ElasticsearchChunkSearchAdapter,
            default_file_text_extractor_adapter_1.DefaultFileTextExtractorAdapter,
            template_document_generator_adapter_1.TemplateDocumentGeneratorAdapter,
            local_answer_generator_adapter_1.LocalAnswerGeneratorAdapter,
            openai_answer_generator_adapter_1.OpenAiAnswerGeneratorAdapter,
            anthropic_answer_generator_adapter_1.AnthropicAnswerGeneratorAdapter,
            ollama_embedding_adapter_1.OllamaEmbeddingAdapter,
            ollama_graph_extractor_adapter_1.OllamaGraphExtractorAdapter,
            {
                provide: core_1.APP_GUARD,
                useClass: throttler_1.ThrottlerGuard,
            },
            {
                provide: di_tokens_1.DOCUMENT_REPOSITORY,
                useClass: mongo_document_repository_1.MongoDocumentRepository,
            },
            {
                provide: di_tokens_1.CHUNK_SEARCH_PORT,
                inject: [config_1.ConfigService, mongo_chunk_search_adapter_1.MongoChunkSearchAdapter, elasticsearch_chunk_search_adapter_1.ElasticsearchChunkSearchAdapter],
                useFactory: (configService, mongoAdapter, elasticAdapter) => {
                    const searchEngine = configService.get('app.searchEngine', {
                        infer: true,
                    });
                    return searchEngine === 'elasticsearch' ? elasticAdapter : mongoAdapter;
                },
            },
            {
                provide: di_tokens_1.GRAPH_STORE_PORT,
                useClass: neo4j_graph_store_adapter_1.Neo4jGraphStoreAdapter,
            },
            {
                provide: di_tokens_1.FILE_TEXT_EXTRACTOR_PORT,
                useExisting: default_file_text_extractor_adapter_1.DefaultFileTextExtractorAdapter,
            },
            {
                provide: di_tokens_1.ANSWER_GENERATOR_PORT,
                inject: [
                    config_1.ConfigService,
                    local_answer_generator_adapter_1.LocalAnswerGeneratorAdapter,
                    openai_answer_generator_adapter_1.OpenAiAnswerGeneratorAdapter,
                    anthropic_answer_generator_adapter_1.AnthropicAnswerGeneratorAdapter,
                ],
                useFactory: (configService, localAdapter, openaiAdapter, anthropicAdapter) => {
                    const llmProvider = configService.get('llm.provider', {
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
                provide: di_tokens_1.EMBEDDING_PORT,
                useExisting: ollama_embedding_adapter_1.OllamaEmbeddingAdapter,
            },
            {
                provide: di_tokens_1.GRAPH_EXTRACTOR_PORT,
                useExisting: ollama_graph_extractor_adapter_1.OllamaGraphExtractorAdapter,
            },
            {
                provide: di_tokens_1.DOCUMENT_GENERATOR_PORT,
                useExisting: template_document_generator_adapter_1.TemplateDocumentGeneratorAdapter,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map