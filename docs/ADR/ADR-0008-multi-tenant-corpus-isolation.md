# ADR-0008: Aislamiento Multi-tenant por corpus (dentro de un solo deployment)

- **Estado**: Accepted (implementación inicial completada)
- **Fecha**: 2026-03-20
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

Hoy el servicio recomienda el patrón **“una instancia por dominio/proyecto”** para evitar mezcla de datos.

Motivo principal:
- la búsqueda híbrida en Mongo se ejecuta sobre candidatos globales (sin filtro por `tenantId/corpusId`);
- la capa de grafo en Neo4j tampoco separa explícitamente entidades/relaciones por tenant/corpus;
- el outbox de sincronización persiste eventos que, si no incluyen tenant/corpus, podrían llevar a escrituras cruzadas entre dominios.

Necesitamos un diseño para permitir un **solo deployment** consumiendo datos de múltiples dominios con separación lógica.

## Estado de implementación

- Implementado:
  - `X-Tenant-Id` requerido cuando `ENABLE_MULTI_TENANT=true`.
  - Persistencia de `tenantId` en documentos/chunks/outbox.
  - Filtros por tenant en ingesta, query, reindex y retry de outbox.
  - Mitigación de IDOR en `DELETE /documents/:id` validando pertenencia por tenant.
- Pendiente:
  - Migración de índices/datos legacy en entornos ya desplegados.
  - Mapeo fuerte API key -> tenant permitido.

## Decisión

### 1. Contrato de API

Introducir un identificador de aislamiento `tenantId` (o `corpusId`) en todas las rutas relevantes:
- Ingesta:
  - `POST /documents/text`
  - `POST /documents/upload`
  - `POST /documents/generate` (cuando aplique)
- Consulta:
  - `POST /query`
- Operación interna:
  - endpoints de reindex/outbox (si se mantiene la API pública)

Forma propuesta:
- Header: `X-Tenant-Id: <string>`
- Alternativa: campo opcional/required en el body DTO (menos ergonómico para algunos clientes).

Regla:
- si `ENABLE_MULTI_TENANT=true`, `X-Tenant-Id` es requerido;
- si está deshabilitado, el sistema conserva comportamiento actual (sin filtro).

### 2. Persistencia en MongoDB

Agregar `tenantId` en los modelos que participan del retrieval:
- `documents.tenantId`
- `chunks.tenantId`
- `graph_sync_outbox.tenantId`

Índices mínimos:
- índice compuesto único para idempotencia por checksum:
  - `unique index { tenantId: 1, checksum: 1 }` (en vez de único solo por checksum)
- índice para búsqueda:
  - `index { tenantId: 1, embedding: 1 }` (o índice vector según motor/config)
  - `index { tenantId: 1, documentId: 1 }`

Ajustes en repositorios:
- `findDocumentByChecksum(checksum)` pasa a `findDocumentByChecksum(tenantId, checksum)`
- `addChunks(...)` y `enqueueGraphSyncEvent(...)` deben incluir `tenantId`

### 3. Separación en Neo4j

Incorporar `tenantId` como propiedad en nodos y relaciones:
- nodos `Document`/`Entity` con `tenantId`
- relaciones `MENTIONS`/`RELATED` con `tenantId`

Restricciones (según modelo actual):
- usar constraints de unicidad con prefijo/compuesto por `tenantId` para evitar colisiones lógicas

Ajustes en queries:
- `findEntitiesByNames(entityNames, tenantId)`
- `findRelationshipsForEntityIds(entityIds, tenantId)`

### 4. Búsqueda y GraphRAG con filtros

Modificar los adaptadores de búsqueda y el pipeline de consulta para que:
- el retrieval textual/vectorial en Mongo filtre por `tenantId`
- los hechos del grafo recuperados desde Neo4j correspondan solo a ese `tenantId`

Con esto el prompt grounded vuelve a estar compuesto por evidencia dentro del mismo corpus.

### 5. Seguridad (API key vs tenant)

Dos estrategias posibles:
1. **Una API key por tenant**: el `ApiKeyGuard` valida la key y mapea a un `tenantId` permitido.
2. **Una API key compartida**: el cliente envía `X-Tenant-Id` y el backend confía el header (menos seguro).

Recomendación:
- estrategia (1) para producción.

## Consecuencias

### Positivas
- Permite consolidar infraestructura y reducir costo.
- Evita mezclas de conocimiento entre dominios.
- Mantiene el contrato de grounding con citaciones `[CTX-X]`/`[FACT-X]` por corpus.

### Negativas / costos
- Requiere migración de esquema (nuevos campos e índices).
- Aumenta la complejidad de consultas y de mantenimiento de índices.
- Impone decisiones adicionales sobre cómo asignar tenants a API keys.

## Plan de implementación (alto nivel)

1. Actualizar DTOs/controllers para leer `X-Tenant-Id` (o body field).
2. Propagar `tenantId` a use cases (`IngestDocumentUseCase`, `GraphRagQueryUseCase`, outbox/index).
3. Actualizar Mongo repositories:
   - filtros por `tenantId`,
   - índices compuestos,
   - idempotencia por `(tenantId, checksum)`.
4. Actualizar Neo4j adapter:
   - añadir `tenantId` al upsert,
   - filtrar en búsquedas de entidades/relaciones.
5. Agregar tests de aislamiento (misma entidad/nombre en tenants distintos).

## Diagrama (flujo propuesto)

```mermaid
flowchart LR
  Cliente[Cliente IA] -->|X-Tenant-Id| API[Brain Service]
  API --> Mongo[MongoDB: documents/chunks (tenantId)]
  API --> Neo4j[Neo4j: entidades/relaciones (tenantId)]
  Mongo --> API
  Neo4j --> API
  API --> Respuesta[Respuesta grounded con citaciones]
```

## Referencias

- Búsqueda en Mongo (candidatos globales hoy):
  - `src/modules/search/infrastructure/mongo/mongo-chunk-search.adapter.ts`
- Pipeline de consulta GraphRAG:
  - `src/modules/query/application/graph-rag-query.usecase.ts`
- Persistencia de ingesta y outbox:
  - `src/modules/ingestion/application/ingest-document.usecase.ts`
- Contrato de API:
  - `docs/API_REFERENCE.md`

