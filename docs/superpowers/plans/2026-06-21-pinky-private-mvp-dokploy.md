# Pinky Private MVP Dokploy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prepare Pinky for a private Dokploy MVP with API at `https://pinky-api.orinocostudios.org`, web at `https://pinky.orinocostudios.org`, and local `pinky-mcp` sync.

**Architecture:** Keep the existing repo layout. Deploy API + Neo4j with `docker-compose.prod.yml`, deploy the web UI separately with `docker-compose.web.yml`, and keep `pinky-mcp` as a local stdio process that syncs to the deployed API.

**Tech Stack:** NestJS, Vite, nginx, Docker Compose, Dokploy, Neo4j, OpenAI-compatible LLM gateway, shell smoke tests, MCP stdio.

---

## File Structure

- Create `docs/deploy/pinky-private-mvp-dokploy.md`: operator guide for Dokploy setup, domains, variables, smoke tests, and rollback notes.
- Create `docs/deploy/pinky-private-mvp.env.example`: copyable non-secret variable template for the API stack and web stack.
- Create `pinky-mcp/docs/PRIVATE_MVP.md`: local MCP configuration guide for this deployed MVP.
- Modify `scripts/smoke-dokploy.sh`: add optional API-key protected checks without breaking current usage.
- Test `scripts/smoke-dokploy.sh`: shell syntax and local help/error behavior.
- Do not modify application runtime code unless a verification step proves a config gap.

## Task 1: Add Private MVP Environment Template

**Files:**
- Create: `docs/deploy/pinky-private-mvp.env.example`

- [ ] **Step 1: Create the env template**

Create `docs/deploy/pinky-private-mvp.env.example` with:

```env
# Pinky private MVP - Dokploy variables
# Copy the API section into the Dokploy app that uses docker-compose.prod.yml.
# Copy the web section into the Dokploy app that uses docker-compose.web.yml.
# Replace every value wrapped in angle brackets before deploying.

# -----------------------------------------------------------------------------
# API stack: brain-app + neo4j
# -----------------------------------------------------------------------------
PORT=8081
NODE_ENV=production

ENABLE_API_KEY_AUTH=true
ENABLE_MULTI_TENANT=false
API_KEY=<private-long-random-api-key>

NEO4J_USER=neo4j
NEO4J_PASSWORD=<private-long-random-neo4j-password>

CORS_ENABLED=true
CORS_ORIGINS=https://pinky.orinocostudios.org

AUTH_JWT_SECRET=<private-long-random-jwt-secret>
AUTH_ENABLE_OAUTH=false
AUTH_ENABLE_DEV_LOGIN=false
AUTH_COOKIE_NAME=pinky_auth
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
OPENAI_TEMPERATURE=0.2
OPENAI_MAX_TOKENS=8192
OPENAI_TIMEOUT_MS=120000

MAX_FILE_SIZE_MB=50
TOP_K=8
CHUNK_SIZE=1200
CHUNK_OVERLAP=200

# Optional image pinning for rollback.
# BRAIN_IMAGE=ghcr.io/orinocostudios/pinky:latest

# -----------------------------------------------------------------------------
# Web stack
# -----------------------------------------------------------------------------
VITE_API_BASE_URL=https://pinky-api.orinocostudios.org
WEB_PORT=8080

# Optional image pinning for rollback.
# WEB_IMAGE=ghcr.io/orinocostudios/pinky-web:latest
```

- [ ] **Step 2: Verify the file contains no real secrets**

Run:

```bash
rg -n "sk-|ghp_|gho_|AIza|-----BEGIN|password=.*[^>]" docs/deploy/pinky-private-mvp.env.example
```

Expected: no output and exit code `1`.

- [ ] **Step 3: Commit**

```bash
git add docs/deploy/pinky-private-mvp.env.example
git commit -m "docs: add private mvp env template"
```

## Task 2: Add Dokploy Operator Guide

**Files:**
- Create: `docs/deploy/pinky-private-mvp-dokploy.md`
- Read: `docs/superpowers/specs/2026-06-20-pinky-private-mvp-dokploy-design.md`
- Read: `docs/DOKPLOY.md`

- [ ] **Step 1: Create the deployment guide**

Create `docs/deploy/pinky-private-mvp-dokploy.md` with:

```markdown
# Pinky Private MVP on Dokploy

This guide deploys the private Pinky MVP approved in `docs/superpowers/specs/2026-06-20-pinky-private-mvp-dokploy-design.md`.

## Targets

- API: `https://pinky-api.orinocostudios.org`
- Web: `https://pinky.orinocostudios.org`
- API compose file: `docker-compose.prod.yml`
- Web compose file: `docker-compose.web.yml`
- Dokploy external network: `dokploy-network`
- LLM gateway: `http://<public-ipv4>:8080/v1`

## Repository Layout

Keep backend, web, and `pinky-mcp` in this repository for the MVP. Dokploy should create two Compose applications from the same repository:

- `pinky-api`: context `pinky/`, compose `docker-compose.prod.yml`
- `pinky-web`: context `pinky/`, compose `docker-compose.web.yml`

## One-Time Server Prerequisite

Ensure the external proxy network exists on the server:

```bash
./scripts/dokploy-init-network.sh
```

If Dokploy uses a different external network name, update both compose files consistently before deploying.

## API App

1. In Dokploy, create a Docker Compose app named `pinky-api`.
2. Point it at this repository with context path `pinky/`.
3. Set compose file to `docker-compose.prod.yml`.
4. Add the API variables from `docs/deploy/pinky-private-mvp.env.example`.
5. Replace every angle-bracket value with a real private value.
6. Route `https://pinky-api.orinocostudios.org` to service `brain-app`, container port `8081`.
7. Do not expose Neo4j HTTP or Bolt publicly.

Minimum checks after deploy:

```bash
curl -fsS https://pinky-api.orinocostudios.org/health
curl -fsS -H "X-API-Key: <private-long-random-api-key>" https://pinky-api.orinocostudios.org/documents
```

## Web App

1. In Dokploy, create a Docker Compose app named `pinky-web`.
2. Point it at the same repository with context path `pinky/`.
3. Set compose file to `docker-compose.web.yml`.
4. Add the web variables from `docs/deploy/pinky-private-mvp.env.example`.
5. Ensure `VITE_API_BASE_URL=https://pinky-api.orinocostudios.org` is available at build time.
6. Route `https://pinky.orinocostudios.org` to service `web`, container port `80`.

Minimum check after deploy:

```bash
curl -fsS -L https://pinky.orinocostudios.org
```

## Smoke Test

Run from this repo after both apps deploy:

```bash
./scripts/smoke-dokploy.sh https://pinky-api.orinocostudios.org https://pinky.orinocostudios.org <private-long-random-api-key>
```

Expected output:

```text
OK  GET https://pinky-api.orinocostudios.org/health
OK  GET https://pinky-api.orinocostudios.org/documents with API key
OK  GET https://pinky.orinocostudios.org (HTML)
```

## Local MCP

Configure local agents using `../pinky-mcp/docs/PRIVATE_MVP.md` from the sibling `pinky-mcp` package.

## Rollback

If a deploy breaks:

1. Pin `BRAIN_IMAGE` or `WEB_IMAGE` to the last known working tag.
2. Redeploy the affected Dokploy app.
3. Keep Neo4j volumes mounted; do not delete volumes during rollback.

## MVP Limits

- Single private API key.
- `ENABLE_MULTI_TENANT=false`.
- No team access.
- No tenant-scoped API keys.
- No public Neo4j access.
```

- [ ] **Step 2: Verify guide references valid local files**

Run:

```bash
test -f docker-compose.prod.yml
test -f docker-compose.web.yml
test -f docs/deploy/pinky-private-mvp.env.example
test -f scripts/dokploy-init-network.sh
test -f scripts/smoke-dokploy.sh
```

Expected: all commands exit `0`.

- [ ] **Step 3: Commit**

```bash
git add docs/deploy/pinky-private-mvp-dokploy.md
git commit -m "docs: add private mvp dokploy guide"
```

## Task 3: Add Local MCP MVP Guide

**Files:**
- Create: `../pinky-mcp/docs/PRIVATE_MVP.md`
- Read: `../pinky-mcp/docs/INTEGRATION.md`
- Read: `../pinky-mcp/README.md`

- [ ] **Step 1: Create the MCP guide**

Create `../pinky-mcp/docs/PRIVATE_MVP.md` with:

```markdown
# Pinky MCP Private MVP Setup

This package stays local. It runs as a stdio MCP server and syncs memory to the private Pinky API.

## Remote Backend

- API URL: `https://pinky-api.orinocostudios.org`
- Auth: `X-API-Key`
- Tenant: unset for the private MVP

## Build

Run from `pinky-mcp/`:

```bash
npm install
npm run build
```

## Environment

Use absolute paths for local files.

```env
PINKY_BASE_URL=https://pinky-api.orinocostudios.org
PINKY_API_KEY=<private-long-random-api-key>
PINKY_MCP_DB_PATH=/absolute/path/to/pinky-mcp/data/dev-memory.sqlite
DEFAULT_REPO_ROOT=/absolute/path/to/current/workspace
PINKY_DEFAULT_LIBRARY_IDS=mcp:<project>:global
PINKY_SYNC_BATCH_SIZE=3
PINKY_SYNC_CONCURRENCY=1
PINKY_SYNC_INTERVAL_MS=5000
PINKY_SYNC_RETRY_BASE_MS=2000
PINKY_SYNC_RETRY_MAX_MS=60000
PINKY_SYNC_CLAIM_TTL_MS=30000
```

Leave `PINKY_TENANT_ID` unset for this MVP.

## Cursor Example

```json
{
  "mcpServers": {
    "pinky-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/pinky-mcp/dist/index.js"],
      "cwd": "/absolute/path/to/pinky-mcp",
      "env": {
        "DEFAULT_REPO_ROOT": "/absolute/path/to/current/workspace",
        "PINKY_MCP_DB_PATH": "/absolute/path/to/pinky-mcp/data/dev-memory.sqlite",
        "PINKY_BASE_URL": "https://pinky-api.orinocostudios.org",
        "PINKY_API_KEY": "<private-long-random-api-key>",
        "PINKY_DEFAULT_LIBRARY_IDS": "mcp:<project>:global"
      }
    }
  }
}
```

## OpenCode Example

```json
"pinky-mcp": {
  "type": "local",
  "command": [
    "node",
    "/absolute/path/to/pinky-mcp/dist/index.js"
  ],
  "environment": {
    "DEFAULT_REPO_ROOT": "/absolute/path/to/current/workspace",
    "PINKY_MCP_DB_PATH": "/absolute/path/to/pinky-mcp/data/dev-memory.sqlite",
    "PINKY_BASE_URL": "https://pinky-api.orinocostudios.org",
    "PINKY_API_KEY": "<private-long-random-api-key>",
    "PINKY_DEFAULT_LIBRARY_IDS": "mcp:<project>:global"
  },
  "enabled": true,
  "timeout": 10000
}
```

## Verification

1. Restart the MCP client.
2. Run `list_recent_memory`.
3. Save a small decision with `save_decision`.
4. Wait at least one sync interval.
5. Query the backend or web UI to confirm the document exists.

If `query_pinky` is missing, confirm `PINKY_BASE_URL` is set in the MCP process environment.
```

- [ ] **Step 2: Verify no real secrets were added**

Run from `pinky/`:

```bash
rg -n "sk-|ghp_|gho_|AIza|-----BEGIN" ../pinky-mcp/docs/PRIVATE_MVP.md
```

Expected: no output and exit code `1`.

- [ ] **Step 3: Commit**

```bash
git add ../pinky-mcp/docs/PRIVATE_MVP.md
git commit -m "docs: add private mvp mcp setup"
```

## Task 4: Extend Smoke Test for API-Key Endpoint

**Files:**
- Modify: `scripts/smoke-dokploy.sh`

- [ ] **Step 1: Update the smoke script**

Replace `scripts/smoke-dokploy.sh` with:

```sh
#!/usr/bin/env sh
# Comprobaciones smoke contra un despliegue Dokploy (API pública HTTPS y front opcional).
# Uso: ./scripts/smoke-dokploy.sh https://api.ejemplo.com [https://app.ejemplo.com] [api-key]

set -eu

API_URL="${1:-}"
FRONT_URL="${2:-}"
API_KEY="${3:-}"

if [ -z "$API_URL" ]; then
  echo "Uso: $0 <API_BASE_URL> [FRONT_URL] [API_KEY]" >&2
  echo "Ejemplo: $0 https://brain.midominio.com https://app.midominio.com clave-privada" >&2
  exit 1
fi

fail=0
check() {
  desc=$1
  shift
  if "$@"; then
    echo "OK  $desc"
  else
    echo "FAIL $desc" >&2
    fail=1
  fi
}

check "GET $API_URL/health" curl -fsS "$API_URL/health" >/dev/null

if [ -n "$API_KEY" ]; then
  check "GET $API_URL/documents with API key" curl -fsS -H "X-API-Key: $API_KEY" "$API_URL/documents" >/dev/null
fi

if [ -n "$FRONT_URL" ]; then
  check "GET $FRONT_URL (HTML)" curl -fsS -o /dev/null -L "$FRONT_URL"
fi

exit "$fail"
```

- [ ] **Step 2: Verify shell syntax**

Run:

```bash
sh -n scripts/smoke-dokploy.sh
```

Expected: no output and exit code `0`.

- [ ] **Step 3: Verify missing API URL behavior**

Run:

```bash
./scripts/smoke-dokploy.sh
```

Expected: exit code `1`, usage text includes:

```text
Uso: ./scripts/smoke-dokploy.sh <API_BASE_URL> [FRONT_URL] [API_KEY]
```

- [ ] **Step 4: Commit**

```bash
git add scripts/smoke-dokploy.sh
git commit -m "chore: check authenticated dokploy smoke path"
```

## Task 5: Run Local Verification

**Files:**
- Read: `docs/deploy/pinky-private-mvp-dokploy.md`
- Read: `docs/deploy/pinky-private-mvp.env.example`
- Read: `../pinky-mcp/docs/PRIVATE_MVP.md`
- Read: `scripts/smoke-dokploy.sh`

- [ ] **Step 1: Run docs and script checks**

Run:

```bash
sh -n scripts/smoke-dokploy.sh
test -f docs/deploy/pinky-private-mvp-dokploy.md
test -f docs/deploy/pinky-private-mvp.env.example
test -f ../pinky-mcp/docs/PRIVATE_MVP.md
rg -n "pinky-api.orinocostudios.org|pinky.orinocostudios.org" docs/deploy/pinky-private-mvp-dokploy.md docs/deploy/pinky-private-mvp.env.example ../pinky-mcp/docs/PRIVATE_MVP.md
```

Expected: shell syntax passes, files exist, and `rg` prints domain references.

- [ ] **Step 2: Confirm staged worktree scope**

Run:

```bash
git status --short docs/deploy scripts/smoke-dokploy.sh ../pinky-mcp/docs/PRIVATE_MVP.md
```

Expected: only files from this plan appear.

- [ ] **Step 3: Final commit if needed**

If any verification-only correction was made, commit it:

```bash
git add docs/deploy scripts/smoke-dokploy.sh ../pinky-mcp/docs/PRIVATE_MVP.md
git commit -m "docs: finalize private mvp deploy prep"
```

If no correction was made, skip this commit.

## Task 6: Deployment Hand-Off Checklist

**Files:**
- Read: `docs/deploy/pinky-private-mvp-dokploy.md`

- [ ] **Step 1: Prepare values outside git**

Generate or collect these values outside the repository:

```text
API_KEY
NEO4J_PASSWORD
AUTH_JWT_SECRET
public IPv4 for OPENAI_BASE_URL
OPENAI_MODEL
OPENAI_EMBEDDING_MODEL
OPENAI_EXTRACTION_MODEL
OPENAI_API_KEY if the gateway requires one
```

- [ ] **Step 2: Create Dokploy apps manually**

Create:

```text
pinky-api -> docker-compose.prod.yml -> pinky-api.orinocostudios.org -> brain-app:8081
pinky-web -> docker-compose.web.yml -> pinky.orinocostudios.org -> web:80
```

- [ ] **Step 3: Run remote smoke test**

Run after deploy:

```bash
./scripts/smoke-dokploy.sh https://pinky-api.orinocostudios.org https://pinky.orinocostudios.org "$API_KEY"
```

Expected:

```text
OK  GET https://pinky-api.orinocostudios.org/health
OK  GET https://pinky-api.orinocostudios.org/documents with API key
OK  GET https://pinky.orinocostudios.org (HTML)
```

- [ ] **Step 4: Configure local MCP**

Use `../pinky-mcp/docs/PRIVATE_MVP.md`, restart the MCP client, and save one small decision to verify SQLite plus remote sync.
