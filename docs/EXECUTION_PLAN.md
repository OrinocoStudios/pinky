# Execution Plan - Brain Service

## Objetivo

Evolucionar `brain_service` como API independiente por instancia (un servicio por dominio/proyecto), con ingesta documental robusta y consulta GraphRAG con grounding en grafo.

## Fuente base

Este plan consolida y limpia el contexto del plan original `memoria_agnostica_contexto_c6131274.plan.md`, alineándolo al estado real del código en `memory_architecture/brain_service`.

> Nota: este documento contiene contexto historico. La arquitectura vigente ya no es polyglot ni usa outbox; el estado actual del runtime es Neo4j-only.

## Estado actual (alineado a codigo)

### Completado

- API base operativa:
  - `GET /health`
  - `POST /documents/text`
  - `POST /documents/upload`
  - `GET /documents`
  - `POST /outbox/retry`
  - `POST /query`
- Arquitectura hexagonal inicial (domain/application/infrastructure/presentation).
- Persistencia polyglot base:
  - MongoDB para `documents`, `chunks`, `graph_sync_outbox`.
  - Neo4j para `Document`, `Entity`, `MENTIONS`, `RELATED`.
- Ingesta con extracción multi-formato inicial (`txt/md/json/csv/pdf/docx`).
- Consistencia Mongo->Neo4j con outbox + retry.
- Pipeline GraphRAG inicial (`fastContext` + `truthFacts` + prompt grounded).

### Pendiente clave
- Mejorar calidad del grounding (cobertura de extracción, entity hints desde la pregunta y evaluación por lotes).
- Evitar el uso de `LLM_PROVIDER=local` en producción; asegurar providers reales con timeouts/retries y guardrails de salida.
- Afinar DX de integración (documentación breve, CORS configurable y notas de despliegue por instancia).
- Multi-corpus/multi-tenant en un solo deployment (hoy el patrón recomendado sigue siendo una instancia por dominio/proyecto).
- Completar o retirar el adaptador Elasticsearch (actualmente actúa como stub).

## Roadmap por fases

## Fase 1 - Calidad de conocimiento (retrieval y graph extraction)

### Objetivo

Subir precisión de recuperación y grounding con componentes productivos.

### Tareas
- Mejorar el extractor LLM estructurado (schema, validación y cobertura de entidades/relaciones).
- Evaluar y ajustar retrieval/híbrido (parámetros `topK`, `CHUNK_SIZE`/`CHUNK_OVERLAP`, scoring y filtros cuando aplique).
- Usar el versionado existente en metadata (`embedding_model`, `extraction_model`) para comparar resultados entre ingestas.

### Criterio de salida
- `POST /query` logra grounding consistente con citación `[CTX-X]`/`[FACT-X]`.
- El grafo aporta entidades/relaciones trazables por `sourceChunkId` y la calidad se mantiene tras reindexaciones.

## Fase 2 - Respuesta LLM grounded

### Objetivo

Generar respuesta final con adapter LLM real y control de alucinaciones.

### Tareas
- Asegurar que `AnswerGeneratorPort` use el provider real configurado (OpenAI/Anthropic o local solo para dev).
- Mantener la plantilla estricta y calibrar guardrails (evitar conocimiento externo y forzar citación).
- Afinar timeouts/retries/fallbacks por proveedor para reducir latencia y errores.
- (Opcional) Streaming de respuesta (SSE) para UIs chat.

### Criterio de salida
- `POST /query` responde con salida grounded usando el provider real configurado.
- Respuesta incluye evidencia trazable de contexto y grafo con citación por bloque.

## Fase 3 - Hardening operacional

### Objetivo

Preparar servicio para ejecución sostenida por dominio.

### Tareas
- Consolidar seguridad operacional:
  - `ApiKeyGuard` en mutaciones sensibles,
  - `@nestjs/throttler` por tier/endpoint,
  - límites de upload y validación de MIME.
- Observabilidad mínima:
  - logs estructurados,
  - métricas Prometheus (ingesta, errores, latencia, outbox),
  - indicadores de salud consistentes.
- Idempotencia por checksum (ya implementada) y documentación del contrato de error/reintentos.
- (Opcional) CORS configurable según despliegue.

### Criterio de salida
- Servicio listo para producción con seguridad básica, límites y observabilidad accionable.

## Fase 4 - Administración de corpus e índice

### Objetivo

Completar contrato API de administración documental e indexación.

### Tareas

- `POST /documents/generate` para documentos por caso de uso.
- `DELETE /documents/:id` con limpieza en Mongo y Neo4j.
- `POST /index/rebuild` y `POST /index/incremental`.
- Opcional: soporte de ingesta por URL con extracción controlada.

### Criterio de salida

- Administración del corpus es completa por API sin intervención manual de base de datos.

## Fase 5 - Despliegue por instancia/dominio

### Objetivo

Estandarizar despliegue aislado por proyecto (hípica, medicina, etc.).

### Tareas

- Definir plantilla de `.env` por instancia.
- Mantener `docker-compose` por servicio con puertos/volúmenes aislados.
- Documentar onboarding de nueva instancia (bootstrap de datos + validaciones).

### Criterio de salida

- Se pueden levantar dos instancias independientes sin mezcla de datasets ni configuración.

## Dependencias técnicas

- MongoDB (incluyendo estrategia de índice híbrido/vector en entorno final).
- Neo4j 5+.
- Proveedor LLM y proveedor de embeddings.
- Storage de objetos para archivos crudos (filesystem o S3/compatible).

## Riesgos abiertos y mitigaciones

- Calidad de extracción semántica insuficiente:
  - mitigación: evaluación por lote y ajuste de prompts/schema.
- Latencia alta en query por llamada LLM:
  - mitigación: límites de contexto, caché de respuestas, timeout + fallback.
- Divergencia entre Mongo y Neo4j:
  - mitigación: monitoreo de outbox, retries y endpoint manual de reproceso.

## Cadencia de actualización

- Cada cambio implementado debe registrar entrada en `CHANGELOG.md`.
- Toda decisión de arquitectura nueva o cambio de dirección debe crear/actualizar ADR.
- Este plan debe actualizarse al cerrar cada fase.
