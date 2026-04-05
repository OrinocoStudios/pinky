# Neo4j-Only Migration Log

## Purpose

This document records what was changed in Pinky, why the changes were made, and what was validated during the migration from the old polyglot design to the current Neo4j-only runtime.

This is a project-local record intended to complement Engram and future Pinky-based memory.

## Why We Made This Change

Pinky had drifted into a hybrid architecture where:

- MongoDB was still the source of truth for documents, chunks, and chat history.
- Neo4j was already handling the knowledge graph and vector search.
- documentation still described outbox and Redis patterns that were no longer aligned with the active code.

The project goal was to complete the direction that had already started: make Neo4j the single persistent backend for documents, chunks, vectors, graph facts, and chat history.

The expected benefits were:

- less infrastructure to run;
- less duplication of state;
- fewer consistency problems between stores;
- a simpler mental model for future work;
- a better base for integrating `pinky-mcp` with the real Pinky service.

## What Was Changed

### 1. Runtime persistence moved to Neo4j-only

New adapters were added:

- `src/modules/documents/infrastructure/neo4j/neo4j-document.repository.ts`
- `src/modules/query/infrastructure/neo4j/neo4j-chat-history.repository.ts`

These now cover:

- `DocumentRepositoryPort`
- `ChatHistoryRepositoryPort`

The new document repository stores and retrieves:

- `Document`
- `Chunk`
- checksum-based idempotency
- document listing
- chunk reindex support
- document deletion

The new chat history repository stores and retrieves:

- `ChatMessage`
- per-session history
- session clearing

### 2. DI and runtime wiring were simplified

`src/app.module.ts` was updated so that:

- `DOCUMENT_REPOSITORY` uses `Neo4jDocumentRepository`
- `CHAT_HISTORY_REPOSITORY` uses `Neo4jChatHistoryRepository`
- `CHUNK_SEARCH_PORT` uses `Neo4jChunkSearchAdapter`
- `GRAPH_STORE_PORT` remains `Neo4jGraphStoreAdapter`

The old runtime dependency on MongoDB was removed.

### 3. Chunk ownership was clarified

`src/modules/ingestion/application/ingest-document.usecase.ts` was simplified so that chunks are persisted through the document repository path only.

This removed the earlier double-write pattern where chunks were also saved through `graphStore.saveChunks(...)`.

Ownership now is:

- `Neo4jDocumentRepository`: `Document` and `Chunk`
- `Neo4jGraphStoreAdapter`: `Entity`, `RELATED`, `MENTIONS`, vector index management

### 4. Graph deletion behavior was adjusted

`src/modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter.ts` was updated so that `deleteByDocumentId()` no longer deletes `Document` and `Chunk` nodes directly.

This avoids duplicate ownership with the document repository.

### 5. Health and config were simplified

`src/modules/health/health.controller.ts` now reports:

- `neo4j`
- `llm`

`src/config/configuration.ts` was simplified to remove active MongoDB and Redis configuration from the runtime contract.

### 6. Mongo code and dependency were removed

Deleted files:

- `src/modules/documents/infrastructure/mongo/mongo-database.service.ts`
- `src/modules/documents/infrastructure/mongo/mongo-document.repository.ts`
- `src/modules/query/infrastructure/mongo/mongo-chat-history.repository.ts`
- `src/modules/search/infrastructure/mongo/mongo-chunk-search.adapter.ts`

Dependency removed:

- `mongoose`

### 7. Deployment files were updated

Updated files:

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.example`

Added files:

- `docker-compose.runtime.yml`
- `.env.runtime.local`

The runtime stack for local validation now uses:

- Neo4j only
- Pinky only
- no MongoDB
- no Redis

### 8. Architecture documentation was updated

Updated files include:

- `README.md`
- `docs/README.md`
- `docs/API_REFERENCE.md`
- `docs/DEPLOY_DOKPLOY.md`
- `docs/INTEGRATION_GUIDE.md`
- `docs/WARP.md`
- `docs/CHANGELOG.md`
- `AGENT.md`

New ADR added:

- `docs/ADR/ADR-0010-neo4j-only-persistence.md`

Historical ADRs were marked as superseded:

- `ADR-0002`
- `ADR-0003`

## Runtime Validation Against Real Pinky

After the migration, a real Docker runtime was brought up with Neo4j and Pinky.

### Local runtime ports used

To avoid conflicts with existing services already running on the machine, the local runtime uses:

- Pinky HTTP: `http://localhost:18081`
- Neo4j HTTP: `http://localhost:7476`
- Neo4j Bolt: `bolt://localhost:7689`

### Real LLM / embedding gateway used

The runtime was configured against:

- `OPENAI_BASE_URL=https://ollama.orinocostudios.dev/v1`
- `OPENAI_MODEL=qwen35-08b`
- `OPENAI_EMBEDDING_MODEL=text-embedding-ada-002`
- `OPENAI_EXTRACTION_MODEL=qwen35-08b`

### Problems found and fixed during runtime validation

#### 1. Vector index dimensions were hardcoded

Problem:

- Pinky created `chunk_embedding_index` with `768` dimensions.
- the real remote embedding model returned vectors with `96` dimensions.

Fix:

- `src/app.module.ts` now probes the real embedding dimension at startup.
- `ensureVectorIndex()` uses the detected dimension instead of a hardcoded value.

#### 2. Neo4j required integer dimensions in Bolt

Problem:

- Neo4j 5.26 rejected `vector.dimensions` when it was passed as a float-like Bolt number.

Fix:

- `src/modules/graph/infrastructure/neo4j/neo4j-graph-store.adapter.ts` now uses `neo4j.int(dimensions)`.

#### 3. Existing vector index dimension was not replaced automatically

Problem:

- `CREATE VECTOR INDEX ... IF NOT EXISTS` did not replace an already existing index with the wrong dimension.

Fix:

- the runtime now drops `chunk_embedding_index` before recreating it.

#### 4. Remote embedding endpoint sometimes returned zero-norm vectors

Problem:

- Neo4j rejects query vectors with zero norm.

Fix:

- `src/modules/ingestion/infrastructure/openai/openai-embedding.adapter.ts`
- `src/modules/ingestion/infrastructure/ollama/ollama-embedding.adapter.ts`

Both now sanitize zero-norm embeddings by replacing them with a safe fallback unit-like vector.

#### 5. Neo4j required explicit integer `LIMIT` values in some repository queries

Problem:

- `GET /documents` failed because Neo4j rejected non-integer `LIMIT` parameters.

Fix:

- `src/modules/documents/infrastructure/neo4j/neo4j-document.repository.ts` now passes `LIMIT` values using Bolt integers.

## What Was Validated Successfully

### Build and tests

Validated successfully:

- `npm run build`
- `npm test -- --runInBand`
- `npm run test:e2e -- --runInBand`

### Real runtime endpoints

Validated successfully against the Dockerized runtime:

- `GET /health`
- `POST /documents/text`
- `GET /documents`
- `POST /query`

### Observed runtime behavior

- Neo4j health is up.
- Pinky starts successfully in production mode.
- document ingestion persists data in Neo4j.
- queries retrieve `fastContext` from Neo4j vector search.
- the real remote model answers via the OpenAI-compatible endpoint.

## Why This Matters For The Next Step

The next stage is integrating `pinky-mcp` with the real Pinky service.

That integration now has a much cleaner target because:

- Pinky is running with a single persistent backend;
- HTTP behavior has been validated end-to-end;
- embeddings, retrieval, and prompt generation are live;
- there is no MongoDB synchronization layer left to account for.

This means `pinky-mcp` can be adapted to treat Pinky as the canonical storage and retrieval service rather than maintaining a separate local-only memory path.
