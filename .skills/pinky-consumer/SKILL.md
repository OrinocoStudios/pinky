---
name: pinky-consumer
description: >
  Integrate with Pinky (Brain Service) from an external service via HTTP.
  Use when building a service that ingests documents into Pinky, queries its GraphRAG engine,
  manages document libraries, or needs to understand Pinky's API contract.
  Use for medical systems, trading platforms, software documentation tools, or any domain
  that needs RAG with knowledge graph grounding.
  Do NOT use for developing Pinky itself — use pinky-dev instead.
---

# Pinky Consumer Guide

## What is Pinky

Pinky is a generic GraphRAG engine exposed as an HTTP API. It handles document ingestion, embedding, knowledge graph extraction, and grounded question answering. Your service provides the business logic and calls Pinky for knowledge management.

## Quick start

### 1. Ingest a document

```bash
POST /documents/text
Headers: X-API-Key, X-Tenant-Id (optional), X-Library-Id (optional)
Body: { "title": "...", "rawText": "..." }
Response: DocumentRecord with documentId, status, checksum
```

### 2. Query the knowledge base

```bash
POST /query
Headers: X-API-Key, X-Tenant-Id (optional), X-Library-Id (optional)
Body: { "query": "...", "topK": 8, "libraryIds": ["lib-a", "lib-b"] }
Response: { answer, sourcesUsed, fastContext, truthFacts, model, tokensUsed }
```

## Scoping model

Two hierarchical levels, both optional:

- **`X-Tenant-Id`** — organization isolation (your company, clinic, etc.)
- **`X-Library-Id`** — document grouping within a tenant

### Ingestion scoping

Every document inherits the scope from headers at ingestion time. A document in `library:patient-123` stays there forever.

```
POST /documents/text
X-Tenant-Id: my-clinic
X-Library-Id: patient:abc123
```

### Query scoping

Single library (via header):
```
POST /query
X-Library-Id: patient:abc123
Body: { "query": "..." }
```

Multiple libraries (via body — overrides header):
```
POST /query
Body: { "query": "...", "libraryIds": ["global-medical", "patient:abc123"] }
```

No scope = query entire corpus of the tenant.

## Key behaviors

### Idempotency
Same content (SHA-256) + same tenant + same library = returns existing document without re-processing. Safe to retry on network failures.

### Document statuses
`RECEIVED` → `EMBEDDED` → `READY` (success) or `ERROR` (graph sync failed).
Documents in `ERROR` state have their data in MongoDB but graph sync pending in the outbox.

### Citation format
Answers contain `[CTX-N]` (text chunks) and `[FACT-N]` (graph facts) citations. `sourcesUsed` lists which were actually cited.

### Rate limiting
Endpoints are rate-limited. On `429`, back off and retry. Limits are configurable per deployment.

## Error handling

All errors return:
```json
{ "statusCode": 400, "message": "...", "error": "Bad Request", "timestamp": "...", "path": "..." }
```

Key status codes: `400` (validation), `401` (missing/bad API key), `404` (not found), `429` (rate limit), `500` (internal).

## Endpoint reference

For complete request/response schemas, examples in Python/TypeScript/curl, and all available fields, see:
- [references/endpoints.md](references/endpoints.md) — full endpoint contract summary
