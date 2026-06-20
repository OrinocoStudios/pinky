# Pinky Private MVP Dokploy Design

## Goal

Deploy a private MVP of Pinky on Dokploy so local agents can persist and query operational memory through `pinky-mcp`.

The MVP validates the full private loop:

1. Local agent writes memory through `pinky-mcp`.
2. `pinky-mcp` stores locally in SQLite and syncs to Pinky over HTTP.
3. Pinky API stores documents, chunks, graph facts, and chat history in Neo4j.
4. Pinky web provides a human-facing admin/query surface.

## Scope

In scope:

- Deploy Pinky API and Neo4j with `docker-compose.prod.yml`.
- Deploy Pinky web with `docker-compose.web.yml`.
- Publish the API at `https://pinky-api.orinocostudios.org`.
- Publish the front at `https://pinky.orinocostudios.org`.
- Use one private API key for the MVP.
- Keep `ENABLE_MULTI_TENANT=false`.
- Configure the LLM provider through an OpenAI-compatible endpoint at `http://<public-ipv4>:8080/v1`.
- Configure local `pinky-mcp` to use the deployed API.
- Keep the current repository layout for the MVP.

Out of scope:

- Team tenant access.
- Separate tenant API keys.
- Repository split.
- Obsidian automation.
- MongoDB, Redis, and SQLite as server-side stores.
- VPS team onboarding.

## Repository Strategy

Keep the MVP in the existing Pinky repository layout.

Reasons:

- Backend, web, and MCP are still evolving together.
- The web build depends directly on the public API URL.
- The MCP depends on the backend HTTP contract.
- Dokploy can deploy API and web as separate apps from the same repo and context.

Splitting repositories is deferred until team access or independent release cadences create a real need.

## Deployment Architecture

### API Stack

Use `docker-compose.prod.yml`.

Services:

- `brain-app`: Pinky API, exposed through Dokploy at `https://pinky-api.orinocostudios.org`.
- `neo4j`: private graph database on the internal Docker network.

Persistent volumes:

- `brain-neo4j-data`
- `brain-objects`

Networks:

- `dokploy-network`: external network used by Dokploy proxy.
- `brain-internal`: private network for API-to-Neo4j traffic.

### Web Stack

Use `docker-compose.web.yml`.

Service:

- `web`: Vite-built static front served by nginx, exposed through Dokploy at `https://pinky.orinocostudios.org`.

Build-time API URL:

- `VITE_API_BASE_URL=https://pinky-api.orinocostudios.org`

## Runtime Configuration

Minimum production variables for the API stack:

```env
PORT=8081
NODE_ENV=production
ENABLE_API_KEY_AUTH=true
ENABLE_MULTI_TENANT=false
API_KEY=<private-long-random-key>

NEO4J_USER=neo4j
NEO4J_PASSWORD=<private-long-random-password>

CORS_ENABLED=true
CORS_ORIGINS=https://pinky.orinocostudios.org

AUTH_JWT_SECRET=<private-long-random-secret>
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=none
AUTH_SUCCESS_URL=https://pinky.orinocostudios.org
AUTH_FAILURE_URL=https://pinky.orinocostudios.org/login?error=unauthorized

LLM_PROVIDER=openai
OPENAI_BASE_URL=http://<public-ipv4>:8080/v1
OPENAI_API_KEY=<gateway-key-if-required-or-empty>
OPENAI_MODEL=<model-served-by-gateway>
OPENAI_EMBEDDING_MODEL=<embedding-model-served-by-gateway>
OPENAI_EXTRACTION_MODEL=<extraction-model-served-by-gateway>
```

Minimum production variables for the web stack:

```env
VITE_API_BASE_URL=https://pinky-api.orinocostudios.org
WEB_PORT=8080
```

## Local MCP Configuration

`pinky-mcp` stays local and uses stdio. It is not deployed as a public service.

Recommended local environment:

```env
PINKY_BASE_URL=https://pinky-api.orinocostudios.org
PINKY_API_KEY=<same-private-api-key>
PINKY_MCP_DB_PATH=<absolute-local-path>/pinky-mcp/data/dev-memory.sqlite
DEFAULT_REPO_ROOT=<absolute-path-to-active-repo>
PINKY_DEFAULT_LIBRARY_IDS=mcp:<project>:global
PINKY_SYNC_BATCH_SIZE=3
PINKY_SYNC_CONCURRENCY=1
PINKY_SYNC_INTERVAL_MS=5000
PINKY_SYNC_RETRY_BASE_MS=2000
PINKY_SYNC_RETRY_MAX_MS=60000
PINKY_SYNC_CLAIM_TTL_MS=30000
```

For the MVP, `PINKY_TENANT_ID` is optional and should be left unset unless a client requires it for future compatibility.

## Data Flow

1. The local agent calls a `pinky-mcp` tool such as `save_decision`.
2. `pinky-mcp` writes the entry to local SQLite.
3. `pinky-mcp` enqueues remote sync.
4. The sync worker sends the document to Pinky API with `X-API-Key`.
5. Pinky chunks the document, generates embeddings through the configured OpenAI-compatible endpoint, extracts graph facts, and writes to Neo4j.
6. Queries from MCP or web use Pinky API to retrieve grounded context.

## Security Model

MVP security is private but simple:

- One API key protects API consumers.
- HTTPS is handled by Dokploy.
- Neo4j is not exposed publicly.
- CORS allows only `https://pinky.orinocostudios.org`.
- Multi-tenant enforcement is disabled until team access is implemented.

Known limitation:

- A single API key cannot distinguish personal versus team access. This is acceptable for the private MVP and must be addressed before onboarding team users.

## Verification

Initial deployment is considered successful when:

- `GET https://pinky-api.orinocostudios.org/health` returns healthy.
- `https://pinky.orinocostudios.org` loads the web app.
- Browser requests from the front to the API pass CORS.
- A local `pinky-mcp` write succeeds while the backend is reachable.
- The synced document appears in Pinky document listing or can be queried.
- A `query_pinky` call returns an answer with grounded context or a clear provider error if the LLM gateway is misconfigured.

## Follow-Up After MVP

Recommended next steps after the private MVP works:

- Add tenant-scoped API keys before team access.
- Add explicit `personal` and `team` tenant setup.
- Decide whether to keep or split repositories based on actual release friction.
- Add Obsidian export/import as a human-readable knowledge layer.
- Add backup policy for Neo4j and object storage volumes.
