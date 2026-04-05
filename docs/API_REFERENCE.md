# Brain Service (Pinky) — API Reference

## Overview

Brain Service is a document ingestion and GraphRAG query API. It ingests documents, splits them into chunks, generates vector embeddings, extracts knowledge graph entities/relationships, and answers questions using grounded retrieval-augmented generation with source citations.

**Base URL**: `https://<your-domain>` (or `http://localhost:8081` for local development)

## Authentication

When `ENABLE_API_KEY_AUTH=true`, all mutating endpoints require the `X-API-Key` header.

```
X-API-Key: <your-api-key>
```

Endpoints that require authentication are marked with 🔐 below. Read-only endpoints (`GET /health`, `GET /documents`, `GET /metrics`) do NOT require authentication.

## Multi-tenant Header

When `ENABLE_MULTI_TENANT=true`, endpoints that read/write corpus data require:

```
X-Tenant-Id: <tenant-id>
```

This applies to:
- `POST /documents/text`
- `POST /documents/upload`
- `POST /documents/generate`
- `DELETE /documents/:id`
- `POST /query`
- `POST /index/rebuild`
- `POST /index/incremental`
- `GET /documents`

## Library Scope Header

All corpus endpoints accept an optional `X-Library-Id` header to scope documents within a library (a logical grouping inside a tenant). This is always optional — when omitted, operations apply to all libraries within the tenant.

```
X-Library-Id: <library-id>
```

The library ID is a free-form string. Naming conventions are up to the consuming service. Examples:
- `global-medical-library` — shared PDFs across all doctors
- `patient:abc123` — documents specific to a patient
- `strategy:btc-2026` — a trading strategy corpus
- `project:pinky` — software documentation corpus

For `POST /query`, you can also pass multiple library IDs via the request body (`libraryIds` array) to query across several libraries at once. The header serves as a fallback when the body field is not provided.

This applies to all endpoints listed in the Multi-tenant section above.

---

## Endpoints

### GET /health

Returns service health status including Neo4j connectivity and LLM configuration.

**Authentication**: None

**Request**:
```
GET /health
```

**Response** (`200 OK`):
```json
{
  "status": "ok",
  "timestamp": "2026-02-26T20:34:05.943Z",
  "uptime": 506,
  "services": {
    "neo4j": { "status": "up", "latency_ms": 15 },
    "llm": { "status": "configured", "provider": "local" }
  },
  "service": "brain-service",
  "latency_ms": 18
}
```

**Status values**: `"ok"` (all services up) or `"degraded"` (one or more services down).

---

### POST /documents/text 🔐

Ingests a plain text document. The service will chunk the text, generate embeddings, extract entities/relationships into the knowledge graph, and store everything.

**Authentication**: Required

**Request**:
```
POST /documents/text
Content-Type: application/json
X-API-Key: <key>
```

**Body**:
```json
{
  "title": "string (optional)",
  "rawText": "string (required, non-empty)",
  "source": {
    "kind": "generated",
    "useCaseId": "manual-api-text"
  },
  "metadata": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rawText` | string | **Yes** | The document text to ingest |
| `title` | string | No | Human-readable title |
| `source` | object | No | Origin descriptor (see Source Types below). Defaults to `{ kind: "generated", useCaseId: "manual-api-text" }` |
| `metadata` | object | No | Arbitrary key-value metadata to attach to the document |

**Source Types**:
```json
{ "kind": "generated", "useCaseId": "string" }
{ "kind": "upload", "filename": "string", "mimeType": "string" }
{ "kind": "url", "url": "string" }
```

**Response** (`201 Created`):
```json
{
  "documentId": "9be3c836-d162-4daa-991f-1aea96b38cb8",
  "title": "Einstein Bio",
  "rawText": "Albert Einstein was...",
  "source": { "kind": "generated", "useCaseId": "manual-api-text" },
  "status": "READY",
  "graphSyncStatus": "SYNCED",
  "checksum": "540069a64c93581ba...",
  "metadata": {
    "embedding_model": "nomic-embed-text",
    "extraction_model": "llama3.2"
  },
  "createdAt": "2026-02-26T20:43:06.890Z",
  "updatedAt": "2026-02-26T20:43:37.585Z"
}
```

**Document statuses**: `RECEIVED` → `EMBEDDED` → `READY` (success) or `ERROR` (failure).
**Graph sync statuses**: `PENDING` → `SYNCED` (success) or `FAILED` (failure).

**Idempotency**: If a document with the same content (SHA-256 checksum) already exists, the existing document is returned without re-ingestion.

**Error responses**:
- `400 Bad Request`: Missing or invalid `rawText`
- `500 Internal Server Error`: Document saved to database but graph sync failed (document will have `status: "ERROR"`)

---

### POST /documents/upload 🔐

Ingests a document from a file upload. Supports: `txt`, `md`, `json`, `csv`, `pdf`, `docx`.

**Authentication**: Required
**Rate limit**: Upload tier (stricter)

**Request**:
```
POST /documents/upload
Content-Type: multipart/form-data
X-API-Key: <key>
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | file | **Yes** | The file to upload (max 10MB by default) |
| `title` | string | No | Overrides the filename as title |
| `metadata` | JSON string | No | Additional metadata |

**Allowed MIME types**:
- `text/plain`
- `text/markdown`
- `application/json`
- `text/csv`
- `application/pdf`
- `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (docx)

**Response**: Same format as `POST /documents/text`.

**Error responses**:
- `400 Bad Request`: No file provided, unsupported MIME type, or empty content
- `413 Payload Too Large`: File exceeds size limit

**Example (curl)**:
```bash
curl -X POST https://<domain>/documents/upload \
  -H "X-API-Key: <key>" \
  -F "file=@./report.pdf" \
  -F "title=Q4 Report"
```

---

### POST /documents/generate 🔐

Generates a document from a predefined use case template, then ingests it.

**Authentication**: Required

**Request**:
```
POST /documents/generate
Content-Type: application/json
X-API-Key: <key>
```

**Body**:
```json
{
  "useCaseId": "string (required)",
  "title": "string (optional)",
  "params": {}
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `useCaseId` | string | **Yes** | Template identifier (e.g. `"sample"`, `"placeholder"`) |
| `title` | string | No | Override the generated title |
| `params` | object | No | Template-specific parameters |

**Built-in use case IDs**: `"sample"`, `"manual-api-text"`, `"placeholder"`. Any unrecognized ID generates a generic document.

**Response**: Same format as `POST /documents/text`.

---

### GET /documents

Lists all ingested documents, ordered by creation date (newest first).

**Authentication**: None

**Request**:
```
GET /documents
```

**Response** (`200 OK`):
```json
[
  {
    "documentId": "9be3c836-d162-4daa-991f-1aea96b38cb8",
    "title": "Einstein Bio",
    "source": { "kind": "generated", "useCaseId": "manual-api-text" },
    "status": "READY",
    "graphSyncStatus": "SYNCED",
    "checksum": "540069a6...",
    "metadata": {
      "embedding_model": "nomic-embed-text",
      "extraction_model": "llama3.2"
    },
    "createdAt": "2026-02-26T20:43:06.890Z",
    "updatedAt": "2026-02-26T20:43:37.585Z"
  }
]
```

Returns up to 100 documents. The `rawText` field is included in each document.

---

### DELETE /documents/:id 🔐

Deletes a document and all associated data (chunks, embeddings, graph entities/relationships).

**Authentication**: Required

**Request**:
```
DELETE /documents/<documentId>
X-API-Key: <key>
```

**Response** (`200 OK`):
```json
{
  "deleted": "9be3c836-d162-4daa-991f-1aea96b38cb8"
}
```

**Error responses**:
- `404 Not Found`: Document does not exist

---

### POST /query 🔐

Executes a GraphRAG query. The system retrieves relevant text chunks (via hybrid vector + text search) and knowledge graph facts, constructs a grounded prompt with citations, and generates an answer.

**Authentication**: Required
**Rate limit**: Query tier

**Request**:
```
POST /query
Content-Type: application/json
X-API-Key: <key>
```

**Body**:
```json
{
  "query": "string (required)",
  "entityHints": ["string"],
  "libraryIds": ["string"],
  "topK": 8
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `query` | string | **Yes** | — | The natural language question |
| `entityHints` | string[] | No | auto-extracted | Entity names to prioritize in graph lookup |
| `libraryIds` | string[] | No | from `X-Library-Id` header | Library IDs to scope the query. Overrides the header. Multiple IDs query across libraries. |
| `topK` | integer | No | `8` | Number of chunks to retrieve (1–50) |

**Response** (`200 OK`):
```json
{
  "answer": "Einstein received the Nobel Prize for his explanation of the photoelectric effect. [CTX-1]",
  "sourcesUsed": ["CTX-1"],
  "fastContext": [
    {
      "id": "4fc700f0-b779-443b-b696-3427c9d3749f",
      "text": "Albert Einstein was a theoretical physicist...",
      "documentId": "9be3c836-d162-4daa-991f-1aea96b38cb8",
      "title": "Einstein Bio",
      "libraryId": "patient:abc123:medical_history",
      "metadata": {
        "engineDocumentId": "67f07a8f7672a58790be0421",
        "patientId": "abc123",
        "documentCategory": "medical_history"
      }
    }
  ],
  "truthFacts": [
    {
      "id": "chunk-uuid",
      "from": "Einstein",
      "relation": "RECEIVED",
      "to": "Nobel Prize"
    }
  ],
  "model": "gpt-4o-mini",
  "tokensUsed": 342,
  "prompt": "Eres un asistente experto..."
}
```

| Field | Type | Description |
|-------|------|-------------|
| `answer` | string | The generated answer with `[CTX-X]` and `[FACT-X]` citations |
| `sourcesUsed` | string[] | IDs of sources actually cited in the answer |
| `fastContext` | array | Text chunks retrieved from vector/text search, enriched with `documentId`, `title`, `libraryId` y `metadata` para trazabilidad aguas abajo |
| `truthFacts` | array | Entity relationships retrieved from the knowledge graph |
| `model` | string | LLM model used (e.g. `"gpt-4o-mini"`, `"claude-3-5-sonnet-20241022"`, `"local-deterministic"`) |
| `tokensUsed` | number | Total tokens consumed (0 for local mode) |
| `prompt` | string | The full grounded prompt sent to the LLM |

**Citation format in `answer`**:
- `[CTX-N]` — references `fastContext[N-1]`
- `[FACT-N]` — references `truthFacts[N-1]`

**Note on `LLM_PROVIDER=local`**: In local mode, the `answer` field contains the raw grounded prompt (not a real LLM response). This is useful for debugging or forwarding the prompt to your own LLM.

---

### POST /index/rebuild 🔐

Regenerates embeddings for ALL chunks using the current embedding model. Use after changing the embedding model or to fix corrupted embeddings.

**Authentication**: Required
**Rate limit**: 2 requests per minute

**Request**:
```
POST /index/rebuild
Content-Type: application/json
X-API-Key: <key>
```

**Body**:
```json
{
  "limit": 10000
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | integer | No | `10000` | Max chunks to reindex (1–50000) |

**Response** (`200 OK`):
```json
{
  "processed": 150,
  "failed": 0,
  "embeddingModel": "nomic-embed-text"
}
```

---

### POST /index/incremental 🔐

Regenerates embeddings only for chunks that don't have an embedding or have an outdated embedding model.

**Authentication**: Required
**Rate limit**: 3 requests per minute

**Request/Response**: Same format as `POST /index/rebuild`.

---

### GET /metrics

Returns Prometheus-formatted metrics.

**Authentication**: None

**Request**:
```
GET /metrics
```

**Custom metrics exposed**:
- `brain_documents_ingested_total` — counter of successfully ingested documents
- `brain_queries_total` — counter of GraphRAG queries
- `brain_query_errors_total` — counter of failed queries
- `brain_query_latency_ms` — histogram of query latency in milliseconds

---

## Error Format

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "rawText should not be empty",
  "error": "Bad Request",
  "timestamp": "2026-02-26T20:47:13.146Z",
  "path": "/documents/text"
}
```

The `message` field can be a string or an array of strings (for validation errors).

**Common HTTP status codes**:
- `400` — Validation error (missing/invalid fields)
- `401` — Missing or invalid `X-API-Key`
- `404` — Resource not found
- `413` — File too large
- `429` — Rate limit exceeded
- `500` — Internal server error

---

## Integration Examples

### Python

```python
import requests

BASE_URL = "https://brain.example.com"
API_KEY = "your-api-key"
HEADERS = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY,
}

# Ingest a document
response = requests.post(
    f"{BASE_URL}/documents/text",
    headers=HEADERS,
    json={
        "title": "Company Policy",
        "rawText": "All employees must complete safety training...",
    },
)
doc = response.json()
print(f"Ingested: {doc['documentId']} — status: {doc['status']}")

# Query the knowledge base
response = requests.post(
    f"{BASE_URL}/query",
    headers=HEADERS,
    json={
        "query": "What training is required for employees?",
        "topK": 5,
    },
)
result = response.json()
print(f"Answer: {result['answer']}")
print(f"Sources: {result['sourcesUsed']}")
print(f"Model: {result['model']} ({result['tokensUsed']} tokens)")
```

### TypeScript / Node.js

```typescript
const BASE_URL = "https://brain.example.com";
const API_KEY = "your-api-key";

async function ingestDocument(title: string, text: string) {
  const res = await fetch(`${BASE_URL}/documents/text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({ title, rawText: text }),
  });
  return res.json();
}

async function query(question: string, topK = 8) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": API_KEY,
    },
    body: JSON.stringify({ query: question, topK }),
  });
  return res.json();
}

// Usage
const doc = await ingestDocument("Policy", "All employees must...");
const result = await query("What training is required?");
console.log(result.answer);
```

### cURL

```bash
# Health check
curl https://brain.example.com/health

# Ingest text
curl -X POST https://brain.example.com/documents/text \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"title":"Test","rawText":"Document content here..."}'

# Upload file
curl -X POST https://brain.example.com/documents/upload \
  -H "X-API-Key: your-api-key" \
  -F "file=@./document.pdf" \
  -F "title=My PDF"

# Query
curl -X POST https://brain.example.com/query \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"query":"What does the document say about X?","topK":5}'

# List documents
curl https://brain.example.com/documents

# Delete document
curl -X DELETE https://brain.example.com/documents/<documentId> \
  -H "X-API-Key: your-api-key"
```
