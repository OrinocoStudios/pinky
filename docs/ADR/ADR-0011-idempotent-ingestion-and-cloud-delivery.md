# ADR-0011: Idempotencia fuerte de ingesta y delivery cloud automatizado

- **Estado**: Accepted
- **Fecha**: 2026-04-09
- **Decisores**: Equipo Pinky / Backend / Operaciones

## Contexto

`pinky-mcp` ahora opera en modo `offline-first`: guarda memoria localmente, encola pendientes y vuelve a sincronizar al recuperar conectividad. Ese cambio mejora resiliencia del lado cliente, pero aumenta necesidad de que backend remoto soporte retries y reconexiones sin crear documentos duplicados.

Al mismo tiempo, el proyecto necesita flujo estándar de nube:

1. validar build y tests automáticamente,
2. publicar imagen Docker en un registry estable,
3. desplegar producción en Dokploy sin pasos manuales repetitivos.

Estado previo:

- backend remoto deduplica por checksum en capa aplicación, pero sin garantía dura frente a requests concurrentes,
- Neo4j solo tiene constraint único por `documentId`,
- no existen workflows de GitHub Actions en el repositorio,
- despliegue Dokploy depende de acciones manuales posteriores a publicar imagen.

## Decisión

Adoptar tres decisiones coordinadas.

### 1. Idempotencia fuerte por `ingestKey`

Cada ingesta documental tendrá una clave estable calculada como:

`sha256(tenantId|libraryId|checksum)`

Donde:

- `checksum` representa contenido documental,
- `tenantId` y `libraryId` preservan scoping multi-tenant/multi-library,
- mismo contenido en distinto scope sigue siendo un documento válido distinto.

El backend remoto deberá:

- persistir `ingestKey` en `Document`,
- crear constraint único en Neo4j por `ingestKey`,
- buscar por `ingestKey` antes de crear,
- y, ante colisión concurrente, recuperar documento existente en vez de reprocesar pipeline completo.

### 2. Publicación estándar en GHCR

El contenedor oficial de `pinky` se publicará en `ghcr.io` con tags:

- `main`
- `sha-<commit>`
- `latest` opcional para compatibilidad operativa

`GHCR` se adopta como registry de referencia por integración nativa con GitHub Actions y trazabilidad por commit SHA.

### 3. Auto deploy en Dokploy desde `main`

Cada push o merge a `main` que supere CI debe:

- construir imagen de producción,
- publicarla en GHCR,
- y disparar redeploy en Dokploy por webhook/API.

Se prefiere webhook/API explícita sobre polling, para evitar latencias, problemas de cache y falta de determinismo en despliegue.

## Consecuencias

### Positivas

- Retries y reconexiones desde `pinky-mcp` no duplican documentos en backend remoto.
- Requests concurrentes al mismo documento y mismo scope retornan mismo `documentId`.
- La operación de nube gana trazabilidad por commit y rollback simple por tag SHA.
- Dokploy recibe una fuente de verdad estable y automatizable para producción.

### Negativas

- Requiere auditoría y posible limpieza de duplicados históricos antes de aplicar constraint nuevo.
- Aumenta complejidad de despliegue por introducir workflows, secrets y webhook/API de Dokploy.
- `latest` ya no debe considerarse única referencia operativa.

## Alternativas consideradas

### 1. Mantener idempotencia solo por checksum en capa aplicación

Descartado. No resuelve carreras concurrentes entre requests o réplicas.

### 2. Crear constraint único por `checksum`

Descartado. Rompe caso válido de mismo contenido en `libraryId` o `tenantId` distinto.

### 3. Usar solo tag `latest` en GHCR

Descartado como estrategia principal. Reduce trazabilidad y complica rollback preciso.

### 4. Hacer deploy manual en Dokploy después de cada push

Descartado para flujo principal. Genera fricción operativa y aumenta probabilidad de drift entre código e infraestructura desplegada.

## Plan de implementación derivado

1. Agregar `ingestKey` a modelo y repository de documentos.
2. Auditar y backfillear documentos existentes.
3. Crear constraint único en Neo4j.
4. Añadir tests de idempotencia y colisión concurrente.
5. Crear workflows `ci.yml` y `deploy.yml`.
6. Configurar GHCR y Dokploy con secrets y webhook/API.
7. Ejecutar smoke test E2E con caída/reconexión del MCP y doble ingesta remota.

## Rollback

- Si una release falla, Dokploy debe poder redeplegar `ghcr.io/orinocostudios/pinky:sha-<commit-previo>`.
- Si la migración de `ingestKey` detecta datos inconsistentes, se debe frenar creación de constraint y resolver duplicados antes de continuar.
- El flujo `offline-first` del MCP no debe depender de disponibilidad inmediata del backend; rollback del backend no invalida cola local.

## Referencias

- [Execution Plan](../EXECUTION_PLAN.md)
- [Deploy Dokploy](../DEPLOY_DOKPLOY.md)
- [GitHub Registry](../GITHUB_REGISTRY.md)
- [ADR-0007 - Hardening operacional](./ADR-0007-operational-hardening-security-reliability.md)
