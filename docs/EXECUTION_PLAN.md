# Execution Plan - Pinky Cloud Readiness

## Objetivo

Dejar `pinky` funcional en nube con tres capacidades coordinadas:

- `pinky-mcp` offline-first con cola SQLite y sincronización remota gradual.
- backend remoto con ingesta documental realmente idempotente ante retries y concurrencia.
- pipeline CI/CD con GitHub Actions, publicación en GHCR y despliegue automático vía Dokploy.

## Alcance

Este plan cubre:

- confiabilidad extremo a extremo entre `pinky-mcp` y backend remoto,
- endurecimiento del contrato de ingesta documental,
- automatización de build, test, publicación y despliegue,
- validación operativa y documentación de rollout/rollback.

No cubre en esta iteración:

- nuevos endpoints funcionales ajenos a ingesta/sync,
- rediseño de GraphRAG,
- migraciones de proveedor LLM o arquitectura distinta a `Neo4j-only`.

## Estado actual

### Completado

- Backend remoto `pinky` operativo con `Neo4j-only`.
- API documental base:
  - `GET /health`
  - `POST /documents/text`
  - `POST /documents/upload`
  - `POST /documents/generate`
  - `GET /documents`
  - `DELETE /documents/:id`
  - `POST /query`
- `pinky-mcp` ya soporta escritura local en SQLite, cola `sync_queue`, retries con backoff y lectura combinada local/remoto.
- `docker-compose.prod.yml` ya usa imagen desde `ghcr.io/orinocostudios/pinky` y red `dokploy-network`.

### Pendiente clave

- Idempotencia fuerte en backend remoto: hoy existe dedupe por checksum en capa aplicación, pero no garantía dura frente a carreras concurrentes.
- Auditoría/migración de duplicados históricos antes de aplicar constraint nuevo en Neo4j.
- Workflows GitHub Actions para CI/CD.
- Trigger automático de Dokploy al publicar imagen nueva.
- Validación E2E de caída/reconexión entre MCP y backend remoto.

## Decisiones activas

- Registry de contenedores: `GHCR` (`ghcr.io`).
- Rama de despliegue: `main`.
- Modelo de despliegue: build/test/push en GitHub Actions y auto deploy en Dokploy.
- Estrategia MCP: `offline-first`, con SQLite como source of truth local y remoto como réplica eventual.
- Estrategia backend: idempotencia por `ingestKey = sha256(tenantId|libraryId|checksum)`.

## Roadmap por PR

## PR-1 - MCP Hardening y validación real

### Objetivo

Cerrar operativamente la implementación `offline-first` ya integrada en `pinky-mcp`.

### Tareas

- Probar escenarios reales:
  - backend remoto caído,
  - reconexión,
  - backlog grande,
  - reinicio con cola pendiente,
  - respuestas `429/5xx`.
- Ajustar defaults de sync:
  - `PINKY_SYNC_BATCH_SIZE`
  - `PINKY_SYNC_CONCURRENCY`
  - `PINKY_SYNC_INTERVAL_MS`
  - `PINKY_SYNC_RETRY_BASE_MS`
  - `PINKY_SYNC_RETRY_MAX_MS`
  - `PINKY_SYNC_CLAIM_TTL_MS`
- Validar merge local+remoto sin duplicados visibles.
- Documentar smoke test y parámetros recomendados de producción en `pinky-mcp/README.md`.

### Criterio de salida

- Sin red, MCP sigue guardando local.
- Con red restaurada, la cola drena en lotes chicos sin bloquear herramientas.
- Las lecturas combinadas no muestran duplicados ni pierden contexto reciente.

## PR-2 - Backend idempotente

### Objetivo

Garantizar que retries o requests concurrentes del mismo documento y mismo scope no creen duplicados.

### Tareas

- Extender `Document` con `ingestKey`.
- Calcular `ingestKey = sha256(tenantId|libraryId|checksum)` en ingesta.
- Agregar `findDocumentByIngestKey` al repository.
- Mantener pre-check por `ingestKey` antes de crear documento.
- Intentar creación y, ante violación de constraint, recuperar documento existente y retornarlo.
- Mantener checksum como señal de contenido, no como única garantía de idempotencia.

### Criterio de salida

- Mismo `rawText` y mismo scope retornan mismo `documentId`.
- Mismo `rawText` y distinto `libraryId` pueden coexistir.
- Retry después de timeout o colisión concurrente no dispara pipeline pesado dos veces.

## PR-3 - Auditoría y migración de datos

### Objetivo

Preparar datos existentes antes de habilitar constraint único por `ingestKey`.

### Tareas

- Auditar duplicados actuales por `(tenantId, libraryId, checksum)`.
- Definir política de resolución:
  - conservar primero creado,
  - conservar más reciente,
  - fusionar metadata cuando aplique.
- Hacer backfill de `ingestKey` para documentos existentes.
- Aplicar constraint único solo después de dejar corpus consistente.

### Criterio de salida

- Todos los documentos existentes tienen `ingestKey` válido.
- Constraint único se crea sin errores.

## PR-4 - Tests de confiabilidad

### Objetivo

Blindar comportamiento crítico antes de automatizar despliegue.

### Tareas

- Backend:
  - test de dedupe por `ingestKey`,
  - test de distinto scope,
  - test de colisión concurrente simulada,
  - test de skip del pipeline pesado cuando documento ya existe.
- MCP:
  - test de cola persistente,
  - test de flush parcial,
  - test de retry/backoff,
  - test de merge local+remoto.

### Criterio de salida

- Suite verde para casos críticos de idempotencia y sync.

## PR-5 - CI con GitHub Actions

### Objetivo

Ejecutar calidad mínima automáticamente en PRs y ramas principales.

### Tareas

- Crear `.github/workflows/ci.yml`.
- Ejecutar:
  - `npm ci`
  - `npm run build`
  - `npm test`
  - opcional `npm run lint`
  - `docker build -f Dockerfile.prod`
- Bloquear merges si la validación falla.

### Criterio de salida

- Todo PR tiene señal automática de build/test.

## PR-6 - CD con GHCR + Dokploy

### Objetivo

Construir, publicar y desplegar automáticamente producción desde `main`.

### Tareas

- Usar `.github/workflows/release.yml` (build GHCR + webhooks Dokploy).
- Login en `ghcr.io` usando `GITHUB_TOKEN` o token con permisos `packages`.
- Publicar imagen con tags:
  - `main`
  - `sha-<commit>`
  - opcional `latest`
- Disparar Dokploy por webhook/API tras publicación exitosa.
- Configurar secretos mínimos:
  - `DOKPLOY_WEBHOOK_URL` o credenciales API,
  - permisos de `packages` en GitHub Actions.

### Criterio de salida

- Push a `main` produce imagen nueva y Dokploy redepliega sin paso manual.

## PR-7 - Validación E2E y operación

### Objetivo

Validar flujo completo antes de declarar lista la feature de nube.

### Tareas

- Apagar backend remoto.
- Guardar memoria desde MCP.
- Verificar cola local SQLite.
- Levantar backend remoto.
- Verificar drenaje progresivo de pendientes.
- Ingerir dos veces mismo documento en mismo scope.
- Validar mismo `documentId`.
- Hacer merge a `main`.
- Verificar push a GHCR, redeploy Dokploy y `GET /health`.

### Criterio de salida

- Flujo completo funciona sin intervención manual fuera de observación y smoke checks.

## Dependencias técnicas

- Node.js 20+
- Neo4j 5+
- GitHub Actions habilitado con permisos de `packages`
- GHCR accesible desde Dokploy
- Dokploy con acceso a webhook/API y red `dokploy-network`
- Secrets reales de producción para `API_KEY`, `NEO4J_*`, `OPENAI_*` / `ANTHROPIC_*` / `OLLAMA_*`

## Riesgos y mitigaciones

- Duplicados históricos impiden crear constraint nuevo.
  - Mitigación: auditoría y backfill antes de aplicar constraint.
- Timeout después de ingesta exitosa puede causar retry desde MCP.
  - Mitigación: idempotencia fuerte por `ingestKey` en backend remoto.
- Dokploy puede no redeplegar automáticamente por polling/tag cache.
  - Mitigación: usar webhook/API explícita tras push de imagen.
- Uso de `latest` complica trazabilidad y rollback.
  - Mitigación: desplegar también con tag `sha-<commit>`.

## Rollout checklist

- Constraint de `ingestKey` validado en staging.
- GHCR configurado y accesible desde Dokploy.
- Dokploy con variables y secretos de producción cargados.
- Workflows GitHub verdes.
- Smoke tests MCP y backend ejecutados.
- Healthcheck `GET /health` estable después de deploy.

## Rollback checklist

- Reapuntar `BRAIN_IMAGE` a tag `sha-<commit-anterior>` si una versión falla.
- Reejecutar deploy en Dokploy.
- Mantener cola local MCP intacta durante rollback.
- Si falla constraint nuevo en producción, detener rollout y volver a versión previa antes de forzar migración de datos.

## Cadencia de actualización

- Cada PR de este roadmap debe anotar avance en `CHANGELOG.md`.
- Toda decisión arquitectónica nueva debe registrarse en ADR.
- Este plan se actualiza al cerrar cada PR/fase crítica.
