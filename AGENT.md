# Pinky — Agent Rules

## What is this project

Pinky is a generic GraphRAG engine. It ingests documents, chunks them, generates embeddings (Ollama), extracts a knowledge graph (Ollama), persists everything in Neo4j, and answers questions with grounded citations via LLM (OpenAI/Anthropic/local).

It is NOT a business application. Business logic (patients, trading strategies, etc.) lives in consuming services that call Pinky via HTTP.

## Architecture — strict hexagonal

Every module follows this layout:

```
src/modules/<module>/
├── domain/models/       # Types, interfaces — zero external deps
├── domain/ports/        # Contracts (interfaces) that infrastructure implements
├── application/         # Use cases — orchestrate ports, never import infrastructure
├── infrastructure/      # Adapters (neo4j, ollama, openai, anthropic, etc.)
└── presentation/        # Controllers + DTOs — HTTP layer only
```

### Rules

- **Domain MUST NOT import infrastructure.** Use cases depend on ports (interfaces), never on adapters.
- **Ports live in `domain/ports/`.** One file per port. Named `<concept>.port.ts`.
- **Adapters live in `infrastructure/<provider>/`.** Named `<provider>-<concept>.adapter.ts`.
- **DI tokens** are in `src/shared/di.tokens.ts` — one `Symbol` per port. Wiring happens in `src/app.module.ts`.
- **DTOs** use `class-validator` decorators. Always `whitelist: true, forbidNonWhitelisted: true`.
- **New optional fields** must be backward-compatible: existing API consumers must not break.

## Scoping model

Two optional hierarchical scopes propagated everywhere:

- `tenantId?: string` — organization-level isolation (header `X-Tenant-Id`)
- `libraryId?: string` — corpus grouping within a tenant (header `X-Library-Id`)

When adding a new feature that touches documents/chunks/graph, always propagate both scopes.

## Key patterns

- **Neo4j-only persistence** — `Document`, `Chunk`, `Entity` y `ChatMessage` viven en un unico backend.
- **Checksum idempotency** — SHA-256 of content, scoped by `tenantId + libraryId`.
- **Provider factory** — `LLM_PROVIDER` selects adapters at boot via factory in `app.module.ts`.

## Validation checklist (before committing)

1. `npm run build` — must pass with zero errors
2. `npm run test:e2e` — all suites must pass
3. New ports/adapters must be registered in `src/shared/di.tokens.ts` and wired in `src/app.module.ts`
4. New optional fields in models/ports must not break existing callers (default to `undefined`)
5. Test helpers (`test/test-helpers.ts`) must implement any new port methods in the in-memory mocks

## Do NOT

- Commit without running build + tests
- Add business logic (patients, roles, sessions) to Pinky — that belongs in the consuming service
- Import infrastructure from domain or application layers
- Create new configuration flags unless strictly necessary — prefer additive optional fields
- Modify existing port signatures in a breaking way without updating all adapters, use cases, and mocks

## Documentation

Update when making changes:

- `docs/API_REFERENCE.md` — endpoint contracts
- `docs/CHANGELOG.md` — every implementation change
- `docs/INTEGRATION_GUIDE.md` — if the change affects consumers
- `docs/ADR/` — for architectural decisions

## Tech stack reference

- NestJS 11 / TypeScript 5.6 / Node 20
- Neo4j (neo4j-driver 5.26) — documents, chunks, knowledge graph y chat history
- Ollama — embeddings (`nomic-embed-text`) + graph extraction (`llama3.2`)
- OpenAI / Anthropic — answer generation
- Prometheus (`@willsoto/nestjs-prometheus`) — metrics at `/metrics`
- `@nestjs/throttler` — rate limiting
