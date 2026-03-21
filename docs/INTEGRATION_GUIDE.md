# Brain Service - Guía de integración rápida (Documental + IA)

Esta guía explica cómo integrar `brain-service` (Pinky) como base documental con GraphRAG para que otros proyectos puedan ingestar conocimiento y consultarlo con grounding y citaciones.

## 1) Contrato e integración

La API HTTP está documentada en [docs/API_REFERENCE.md](docs/API_REFERENCE.md). El servidor expone como mínimo:

- `GET /health` (público)
- `POST /documents/text` (requiere API key cuando `ENABLE_API_KEY_AUTH=true`)
- `POST /documents/upload` (multipart, requiere API key)
- `POST /query` (requiere API key)
- `GET /metrics` (público, Prometheus)

## 2) Despliegue recomendado (aislamiento)

El patrón recomendado hoy es **“una instancia por dominio/proyecto”**.

Motivo: el buscador en Mongo funciona sobre el corpus global de chunks sin un filtro multi-tenant estricto dentro de un solo deployment. Para compartir infraestructura entre dominios se requiere un diseño multi-tenant (ver sección “Multi-tenant (opcional)”).

## 3) Variables de entorno mínimas

Partir de [`.env.example`](.env.example). En producción, como mínimo:

- `ENABLE_API_KEY_AUTH=true`
- `API_KEY=<tu-api-key>`
- `LLM_PROVIDER=openai` o `LLM_PROVIDER=anthropic` (en vez de `local`)
- Conectividad a:
  - `MONGODB_URI`, `MONGODB_DB`
  - `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`
  - `REDIS_URL`
- Modelos de Ollama (si usas Ollama para embeddings/extracción):
  - `OLLAMA_BASE_URL`
  - `OLLAMA_EMBEDDING_MODEL`
  - `OLLAMA_EXTRACTION_MODEL`

Nota: `LLM_PROVIDER=local` es útil para desarrollo/debug, pero no está pensado como opción “production-ready”.

## 4) Auth (API key)

Cuando `ENABLE_API_KEY_AUTH=true`, las rutas mutantes requieren el header:

```http
X-API-Key: <your-api-key>
```

## 5) Idempotencia

La ingesta calcula `SHA-256` del `rawText` y reutiliza el documento existente si ya existe ese checksum.

Consecuencia práctica:
- reintentos por fallos de red no duplican documentos;
- el servidor retorna el documento previo en vez de re-procesar embeddings y grafo.

## 6) Límites de carga y abusos

En `src/main.ts` se configura `bodyParser` con límite por defecto de `1mb`.

Upload (`POST /documents/upload`):
- tamaño máximo de archivo: `MAX_FILE_SIZE_MB` (por defecto `10MB`)
- allowlist MIME basada en `ALLOWED_MIME_TYPES` (por defecto incluye `txt`, `md`, `json`, `csv`, `pdf`, `docx`/Word)

Rate limiting con `@nestjs/throttler` usando:
- `RATE_LIMIT_TTL`
- `RATE_LIMIT_GLOBAL`
- `RATE_LIMIT_QUERY`
- `RATE_LIMIT_UPLOAD`

## 7) Ejemplos rápidos (curl)

### 7.1) Ingesta de texto

```bash
curl -X POST "http://localhost:8081/documents/text" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "title": "Manual de ejemplo",
    "rawText": "El potro se adapta a su entorno mediante... ",
    "source": { "kind": "generated", "useCaseId": "manual-api-text" },
    "metadata": { "origin": "pinky" }
  }'
```

### 7.2) Consulta GraphRAG

```bash
curl -X POST "http://localhost:8081/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -d '{
    "query": "¿Cómo se adapta el potro a su entorno?",
    "topK": 8
  }'
```

Respuesta:
- `answer` (grounded, con citaciones)
- `sourcesUsed`, `fastContext`, `truthFacts`
- `model`, `tokensUsed` y el `prompt` usado.

## 8) Multi-tenant (opcional)

La base multi-tenant ya está implementada de forma inicial mediante `X-Tenant-Id` y `ENABLE_MULTI_TENANT=true` en ingesta, consulta y operaciones administrativas clave.

### Contrato actual

- Header requerido cuando multi-tenant está activo:
  - `X-Tenant-Id: <tenant-id>`
- Endpoints con requisito de tenant:
  - `POST /documents/text`
  - `POST /documents/upload`
  - `POST /documents/generate`
  - `DELETE /documents/:id`
  - `POST /query`
  - `POST /index/rebuild`
  - `POST /index/incremental`
  - `POST /outbox/retry`
  - `GET /documents`

### Consideraciones de seguridad

- El borrado por `documentId` valida tenant para evitar IDOR entre corpus.
- Reindex y retry de outbox se ejecutan en alcance del tenant solicitado.

### Próximos pasos recomendados

Si necesitas endurecimiento adicional para producción multi-tenant:

- completar migración de índices legacy en Mongo para datasets ya desplegados,
- mapear API keys a tenants permitidos (control fuerte de autorización por tenant),
- añadir observabilidad segmentada por tenant (métricas y alertas),
- definir políticas de cuotas/rate limiting por tenant.

## 9) Library Scope (agrupación de documentos)

Dentro de un tenant, los documentos se pueden agrupar en **bibliotecas** usando el header `X-Library-Id`.

Esto permite organizar el corpus sin necesidad de múltiples deployments:

```bash
# Ingestar en una biblioteca específica
curl -X POST "http://localhost:8081/documents/text" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Tenant-Id: clinica-salud" \
  -H "X-Library-Id: patient:abc123" \
  -d '{"title": "Historia clínica", "rawText": "Paciente presenta..."}'

# Consultar una sola biblioteca
curl -X POST "http://localhost:8081/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Tenant-Id: clinica-salud" \
  -H "X-Library-Id: patient:abc123" \
  -d '{"query": "¿Qué presenta el paciente?"}'

# Consultar múltiples bibliotecas a la vez
curl -X POST "http://localhost:8081/query" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $API_KEY" \
  -H "X-Tenant-Id: clinica-salud" \
  -d '{"query": "¿Hay contraindicaciones?", "libraryIds": ["global-medical-library", "patient:abc123"]}'
```

### Características

- **Siempre opcional**: sin `X-Library-Id`, el sistema opera sobre todo el corpus del tenant.
- **Aditivo**: no requiere configuración previa; el `libraryId` se crea implícitamente al ingestar el primer documento.
- **Multi-biblioteca en queries**: el body de `POST /query` acepta `libraryIds: string[]` para consultar múltiples bibliotecas.
- **Aislamiento completo**: documentos, chunks, embeddings, entidades y relaciones del grafo se filtran por `libraryId`.
- **Backward-compatible**: servicios que no envían el header siguen funcionando exactamente igual.

