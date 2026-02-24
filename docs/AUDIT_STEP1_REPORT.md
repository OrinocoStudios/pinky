# Step 1: Codebase Audit & Architectural Alignment

**Fecha:** 2025-02-24  
**Alcance:** brain_service - Hexagonal Architecture, Outbox Pattern, Error Handling, DTOs, TypeScript

---

## 1. Resumen Ejecutivo

| Área | Estado | Hallazgos |
|------|--------|-----------|
| Hexagonal Architecture | ✅ Cumple | Sin fugas de infraestructura en Domain/Application |
| Outbox Pattern | ⚠️ Mejorable | Robustez ante fallos parciales y concurrencia |
| DI / Providers | ⚠️ Crítico | `MongoDatabaseService` no está en `providers` |
| DTOs / Validación | ⚠️ Parcial | `source` en IngestTextDocumentDto sin validación estructural |
| Error Handling | ⚠️ Básico | Sin Exception Filter global |
| TypeScript / Build | ❌ Falla | TS2532 en `documents.controller.ts` |
| Seguridad | ⚠️ Parcial | IndexController sin `@RequireApiKey()` |

---

## 2. Hexagonal Architecture

### 2.1 Cumplimiento por capa

| Capa | Ubicación | Estado | Detalle |
|------|-----------|--------|---------|
| **Domain** | `*/domain/` | ✅ | Solo interfaces (Ports), modelos, tipos. Sin imports de mongoose, neo4j, axios |
| **Application** | `*/application/` | ✅ | Use Cases dependen únicamente de Ports inyectados |
| **Infrastructure** | `*/infrastructure/` | ✅ | Mongoose en `mongo-database.service.ts`, Neo4j en `neo4j-graph-store.adapter.ts` |
| **Presentation** | `*/presentation/` | ✅ | Controllers y DTOs, dependencias NestJS |

### 2.2 Mapeo Puertos → Adaptadores

| Token | Puerto | Adaptador(es) | Configuración |
|-------|--------|---------------|---------------|
| `DOCUMENT_REPOSITORY` | DocumentRepositoryPort | MongoDocumentRepository | useClass |
| `CHUNK_SEARCH_PORT` | ChunkSearchPort | MongoChunkSearchAdapter, ElasticsearchChunkSearchAdapter | Factory (app.searchEngine) |
| `GRAPH_STORE_PORT` | GraphStorePort | Neo4jGraphStoreAdapter | useClass |
| `FILE_TEXT_EXTRACTOR_PORT` | FileTextExtractorPort | DefaultFileTextExtractorAdapter | useExisting |
| `ANSWER_GENERATOR_PORT` | AnswerGeneratorPort | Local, OpenAI, Anthropic | Factory (llm.provider) |
| `EMBEDDING_PORT` | EmbeddingPort | OllamaEmbeddingAdapter | useExisting |
| `GRAPH_EXTRACTOR_PORT` | GraphExtractorPort | OllamaGraphExtractorAdapter | useExisting |
| `DOCUMENT_GENERATOR_PORT` | DocumentGeneratorPort | TemplateDocumentGeneratorAdapter | useExisting |

### 2.3 Violaciones detectadas

**Ninguna.** Mongoose y neo4j-driver están únicamente en capa Infrastructure.

---

## 3. Outbox Pattern

### 3.1 Flujo actual

1. **Ingesta** (`IngestDocumentUseCase`): Tras extraer el grafo → `enqueueGraphSyncEvent()` → `upsertGraph()` → `markGraphSyncEvent(SYNCED)` → `updateDocumentStatus(READY)`.
2. **Retry** (`GraphSyncRetryService`): Cada 30s procesa hasta 20 eventos PENDING/FAILED con `attempts < 10`.

### 3.2 Robustez

| Aspecto | Estado | Riesgo |
|---------|--------|--------|
| **Neo4j caído** | ✅ OK | Evento queda en outbox; retry lo procesará cuando Neo4j vuelva |
| **Orden de operaciones en retry** | ⚠️ | Si `markGraphSyncEvent` falla tras `upsertGraph` exitoso → evento se reintentará → duplicación en Neo4j |
| **Idempotencia Neo4j** | ✅ | `upsertGraph` usa MERGE → idempotente por `entityId` |
| **Concurrencia multi-instancia** | ⚠️ | Sin locking: dos pods pueden procesar el mismo evento |
| **Atomicidad** | ⚠️ | `markGraphSyncEvent` y `updateDocumentStatus` no son transaccionales |

### 3.3 Recomendaciones Outbox

1. **Locking**: Usar `findOneAndUpdate` con condición para "claim" el evento (p. ej. `attempts < 10 AND status IN (...)`) y actualizar `attempts` en la misma operación para evitar doble procesamiento.
2. **Orden de actualización**: Considerar marcar SYNCED antes de `updateDocumentStatus` si falla el segundo; el retry no reintentaría (evento ya SYNCED). Alternativa: hacer ambas en una transacción MongoDB si aplica.
3. **Deadletter**: Eventos con `attempts >= 10` deberían moverse a una colección de deadletter o marcarse explícitamente para alertas.

---

## 4. Dependency Injection

### 4.1 🔴 CRÍTICO: MongoDatabaseService no registrado

**Archivo:** `src/app.module.ts`

`MongoDatabaseService` es inyectado por:
- `MongoDocumentRepository`
- `MongoChunkSearchAdapter`

pero **no está en el array `providers`** de `AppModule`. NestJS puede fallar al resolver dependencias con:

```
Nest can't resolve dependencies of MongoDocumentRepository (?)
```

**Acción:** Añadir `MongoDatabaseService` a `providers` en `app.module.ts`.

---

## 5. DTOs y Validación

### 5.1 DTOs con class-validator

| DTO | Validación | Estado |
|-----|------------|--------|
| `IngestTextDocumentDto` | `rawText`, `title`, `metadata` | ⚠️ `source` sin validación estructural |
| `UploadDocumentDto` | `title`, `metadata` | ⚠️ `source` no aplica |
| `GenerateDocumentDto` | `useCaseId`, `title`, `params` | ✅ |
| `QueryDto` | `query`, `entityHints`, `topK` (1–50) | ✅ |
| `ReindexDto` | `limit` (1–50000) | ✅ |
| `RetryOutboxDto` | `limit` (1–200) | ✅ |

### 5.2 IngestTextDocumentDto – `source`

`source` es `DocumentRecord['source']` (union de `upload` | `url` | `generated`). Tiene `@IsOptional()` pero no `@ValidateNested()` ni validación de estructura. Un payload malformado puede pasar.

**Recomendación:** Crear `DocumentSourceDto` con `@ValidateNested()` y `@IsIn(['upload','url','generated'])` para `kind`, y validar campos según `kind`.

---

## 6. Error Handling

### 6.1 Estado actual

- No hay `ExceptionFilter` global.
- Use Cases usan `InternalServerErrorException` (ej. `IngestDocumentUseCase`).
- Controllers lanzan `BadRequestException` cuando corresponde.
- Validación automática con `ValidationPipe` (whitelist, forbidNonWhitelisted, transform).

### 6.2 Recomendación

Implementar un `HttpExceptionFilter` global que:
- Formatee errores en JSON.
- Registre errores 5xx en logs.
- Mantenga mensajes genéricos en producción para errores internos.

---

## 7. TypeScript y Build

### 7.1 Error actual

```
src/modules/documents/presentation/documents.controller.ts:110:25 - error TS2532: Object is possibly 'undefined'.
```

**Archivo:** `documents.controller.ts` línea 110

```typescript
const allowed = this.allowedMimeTypes!;
```

`allowedMimeTypes` puede ser `undefined` si `appConfig` no tiene `allowedMimeTypes`; el `!` no es suficiente para el compilador estricto.

**Solución:** Usar fallback: `this.allowedMimeTypes ?? []` o asegurar que siempre exista en el constructor.

---

## 8. Seguridad y Endpoints

### 8.1 Protección por API Key

| Endpoint | @RequireApiKey | Comentario |
|----------|----------------|------------|
| `POST /documents/text` | ✅ | |
| `POST /documents/generate` | ✅ | |
| `POST /documents/upload` | ✅ | |
| `DELETE /documents/:id` | ✅ | |
| `GET /documents` | ❌ | Lectura; posiblemente intencional |
| `POST /query` | ✅ | |
| `POST /outbox/retry` | ✅ | |
| `POST /index/rebuild` | ❌ | **Crítico** – operación costosa sin protección |
| `POST /index/incremental` | ❌ | **Crítico** – operación costosa sin protección |

**Recomendación:** Añadir `@RequireApiKey()` a `POST /index/rebuild` y `POST /index/incremental`.

---

## 9. Configuración y process.env

Según `.cursorrules`, no usar `process.env` directamente en lógica de aplicación.

| Archivo | Uso | Estado |
|---------|-----|--------|
| `config/configuration.ts` | Carga de configuración | ✅ Aceptable |
| `main.ts` | `process.env.PORT` | ⚠️ Debería usar `ConfigService` o `configuration().app.port` |
| `scripts/reindex-chunks.ts` | `process.env.REINDEX_LIMIT` | ⚠️ Script standalone; aceptable si se documenta |

---

## 10. Archivos a inspeccionar en Step 2 (Repair)

| Prioridad | Archivo | Acción |
|-----------|---------|--------|
| P0 | `app.module.ts` | Añadir `MongoDatabaseService` a providers |
| P0 | `documents.controller.ts` | Corregir TS2532 y uso de `allowedMimeTypes` |
| P1 | `index.controller.ts` | Añadir `@RequireApiKey()` a rebuild e incremental |
| P1 | `graph-sync-retry.service.ts` | Evaluar locking para evitar doble procesamiento |
| P2 | `documents.dto.ts` | Validar estructura de `source` |
| P2 | `main.ts` | Usar ConfigService para PORT |
| P2 | (nuevo) | Crear HttpExceptionFilter global |

---

## 11. Conclusión

La arquitectura hexagonal se respeta y el Outbox está bien planteado. Los puntos críticos son:

1. **Registrar `MongoDatabaseService`** en `app.module.ts`.
2. **Corregir el error de TypeScript** en `documents.controller.ts`.
3. **Proteger endpoints de índice** con `@RequireApiKey()`.
4. **Reforzar el Outbox** con locking para entornos multi-instancia.

Una vez aplicadas las correcciones P0 y P1, el código estará listo para avanzar al Step 2 (Repair & Refactor) y luego al Step 3 (Operational Hardening).
