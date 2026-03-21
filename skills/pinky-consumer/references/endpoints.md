# Pinky API — Endpoint Contract Summary

Base URL: `http://<host>:8081` (default port)

All mutating endpoints require `X-API-Key` header when `ENABLE_API_KEY_AUTH=true`.
Scope headers `X-Tenant-Id` and `X-Library-Id` are always optional unless `ENABLE_MULTI_TENANT=true` (then `X-Tenant-Id` is required).

## POST /documents/text

Ingest plain text. Returns `DocumentRecord`.

```
Body: {
  "rawText": "string (required)",
  "title": "string (optional)",
  "source": { "kind": "generated", "useCaseId": "manual-api-text" } (optional),
  "metadata": {} (optional)
}
```

Idempotent: same content + tenant + library returns existing document.

## POST /documents/upload

Ingest file (multipart). Supports txt, md, json, csv, pdf, docx. Max 10MB default.

```
Form fields:
  file: binary (required)
  title: string (optional)
  metadata: JSON string (optional)
```

## POST /documents/generate

Generate and ingest a document from a template.

```
Body: {
  "useCaseId": "string (required)",
  "title": "string (optional)",
  "params": {} (optional)
}
```

## GET /documents

List documents. Filterable by `X-Tenant-Id` and `X-Library-Id` headers. Returns array of `DocumentRecord`.

## DELETE /documents/:id

Delete document + all associated chunks, graph data, and outbox events. Validates tenant/library ownership.

## POST /query

GraphRAG query with grounded citations.

```
Body: {
  "query": "string (required)",
  "entityHints": ["string"] (optional — entity names to prioritize in graph),
  "libraryIds": ["string"] (optional — scope to specific libraries, overrides header),
  "topK": number (optional, default 8, range 1-50)
}
```

Response:
```json
{
  "answer": "The answer with [CTX-1] and [FACT-1] citations.",
  "sourcesUsed": ["CTX-1", "FACT-1"],
  "fastContext": [{ "id": "chunk-uuid", "text": "..." }],
  "truthFacts": [{ "id": "chunk-uuid", "from": "Entity A", "relation": "RELATED_TO", "to": "Entity B" }],
  "model": "gpt-4o-mini",
  "tokensUsed": 342,
  "prompt": "Full grounded prompt sent to LLM"
}
```

## POST /outbox/retry

Retry failed graph sync events.

```
Body: { "limit": 20 (optional) }
Response: { "processed": 3, "synced": 2, "failed": 1 }
```

## POST /index/rebuild

Re-embed all chunks with current model.

```
Body: { "limit": 10000 (optional) }
Response: { "processed": 150, "failed": 0, "embeddingModel": "nomic-embed-text" }
```

## POST /index/incremental

Re-embed only chunks with outdated/missing embeddings. Same body/response as rebuild.

## GET /health

No auth required.

```json
{
  "status": "ok",
  "services": {
    "mongodb": { "status": "up", "latency_ms": 2 },
    "neo4j": { "status": "up", "latency_ms": 15 },
    "llm": { "status": "configured", "provider": "local" }
  }
}
```

## GET /metrics

Prometheus metrics. No auth required.

## DocumentRecord shape

```json
{
  "documentId": "uuid",
  "tenantId": "string (optional)",
  "libraryId": "string (optional)",
  "title": "string",
  "rawText": "string",
  "source": { "kind": "upload|url|generated", ... },
  "status": "RECEIVED|EMBEDDED|READY|ERROR",
  "graphSyncStatus": "PENDING|SYNCED|FAILED",
  "checksum": "sha256-hex",
  "metadata": { "embedding_model": "...", "extraction_model": "..." },
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601"
}
```
