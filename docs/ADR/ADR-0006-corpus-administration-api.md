# ADR-0006: Administración de corpus por API

- **Estado**: Accepted
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

La Fase 4 del plan de ejecución exige completar el contrato API de administración documental e indexación para que la gestión del corpus sea íntegra por API, sin intervención manual en MongoDB ni Neo4j.

## Decisión

1. **DELETE /documents/:id**: Eliminar documento y toda su huella. Orden: primero Neo4j (entidades con `entityId` que contiene `::documentId::`, relaciones RELATED, nodo Document), luego Mongo (chunks, outbox, documento).

2. **POST /documents/generate**: Puerto `DocumentGeneratorPort` con adaptador `TemplateDocumentGeneratorAdapter` que genera texto según `useCaseId` y parámetros. El resultado se ingesta vía `IngestDocumentUseCase` con `source: { kind: 'generated', useCaseId }`.

3. **POST /index/rebuild** y **POST /index/incremental**: Exponer `ReindexChunksUseCase` por API. Rebuild procesa todos los chunks; incremental solo los que no tienen `embeddingModel` o tienen modelo distinto al actual.

4. **Opcional no implementada**: Ingesta por URL (`POST /documents/ingest-url`) queda pendiente para iteración futura.

## Consecuencias

### Positivas

- Administración completa del corpus por API.
- Eliminación consistente en Mongo y Neo4j.
- Generación de documentos por caso de uso extensible (templates, LLM).
- Reindexación sin scripts manuales.

### Negativas

- `TemplateDocumentGeneratorAdapter` es básico; dominios específicos requerirán adaptadores (ej. Ollama).
- Ingesta por URL no disponible.

## Alternativas consideradas

1. **Eliminar solo en Mongo**: descartado por dejar huérfanos en Neo4j.
2. **Reindexación solo por script**: descartado; el plan exige endpoints HTTP.
3. **Generador LLM obligatorio**: descartado; templates permiten desarrollo sin dependencias externas.

## Referencias

- [EXECUTION_PLAN.md](../EXECUTION_PLAN.md) - Fase 4
- [Fase-4-Administracion-corpus-indice.md](../Fases/Fase-4-Administracion-corpus-indice.md)
