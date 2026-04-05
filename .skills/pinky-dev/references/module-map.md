# Pinky — Module Map

## Source layout

```
src/
├── main.ts                          # Bootstrap, CORS, global pipes/filters
├── app.module.ts                    # Root module — all DI wiring
├── config/configuration.ts          # BrainConfig type + env loader
├── shared/di.tokens.ts              # All DI Symbol tokens
├── common/
│   ├── guards/api-key.guard.ts      # X-API-Key validation
│   ├── decorators/require-api-key.decorator.ts
│   ├── filters/http-exception.filter.ts
│   ├── filters/all-exceptions.filter.ts
│   ├── interceptors/file-upload.interceptor.ts
│   ├── logger/structured-logger.service.ts
│   └── utils/checksum.service.ts    # SHA-256 for idempotency
│
├── modules/
│   ├── documents/                   # Document CRUD + management
│   │   ├── domain/models/document.model.ts      # DocumentRecord, DocumentChunk, GraphSyncOutboxEvent
│   │   ├── domain/ports/document-repository.port.ts
│   │   ├── domain/ports/document-generator.port.ts
│   │   ├── application/delete-document.usecase.ts
│   │   ├── application/generate-document.usecase.ts
│   │   ├── infrastructure/mongo/mongo-database.service.ts    # Connection + indexes
│   │   ├── infrastructure/mongo/mongo-document.repository.ts
│   │   ├── infrastructure/generators/template-document-generator.adapter.ts
│   │   └── presentation/documents.controller.ts + documents.dto.ts
│   │
│   ├── ingestion/                   # Document ingestion pipeline
│   │   ├── domain/ports/embedding.port.ts
│   │   ├── domain/ports/graph-extractor.port.ts
│   │   ├── domain/ports/file-text-extractor.port.ts
│   │   ├── application/ingest-document.usecase.ts       # Main ingestion orchestrator
│   │   ├── application/simple-chunker.service.ts
│   │   ├── application/reindex-chunks.usecase.ts
│   │   ├── application/graph-sync-retry.service.ts      # Outbox retry worker (30s interval)
│   │   ├── infrastructure/ollama/ollama-embedding.adapter.ts
│   │   ├── infrastructure/ollama/ollama-graph-extractor.adapter.ts
│   │   ├── infrastructure/extractors/default-file-text-extractor.adapter.ts
│   │   └── presentation/outbox.controller.ts + retry-outbox.dto.ts
│   │
│   ├── query/                       # GraphRAG query pipeline
│   │   ├── domain/ports/answer-generator.port.ts
│   │   ├── application/graph-rag-query.usecase.ts       # Main query orchestrator
│   │   ├── application/prompt-template.service.ts       # Grounded prompt builder
│   │   ├── infrastructure/local/local-answer-generator.adapter.ts     # Placeholder
│   │   ├── infrastructure/openai/openai-answer-generator.adapter.ts
│   │   ├── infrastructure/anthropic/anthropic-answer-generator.adapter.ts
│   │   └── presentation/query.controller.ts + query.dto.ts
│   │
│   ├── search/                      # Chunk search abstraction
│   │   ├── domain/ports/chunk-search.port.ts
│   │   ├── infrastructure/mongo/mongo-chunk-search.adapter.ts          # Brute-force hybrid
│   │   └── infrastructure/elasticsearch/elasticsearch-chunk-search.adapter.ts  # Stub
│   │
│   ├── graph/                       # Knowledge graph abstraction
│   │   ├── domain/models/graph.model.ts    # GraphEntity, GraphRelationship, ExtractedGraph
│   │   ├── domain/ports/graph-store.port.ts
│   │   └── infrastructure/neo4j/neo4j-graph-store.adapter.ts
│   │
│   ├── health/health.controller.ts  # GET /health
│   └── index/                       # Reindex endpoints
│       └── presentation/index.controller.ts + index.dto.ts
│
├── scripts/reindex-chunks.ts        # CLI reindex script
└── types/pdf-parse.d.ts
```

## DI tokens → adapters (app.module.ts)

| Token | Default adapter | Selection |
|-------|----------------|-----------|
| `DOCUMENT_REPOSITORY` | `Neo4jDocumentRepository` | Fixed |
| `CHUNK_SEARCH_PORT` | `Neo4jChunkSearchAdapter` | Fixed |
| `GRAPH_STORE_PORT` | `Neo4jGraphStoreAdapter` | Fixed |
| `EMBEDDING_PORT` | `OllamaEmbeddingAdapter` | Fixed |
| `GRAPH_EXTRACTOR_PORT` | `OllamaGraphExtractorAdapter` | Fixed |
| `ANSWER_GENERATOR_PORT` | `LocalAnswerGeneratorAdapter` | `LLM_PROVIDER` config (local/openai/anthropic) |
| `FILE_TEXT_EXTRACTOR_PORT` | `DefaultFileTextExtractorAdapter` | Fixed |
| `DOCUMENT_GENERATOR_PORT` | `TemplateDocumentGeneratorAdapter` | Fixed |

## Test infrastructure

```
test/
├── test-helpers.ts          # InMemoryDocumentRepository, MockGraphStore, MockChunkSearch, etc.
├── documents.e2e-spec.ts    # Document CRUD tests
├── query.e2e-spec.ts        # Query + library scoping tests
├── multi-tenant.e2e-spec.ts # Tenant isolation tests
├── health.e2e-spec.ts       # Health endpoint test
└── outbox-index.e2e-spec.ts # Reindex tests
```
