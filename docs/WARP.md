# Brain Service (Pinky) — Contexto para Warp AI

## Descripción del Proyecto

Pinky es un motor RAG genérico (Graph Retrieval-Augmented Generation) con arquitectura hexagonal en NestJS. Ingesta documentos, los fragmenta, genera embeddings vectoriales, extrae un grafo de conocimiento, y responde preguntas con citación de fuentes.

**No es una aplicación de negocio** — es la capa de infraestructura de conocimiento que otros servicios consumen vía HTTP.

## Arquitectura

### Estructura Hexagonal (por módulo)

```
src/modules/<module>/
├── domain/
│   ├── models/       # Tipos e interfaces de dominio
│   └── ports/        # Contratos (interfaces) que la infraestructura implementa
├── application/      # Casos de uso y lógica de orquestación
├── infrastructure/   # Adaptadores concretos (mongo, neo4j, ollama, openai, etc.)
└── presentation/     # Controllers HTTP y DTOs
```

### Stack Tecnológico

- **Framework**: NestJS 11.x / TypeScript 5.6 / Node.js 20
- **Almacenamiento documental**: MongoDB (mongoose 8.7) — documentos, chunks, embeddings, outbox
- **Grafo de conocimiento**: Neo4j (neo4j-driver 5.26) — entidades, relaciones, Document→MENTIONS→Entity
- **Embeddings**: Ollama (`nomic-embed-text` por defecto) vía `/api/embed`
- **Extracción de grafo**: Ollama (`llama3.2` por defecto) vía `/api/generate` con output JSON
- **Generación de respuesta**: OpenAI, Anthropic, o modo local (seleccionable con `LLM_PROVIDER`)
- **Métricas**: Prometheus vía `@willsoto/nestjs-prometheus`
- **Auth**: API Key vía `X-API-Key` header
- **Rate limiting**: `@nestjs/throttler` por endpoint

## Organización de datos: Tenant + Library

Dos niveles jerárquicos de scope, ambos opcionales:

- **`X-Tenant-Id`**: Organización (clínica, empresa). Requerido cuando `ENABLE_MULTI_TENANT=true`.
- **`X-Library-Id`**: Biblioteca lógica dentro del tenant (corpus global, paciente, proyecto). Siempre opcional.

```
Tenant (X-Tenant-Id: "clinica-salud")
├── Library "global-medical-library"  → PDFs compartidos
├── Library "patient:abc123"          → documentos del paciente
└── Library "patient:xyz789"          → documentos de otro paciente
```

Para queries: `POST /query` acepta `libraryIds: string[]` en el body para consultar múltiples bibliotecas a la vez.

## Pipelines

### Pipeline de Ingesta

1. Recibe texto o archivo (`POST /documents/text`, `/upload`, `/generate`)
2. Chunking con overlap configurable (`CHUNK_SIZE`, `CHUNK_OVERLAP`)
3. Embedding vectorial por chunk (Ollama `nomic-embed-text`)
4. Extracción de entidades/relaciones por chunk (Ollama `llama3.2`, output JSON)
5. Persistencia en MongoDB (documento + chunks + embeddings)
6. Upsert del grafo en Neo4j (Document, Entity, MENTIONS, RELATED)
7. Outbox event para retry si Neo4j falla
8. Deduplicación por checksum SHA-256 (por tenant + library)

### Pipeline de Query (GraphRAG)

1. Recibe pregunta (`POST /query`)
2. Embedding del query → búsqueda híbrida (vector + texto) en chunks de MongoDB
3. Extracción de entity hints → búsqueda de entidades y relaciones en Neo4j
4. Construcción de prompt grounded con `[CTX-X]` y `[FACT-X]`
5. Generación de respuesta con LLM (OpenAI/Anthropic/local)
6. Extracción de fuentes citadas de la respuesta
7. Retorno: answer, sourcesUsed, fastContext, truthFacts, model, tokensUsed

## Endpoints API

- `GET /health` — Health check (MongoDB, Neo4j, LLM)
- `GET /documents` — Listar documentos (filtrable por tenant/library)
- `POST /documents/text` 🔐 — Ingestar texto plano
- `POST /documents/upload` 🔐 — Subir archivo (txt/md/json/csv/pdf/docx)
- `POST /documents/generate` 🔐 — Generar documento desde template
- `DELETE /documents/:id` 🔐 — Eliminar documento + chunks + grafo
- `POST /query` 🔐 — Consulta GraphRAG con citación
- `POST /outbox/retry` 🔐 — Reintentar sync de grafo fallidos
- `POST /index/rebuild` 🔐 — Re-embeddings de todos los chunks
- `POST /index/incremental` 🔐 — Re-embeddings de chunks desactualizados
- `GET /metrics` — Métricas Prometheus

Documentación completa: `docs/API_REFERENCE.md`

## Variables de Entorno Clave

```env
# App
PORT=8081
API_KEY=<secret>
ENABLE_API_KEY_AUTH=true
ENABLE_MULTI_TENANT=false

# Databases
MONGODB_URI=mongodb://localhost:27021/brain_service
NEO4J_URI=bolt://localhost:7688
NEO4J_USER=neo4j
NEO4J_PASSWORD=<secret>

# Ollama (embeddings + graph extraction)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_EXTRACTION_MODEL=llama3.2

# LLM Provider (answer generation)
LLM_PROVIDER=local|openai|anthropic
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Chunking
CHUNK_SIZE=1200
CHUNK_OVERLAP=200
TOP_K=8
```

## Comandos

```bash
npm run build          # Compilar TypeScript
npm run start:dev      # Desarrollo con watch
npm run start          # Producción
npm run test:e2e       # Tests end-to-end
npm run lint           # ESLint
npm run reindex        # Reindexar embeddings de chunks existentes
```

## Documentación

- `docs/API_REFERENCE.md` — Referencia completa de endpoints con ejemplos
- `docs/INTEGRATION_GUIDE.md` — Guía de integración para servicios consumidores
- `docs/CHANGELOG.md` — Historial de cambios por fase
- `docs/ADR/` — Architecture Decision Records (9 ADRs)
- `docs/DEPLOY_DOKPLOY.md` — Guía de deploy con Dokploy
- `docs/GITHUB_REGISTRY.md` — Publicación de imagen Docker

## Patrones Clave

- **Hexagonal Architecture**: puertos (interfaces) + adaptadores (implementaciones). Los puertos viven en `domain/ports/`, los adaptadores en `infrastructure/`.
- **Outbox Pattern**: consistencia eventual entre MongoDB y Neo4j. Eventos de sync en `graph_sync_outbox` con retry automático cada 30s y dead-letter después de 10 intentos.
- **Provider Factory**: selección dinámica de adaptadores por configuración (`LLM_PROVIDER`, `SEARCH_ENGINE`).
- **Checksum Idempotency**: SHA-256 del contenido para deduplicación. Scoped por tenant + library.
