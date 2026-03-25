# Brain Service (Hexagonal)

Servicio API para ingesta documental y GraphRAG con arquitectura hexagonal.

## Principios

- `domain`: modelos y puertos (sin dependencias externas).
- `application`: casos de uso.
- `infrastructure`: adaptadores (`mongo`, `neo4j`, `elasticsearch`).
- `config`: configuración central de runtime.

## Motor de búsqueda desacoplado

El puerto `ChunkSearchPort` permite cambiar entre:

- `MongoChunkSearchAdapter` (default).
- `ElasticsearchChunkSearchAdapter` (cuando `SEARCH_ENGINE=elasticsearch`).

## Arranque local

```bash
docker compose -f docker-compose.yml up -d
ollama pull nomic-embed-text
ollama pull llama3.2
cp .env.example .env
yarn install
yarn start:dev
```

## Reindexación de embeddings

Tras migrar a embeddings reales (Ollama), reindexar chunks existentes:

```bash
yarn build
yarn reindex
```

Opcional: `REINDEX_LIMIT=100 yarn reindex` para limitar chunks procesados.

## Endpoints

- `GET /health`
- `POST /summarize` (body: `{ messages: [{role, content}] }`) - Genera resúmenes clínicos de sesiones de chat.
- `POST /documents/text`
- `POST /documents/upload` (multipart `file`, soporta `txt/md/json/csv/pdf/docx`)
- `POST /documents/generate` (body: `{ useCaseId, title?, params? }`)
- `GET /documents`
- `DELETE /documents/:id`
- `POST /outbox/retry`
- `POST /query`
- `POST /index/rebuild` (body: `{ limit? }`)
- `POST /index/incremental` (body: `{ limit? }`)
- `GET /metrics` (Prometheus)

Ver [docs/API_REFERENCE.md](docs/API_REFERENCE.md) para documentación completa de cada endpoint.

## Scoping: Tenant + Library

Pinky soporta dos niveles de organización de datos, ambos opcionales:

- **`X-Tenant-Id`**: Organización de nivel superior (clínica, empresa, equipo). Requerido cuando `ENABLE_MULTI_TENANT=true`.
- **`X-Library-Id`**: Biblioteca lógica dentro de un tenant (corpus global, paciente específico, proyecto). Siempre opcional.

Ejemplo de uso típico para una clínica médica:

```bash
# Subir documento a la biblioteca global compartida
curl -X POST http://localhost:8081/documents/text \
  -H "X-Tenant-Id: clinica-salud" \
  -H "X-Library-Id: global-medical-library" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Protocolo COVID", "rawText": "..."}'

# Subir documento específico de un paciente
curl -X POST http://localhost:8081/documents/text \
  -H "X-Tenant-Id: clinica-salud" \
  -H "X-Library-Id: patient:abc123" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "Análisis de sangre", "rawText": "..."}'

# Consultar cruzando biblioteca global + paciente
curl -X POST http://localhost:8081/query \
  -H "X-Tenant-Id: clinica-salud" \
  -H "X-API-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "¿Hay contraindicaciones?", "libraryIds": ["global-medical-library", "patient:abc123"]}'
```

Sin headers de scope, el sistema opera sobre todo el corpus disponible (comportamiento por defecto).

## Pipeline 1 (estado actual)

- Guarda documento y metadata en Mongo (`documents`).
- Chunking + embeddings reales (Ollama `nomic-embed-text`) en Mongo (`chunks`).
- Extracción estructurada de entidades/relaciones por chunk (Ollama `llama3.2`) con `sourceChunkId` y upsert en Neo4j.
- Outbox Mongo para sincronización de grafo (`graph_sync_outbox`) con retries automáticos.
- Manejo de consistencia:
  - Si falla Neo4j, el documento queda en Mongo y se marca `ERROR/FAILED`.
  - El evento queda en outbox y puede reprocesarse por worker o `POST /outbox/retry`.

## Pipeline 2 (estado actual)

- `POST /query` ejecuta GraphRAG básico:
  - Recupera contexto rápido desde chunks en Mongo (búsqueda híbrida inicial).
  - Recupera hechos del grafo en Neo4j.
  - Construye prompt grounded con citación de fuentes.
  - Genera respuesta usando LLM real (OpenAI/Anthropic) o modo local.
  - Retorna respuesta con fuentes citadas, modelo usado y tokens consumidos.

## Proveedores LLM (Fase 2)

El sistema soporta múltiples proveedores LLM:

### Modo Local (por defecto)
No requiere API keys. Retorna el prompt estructurado sin procesamiento LLM real.

```bash
LLM_PROVIDER=local
```

### OpenAI
Usa modelos GPT (gpt-4o-mini por defecto).

1. Obtén tu API key en: https://platform.openai.com/api-keys
2. Configura en `.env`:
```bash
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4o-mini
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=1000
OPENAI_TIMEOUT_MS=30000
```

### Anthropic
Usa modelos Claude (claude-3-5-sonnet por defecto).

1. Obtén tu API key en: https://console.anthropic.com/
2. Configura en `.env`:
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_TEMPERATURE=0.2
ANTHROPIC_MAX_TOKENS=1000
ANTHROPIC_TIMEOUT_MS=30000
```

**Nota:** Las API keys son sensibles. Nunca las subas al repositorio. Usa variables de entorno o secrets management en producción.
