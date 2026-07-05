# Changelog - Brain Service

Este registro resume cambios de implementación para mantener contexto operativo y técnico.

---

## 2026-05-02 (Dashboard usage analytics)

### Added

- Agregados de uso en backend para dashboard: ingesta de documentos por dia, top libraries por documentos, distribucion por origen y consultas persistidas por dia/library.
- Campo `usage` en `GET /admin/overview` con series de 14 dias y top 5 libraries.
- Conteo de consultas por documento recuperado (deduplicado por query/documento) y nuevo agregado `usage.documents.byQueryCount` (top 10).
- Persistencia de `tenantId` en `ChatMessage` para mejorar scoping de analitica futura.
- Seccion visual de graficas en dashboard web usando `recharts`, incluyendo gráfico adicional de top documentos por consultas.

### Changed

- `GraphRagQueryUseCase` ahora guarda `tenantId` junto con `sessionId`/`libraryId` al persistir mensajes de chat.
- Contratos frontend (`OverviewResponse`) y mocks de tests actualizados para el nuevo bloque `usage`.
- Documentacion API ampliada con el contrato de `GET /admin/overview`.
- El limite global por defecto sube de 10 a 60 req/min para evitar `429` durante navegacion normal del frontend; los perfiles `query`, `upload` e `ingest` mantienen sus limites especificos.
- Los perfiles de `@nestjs/throttler` quedan aislados por tipo de endpoint para que lecturas/auth/admin no consuman cuota de `query`, y el MCP no quede bloqueado por throttles ajenos al sincronizar documentos.

---

## 2026-04-04 (Neo4j-only persistence)

### Added

- `Neo4jDocumentRepository` como repositorio unico de `Document` y `Chunk`.
- `Neo4jChatHistoryRepository` para persistir historial de chat sin MongoDB.
- Indices y constraints de Neo4j para `Document`, `Chunk` y `ChatMessage`.

### Changed

- El runtime paso a Neo4j-only: `DOCUMENT_REPOSITORY`, `CHAT_HISTORY_REPOSITORY`, busqueda vectorial y health operan sobre Neo4j.
- La ingesta ya no persiste chunks por un camino Mongo ni depende de sincronizacion por outbox.
- `GET /health` ahora reporta Neo4j + configuracion LLM.
- `docker-compose.yml`, `docker-compose.prod.yml` y `.env.example` se simplificaron para no requerir MongoDB ni Redis.

### Removed

- Dependencia `mongoose`.
- Adaptadores Mongo (`MongoDocumentRepository`, `MongoChatHistoryRepository`, `MongoChunkSearchAdapter`, `MongoDatabaseService`).
- Referencias operativas a outbox como parte del flujo vigente.

---

## 2026-03-29 (Clinical traceability contract for Convit MVP)

### Added

- Metadata documental enriquecida en `fastContext` de `POST /query`: `documentId`, `title`, `libraryId` y `metadata` para permitir que el engine resuelva el original clínico.
- Documentación del contrato de respuesta actualizada en `docs/API_REFERENCE.md` para reflejar la trazabilidad consumida por el cliente clínico.

### Changed

- La integración con Convit ahora devuelve suficiente contexto estructurado para mapear chunks del brain a documentos del hospital sin inferencias adicionales en el frontend.
- El servicio puede operar contra un gateway OpenAI-compatible remoto para respuestas, embeddings y extracción de grafo mediante `OPENAI_BASE_URL`.

### Notes

- El servicio sigue siendo agnóstico al dominio: el significado de `libraryId` y de la metadata clínica sigue definido por el engine.

---

## 2026-03-21 (Library Scoping — libraryId)

### Added

- `libraryId` opcional en `DocumentRecord`, `DocumentChunk` y `GraphSyncOutboxEvent`.
- Header `X-Library-Id` aceptado en todos los endpoints de corpus (documents, query, index, outbox).
- `libraryIds: string[]` en el body de `POST /query` para consultas multi-biblioteca.
- Método `listDocumentsByLibrary(libraryId, tenantId?, limit?)` en `DocumentRepositoryPort`.
- Índices de MongoDB para scoping por library: `{ libraryId, tenantId, createdAt }`, `{ libraryId, documentId }`, `{ tenantId, libraryId, checksum }` (unique).
- Propiedades `libraryId` en nodos `Document`, `Entity` y relaciones `MENTIONS`, `RELATED` de Neo4j.
- Filtro por `libraryIds` (lista) en Neo4j para `findEntitiesByNames` y `findRelationshipsForEntityIds`.
- Tests E2E: aislamiento por biblioteca y consulta multi-biblioteca.
- ADR-0009: Library scoping como segundo nivel de organización.

### Changed

- Todos los puertos de dominio (`DocumentRepositoryPort`, `GraphStorePort`, `ChunkSearchPort`) aceptan `libraryId`/`libraryIds` como parámetro opcional.
- Todos los use cases (ingest, query, delete, generate, reindex, graph-sync-retry) propagan `libraryId`.
- Todos los controllers leen `X-Library-Id` y lo propagan.
- `MongoChunkSearchAdapter` filtra candidatos por `libraryIds` (con `$in`).
- Índice único de checksum migrado de `{ tenantId, checksum }` a `{ tenantId, libraryId, checksum }`.
- CORS ahora permite `X-Tenant-Id` y `X-Library-Id`.

### Notes

- 100% backward-compatible: sin `X-Library-Id`, el comportamiento es idéntico al anterior.
- El `libraryId` es implícito — se crea al ingestar el primer documento con ese ID, sin registro previo.
- La capa de negocio (servicio externo) es responsable de definir qué significa cada `libraryId`.

---

## 2026-02-24 (Fase 3 - Hardening operacional y estabilización)

### Added

- Patrón Outbox endurecido para concurrencia multi-instancia: claim atómico con `findOneAndUpdate`, transición a `PROCESSING`, lease (`lockExpiresAt`) y control de `attempts < 10`.
- `HttpExceptionFilter` global con formato consistente de error (`statusCode`, `message`, `error`, `timestamp`, `path`) y logging sin exponer stack traces al cliente.
- Rate limiting global y por endpoint con `@nestjs/throttler` usando variables de entorno:
  - `RATE_LIMIT_TTL`
  - `RATE_LIMIT_GLOBAL`
  - `RATE_LIMIT_QUERY`
  - `RATE_LIMIT_UPLOAD`
- Métricas Prometheus base con `@willsoto/nestjs-prometheus` y `prom-client`:
  - `brain_documents_ingested_total`
  - `brain_queries_total`
  - `brain_query_errors_total`
  - `brain_query_latency_ms`
- `ChecksumService` (SHA-256) para idempotencia de ingesta documental.
- ADR-0007: Hardening operacional para seguridad, confiabilidad e idempotencia.

### Changed

- `GraphSyncRetryService` ahora consume eventos vía claim atómico y evita incremento doble de intentos.
- `ThrottlerGuard` registrado globalmente (`APP_GUARD`) y decoradores `@Throttle()` alineados por perfil (`query`, `upload`).
- `FileUploadInterceptor` usa `ConfigService` para `MAX_FILE_SIZE_MB` y `ALLOWED_MIME_TYPES`.
- `GraphRagQueryUseCase` integra `StructuredLogger` y métricas de volumen, errores y latencia.
- `IngestDocumentUseCase` retorna documento existente por checksum y maneja condición de carrera por índice único (`E11000`).
- Índice de `checksum` en Mongo reforzado como `unique + sparse` para garantizar idempotencia concurrente.

### Fixed

- Resolución de conflictos de merge y firmas de `ping()` inconsistentes entre Mongo, Neo4j y health checks.
- Error de compilación por implementación duplicada de `ping()` en adaptador Neo4j.
- Endpoint legacy de health (`src/health/health.controller.ts`) ajustado a contratos actuales.

### Notes

- Build validado en verde con `npm run build`.
- Se mantiene una sola semántica de salud por excepción para Neo4j (`GraphStorePort.ping(): Promise<void>`) y por latencia para Mongo (`MongoDatabaseService.ping(): Promise<number>`).

---

## 2026-02-24 (Fase 4 - Administración de corpus e índice)

### Added

- `DELETE /documents/:id`: elimina documento, chunks y outbox en Mongo; nodo Document, entidades y relaciones asociadas en Neo4j.
- `POST /documents/generate`: genera e ingesta documentos por caso de uso (`useCaseId`, `title`, `params`).
- `POST /index/rebuild`: reindexa embeddings de todos los chunks (o hasta `limit`).
- `POST /index/incremental`: reindexa solo chunks sin `embeddingModel` o con modelo distinto al actual.
- Puerto `DocumentGeneratorPort` y adaptador `TemplateDocumentGeneratorAdapter` con templates por defecto.
- `DeleteDocumentUseCase` y `GenerateDocumentUseCase`.
- `GraphStorePort.deleteByDocumentId` y `DocumentRepositoryPort.deleteDocument`.
- `DocumentRepositoryPort.listChunksNeedingReindex` para reindexación incremental.
- `ReindexChunksUseCase` extendido con modo `rebuild` | `incremental`.
- `IndexController` con rutas `/index/rebuild` y `/index/incremental`.
- ADR-0006: Administración de corpus por API.

### Changed

- `DocumentsController` expone DELETE y POST generate.
- `ReindexChunksUseCase` acepta `mode` en input.

### Notes

- Ingesta por URL (opcional) no implementada en esta fase.
- `TemplateDocumentGeneratorAdapter` incluye templates básicos; puede extenderse con Ollama u otro LLM.

---

## 2026-02-24 (Fase 1 - Calidad de conocimiento)

### Added

- Puertos `EmbeddingPort` y `GraphExtractorPort` para desacoplar IA de proveedores concretos.
- Adaptadores Ollama: `OllamaEmbeddingAdapter` (embeddings vía `/api/embed`) y `OllamaGraphExtractorAdapter` (extracción JSON vía `/api/generate`).
- Configuración Ollama: `AI_URL`, `OLLAMA_EMBEDDING_MODEL`, `OLLAMA_EXTRACTION_MODEL`, `OLLAMA_TIMEOUT_MS`.
- Versionado de modelos en metadata: `embedding_model`, `extraction_model` en documentos; `embeddingModel` en chunks.
- Extracción de grafo por chunk con `sourceChunkId` real para trazabilidad.
- Caso de uso `ReindexChunksUseCase` y script `npm run reindex` para reindexar embeddings de chunks existentes.
- Métodos `listAllChunks` y `updateChunkEmbedding` en `DocumentRepositoryPort`.
- ADR-0005: Ollama para embeddings y extracción estructurada.

### Changed

- `IngestDocumentUseCase` usa `EmbeddingPort` y `GraphExtractorPort` (Ollama) en lugar de servicios determinísticos/naive.
- `MongoChunkSearchAdapter` usa `EmbeddingPort` para vector de consulta; fallback seguro para chunks sin embedding o dimensión inválida.
- Eliminados `DeterministicEmbeddingService` y `NaiveGraphExtractorService` del módulo principal.
- `GraphRagQueryUseCase` adaptado a contrato `AnswerGeneratorPort` (sources + GenerateAnswerOutput).

### Notes

- Requiere Ollama en ejecución para ingesta y query. Ejecutar `ollama pull nomic-embed-text` y `ollama pull llama3.2` antes de usar.
- Tras migración, ejecutar `npm run build && npm run reindex` para actualizar chunks históricos.
- Para `reindex`, usar `LLM_PROVIDER=local` si no se dispone de OpenAI/Anthropic (el script no usa el generador de respuestas).

---

## 2026-02-24 (inicial)

### Added

- Adopción oficial de `memory_architecture/brain_service/docs` como fuente de verdad del módulo.
- Nuevo plan operativo consolidado: `memory_architecture/brain_service/docs/EXECUTION_PLAN.md`.
- Scaffold inicial de `memory_architecture/brain_service` con NestJS y estructura hexagonal (`domain`, `application`, `infrastructure`, `presentation`).
- Configuración base (`.env.example`, `docker-compose.yml`, `configuration.ts`, `nest-cli.json`).
- Modelos de dominio para documento, chunk, entidades y relaciones.
- Puertos de dominio:
  - `DocumentRepositoryPort`
  - `ChunkSearchPort`
  - `GraphStorePort`
  - `FileTextExtractorPort`
  - `AnswerGeneratorPort`
- Adaptadores iniciales:
  - Mongo repository para documentos/chunks/outbox.
  - Neo4j graph store con `MERGE` de nodos/relaciones.
  - Búsqueda Mongo y placeholder Elasticsearch.
  - Extractor de archivos (`txt/md/json/csv/pdf/docx`).
  - Generador de respuesta local (placeholder).
- Casos de uso:
  - Ingesta documental (`IngestDocumentUseCase`).
  - Consulta GraphRAG (`GraphRagQueryUseCase`).
  - Retry de sincronización de grafo (`GraphSyncRetryService`).
- Endpoints:
  - `GET /health`
  - `POST /documents/text`
  - `POST /documents/upload`
  - `GET /documents`
  - `POST /outbox/retry`
  - `POST /query`

### Changed

- `memory_architecture/brain_service/docs/README.md` ahora referencia explícitamente `EXECUTION_PLAN.md` como plan activo.
- Pipeline de ingesta evolucionó de stub a persistencia real en Mongo.
- Sincronización con Neo4j pasó a esquema con outbox + retry.
- Endpoint `/query` ahora ensambla prompt grounded con contexto y hechos de grafo.

### Notes

- Embeddings y extractor de entidades actuales son temporales (determinísticos/naive) y deberán reemplazarse por adaptadores productivos.
- La estrategia de búsqueda híbrida en Mongo está en modo inicial y debe migrar a índices vectoriales/híbridos gestionados en entorno final.

---

## 2026-02-24 - Fase 2 Completada

### Added

#### Proveedores LLM Reales
- Integración con OpenAI (GPT-4o-mini por defecto)
  - `OpenAiAnswerGeneratorAdapter` con SDK oficial de OpenAI
  - Configuración de modelo, temperatura, max_tokens y timeout
  - Manejo de errores específicos (401, 429, 404)
  - Retry automático (3 intentos)
- Integración con Anthropic (Claude-3.5-Sonnet)
  - `AnthropicAnswerGeneratorAdapter` con SDK oficial de Anthropic
  - Configuración similar a OpenAI
  - Manejo de uso de tokens (input + output)
- Provider Factory dinámico
  - Selección de proveedor por variable `LLM_PROVIDER` (local/openai/anthropic)
  - Inyección de dependencias con factory pattern en `app.module.ts`

#### Sistema de Citación de Fuentes
- `PromptTemplateService` para construcción de prompts estructurados
  - IDs trazables para contextos ([CTX-1], [CTX-2]...)
  - IDs trazables para hechos de grafo ([FACT-1], [FACT-2]...)
  - Instrucciones explícitas anti-alucinación en prompts
  - Formato de citación requerido
- Extracción automática de fuentes citadas desde respuesta LLM
- Respuesta con `sourcesUsed` (array de IDs citados)

#### Metadata de Respuesta
- `model`: Modelo LLM usado (ej: gpt-4o-mini, claude-3-5-sonnet)
- `tokensUsed`: Total de tokens consumidos
- `sourcesUsed`: Lista de IDs de fuentes citadas
- Logs estructurados de latencia, tokens y fuentes

### Changed

#### Puerto y Contratos
- `AnswerGeneratorPort` extendido con:
  - `GenerateAnswerInput` (prompt + sources + maxTokens)
  - `GenerateAnswerOutput` (answer + sourcesUsed + model + tokensUsed)
  - `AnswerSource` (id + text + type: 'chunk' | 'graph_fact')
- `QueryResponseDto` extendido con:
  - `sourcesUsed: string[]`
  - `fastContext: Array<{ id, text }>`
  - `truthFacts: Array<{ id, from, relation, to }>`
  - `model?: string`
  - `tokensUsed?: number`

#### GraphRagQueryUseCase
- Integrado `PromptTemplateService` para construcción de prompts
- Uso de nuevo puerto `AnswerGeneratorPort` con metadata
- Fuentes con IDs trazables (chunkId, sourceChunkId)
- Logging de latencia, modelo, tokens y citaciones
- Manejo de errores con fallback informativo

#### QueryController
- Logging estructurado de queries y respuestas
- Respuesta tipada con `QueryResponseDto`
- Logs de modelo, tokens y fuentes citadas

#### LocalAnswerGeneratorAdapter
- Actualizado para cumplir nueva interfaz con metadata
- Retorna todas las fuentes como "usadas" (modo determinístico)

### Configuration

#### Variables de Entorno Añadidas
```env
LLM_PROVIDER=local|openai|anthropic

OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=1000
OPENAI_TIMEOUT_MS=30000

ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.2
ANTHROPIC_MAX_TOKENS=1000
ANTHROPIC_TIMEOUT_MS=30000
```

#### Dependencias Añadidas
- `openai`: ^4.73.0
- `@anthropic-ai/sdk`: ^0.32.0
- `axios-retry`: ^4.5.0

### Impact

- ✅ POST /query ahora usa LLM real (según LLM_PROVIDER)
- ✅ Respuestas con citación de fuentes trazables
- ✅ Control de alucinaciones con prompts estructurados
- ✅ Observabilidad de uso (modelo, tokens, latencia)
- ✅ Soporte multi-proveedor (OpenAI, Anthropic, local)
- ✅ Fallback a modo local si no hay API keys configuradas

### Next Steps (Fase 3)

- Hardening operacional (API key auth, rate limiting)
- Observabilidad avanzada (métricas, logs estructurados)
- Idempotencia en ingesta
- Políticas de abuso y límites de carga
