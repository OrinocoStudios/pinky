# ADR-0002: Persistencia Polyglot con MongoDB y Neo4j

- **Estado**: Accepted
- **Fecha**: 2026-02-24
- **Decisores**: Equipo Backend / AI Architecture

## Contexto

El sistema necesita:

- almacenar documentos y chunks para recuperación de contexto rápido;
- mantener hechos verificables y relaciones para grounding y reducción de alucinaciones.

Un único motor no resuelve óptimamente ambos perfiles.

## Decisión

Adoptar persistencia polyglot:

- **MongoDB** como datastore principal de documentos/chunks/outbox.
- **Neo4j** como grafo de verdad para entidades y relaciones.

En esta etapa:

- Mongo persiste `documents`, `chunks`, `graph_sync_outbox`.
- Neo4j persiste nodos `Document`, `Entity` y relaciones `MENTIONS`, `RELATED`.

## Consecuencias

### Positivas

- Optimización por tipo de carga (texto/chunks vs relaciones).
- Escalado independiente por componente.
- Mejor base para GraphRAG.

### Negativas

- Mayor complejidad operativa al mantener dos bases.
- Necesidad de estrategias explícitas de consistencia.

## Alternativas consideradas

1. Solo MongoDB.
2. Solo Neo4j.
3. PostgreSQL único para todo.

Se descartan para esta fase por trade-offs de retrieval híbrida y grafo semántico especializado.
