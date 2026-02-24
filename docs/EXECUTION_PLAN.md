# Execution Plan - Brain Service

## Objetivo

Evolucionar `brain_service` como API independiente por instancia (un servicio por dominio/proyecto), con ingesta documental robusta y consulta GraphRAG con grounding en grafo.

## Fuente base

Este plan consolida y limpia el contexto del plan original `memoria_agnostica_contexto_c6131274.plan.md`, alineándolo al estado real del código en `memory_architecture/brain_service`.

## Estado actual (alineado a código)

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

- Sustituir embeddings determinísticos por proveedor real.
- Sustituir extractor naive de entidades/relaciones por extractor LLM estructurado.
- Sustituir generador local de respuesta por adapter LLM real.
- Endurecimiento de seguridad/observabilidad y límites operativos.
- Soporte completo de endpoints de administración de índice y generación de documentos por caso de uso.

## Roadmap por fases

## Fase 1 - Calidad de conocimiento (retrieval y graph extraction)

### Objetivo

Subir precisión de recuperación y grounding con componentes productivos.

### Tareas

- Implementar puerto/adaptador de embeddings reales (ej. proveedor externo o modelo local robusto).
- Reindexar `chunks.embedding` con vector real.
- Implementar extractor LLM estructurado para entidades/relaciones con schema fijo.
- Añadir versionado de modelos (`embedding_model`, `extraction_model`) en metadata.

### Criterio de salida

- Consulta `POST /query` usa embeddings reales en búsqueda.
- Grafo contiene relaciones con mejor precisión y trazabilidad por `sourceChunkId`.

## Fase 2 - Respuesta LLM grounded

### Objetivo

Generar respuesta final con adapter LLM real y control de alucinaciones.

### Tareas

- Implementar `AnswerGeneratorPort` con adapter real (OpenAI/Anthropic u otro).
- Definir plantilla de prompt estricta (solo hechos/contexto recuperado).
- Añadir política de citación de fuentes en respuesta.
- Añadir timeout, retries y manejo de errores de proveedor LLM.

### Criterio de salida

- `POST /query` responde con salida grounded usando adapter LLM real.
- Respuesta incluye evidencia trazable de contexto y grafo.

## Fase 3 - Hardening operacional

### Objetivo

Preparar servicio para ejecución sostenida por dominio.

### Tareas

- Implementar autenticación por API key para rutas sensibles.
- Límites de carga (`upload size`, `mime allowlist`, rate limit básico).
- Observabilidad mínima:
  - logs estructurados,
  - métricas de ingesta/reintentos/latencia de query.
- Idempotencia en ingesta por checksum y control de duplicados.

### Criterio de salida

- Servicio protegido por API key y políticas básicas de abuso.
- Métricas y logs permiten diagnóstico de fallos en producción.

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
